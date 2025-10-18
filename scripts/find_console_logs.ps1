$extensions = @('*.ts', '*.js', '*.tsx', '*.jsx')
$consoleLogs = @()

foreach ($ext in $extensions) {
    Get-ChildItem -Path 'src' -Recurse -Filter $ext | ForEach-Object {
        $filePath = $_.FullName.Replace((Get-Location).Path + '\', '')

        $matches = Select-String -Path $_.FullName -Pattern "console\.log" -AllMatches

        foreach ($match in $matches) {
            $consoleLogs += [PSCustomObject]@{
                File = $filePath
                Line = $match.LineNumber
                Content = $match.Line.Trim()
            }
        }
    }
}

if ($consoleLogs.Count -eq 0) {
    Write-Host "No console.log statements found!" -ForegroundColor Green
} else {
    # Group by file
    $groupedByFile = $consoleLogs | Group-Object -Property File | Sort-Object Name

    foreach ($fileGroup in $groupedByFile) {
        Write-Host "`n$($fileGroup.Name)" -ForegroundColor Cyan
        foreach ($log in $fileGroup.Group | Sort-Object Line) {
            Write-Host "  $($log.Content) (line $($log.Line))" -ForegroundColor Yellow
        }
    }

    $uniqueFiles = ($consoleLogs | Select-Object File -Unique | Measure-Object).Count
    Write-Host "`nTotal: $($consoleLogs.Count) console.log statements in $uniqueFiles files" -ForegroundColor Red
}
