// extract-fileoverview.go
//
// Extracts @fileoverview blocks from source files under ./src and writes a Markdown report.
// 1:1 port of the original TypeScript script:
//
//   Default output: fileoverview-report.md
//   Flags:
//     --output=FILE   set output markdown path (relative to CWD)
//     --lines=N       number of lines to inspect per file (default 50, must be > 0)
//     --debug         log each file where an @fileoverview is found
//
// Usage examples:
//   go build -o extract-fileoverview .
//   ./extract-fileoverview
//   ./extract-fileoverview --output=custom.md --lines=80 --debug

package main

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	DefaultOutput = "fileoverview-report.md"
	DefaultLines  = 50
)

// Supported source file extensions (case sensitive, same as TS version)
var supportedExtensions = map[string]struct{}{
	".ts":  {},
	".tsx": {},
	".js":  {},
	".jsx": {},
}

type FileOverviewEntry struct {
	File     string
	Overview string
}

type ScriptOptions struct {
	Output     string
	CheckLines int
	Debug      bool
}

var overviewRe = regexp.MustCompile(`(?is)/\*\*[\s\S]*?@fileoverview([\s\S]*?)\*/`)
var starPrefixRe = regexp.MustCompile(`^\s*\*\s?`)

func parseArgs(args []string) ScriptOptions {
	opts := ScriptOptions{
		Output:     DefaultOutput,
		CheckLines: DefaultLines,
		Debug:      false,
	}

	for _, arg := range args {
		if strings.HasPrefix(arg, "--output=") {
			value := strings.TrimPrefix(arg, "--output=")
			if value != "" {
				opts.Output = value
			}
		} else if strings.HasPrefix(arg, "--lines=") {
			value := strings.TrimPrefix(arg, "--lines=")
			if n, err := strconv.Atoi(value); err == nil && n > 0 {
				opts.CheckLines = n
			}
		} else if arg == "--debug" {
			opts.Debug = true
		}
	}

	return opts
}

func collectSourceFiles(rootDir string) ([]string, error) {
	entries, err := os.ReadDir(rootDir)
	if err != nil {
		return nil, err
	}

	var files []string

	for _, entry := range entries {
		fullPath := filepath.Join(rootDir, entry.Name())

		if entry.IsDir() {
			subFiles, err := collectSourceFiles(fullPath)
			if err != nil {
				return nil, err
			}
			files = append(files, subFiles...)
			continue
		}

		// Only regular files
		info, err := entry.Info()
		if err != nil {
			return nil, err
		}
		if !info.Mode().IsRegular() {
			continue
		}

		if _, ok := supportedExtensions[filepath.Ext(entry.Name())]; ok {
			files = append(files, fullPath)
		}
	}

	return files, nil
}

func extractOverviewBlock(snippet string) string {
	matches := overviewRe.FindStringSubmatch(snippet)
	if matches == nil || len(matches) < 2 {
		return ""
	}

	raw := matches[1]

	// Normalize newlines like /\r?\n/
	raw = strings.ReplaceAll(raw, "\r\n", "\n")
	lines := strings.Split(raw, "\n")

	for i, line := range lines {
		lines[i] = starPrefixRe.ReplaceAllString(line, "")
	}

	cleaned := strings.TrimSpace(strings.Join(lines, "\n"))
	if cleaned == "" {
		return ""
	}
	return cleaned
}

func buildReportEntries(files []string, checkLines int, debug bool, projectRoot string) ([]FileOverviewEntry, error) {
	entries := make([]FileOverviewEntry, 0)

	for _, filePath := range files {
		data, err := os.ReadFile(filePath)
		if err != nil {
			return nil, err
		}

		content := string(data)
		// Normalize newlines before splitting
		content = strings.ReplaceAll(content, "\r\n", "\n")
		lines := strings.Split(content, "\n")
		if len(lines) > checkLines {
			lines = lines[:checkLines]
		}

		snippet := strings.Join(lines, "\n")
		overview := extractOverviewBlock(snippet)
		if overview == "" {
			continue
		}

		relativePath, err := filepath.Rel(projectRoot, filePath)
		if err != nil {
			relativePath = filePath
		}
		relativePath = filepath.ToSlash(relativePath)

		if debug {
			fmt.Printf("Found @fileoverview in: %s\n", relativePath)
		}

		entries = append(entries, FileOverviewEntry{
			File:     relativePath,
			Overview: overview,
		})
	}

	return entries, nil
}

func buildMarkdown(entries []FileOverviewEntry, totalFiles int) string {
	lines := make([]string, 0)

	lines = append(lines, "# Fileoverview Report")
	lines = append(lines, "")

	// Match Date.toISOString() format (UTC, 3 fractional digits)
	now := time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
	lines = append(lines, fmt.Sprintf("Generated: %s", now))
	lines = append(lines, fmt.Sprintf("Total files scanned: %d", totalFiles))
	lines = append(lines, fmt.Sprintf("Files with @fileoverview: %d", len(entries)))
	lines = append(lines, "")

	sorted := make([]FileOverviewEntry, len(entries))
	copy(sorted, entries)

	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].File < sorted[j].File
	})

	for _, entry := range sorted {
		lines = append(lines, fmt.Sprintf("## %s", entry.File))
		lines = append(lines, "")
		lines = append(lines, entry.Overview)
		lines = append(lines, "")
	}

	if len(sorted) == 0 {
		lines = append(lines, "_No @fileoverview blocks were found._")
	}

	return strings.Join(lines, "\n")
}

func run() error {
	start := time.Now()

	opts := parseArgs(os.Args[1:])

	projectRoot, err := os.Getwd()
	if err != nil {
		return err
	}

	srcDir := filepath.Join(projectRoot, "src")

	info, err := os.Stat(srcDir)
	if err != nil || !info.IsDir() {
		// Matches TS behavior: direct message and exit with code 1,
		// no "Error extracting fileoverviews" wrapper here.
		fmt.Fprintf(os.Stderr, "Directory not found: %s\n", srcDir)
		os.Exit(1)
	}

	files, err := collectSourceFiles(srcDir)
	if err != nil {
		return err
	}

	entries, err := buildReportEntries(files, opts.CheckLines, opts.Debug, projectRoot)
	if err != nil {
		return err
	}

	markdown := buildMarkdown(entries, len(files))
	outputPath := filepath.Join(projectRoot, opts.Output)

	if err := os.WriteFile(outputPath, []byte(markdown), 0o644); err != nil {
		return err
	}

	elapsed := time.Since(start)
	fmt.Printf(
		"✅ Extracted %d @fileoverview blocks to %s in %s\n",
		len(entries),
		opts.Output,
		elapsed,
	)

	return nil
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error extracting fileoverviews: %v\n", err)
		os.Exit(1)
	}
}
