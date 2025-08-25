Get-ChildItem -Path 'src' -Recurse -Filter '*.ts' | ForEach-Object { 
    $lineCount = (Get-Content $_.FullName | Measure-Object -Line).Lines; 
    [PSCustomObject]@{
        File = $_.FullName.Replace((Get-Location).Path + '\', ''); 
        Lines = $lineCount
    } 
} | Sort-Object Lines -Descending | Format-Table -AutoSize