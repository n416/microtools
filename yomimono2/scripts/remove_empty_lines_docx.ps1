param (
    [Parameter(Mandatory=$true)]
    [string]$DocPath
)

try {
    $fullPath = [System.IO.Path]::GetFullPath($DocPath)

    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    # Suppress all background invisible dialogs (e.g., read-only prompts, macros)
    $word.DisplayAlerts = 0 
    
    $doc = $word.Documents.Open($fullPath)
    
    $deletedCount = 0
    $i = 1
    $loopCountCurrentPage = 0

    while ($true) {
        $pages = $doc.ComputeStatistics(2)
        if ($i -gt $pages) {
            break
        }

        $range = $doc.GoTo(1, 1, $i)
        $range.Expand(4)
        $text = $range.Text
        
        if ($text -match "^[\s\r]*$" -and $loopCountCurrentPage -lt 3) {
            $range.Delete()
            $deletedCount++
            $loopCountCurrentPage++
            
            $doc.Repaginate()
        } else {
            $i++
            $loopCountCurrentPage = 0
        }
    }

    $doc.Close(-1)
    $word.Quit()
    
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($doc) | Out-Null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
    
    exit 0
}
catch {
    if ($word) {
        try { if ($doc) { $doc.Close(0) | Out-Null } } catch {}
        try { $word.Quit() } catch {}
        try { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null } catch {}
    }
    exit 1
}
