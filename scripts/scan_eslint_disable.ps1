$extensions = @('*.ts', '*.js', '*.tsx', '*.jsx')
$disableRules = @()

foreach ($ext in $extensions) {
    Get-ChildItem -Path 'src' -Recurse -Filter $ext | ForEach-Object { 
        $filePath = $_.FullName.Replace((Get-Location).Path + '\', '')
        
        $matches = Select-String -Path $_.FullName -Pattern "eslint-disable" -AllMatches
        
        foreach ($match in $matches) {
            $disableRules += [PSCustomObject]@{
                File = $filePath
                Line = $match.LineNumber
                Content = $match.Line.Trim()
            }
        }
    }
}

if ($disableRules.Count -eq 0) {
    Write-Host "No eslint-disable rules found!" -ForegroundColor Green
} else {
    Write-Host "Found eslint-disable rules:" -ForegroundColor Yellow
    $disableRules | Sort-Object File, Line | Format-Table -AutoSize
    $uniqueFiles = ($disableRules | Select-Object File -Unique | Measure-Object).Count
    Write-Host "Total: $($disableRules.Count) rules in $uniqueFiles files" -ForegroundColor Red
}