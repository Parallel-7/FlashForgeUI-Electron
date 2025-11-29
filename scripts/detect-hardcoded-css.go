package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"
)

// Tool metadata for usage instructions.
const description = `
detect-hardcoded-css scans the workspace for color literals that are not routed
through the theme editor CSS variables. It highlights candidates that still use
hex values, rgb()/hsl() functions, gradients, or named colors without relying on
var(--theme-*) custom properties.
`

const (
	matchKindHex      = "hex"
	matchKindRGB      = "rgb"
	matchKindHSL      = "hsl"
	matchKindGradient = "gradient"
	matchKindNamed    = "named"
)

var (
	hexColorPattern      = regexp.MustCompile(`#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b`)
	rgbColorPattern      = regexp.MustCompile(`(?i)rgba?\([^)]*\)`)
	hslColorPattern      = regexp.MustCompile(`(?i)hsla?\([^)]*\)`)
	namedColorPattern    = regexp.MustCompile(`(?i)\b(white|black|red|blue|green|yellow|purple|orange|pink|gray|grey|silver|maroon|teal|navy|lime|olive|aqua|fuchsia|transparent)\b`)
	lineCommentExtension = buildSet(".ts,.tsx,.js,.jsx,.cts,.mts,.cjs,.mjs,.html,.htm", ",")
)

type match struct {
	Value  string
	Reason string
	Kind   string
}

type finding struct {
	FilePath string
	Line     int
	Text     string
	Matches  []match
}

type detectionOptions struct {
	allowedKinds map[string]struct{}
	lineContains string
}

type scanConfig struct {
	root         string
	extensions   map[string]struct{}
	ignoreDirs   map[string]struct{}
	includePaths []string
	excludePaths []string
	workerCount  int
	options      detectionOptions
	whitelist    *whitelist
}

type whitelistConfig struct {
	Version         string                `json:"version"`
	GlobalPatterns  []globalPattern       `json:"globalPatterns"`
	FileWhitelists  []fileWhitelist       `json:"fileWhitelists"`
}

type globalPattern struct {
	Pattern string `json:"pattern"`
	Reason  string `json:"reason"`
}

type fileWhitelist struct {
	Path     string `json:"path"`
	Lines    []int  `json:"lines,omitempty"`
	Pattern  string `json:"pattern,omitempty"`
	Contains string `json:"contains,omitempty"`
	Reason   string `json:"reason"`
}

type whitelist struct {
	globalPatterns map[string]string // pattern -> reason
	fileRules      map[string][]fileWhitelist
}

type scanResult struct {
	findings     []finding
	filesScanned int
	linesScanned int
}

type fileTask struct {
	path        string
	displayPath string
}

type fileAnalysis struct {
	findings     []finding
	linesScanned int
}

type fileAnalysisResult struct {
	analysis fileAnalysis
	err      error
}

