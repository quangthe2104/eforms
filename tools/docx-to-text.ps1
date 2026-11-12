param([Parameter(Mandatory)][string]$Path, [string]$Out)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $Path))
try {
    $entry = $zip.GetEntry('word/document.xml')
    $reader = New-Object System.IO.StreamReader($entry.Open(), [System.Text.Encoding]::UTF8)
    $xml = $reader.ReadToEnd()
    $reader.Close()
} finally { $zip.Dispose() }
$xml = $xml -replace '</w:p>', "`n" -replace '<w:tab/>', "`t" -replace '</w:tc>', ' | '
$text = [System.Net.WebUtility]::HtmlDecode(($xml -replace '<[^>]+>', ''))
$text = ($text -split "`n" | ForEach-Object { $_.TrimEnd() } | Where-Object { $_ -ne '' }) -join "`n"
if ($Out) { [System.IO.File]::WriteAllText($Out, $text, [System.Text.Encoding]::UTF8); "Written $Out ($($text.Length) chars)" } else { $text }
