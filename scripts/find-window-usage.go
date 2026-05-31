package main

import (
	"flag"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

// -- Structs and Types --

type WindowUsageMatch struct {
	Line        int
	Snippet     []string
	Identifiers []string
}

// stringSlice handles comma-separated flags or multiple flag occurrences
type stringSlice []string

func (s *stringSlice) String() string {
	return strings.Join(*s, ",")
}

func (s *stringSlice) Set(value string) error {
	parts := strings.Split(value, ",")
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			*s = append(*s, trimmed)
		}
	}
	return nil
}

// -- Constants and Globals --

var defaultExtensions = map[string]bool{
	".ts": true, ".tsx": true, ".js": true, ".jsx": true,
	".cts": true, ".mts": true, ".cjs": true, ".mjs": true,
}

var excludedDirs = map[string]bool{
	"node_modules": true, "dist": true, "out": true, "build": true,
	"coverage": true, ".git": true, ".idea": true, ".vscode": true,
	"lib": true, "debug_logs": true,
}

// Regex patterns compiled at initialization
var (
	windowPropertyRegex        = regexp.MustCompile(`\bwindow\s*(?:\?\.|\.)[A-Za-z_$]`)
	windowBracketRegex         = regexp.MustCompile(`\bwindow\s*\[`)
	windowPropertyCaptureRegex = regexp.MustCompile(`\bwindow\s*(?:\?\.|\.)\s*([A-Za-z_$][\w$]*)`)
	windowBracketCaptureRegex  = regexp.MustCompile(`\bwindow\s*\[\s*['"]([^'"]+)['"]\s*\]`)
)

// -- Helper Functions --

func isCommentOnlyLine(line string) bool {
	trimmed := strings.TrimSpace(line)
	if len(trimmed) == 0 {
		return true
	}
	return strings.HasPrefix(trimmed, "//") ||
		strings.HasPrefix(trimmed, "*") ||
		strings.HasPrefix(trimmed, "/*") ||
		strings.HasPrefix(trimmed, "*/")
}

func createSnippet(lines []string, index int, context int) []string {
	start := index - context
	if start < 0 {
		start = 0
	}
	end := index + context
	if end > len(lines)-1 {
		end = len(lines) - 1
	}

	lineNumberWidth := len(strconv.Itoa(end + 1))
	var snippet []string

	for i := start; i <= end; i++ {
		prefix := " "
		if i == index {
			prefix = ">"
		}
		// Format: ">  10 | code"
		lineNumStr := fmt.Sprintf("%*d", lineNumberWidth, i+1)
		snippet = append(snippet, fmt.Sprintf("%s %s | %s", prefix, lineNumStr, lines[i]))
	}

	return snippet
}

func extractIdentifiers(line string) []string {
	uniqueIDs := make(map[string]struct{})

	// Find property matches (window.prop)
	propMatches := windowPropertyCaptureRegex.FindAllStringSubmatch(line, -1)
	for _, m := range propMatches {
		if len(m) > 1 {
			uniqueIDs[strings.TrimSpace(m[1])] = struct{}{}
		}
	}

	// Find bracket matches (window['prop'])
	bracketMatches := windowBracketCaptureRegex.FindAllStringSubmatch(line, -1)
	for _, m := range bracketMatches {
		if len(m) > 1 {
			uniqueIDs[strings.TrimSpace(m[1])] = struct{}{}
		}
	}

	identifiers := make([]string, 0, len(uniqueIDs))
	for id := range uniqueIDs {
		identifiers = append(identifiers, id)
	}
	return identifiers
}

func collectWindowUsage(content string, context int, pattern *regexp.Regexp) []WindowUsageMatch {
	// Normalize line endings to \n then split
	normalized := strings.ReplaceAll(content, "\r\n", "\n")
	lines := strings.Split(normalized, "\n")
	var matches []WindowUsageMatch

	for i, line := range lines {
		if isCommentOnlyLine(line) {
			continue
		}
		// Check basic window patterns first
		if !windowPropertyRegex.MatchString(line) && !windowBracketRegex.MatchString(line) {
			continue
		}
		// Check user supplied pattern if exists
		if pattern != nil && !pattern.MatchString(line) {
			continue
		}

		matches = append(matches, WindowUsageMatch{
			Line:        i + 1,
			Snippet:     createSnippet(lines, i, context),
			Identifiers: extractIdentifiers(line),
		})
	}
	return matches
}

// -- Main Logic --