func main() {
	root := flag.String("root", ".", "workspace path to scan")
	extensions := flag.String("ext", ".css,.scss,.less,.ts,.tsx,.js,.jsx,.cts,.mts,.cjs,.mjs,.html", "comma-separated extensions to include")
	ignoreList := flag.String("ignore", "node_modules,.git,dist,build,out,.next,.turbo,coverage,docs/assets", "comma-separated directories to skip entirely")
	includePathsFlag := flag.String("path-include", "", "comma-separated substrings; only files whose relative path contains one of these are scanned")
	excludePathsFlag := flag.String("path-exclude", "", "comma-separated substrings; files whose relative path contains any of these are skipped")
	matchTypesFlag := flag.String("match-types", "", "comma-separated match kinds to include (hex,rgb,hsl,gradient,named)")
	lineContainsFlag := flag.String("line-contains", "", "only report matches whose source line contains this case-insensitive substring")
	workersFlag := flag.Int("workers", runtime.NumCPU(), "number of worker goroutines to run in parallel")
	summaryOnly := flag.Bool("summary", false, "only print summary statistics instead of every finding")
	showDescription := flag.Bool("help-details", false, "print extended description")
	whitelistPath := flag.String("whitelist", "scripts/css-scanner-whitelist.json", "path to whitelist config file")

	flag.Parse()

	if *showDescription {
		fmt.Print(strings.TrimSpace(description) + "\n\n")
	}

	absRoot, err := filepath.Abs(*root)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to resolve root path: %v\n", err)
		os.Exit(1)
	}

	workerCount := *workersFlag
	if workerCount <= 0 {
		workerCount = runtime.NumCPU()
	}

	matchKinds, err := parseMatchTypes(*matchTypesFlag)
	if err != nil {
		fmt.Fprintf(os.Stderr, "invalid match types: %v\n", err)
		os.Exit(1)
	}

	lineContains := strings.ToLower(strings.TrimSpace(*lineContainsFlag))

	// Load whitelist if exists
	wl, err := loadWhitelist(*whitelistPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "warning: failed to load whitelist: %v\n", err)
	}

	cfg := scanConfig{
		root:         absRoot,
		extensions:   buildSet(*extensions, ","),
		ignoreDirs:   buildSet(*ignoreList, ","),
		includePaths: buildList(*includePathsFlag, ","),
		excludePaths: buildList(*excludePathsFlag, ","),
		workerCount:  workerCount,
		whitelist:    wl,
		options: detectionOptions{
			allowedKinds: matchKinds,
			lineContains: lineContains,
		},
	}

	fmt.Printf("Starting hard-coded CSS scan in %s with %d workers...\n", absRoot, workerCount)
	start := time.Now()

	result, err := scanWorkspace(cfg)
	elapsed := time.Since(start)
	if err != nil {
		fmt.Fprintf(os.Stderr, "scan error: %v\n", err)
		os.Exit(1)
	}

	printResults(result, elapsed, *summaryOnly)
}

func loadWhitelist(path string) (*whitelist, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil // No whitelist is fine
		}
		return nil, err
	}

	var cfg whitelistConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("invalid whitelist JSON: %w", err)
	}

	wl := &whitelist{
		globalPatterns: make(map[string]string),
		fileRules:      make(map[string][]fileWhitelist),
	}

	// Index global patterns
	for _, gp := range cfg.GlobalPatterns {
		wl.globalPatterns[strings.ToLower(gp.Pattern)] = gp.Reason
	}

	// Index file rules by normalized path
	for _, fw := range cfg.FileWhitelists {
		normalizedPath := normalizeForMatch(fw.Path)
		wl.fileRules[normalizedPath] = append(wl.fileRules[normalizedPath], fw)
	}

	return wl, nil
}

func parseMatchTypes(raw string) (map[string]struct{}, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}

	validKinds := map[string]struct{}{
		matchKindHex:      {},
		matchKindRGB:      {},
		matchKindHSL:      {},
		matchKindGradient: {},
		matchKindNamed:    {},
	}

	items := strings.Split(raw, ",")
	set := make(map[string]struct{}, len(items))
	for _, item := range items {
		kind := strings.ToLower(strings.TrimSpace(item))
		if kind == "" {
			continue
		}
		if _, ok := validKinds[kind]; !ok {
			return nil, fmt.Errorf("unknown match kind %q", kind)
		}
		set[kind] = struct{}{}
	}

	if len(set) == 0 {
		return nil, errors.New("no valid match kinds supplied")
	}

	return set, nil
}

