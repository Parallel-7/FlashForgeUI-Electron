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

// Global configuration constants matching the source script
var (
	supportedExtensions = map[string]bool{
		".ts": true, ".tsx": true, ".js": true, ".jsx": true,
	}
	excludedDirs = map[string]bool{
		"node_modules": true, ".git": true, "dist": true, "build": true, "out": true,
	}
	validLevels     = []string{"log", "debug", "info", "warn", "error"}
	validLevelSet   = make(map[string]bool)
	defaultLevel    = "log"
	projectRoot     string
)

func init() {
	// Initialize the set for O(1) lookups
	for _, l := range validLevels {
		validLevelSet[l] = true
	}
}

type ConsoleMatch struct {
	File    string
	Line    int
	Content string
	Level   string
}

// Mandatory execution timing wrapper
func main() {
	start := time.Now()

	// Defer the timing print to ensure it runs on exit
	defer func() {
		elapsed := time.Since(start)
		// Formatting to match the source script's specific output style + prompt requirement
		fmt.Printf("\nScan completed in %.2fms\n", float64(elapsed.Microseconds())/1000.0)
	}()

	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error finding console usage: %v\n", err)
		os.Exit(1)
	}
}

// Core application logic
func run() error {
	// 1. Parse Arguments
	levelFlag := flag.String("level", "", "Single console level")
	levelsFlag := flag.String("levels", "", "Comma-separated console levels")
	flag.Parse()

	levels := parseLevelsArg(*levelFlag, *levelsFlag)

	// 2. Setup paths
	var err error
	projectRoot, err = os.Getwd()
	if err != nil {
		return err
	}
	srcDir := filepath.Join(projectRoot, "src")

	// 3. Collect Files
	files, err := collectSourceFiles(srcDir)
	if err != nil {
		// If src doesn't exist, the original script might fail or return empty. 
		// We'll treat a missing directory as empty results to be safe, 
		// or propagate error if strict. The JS script assumes fs.readdir works.
		return fmt.Errorf("failed to read src directory: %w", err)
	}

	// 4. Scan Files
	var allMatches []ConsoleMatch
	for _, file := range files {
		matches, err := findMatchesInFile(file, levels)
		if err != nil {
			return err
		}
		allMatches = append(allMatches, matches...)
	}

	// 5. Print Results
	printResults(allMatches, levels, projectRoot)

	return nil
}

// parseLevelsArg replicates the precedence logic: --levels > --level > default
func parseLevelsArg(levelArg, levelsArg string) []string {
	// Check --levels first
	if levelsArg != "" {
		rawList := strings.Split(levelsArg, ",")
		var finalLevels []string
		var invalid []string
		seen := make(map[string]bool)

		for _, raw := range rawList {
			clean := strings.TrimSpace(raw)
			if clean == "" {
				continue
			}
			if validLevelSet[clean] {
				if !seen[clean] {
					finalLevels = append(finalLevels, clean)
					seen[clean] = true
				}
			} else {
				invalid = append(invalid, clean)
			}
		}

		if len(invalid) > 0 {
			fmt.Printf("Ignoring invalid level(s) in --levels: %s. Valid values are: %s.\n",
				strings.Join(invalid, ", "), strings.Join(validLevels, ", "))
		}

		if len(finalLevels) == 0 {
			fmt.Printf("No valid levels provided to --levels. Falling back to \"%s\".\n", defaultLevel)
			return []string{defaultLevel}
		}

		return finalLevels
	}

	// Check --level
	if levelArg != "" {
		clean := strings.TrimSpace(levelArg)
		if !validLevelSet[clean] {
			fmt.Printf("Invalid --level value \"%s\". Valid values are: %s. Falling back to \"%s\".\n",
				clean, strings.Join(validLevels, ", "), defaultLevel)
			return []string{defaultLevel}
		}
		return []string{clean}
	}

	// Default
	return []string{defaultLevel}
}

// collectSourceFiles walks the directory tree recursively
func collectSourceFiles(rootDir string) ([]string, error) {
	var results []string

	err := filepath.WalkDir(rootDir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}

		name := d.Name()

		if d.IsDir() {
			if excludedDirs[name] {
				return filepath.SkipDir
			}
			return nil
		}

		ext := filepath.Ext(name)
		if supportedExtensions[ext] {
			results = append(results, path)
		}

		return nil
	})

	return results, err
}

