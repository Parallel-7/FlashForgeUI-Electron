package main

import (
	"bufio"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

// Constants
const defaultCheckLines = 20

var supportedExtensions = map[string]bool{
	".ts":  true,
	".tsx": true,
	".js":  true,
	".jsx": true,
}

// MissingFile structure to hold report data
type MissingFile struct {
	File      string
	FirstLine string
}

// collectSourceFiles walks the directory and collects matching files
func collectSourceFiles(rootDir string) ([]string, error) {
	var files []string

	err := filepath.Walk(rootDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			return nil
		}

		ext := filepath.Ext(info.Name())
		if supportedExtensions[ext] {
			files = append(files, path)
		}
		return nil
	})

	return files, err
}

// buildPatternList compiles the regex patterns
func buildPatternList() []*regexp.Regexp {
	// Go uses (?i) for case insensitivity
	patterns := []string{
		`(?i)@fileoverview`,
		`(?i)@\s*fileoverview`,
		`(?i)\*\s*@fileoverview`,
		`(?i)//\s*@fileoverview`,
	}

	var compiled []*regexp.Regexp
	for _, p := range patterns {
		compiled = append(compiled, regexp.MustCompile(p))
	}
	return compiled
}

// hasFileOverview checks the top N lines of a file for the patterns
func hasFileOverview(filePath string, linesToCheck int) (bool, string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return false, "", err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	var lines []string
	lineCount := 0

	// Read only up to linesToCheck
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
		lineCount++
		if lineCount >= linesToCheck {
			break
		}
	}

	if err := scanner.Err(); err != nil {
		return false, "", err
	}

	firstLine := "(empty file)"
	if len(lines) > 0 {
		firstLine = strings.TrimSpace(lines[0])
	}

	snippet := strings.Join(lines, "\n")
	patterns := buildPatternList()
	found := false

	for _, pattern := range patterns {
		if pattern.MatchString(snippet) {
			found = true
			break
		}
	}

	return found, firstLine, nil
}

func main() {
	start := time.Now()

	// Define flags using the standard "flag" package
	linesPtr := flag.Int("lines", defaultCheckLines, "Number of lines to check for @fileoverview")
	debugPtr := flag.Bool("debug", false, "Enable debug output")

	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "Usage of %s:\n", os.Args[0])
		flag.PrintDefaults()
	}

	flag.Parse()

	// Dereference pointers
	checkLines := *linesPtr
	debug := *debugPtr

	if checkLines <= 0 {
		checkLines = defaultCheckLines
	}

	projectRoot, err := os.Getwd()
	if err != nil {
		fmt.Printf("Error getting current directory: %v\n", err)
		os.Exit(1)
	}

	srcDir := filepath.Join(projectRoot, "src")

	info, err := os.Stat(srcDir)
	if err != nil || !info.IsDir() {
		fmt.Fprintf(os.Stderr, "Directory not found: %s\n", srcDir)
		os.Exit(1)
	}

	files, err := collectSourceFiles(srcDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error collecting files: %v\n", err)
		os.Exit(1)
	}

	var missingFiles []MissingFile

	for _, filePath := range files {
		found, firstLine, err := hasFileOverview(filePath, checkLines)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error reading file %s: %v\n", filePath, err)
			continue
		}

		if found {
			if debug {
				relPath, _ := filepath.Rel(projectRoot, filePath)
				fmt.Printf("Found @fileoverview in: %s\n", relPath)
			}
			continue
		}

		relPath, _ := filepath.Rel(projectRoot, filePath)
		relPath = filepath.ToSlash(relPath)

		missingFiles = append(missingFiles, MissingFile{
			File:      relPath,
			FirstLine: firstLine,
		})
	}

	if len(missingFiles) == 0 {
		fmt.Println("✅ All source files have @fileoverview documentation!")
		fmt.Printf("✨ Done in %s\n", time.Since(start))
		return
	}

	fmt.Println("📄 Files missing @fileoverview documentation:")

	// Sort by filename
	sort.Slice(missingFiles, func(i, j int) bool {
		return missingFiles[i].File < missingFiles[j].File
	})

	// Calculate max length for padding
	maxFileLength := len("File")
	for _, mf := range missingFiles {
		if len(mf.File) > maxFileLength {
			maxFileLength = len(mf.File)
		}
	}

	// Print Table
	fmt.Printf("%-*s  First line\n", maxFileLength, "File")
	fmt.Printf("%-*s  ----------\n", maxFileLength, strings.Repeat("-", maxFileLength))

	for _, mf := range missingFiles {
		fmt.Printf("%-*s  %s\n", maxFileLength, mf.File, mf.FirstLine)
	}

	fmt.Printf("Found %d files missing @fileoverview documentation.\n", len(missingFiles))
	fmt.Printf("✨ Done in %s\n", time.Since(start))
}