func printResults(result scanResult, elapsed time.Duration, summaryOnly bool) {
	totalMatches := 0
	kindCounts := map[string]int{
		matchKindHex:      0,
		matchKindRGB:      0,
		matchKindHSL:      0,
		matchKindGradient: 0,
		matchKindNamed:    0,
	}
	uniqueFiles := make(map[string]struct{})

	for _, f := range result.findings {
		uniqueFiles[f.FilePath] = struct{}{}
		for _, m := range f.Matches {
			totalMatches++
			kindCounts[m.Kind]++
		}
	}

	if totalMatches == 0 {
		fmt.Printf("Scan complete in %s. Files scanned: %d; lines inspected: %d.\n", elapsed, result.filesScanned, result.linesScanned)
		fmt.Println("No obvious hard-coded CSS color tokens were detected.")
		return
	}

	if !summaryOnly {
		fmt.Printf("Detected %d potential hard-coded CSS color tokens across %d files.\n\n", totalMatches, len(uniqueFiles))
		for _, f := range result.findings {
			fmt.Printf("%s:%d\n", f.FilePath, f.Line)
			fmt.Printf("  %s\n", strings.TrimSpace(f.Text))
			for _, m := range f.Matches {
				fmt.Printf("    -> %s (%s)\n", m.Value, m.Reason)
			}
			fmt.Println()
		}
	}

	fmt.Printf("Summary: %d matches across %d files (scanned %d files / %d lines) in %s.\n",
		totalMatches, len(uniqueFiles), result.filesScanned, result.linesScanned, elapsed)
	fmt.Printf("  hex=%d rgb=%d hsl=%d gradient=%d named=%d\n",
		kindCounts[matchKindHex], kindCounts[matchKindRGB], kindCounts[matchKindHSL], kindCounts[matchKindGradient], kindCounts[matchKindNamed])
}

func scanWorkspace(cfg scanConfig) (scanResult, error) {
	tasks, err := collectFileTasks(cfg)
	if err != nil {
		return scanResult{}, err
	}

	if len(tasks) == 0 {
		return scanResult{}, nil
	}

	jobCh := make(chan fileTask)
	resultCh := make(chan fileAnalysisResult)

	var wg sync.WaitGroup
	for i := 0; i < cfg.workerCount; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for task := range jobCh {
				analysis, err := analyzeFile(task, cfg.options, cfg.whitelist)
				resultCh <- fileAnalysisResult{analysis: analysis, err: err}
			}
		}()
	}

	go func() {
		for _, task := range tasks {
			jobCh <- task
		}
		close(jobCh)
	}()

	go func() {
		wg.Wait()
		close(resultCh)
	}()

	var (
		allFindings  []finding
		linesScanned int
		firstErr     error
	)

	for res := range resultCh {
		if res.err != nil && firstErr == nil {
			firstErr = res.err
			continue
		}
		linesScanned += res.analysis.linesScanned
		if len(res.analysis.findings) > 0 {
			allFindings = append(allFindings, res.analysis.findings...)
		}
	}

	sort.Slice(allFindings, func(i, j int) bool {
		if allFindings[i].FilePath == allFindings[j].FilePath {
			return allFindings[i].Line < allFindings[j].Line
		}
		return allFindings[i].FilePath < allFindings[j].FilePath
	})

	return scanResult{
		findings:     allFindings,
		filesScanned: len(tasks),
		linesScanned: linesScanned,
	}, firstErr
}

func collectFileTasks(cfg scanConfig) ([]fileTask, error) {
	var tasks []fileTask

	err := filepath.WalkDir(cfg.root, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}

		relPath := relativePath(cfg.root, path)
		normalizedRel := normalizeForMatch(relPath)

		if entry.IsDir() {
			if shouldIgnoreDir(entry.Name(), cfg.ignoreDirs) || matchesAny(normalizedRel, cfg.excludePaths) {
				return filepath.SkipDir
			}
			return nil
		}

		if !shouldInspectFile(path, cfg.extensions) {
			return nil
		}

		if !shouldProcessPath(normalizedRel, cfg.includePaths, cfg.excludePaths) {
			return nil
		}

		tasks = append(tasks, fileTask{
			path:        path,
			displayPath: filepath.ToSlash(relPath),
		})

		return nil
	})
	if err != nil {
		return nil, err
	}

	return tasks, nil
}

