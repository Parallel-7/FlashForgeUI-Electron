param(
    [string]$OutputFile = "fileoverview-collection.json",
    [int]$CheckLines = 50,
    [switch]$Debug
)

$extensions = @('*.ts', '*.js', '*.tsx', '*.jsx')
$fileoverviews = @()

foreach ($ext in $extensions) {
    Get-ChildItem -Path 'src' -Recurse -Filter $ext | ForEach-Object { 
        $filePath = $_.FullName.Replace((Get-Location).Path + '\', '')
        
        # Read first X lines to find @fileoverview
        $content = Get-Content $_.FullName -TotalCount $CheckLines -ErrorAction SilentlyContinue
        
        if ($content) {
            $joinedContent = $content -join "`n"
            
            # Find @fileoverview block
            $fileoverviewMatch = $joinedContent -match '(?s)/\*\*[\s\*]*@fileoverview(.*?)\*/'
            
            if ($fileoverviewMatch) {
                # Extract the full comment block
                $match = [regex]::Match($joinedContent, '(?s)/\*\*(.*?@fileoverview.*?)\*/')
                if ($match.Success) {
                    $fullComment = $match.Value
                    
                    # Extract just the @fileoverview content (everything after @fileoverview)
                    $overviewMatch = [regex]::Match($fullComment, '(?s)@fileoverview\s*(.*?)(?=\*\/|$)')
                    if ($overviewMatch.Success) {
                        $overview = $overviewMatch.Groups[1].Value.Trim()
                        # Clean up asterisks and extra whitespace
                        $overview = ($overview -replace '(?m)^\s*\*\s*', '') -replace '\s*\*\s*$', '' -replace '\n\s*\*\s*', "`n" 
                        $overview = $overview.Trim()
                        
                        if ($Debug) {
                            Write-Host "Found @fileoverview in: $filePath" -ForegroundColor Green
                        }
                        
                        $fileoverviews += [PSCustomObject]@{
                            filename = $filePath
                            fileoverview = $overview
                        }
                    }
                }
            }
        }
    }
}

# Convert to JSON and output
$jsonOutput = $fileoverviews | ConvertTo-Json -Depth 10

if ($fileoverviews.Count -eq 0) {
    Write-Host "⚠️  No @fileoverview blocks found in source files!" -ForegroundColor Yellow
} else {
    # Write to file
    $jsonOutput | Out-File -FilePath $OutputFile -Encoding UTF8
    Write-Host "✅ Extracted $($fileoverviews.Count) @fileoverview blocks to $OutputFile" -ForegroundColor Green
    
    if ($Debug) {
        Write-Host "`nFiles with @fileoverview:" -ForegroundColor Cyan
        $fileoverviews | ForEach-Object { Write-Host "  - $($_.filename)" }
    }
}