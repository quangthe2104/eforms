# Usage: powershell -File tools/prod-bundle-grep.ps1 "pattern" — downloads the live JS bundle(s) from ksxh.vn and prints short context around each match.
param([string]$Pattern = 'Hoàn thành', [string]$Base = 'https://ksxh.vn')
$ProgressPreference = 'SilentlyContinue'
$html = (Invoke-WebRequest "$Base/" -UseBasicParsing).Content
$assets = [regex]::Matches($html, 'assets/[A-Za-z0-9_.-]+\.js') | ForEach-Object Value | Select-Object -Unique
"bundles: $($assets -join ', ')"
foreach ($a in $assets) {
    $bytes = (Invoke-WebRequest "$Base/$a" -UseBasicParsing).RawContentStream.ToArray()
    $js = [Text.Encoding]::UTF8.GetString($bytes)
    $ms = [regex]::Matches($js, [regex]::Escape($Pattern))
    "$a size=$($js.Length) matches=$($ms.Count)"
    foreach ($m in $ms | Select-Object -First 8) {
        $s = [Math]::Max(0, $m.Index - 200)
        '  ...' + $js.Substring($s, [Math]::Min(450, $js.Length - $s)) + '...'
    }
}
