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

// LucideMatch represents a finding of the search token in a file.
type LucideMatch struct {
	File    string
	Line    int
	Content string
}

const matchToken = "lucide"

// supportedExtensions acts as a set for O(1) lookups.
var supportedExtensions = map[string]bool{
	".ts":  true,
	".tsx": true,
	".js":  true,
	".jsx": true,
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error scanning for Lucide references: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	// 2a, 2b: Execution timing wrapping the primary logic
	startTime := time.Now()
	defer func() {
		// 2c: Formatted timing output
		fmt.Printf("\nTotal execution time: %v\n", time.Since(startTime))
	}()

	// 1c: Argument parsing using 'flag'
	// Defaults to "src" to maintain 1:1 behavior with original script which hardcoded 'src'
	targetDir := flag.String("dir", "src", "Directory to scan")
	flag.Parse()

	projectRoot, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("failed to get current working directory: %w", err)
	}

	searchPath := filepath.Join(projectRoot, *targetDir)

	// Verify directory exists
	info, err := os.Stat(searchPath)
	if err != nil || !info.IsDir() {
		return fmt.Errorf("directory not found: %s", searchPath)
	}

	var allMatches []LucideMatch

	// 1b: Use standard library filepath.WalkDir instead of manual recursion
	err = filepath.WalkDir(searchPath, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if !d.IsDir() {
			ext := filepath.Ext(d.Name())
			if supportedExtensions[ext] {
				matches, err := scanFile(path, projectRoot)
				if err != nil {
					return fmt.Errorf("failed to read file %s: %w", path, err)
				}
				allMatches = append(allMatches, matches...)
			}
		}
		return nil
	})

	if err != nil {
		return err
	}

	if len(allMatches) == 0 {
		fmt.Println("No Lucide references found.")
		return nil
	}

	// Group matches by file
	grouped := make(map[string][]LucideMatch)
	for _, match := range allMatches {
		grouped[match.File] = append(grouped[match.File], match)
	}

	fmt.Println("Lucide icon references:")

	// Sort files alphabetically
	var sortedFiles []string
	for file := range grouped {
		sortedFiles = append(sortedFiles, file)
	}
	sort.Strings(sortedFiles)

	for _, file := range sortedFiles {
		fmt.Printf("\n%s\n", file)
		
		// Sort entries by line number
		entries := grouped[file]
		sort.Slice(entries, func(i, j int) bool {
			return entries[i].Line < entries[j].Line
		})

		for _, entry := range entries {
			fmt.Printf("  %s (line %d)\n", entry.Content, entry.Line)
		}
	}

	fmt.Printf("\nTotal: %d files with Lucide references (%d matches).\n", len(grouped), len(allMatches))

	return nil
}

// scanFile reads a file and finds lines containing the match token.
func scanFile(absPath, projectRoot string) ([]LucideMatch, error) {
	file, err := os.Open(absPath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var matches []LucideMatch
	scanner := bufio.NewScanner(file)
	lineNumber := 0

	// Replicates path.relative logic
	relPath, err := filepath.Rel(projectRoot, absPath)
	if err != nil {
		relPath = absPath // Fallback if rel path fails
	}
	// Replicates .replace(/\\/g, '/') for consistent output style
	relPath = filepath.ToSlash(relPath)

	for scanner.Scan() {
		lineNumber++
		lineContent := scanner.Text()
		
		// Case-insensitive check
		if strings.Contains(strings.ToLower(lineContent), matchToken) {
			matches = append(matches, LucideMatch{
				File:    relPath,
				Line:    lineNumber,
				Content: strings.TrimSpace(lineContent),
			})
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return matches, nil
}