param(
    [int]$CheckLines = 20,
    [switch]$Debug
)

$extensions = @('*.ts', '*.js', '*.tsx', '*.jsx')
$missingFiles = @()

foreach ($ext in $extensions) {
    Get-ChildItem -Path 'src' -Recurse -Filter $ext | ForEach-Object { 
        $filePath = $_.FullName.Replace((Get-Location).Path + '\', '')
        
        # Read first X lines and check for @fileoverview with more flexible pattern
        $firstLines = Get-Content $_.FullName -TotalCount $CheckLines -ErrorAction SilentlyContinue
        
        # Join all lines into one string to handle multi-line comments
        $content = $firstLines -join "`n"
        
        # More flexible regex patterns for @fileoverview
        $patterns = @(
            '@fileoverview',           # Standard format
            '@ fileoverview',          # With space
            '\*\s*@fileoverview',      # With asterisk and optional spaces
            '//\s*@fileoverview'       # Single line comment
        )
        
        $hasFileoverview = $false
        foreach ($pattern in $patterns) {
            if ($content -match $pattern) {
                $hasFileoverview = $true
                break
            }
        }
        
        if ($Debug -and $hasFileoverview) {
            Write-Host "Found @fileoverview in: $filePath" -ForegroundColor Green
        }
        
        if (-not $hasFileoverview) {
            $missingFiles += [PSCustomObject]@{
                File = $filePath
                FirstLine = if ($firstLines.Count -gt 0) { $firstLines[0].Trim() } else { "(empty file)" }
            }
        }
    }
}

if ($missingFiles.Count -eq 0) {
    Write-Host "✅ All source files have @fileoverview documentation!" -ForegroundColor Green
} else {
    Write-Host "📄 Files missing @fileoverview documentation:" -ForegroundColor Yellow
    $missingFiles | Sort-Object File | Format-Table -AutoSize
    Write-Host "Found $($missingFiles.Count) files missing @fileoverview documentation." -ForegroundColor Red
}