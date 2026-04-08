$ErrorActionPreference = "Stop"
try {
    $files = Get-ChildItem -Path "public\settings" -Filter "*.mdx"
    $text = ""
    foreach ($f in $files) {
        $text += [IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8) + "`n"
    }

    $matches = [regex]::Matches($text, '[ァ-ヶー]{2,}')
    $counts = @{}
    foreach ($m in $matches) {
        $val = $m.Value
        if (-not $counts.ContainsKey($val)) { $counts[$val] = 0 }
        $counts[$val]++
    }

    $outText = "Word,Count`n"
    $counts.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object {
        $outText += "$($_.Name),$($_.Value)`n"
    }
    
    [IO.File]::WriteAllText("$PWD\katakana_ranking.csv", $outText, [System.Text.Encoding]::UTF8)
    Write-Host "Success: Katakana extracted."
} catch {
    Write-Host "Error: $($_.Exception.Message)"
}