// findMatchesInFile scans a single file for regex matches
func findMatchesInFile(filePath string, levels []string) ([]ConsoleMatch, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	// Pre-compile regexes for performance
	patterns := make(map[string]*regexp.Regexp)
	for _, l := range levels {
		// regex: \bconsole.<level>\s*\(
		pattern := fmt.Sprintf(`\bconsole\.%s\s*\(`, regexp.QuoteMeta(l))
		patterns[l] = regexp.MustCompile(pattern)
	}

	var matches []ConsoleMatch
	scanner := bufio.NewScanner(file)
	lineNum := 0

	for scanner.Scan() {
		lineNum++
		lineText := scanner.Text()

		for _, l := range levels {
			if patterns[l].MatchString(lineText) {
				matches = append(matches, ConsoleMatch{
					File:    filePath,
					Line:    lineNum,
					Content: strings.TrimSpace(lineText),
					Level:   l,
				})
				// Matches behavior: one match per level per line is enough
			}
		}
	}

	return matches, scanner.Err()
}

// printResults dispatches to single or multi level printers
func printResults(matches []ConsoleMatch, levels []string, root string) {
	if len(levels) == 1 {
		printSingleLevelResults(matches, levels[0], root)
	} else {
		printMultiLevelResults(matches, levels, root)
	}
}

func printSingleLevelResults(matches []ConsoleMatch, level string, root string) {
	if len(matches) == 0 {
		fmt.Printf("No console.%s statements found!\n", level)
		return
	}

	grouped := make(map[string][]ConsoleMatch)
	for _, m := range matches {
		rel, _ := filepath.Rel(root, m.File)
		grouped[rel] = append(grouped[rel], m)
	}

	fmt.Printf("console.%s usage:\n\n", level)

	// Sort files for deterministic output
	var files []string
	for k := range grouped {
		files = append(files, k)
	}
	sort.Strings(files)

	for _, f := range files {
		fmt.Printf("\n%s\n", f)
		entries := grouped[f]
		// Sort by line number
		sort.Slice(entries, func(i, j int) bool {
			return entries[i].Line < entries[j].Line
		})

		for _, e := range entries {
			fmt.Printf("  %s (line %d)\n", e.Content, e.Line)
		}
	}

	fmt.Printf("\nTotal: %d console.%s statements in %d files\n", len(matches), level, len(grouped))
}

func printMultiLevelResults(matches []ConsoleMatch, levels []string, root string) {
	if len(matches) == 0 {
		var labels []string
		for _, l := range levels {
			labels = append(labels, "console."+l)
		}
		fmt.Printf("No %s statements found!\n", strings.Join(labels, ", "))
		return
	}

	fmt.Printf("console.%s usage (grouped by level):\n", strings.Join(levels, ", "))

	matchesByLevel := make(map[string][]ConsoleMatch)
	for _, l := range levels {
		matchesByLevel[l] = []ConsoleMatch{}
	}
	for _, m := range matches {
		matchesByLevel[m.Level] = append(matchesByLevel[m.Level], m)
	}

	totalFiles := make(map[string]bool)
	type summary struct {
		Level     string
		Count     int
		FileCount int
	}
	var summaries []summary

	for _, l := range levels {
		levelMatches := matchesByLevel[l]
		if len(levelMatches) == 0 {
			fmt.Printf("\n=== console.%s ===\n", l)
			fmt.Println("  (no matches)")
			summaries = append(summaries, summary{Level: l, Count: 0, FileCount: 0})
			continue
		}

		grouped := make(map[string][]ConsoleMatch)
		for _, m := range levelMatches {
			rel, _ := filepath.Rel(root, m.File)
			totalFiles[rel] = true
			grouped[rel] = append(grouped[rel], m)
		}

		var files []string
		for k := range grouped {
			files = append(files, k)
		}
		sort.Strings(files)

		fmt.Printf("\n=== console.%s ===\n", l)

		for _, f := range files {
			fmt.Printf("\n%s\n", f)
			entries := grouped[f]
			sort.Slice(entries, func(i, j int) bool {
				return entries[i].Line < entries[j].Line
			})
			for _, e := range entries {
				fmt.Printf("  %s (line %d)\n", e.Content, e.Line)
			}
		}

		summaries = append(summaries, summary{
			Level:     l,
			Count:     len(levelMatches),
			FileCount: len(files),
		})
	}

	fmt.Println("\nSummary:")
	for _, s := range summaries {
		fmt.Printf("  console.%s: %d statement(s) in %d file(s)\n", s.Level, s.Count, s.FileCount)
	}
	fmt.Printf("  Total: %d statement(s) across %d file(s)\n", len(matches), len(totalFiles))
}