func analyzeFile(task fileTask, opts detectionOptions, wl *whitelist) (fileAnalysis, error) {
	file, err := os.Open(task.path)
	if err != nil {
		return fileAnalysis{}, err
	}
	defer file.Close()

	var findings []finding

	scanner := bufio.NewScanner(file)
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, 1024*1024)

	lineNumber := 0
	lineCommentAware := supportsLineComments(task.path)

	for scanner.Scan() {
		lineNumber++
		line := scanner.Text()
		lineForDetection := removeBlockComments(line)
		if lineCommentAware {
			lineForDetection = stripLineComment(lineForDetection)
		}
		if shouldSkipLine(lineForDetection) {
			continue
		}

		lineMatches := detectMatches(lineForDetection, opts.allowedKinds)
		if len(lineMatches) == 0 {
			continue
		}

		// Filter whitelisted patterns
		if wl != nil {
			lineMatches = filterWhitelisted(lineMatches, task.displayPath, lineNumber, line, wl)
			if len(lineMatches) == 0 {
				continue
			}
		}

		if opts.lineContains != "" {
			lineLower := strings.ToLower(line)
			if !strings.Contains(lineLower, opts.lineContains) {
				continue
			}
		}

		findings = append(findings, finding{
			FilePath: task.displayPath,
			Line:     lineNumber,
			Text:     line,
			Matches:  lineMatches,
		})
	}

	if err := scanner.Err(); err != nil {
		return fileAnalysis{}, err
	}

	return fileAnalysis{
		findings:     findings,
		linesScanned: lineNumber,
	}, nil
}

func filterWhitelisted(matches []match, filePath string, lineNum int, lineText string, wl *whitelist) []match {
	var filtered []match
	normalizedPath := normalizeForMatch(filePath)

	for _, m := range matches {
		// Check global patterns first
		if _, ok := wl.globalPatterns[strings.ToLower(m.Value)]; ok {
			continue // Skip this match, it's whitelisted globally
		}

		// Check file-specific rules
		if rules, ok := wl.fileRules[normalizedPath]; ok {
			whitelisted := false
			for _, rule := range rules {
				// Line-based whitelist
				if len(rule.Lines) > 0 {
					for _, wlLine := range rule.Lines {
						if lineNum == wlLine {
							whitelisted = true
							break
						}
					}
				}

				// Line range whitelist (if Lines has 2 elements, treat as range)
				if len(rule.Lines) == 2 && lineNum >= rule.Lines[0] && lineNum <= rule.Lines[1] {
					whitelisted = true
				}

				// Pattern-based whitelist
				if rule.Pattern != "" && strings.Contains(strings.ToLower(m.Value), strings.ToLower(rule.Pattern)) {
					whitelisted = true
				}

				// Contains-based whitelist (check if line contains specific substring)
				if rule.Contains != "" && strings.Contains(strings.ToLower(lineText), strings.ToLower(rule.Contains)) {
					whitelisted = true
				}

				if whitelisted {
					break
				}
			}

			if whitelisted {
				continue // Skip this match
			}
		}

		// Not whitelisted, keep it
		filtered = append(filtered, m)
	}

	return filtered
}

