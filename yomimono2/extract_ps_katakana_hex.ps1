$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding $False
try {
    $dir = "c:\Users\shingo\Desktop\microtools\yomimono2\public\settings"
    $files = Get-ChildItem -Path $dir -Filter "*.mdx" | Where-Object { $_.Name -match "^ep\d+\.mdx$" -or $_.Name -eq "yomikiri.mdx" }
    $text = ""
    foreach ($f in $files) {
        $text += [IO.File]::ReadAllText($f.FullName, $utf8NoBom) + "`n"
    }

    $regex = "[$([char]0x30A1)-$([char]0x30F6)$([char]0x30FC)]{2,}"
    $matches = [regex]::Matches($text, $regex)
    $counts = @{}
    foreach ($m in $matches) {
        $val = $m.Value
        if ($val -match "^$([char]0x30FC)+$") { continue }
        if (-not $counts.ContainsKey($val)) { $counts[$val] = 0 }
        $counts[$val]++
    }

    $outlines = New-Object System.Collections.Generic.List[string]
    $outlines.Add("Word,Count")
    $counts.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 200 | ForEach-Object {
        $outlines.Add("$($_.Name),$($_.Value)")
    }
    
    [IO.File]::WriteAllLines("c:\Users\shingo\Desktop\microtools\yomimono2\katakana_ranking.csv", $outlines, $utf8NoBom)
} catch {
    [IO.File]::WriteAllText("c:\Users\shingo\Desktop\microtools\yomimono2\katakana_ranking.csv", $_.Exception.Message, $utf8NoBom)
}
