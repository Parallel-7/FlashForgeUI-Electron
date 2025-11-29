package main

import (
	"bufio"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// DisableRule represents a single instance of an eslint-disable directive.
type DisableRule struct {
	File    string
	Line    int
	Content string
}

// supportedExtensions defines the set of file extensions to scan.
var supportedExtensions = map[string]bool{
	".ts":  true,
	".tsx": true,
	".js":  true,
	".jsx": true,
}

func main() {
	// 2) Mandatory Execution Timing Feature
	start := time.Now()
	defer func() {
		duration := time.Since(start)
		fmt.Printf("\nTotal execution time: %s\n", duration)
	}()

	// 1c) Implement command-line argument parsing
	// Defaulting to "src" to match the hardcoded logic of the original script,
	// but allowing override via flags.
	srcDirPtr := flag.String("dir", "src", "Directory to scan for eslint-disable directives")
	flag.Parse()

	projectRoot, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error getting current working directory: %v\n", err)
		os.Exit(1)
	}

	targetDir := filepath.Join(projectRoot, *srcDirPtr)

	// Check if directory exists
	info, err := os.Stat(targetDir)
	if err != nil || !info.IsDir() {
		fmt.Fprintf(os.Stderr, "Directory not found: %s\n", targetDir)
		os.Exit(1)
	}

	files, err := collectSourceFiles(targetDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error collecting files: %v\n", err)
		os.Exit(1)
	}

	var allEntries []DisableRule

	for _, file := range files {
		entries, err := findDisableRules(file, projectRoot)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error reading file %s: %v\n", file, err)
			continue
		}
		allEntries = append(allEntries, entries...)
	}

	if len(allEntries) == 0 {
		fmt.Println("No eslint-disable rules found!")
		return
	}

	fmt.Println("Found eslint-disable rules:")
	printTable(allEntries)

	uniqueFiles := make(map[string]bool)
	for _, entry := range allEntries {
		uniqueFiles[entry.File] = true
	}
	fmt.Printf("Total: %d rules in %d files\n", len(allEntries), len(uniqueFiles))
}

// collectSourceFiles walks the directory tree and returns a list of matching file paths.
func collectSourceFiles(dir string) ([]string, error) {
	var files []string

	err := filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() {
			ext := filepath.Ext(d.Name())
			if supportedExtensions[ext] {
				files = append(files, path)
			}
		}
		return nil
	})

	return files, err
}

// findDisableRules scans a specific file for eslint-disable directives.
func findDisableRules(filePath, projectRoot string) ([]DisableRule, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var matches []DisableRule
	scanner := bufio.NewScanner(file)
	lineNum := 0

	// Calculate relative path for reporting
	relPath, err := filepath.Rel(projectRoot, filePath)
	if err != nil {
		relPath = filePath // Fallback if rel path fails
	}
	// Normalize path separators to forward slashes to match original script's replace(/\\/g, '/')
	relPath = filepath.ToSlash(relPath)

	for scanner.Scan() {
		lineNum++
		text := scanner.Text()
		if strings.Contains(text, "eslint-disable") {
			matches = append(matches, DisableRule{
				File:    relPath,
				Line:    lineNum,
				Content: strings.TrimSpace(text),
			})
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return matches, nil
}

// printTable formats and prints the rules in a table.
func printTable(entries []DisableRule) {
	// Sort entries: File A-Z, then Line number asc
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].File == entries[j].File {
			return entries[i].Line < entries[j].Line
		}
		return entries[i].File < entries[j].File
	})

	// Calculate column widths
	fileWidth := len("File")
	lineWidth := len("Line")

	for _, e := range entries {
		if len(e.File) > fileWidth {
			fileWidth = len(e.File)
		}
		lineStrLen := len(fmt.Sprintf("%d", e.Line))
		if lineStrLen > lineWidth {
			lineWidth = lineStrLen
		}
	}

	// Print Header
	// Go formatting: %-*s pads to the right (negative width), %*s pads to the left
	fmt.Printf("%-*s  %*s  Content\n", fileWidth, "File", lineWidth, "Line")
	fmt.Printf("%s  %s  -------\n", strings.Repeat("-", fileWidth), strings.Repeat("-", lineWidth))

	// Print Rows
	for _, entry := range entries {
		fmt.Printf("%-*s  %*d  %s\n",
			fileWidth, entry.File,
			lineWidth, entry.Line,
			entry.Content,
		)
	}
}