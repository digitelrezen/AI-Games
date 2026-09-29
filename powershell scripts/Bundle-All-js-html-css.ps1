$targetDir = $PSScriptRoot
$outputJs = Join-Path $targetDir "CompleteFiles.js"

$files = Get-ChildItem -Path $targetDir -Filter "*.js" | Where-Object { $_.Name -ne "CompleteFiles.js" }
$files += Get-ChildItem -Path $targetDir -Filter "*.html"
$files += Get-ChildItem -Path $targetDir -Filter "*.css"
$files = $files | Sort-Object Name

Set-Content -Path $outputJs -Value "// === COMBINED FILES ===" -Encoding utf8

$packedCount = 0

foreach ($f in $files) {
    Add-Content -Path $outputJs -Value "`n`n// --- START OF FILE: $($f.Name) ---"
    Add-Content -Path $outputJs -Value (Get-Content $f.FullName -Raw)
    Add-Content -Path $outputJs -Value "`n// --- END OF FILE: $($f.Name) ---"
    Write-Host "Packed: $($f.Name)" -ForegroundColor Cyan
    $packedCount++
}

$finalSize = (Get-Item $outputJs).Length
Write-Host "`nDONE! Packed $packedCount files into CompleteFiles.js. Total Size: $finalSize bytes." -ForegroundColor Green   