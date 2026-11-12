# Runs every frontend unit script and E2E script one at a time (the WAMP backend 500s under parallel load) and prints one line per script.
# Usage: powershell -File tools/run-e2e-all.ps1 [-Only name1,name2]   (names without .mjs)
param([string[]]$Only)
$scripts = @(
    'test-ops', 'test-form-runtime', 'test-form-structure',
    'e2e-editor-header', 'e2e-autosave', 'e2e-sync', 'e2e-builder', 'e2e-phase4', 'e2e-share', 'e2e-polish',
    'e2e-public', 'e2e-survey'
)
if ($Only) { $scripts = $Only -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ } }
Set-Location $PSScriptRoot
foreach ($s in $scripts) {
    $start = Get-Date
    $out = & node "$s.mjs" 2>&1 | ForEach-Object { "$_" }
    $code = $LASTEXITCODE
    $secs = [int]((Get-Date) - $start).TotalSeconds
    $out | Set-Content -Encoding utf8 (Join-Path 'out' "$s.log")
    $summary = ($out | Select-Object -Last 1)
    "{0,-18} exit={1} {2,4}s  {3}" -f $s, $code, $secs, $summary
    if ($code -ne 0) { $out | Where-Object { $_ -match '^FAIL' } | Select-Object -First 8 | ForEach-Object { "    $_" } }
}
