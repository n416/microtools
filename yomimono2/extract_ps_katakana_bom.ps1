$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding $False
try {
    $dir = "c:\Users\shingo\Desktop\microtools\yomimono2\public\settings"
    $files = Get-ChildItem -Path $dir -Filter "*.mdx"
    $text = ""
    foreach ($f in $files) {
        $text += [IO.File]::ReadAllText($f.FullName, $utf8NoBom) + "`n"
    }

    $matches = [regex]::Matches($text, '[ァ-ヶー]{2,}')
    $counts = @{}
    foreach ($m in $matches) {
        $val = $m.Value
        if ($val -match '^ー+$') { continue }
        if (-not $counts.ContainsKey($val)) { $counts[$val] = 0 }
        $counts[$val]++
    }

    $outlines = New-Object System.Collections.Generic.List[string]
    $outlines.Add("Word,Count")
    $counts.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 100 | ForEach-Object {
        $outlines.Add("$($_.Name),$($_.Value)")
    }
    
    [IO.File]::WriteAllLines("c:\Users\shingo\Desktop\microtools\yomimono2\katakana_ranking.csv", $outlines, $utf8NoBom)
} catch {
}
