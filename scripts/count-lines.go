package main

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

type fileCount struct {
	path  string
	lines int
}

func main() {
	minLines, err := parseArgs(os.Args[1:])
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	projectRoot, err := os.Getwd()
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to get working directory: %v\n", err)
		os.Exit(1)
	}

	srcDir := filepath.Join(projectRoot, "src")
	stat, err := os.Stat(srcDir)
	if err != nil || !stat.IsDir() {
		fmt.Fprintf(os.Stderr, "Directory not found: %s\n", srcDir)
		os.Exit(1)
	}

	tsFiles, err := collectTsFiles(srcDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to collect TypeScript files: %v\n", err)
		os.Exit(1)
	}

	counts, err := countLinesForFiles(tsFiles, projectRoot)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to count lines: %v\n", err)
		os.Exit(1)
	}

	sort.Slice(counts, func(i, j int) bool {
		return counts[i].lines > counts[j].lines
	})

	filtered := filterByMinLines(counts, minLines)

	if minLines > 0 {
		fmt.Printf("Showing files with %d+ lines (%d of %d total)\n\n", minLines, len(filtered), len(counts))
	}

	printTable(filtered)
}

func parseArgs(args []string) (int, error) {
	minLines := 0

	for i := 0; i < len(args); i++ {
		arg := args[i]

		if arg == "--min-lines" {
			if i+1 >= len(args) {
				return 0, errors.New("missing value for --min-lines")
			}
			value := args[i+1]
			parsed, err := parsePositiveInt(value)
			if err != nil {
				return 0, fmt.Errorf("invalid value for --min-lines: %s", value)
			}
			minLines = parsed
			i++
			continue
		}

		if strings.HasPrefix(arg, "--min-lines=") {
			value := strings.TrimPrefix(arg, "--min-lines=")
			parsed, err := parsePositiveInt(value)
			if err != nil {
				return 0, fmt.Errorf("invalid value for --min-lines: %s", value)
			}
			minLines = parsed
			continue
		}

		return 0, fmt.Errorf("unknown argument: %s", arg)
	}

	return minLines, nil
}

func parsePositiveInt(value string) (int, error) {
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed < 0 {
		return 0, errors.New("value must be a non-negative integer")
	}
	return parsed, nil
}

func collectTsFiles(root string) ([]string, error) {
	var files []string
	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		if strings.HasSuffix(strings.ToLower(path), ".ts") {
			files = append(files, path)
		}
		return nil
	})
	return files, err
}

func countLinesForFiles(paths []string, projectRoot string) ([]fileCount, error) {
	results := make([]fileCount, 0, len(paths))
	for _, path := range paths {
		lines, err := countLines(path)
		if err != nil {
			return nil, err
		}
		rel, err := filepath.Rel(projectRoot, path)
		if err != nil {
			rel = path
		}
		results = append(results, fileCount{
			path:  filepath.ToSlash(rel),
			lines: lines,
		})
	}
	return results, nil
}

func countLines(path string) (int, error) {
	file, err := os.Open(path)
	if err != nil {
		return 0, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	count := 0
	for scanner.Scan() {
		count++
	}
	if err := scanner.Err(); err != nil {
		return 0, err
	}
	return count, nil
}

func filterByMinLines(counts []fileCount, minLines int) []fileCount {
	if minLines <= 0 {
		return counts
	}
	filtered := make([]fileCount, 0, len(counts))
	for _, c := range counts {
		if c.lines >= minLines {
			filtered = append(filtered, c)
		}
	}
	return filtered
}

func printTable(counts []fileCount) {
	maxFileLen := len("File")
	maxLinesLen := len("Lines")

	for _, c := range counts {
		if len(c.path) > maxFileLen {
			maxFileLen = len(c.path)
		}
		lineLen := len(strconv.Itoa(c.lines))
		if lineLen > maxLinesLen {
			maxLinesLen = lineLen
		}
	}

	fmt.Printf("%s  %s\n", padRight("File", maxFileLen), padLeft("Lines", maxLinesLen))
	fmt.Printf("%s  %s\n", strings.Repeat("-", maxFileLen), strings.Repeat("-", maxLinesLen))

	for _, c := range counts {
		fmt.Printf("%s  %s\n", padRight(c.path, maxFileLen), padLeft(strconv.Itoa(c.lines), maxLinesLen))
	}
}

func padRight(value string, width int) string {
	if len(value) >= width {
		return value
	}
	return value + strings.Repeat(" ", width-len(value))
}

func padLeft(value string, width int) string {
	if len(value) >= width {
		return value
	}
	return strings.Repeat(" ", width-len(value)) + value
}