func detectMatches(line string, allowedKinds map[string]struct{}) []match {
	var matches []match

	collectMatches := func(pattern *regexp.Regexp, reason string, kind string) {
		if allowedKinds != nil {
			if _, ok := allowedKinds[kind]; !ok {
				return
			}
		}
		locs := pattern.FindAllStringIndex(line, -1)
		for _, loc := range locs {
			if isInsideVarCall(line, loc[0]) {
				continue
			}
			value := line[loc[0]:loc[1]]
			matches = append(matches, match{Value: value, Reason: reason, Kind: kind})
		}
	}

	collectMatches(hexColorPattern, "hex color literal", matchKindHex)
	collectMatches(rgbColorPattern, "rgb/rgba color function", matchKindRGB)
	collectMatches(hslColorPattern, "hsl/hsla color function", matchKindHSL)

	if allowedKinds == nil || hasKind(allowedKinds, matchKindGradient) {
		matches = append(matches, collectGradientMatches(line)...)
	}

	if allowedKinds == nil {
		matches = append(matches, collectNamedColorMatches(line)...)
	} else {
		if _, ok := allowedKinds[matchKindNamed]; ok {
			matches = append(matches, collectNamedColorMatches(line)...)
		}
	}

	return matches
}

func collectNamedColorMatches(line string) []match {
	var matches []match
	commentIdx := findLineCommentIndex(line)
	namedIndexes := namedColorPattern.FindAllStringIndex(line, -1)
	for _, loc := range namedIndexes {
		if commentIdx != -1 && loc[0] >= commentIdx {
			continue
		}
		if !looksLikePropertyContext(line, loc[0]) || isInsideVarCall(line, loc[0]) {
			continue
		}
		value := line[loc[0]:loc[1]]
		matches = append(matches, match{Value: value, Reason: "named color literal", Kind: matchKindNamed})
	}
	return matches
}

func collectGradientMatches(line string) []match {
	var matches []match
	lowered := strings.ToLower(line)
	keywords := []string{"linear-gradient(", "radial-gradient(", "conic-gradient("}

	for _, keyword := range keywords {
		searchIdx := 0
		for {
			pos := strings.Index(lowered[searchIdx:], keyword)
			if pos == -1 {
				break
			}
			start := searchIdx + pos
			openParenIdx := start + len(keyword) - 1
			end := findMatchingParen(line, openParenIdx)
			if end == -1 {
				break
			}
			if isInsideVarCall(line, start) {
				searchIdx = end + 1
				continue
			}
			value := line[start : end+1]
			matches = append(matches, match{Value: value, Reason: "gradient with fixed colors", Kind: matchKindGradient})
			searchIdx = end + 1
		}
	}

	return matches
}

func findMatchingParen(line string, openIdx int) int {
	depth := 0
	for i := openIdx; i < len(line); i++ {
		switch line[i] {
		case '(':
			depth++
		case ')':
			depth--
			if depth == 0 {
				return i
			}
		}
	}
	return -1
}

func hasKind(set map[string]struct{}, kind string) bool {
	if set == nil {
		return true
	}
	_, ok := set[kind]
	return ok
}

func buildSet(input, sep string) map[string]struct{} {
	items := strings.Split(input, sep)
	set := make(map[string]struct{}, len(items))
	for _, item := range items {
		trimmed := strings.TrimSpace(strings.ToLower(item))
		if trimmed == "" {
			continue
		}
		set[trimmed] = struct{}{}
	}
	return set
}

func buildList(input, sep string) []string {
	items := strings.Split(input, sep)
	var list []string
	for _, item := range items {
		trimmed := strings.ToLower(strings.TrimSpace(item))
		if trimmed == "" {
			continue
		}
		list = append(list, normalizeForMatch(trimmed))
	}
	return list
}

func shouldIgnoreDir(name string, ignoreDirs map[string]struct{}) bool {
	_, exists := ignoreDirs[strings.ToLower(name)]
	return exists
}

func shouldInspectFile(path string, extSet map[string]struct{}) bool {
	if len(extSet) == 0 {
		return true
	}
	ext := strings.ToLower(filepath.Ext(path))
	_, ok := extSet[ext]
	return ok
}

func shouldSkipLine(line string) bool {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" {
		return true
	}

	commentPrefixes := []string{"/*", "*", "--", "<!--"}
	for _, prefix := range commentPrefixes {
		if strings.HasPrefix(trimmed, prefix) {
			return true
		}
	}

	return false
}

