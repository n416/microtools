$ErrorActionPreference = "Stop"
try {
    $dir = "c:\Users\shingo\Desktop\microtools\yomimono2\public\settings"
    $files = Get-ChildItem -Path $dir -Filter "*.mdx"
    $text = ""
    foreach ($f in $files) {
        $text += [IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8) + "`n"
    }

    $matches = [regex]::Matches($text, '[ァ-ヶー]{2,}')
    $counts = @{}
    foreach ($m in $matches) {
        $val = $m.Value
        if ($val -match '^[ー]+$') { continue }
        if (-not $counts.ContainsKey($val)) { $counts[$val] = 0 }
        $counts[$val]++
    }

    $outText = "Word,Count`n"
    $counts.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 200 | ForEach-Object {
        $outText += "$($_.Name),$($_.Value)`n"
    }
    
    [IO.File]::WriteAllText("c:\Users\shingo\Desktop\microtools\yomimono2\katakana_ranking.csv", $outText, [System.Text.Encoding]::UTF8)
} catch {
    [IO.File]::WriteAllText("c:\Users\shingo\Desktop\microtools\yomimono2\katakana_ranking.csv", $_.Exception.Message, [System.Text.Encoding]::UTF8)
}