func run() {
	// Flags
	var context int
	var rootFlags stringSlice
	var extensionFlags stringSlice
	var patternStr string

	flag.IntVar(&context, "context", 2, "Number of context lines")
	// Support both --root and --roots logic by binding same var or checking args
	// We use a custom var that accumulates.
	flag.Var(&rootFlags, "root", "Root directory (can be comma separated)")
	flag.Var(&rootFlags, "roots", "Root directories (alias)")
	flag.StringVar(&patternStr, "pattern", "", "Regex pattern to filter lines")
	flag.Var(&extensionFlags, "extensions", "File extensions to scan")
	flag.Parse()

	// 1. Setup Configuration
	projectRoot, err := os.Getwd()
	if err != nil {
		fmt.Printf("Error getting current directory: %v\n", err)
		os.Exit(1)
	}

	// Resolve Roots
	roots := []string{}
	if len(rootFlags) > 0 {
		roots = rootFlags
	} else {
		roots = append(roots, "src")
	}

	// Resolve Extensions
	extensions := make(map[string]bool)
	if len(extensionFlags) > 0 {
		for _, ext := range extensionFlags {
			// Ensure dot prefix
			if !strings.HasPrefix(ext, ".") {
				ext = "." + ext
			}
			extensions[strings.ToLower(ext)] = true
		}
	} else {
		extensions = defaultExtensions
	}

	// Resolve Pattern
	var pattern *regexp.Regexp
	if patternStr != "" {
		p, err := regexp.Compile("(?i)" + patternStr) // case insensitive
		if err != nil {
			fmt.Printf("Invalid pattern \"%s\": %v\n", patternStr, err)
			// Proceeding without pattern as per original script logic (it warns)
		} else {
			pattern = p
		}
	}

	// 2. Gather Files
	filesSet := make(map[string]struct{})

	for _, r := range roots {
		absRoot := filepath.Join(projectRoot, r)
		info, err := os.Stat(absRoot)
		if err != nil {
			fmt.Printf("Skipping missing path: %s\n", r)
			continue
		}

		if !info.IsDir() {
			// Single file check
			ext := strings.ToLower(filepath.Ext(absRoot))
			if extensions[ext] {
				filesSet[absRoot] = struct{}{}
			}
			continue
		}

		// Directory Walk
		err = filepath.WalkDir(absRoot, func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if d.IsDir() {
				if excludedDirs[d.Name()] {
					return filepath.SkipDir
				}
				return nil
			}

			ext := strings.ToLower(filepath.Ext(d.Name()))
			if extensions[ext] {
				filesSet[path] = struct{}{}
			}
			return nil
		})
		if err != nil {
			fmt.Printf("Error walking directory %s: %v\n", r, err)
		}
	}

	if len(filesSet) == 0 {
		fmt.Println("No files found to scan.")
		return
	}

	// 3. Scan Files
	matchesByFile := make(map[string][]WindowUsageMatch)
	identifierCounts := make(map[string]int)

	// Convert map keys to slice for sorting to match deterministic output order requirement implicitly
	// though map iteration is random, we sort later for output.
	allFiles := make([]string, 0, len(filesSet))
	for f := range filesSet {
		allFiles = append(allFiles, f)
	}

	for _, filePath := range allFiles {
		contentBytes, err := os.ReadFile(filePath)
		if err != nil {
			continue
		}

		matches := collectWindowUsage(string(contentBytes), context, pattern)
		if len(matches) == 0 {
			continue
		}

		relPath, _ := filepath.Rel(projectRoot, filePath)
		relPath = filepath.ToSlash(relPath) // Force forward slashes for consistency
		matchesByFile[relPath] = matches

		for _, match := range matches {
			for _, id := range match.Identifiers {
				identifierCounts[id]++
			}
		}
	}

	if len(matchesByFile) == 0 {
		fmt.Println("No window usages found.")
		return
	}

	// 4. Output Results
	fmt.Printf("Scanning complete. Displaying window usages with ±%d lines of context.\n", context)

	// Sort filenames
	sortedFiles := make([]string, 0, len(matchesByFile))
	for k := range matchesByFile {
		sortedFiles = append(sortedFiles, k)
	}
	sort.Strings(sortedFiles)

	totalMatches := 0
	for _, file := range sortedFiles {
		matches := matchesByFile[file]
		totalMatches += len(matches)
		fmt.Printf("\n%s\n", file)
		for _, match := range matches {
			fmt.Printf("  Line %d\n", match.Line)
			for _, line := range match.Snippet {
				fmt.Printf("  %s\n", line)
			}
			fmt.Println("")
		}
	}

	fmt.Printf("Found %d window usages across %d files.\n", totalMatches, len(matchesByFile))

	if len(identifierCounts) > 0 {
		fmt.Println("\nTop window identifiers:")

		// Sort identifiers by count descending
		type kv struct {
			Key   string
			Value int
		}
		var ss []kv
		for k, v := range identifierCounts {
			ss = append(ss, kv{k, v})
		}
		sort.Slice(ss, func(i, j int) bool {
			return ss[i].Value > ss[j].Value
		})

		limit := 20
		if len(ss) < limit {
			limit = len(ss)
		}

		for i := 0; i < limit; i++ {
			// Padding 20 chars
			fmt.Printf("  %-20s %d\n", ss[i].Key, ss[i].Value)
		}
	}
}

func main() {
	start := time.Now()

	// Execute core logic
	run()

	duration := time.Since(start)
	fmt.Printf("\nTotal execution time: %v\n", duration)
}