func isInsideVarCall(line string, startIdx int) bool {
	if startIdx <= 0 {
		return false
	}

	prefix := line[:startIdx]
	lastVar := strings.LastIndex(prefix, "var(")
	if lastVar == -1 {
		return false
	}

	depth := 0
	for i := lastVar; i < len(line); i++ {
		switch line[i] {
		case '(':
			depth++
		case ')':
			if depth > 0 {
				depth--
				if depth == 0 {
					return startIdx >= lastVar && startIdx < i
				}
			}
		}
	}

	return true
}

func looksLikePropertyContext(line string, idx int) bool {
	if idx == 0 {
		return false
	}

	prefix := line[:idx]
	lastColon := strings.LastIndex(prefix, ":")
	lastEquals := strings.LastIndex(prefix, "=")
	lastOpenParen := strings.LastIndex(prefix, "(")
	indicator := max(lastColon, max(lastEquals, lastOpenParen))

	if indicator == -1 {
		return false
	}

	segment := prefix[indicator:]
	return strings.Contains(segment, ":") || strings.Contains(segment, "=") || strings.HasSuffix(strings.TrimSpace(segment), "(")
}

func relativePath(root, path string) string {
	rel, err := filepath.Rel(root, path)
	if err != nil {
		return filepath.ToSlash(path)
	}
	return filepath.ToSlash(rel)
}

func normalizeForMatch(value string) string {
	return strings.ToLower(filepath.ToSlash(value))
}

func matchesAny(path string, patterns []string) bool {
	if len(patterns) == 0 {
		return false
	}
	for _, pattern := range patterns {
		if pattern == "" {
			continue
		}
		if strings.Contains(path, pattern) {
			return true
		}
	}
	return false
}

func shouldProcessPath(path string, includes, excludes []string) bool {
	if matchesAny(path, excludes) {
		return false
	}
	if len(includes) == 0 {
		return true
	}
	for _, include := range includes {
		if include == "" {
			continue
		}
		if strings.Contains(path, include) {
			return true
		}
	}
	return false
}

func supportsLineComments(path string) bool {
	ext := strings.ToLower(filepath.Ext(path))
	_, ok := lineCommentExtension[ext]
	return ok
}

func removeBlockComments(line string) string {
	var builder strings.Builder
	inComment := false
	length := len(line)
	for i := 0; i < length; i++ {
		if !inComment && i+1 < length && line[i] == '/' && line[i+1] == '*' {
			inComment = true
			i++
			continue
		}
		if inComment {
			if i+1 < length && line[i] == '*' && line[i+1] == '/' {
				inComment = false
				i++
			}
			continue
		}
		builder.WriteByte(line[i])
	}
	return builder.String()
}

func stripLineComment(line string) string {
	inSingle := false
	inDouble := false
	inTemplate := false
	escaped := false

	for i := 0; i < len(line)-1; i++ {
		char := line[i]
		next := line[i+1]

		if escaped {
			escaped = false
			continue
		}

		switch char {
		case '\\':
			escaped = true
			continue
		case '\'':
			if !inDouble && !inTemplate {
				inSingle = !inSingle
			}
		case '"':
			if !inSingle && !inTemplate {
				inDouble = !inDouble
			}
		case '`':
			if !inSingle && !inDouble {
				inTemplate = !inTemplate
			}
		case '/':
			if !inSingle && !inDouble && !inTemplate && next == '/' && !looksLikeProtocol(line, i) {
				return strings.TrimRight(line[:i], " \t")
			}
		}
	}

	return line
}

func looksLikeProtocol(line string, idx int) bool {
	if idx <= 0 {
		return false
	}
	return line[idx-1] == ':'
}

func findLineCommentIndex(line string) int {
	for i := 0; i < len(line)-1; i++ {
		if line[i] == '/' && line[i+1] == '/' && !looksLikeProtocol(line, i) {
			return i
		}
	}
	return -1
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
