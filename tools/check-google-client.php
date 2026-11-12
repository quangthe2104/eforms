<?php
// Usage: php tools/check-google-client.php
// Checks GOOGLE_CLIENT_ID / VITE_GOOGLE_CLIENT_ID in the .env files and asks Google whether the client exists.

$root = dirname(__DIR__);

function envValue(string $file, string $key): ?string
{
    if (!is_file($file)) return null;
    foreach (file($file, FILE_IGNORE_NEW_LINES) as $line) {
        if (preg_match('/^\s*' . preg_quote($key, '/') . '\s*=(.*)$/', $line, $m)) return $m[1];
    }
    return null;
}

$raw = [
    'backend GOOGLE_CLIENT_ID' => envValue("$root/backend/.env", 'GOOGLE_CLIENT_ID'),
    'frontend VITE_GOOGLE_CLIENT_ID' => envValue("$root/frontend/.env", 'VITE_GOOGLE_CLIENT_ID'),
];
$backendSecret = envValue("$root/backend/.env", 'GOOGLE_CLIENT_SECRET');
$frontendSecret = envValue("$root/frontend/.env", 'VITE_GOOGLE_CLIENT_SECRET');

foreach ($raw as $name => $v) {
    if ($v === null) { echo "MISSING  $name\n"; continue; }
    $clean = trim($v, " \t\"'");
    $issues = [];
    if ($v !== $clean) $issues[] = 'has quotes/spaces';
    if (!preg_match('/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/', $clean)) $issues[] = 'bad format';
    echo ($issues ? 'PROBLEM  ' : 'OK       ') . "$name" . ($issues ? ' (' . implode(', ', $issues) . ')' : '') . "\n";
}

$ids = array_unique(array_map(fn ($v) => trim((string) $v, " \t\"'"), $raw));
echo count($ids) === 1 ? "OK       backend and frontend IDs match\n" : "PROBLEM  backend and frontend IDs differ\n";
if ($frontendSecret !== null) echo "PROBLEM  VITE_GOOGLE_CLIENT_SECRET is in frontend/.env; remove it (it would be shipped to browsers)\n";
if ($backendSecret !== null) echo "NOTE     GOOGLE_CLIENT_SECRET is set in backend/.env; this flow does not need it\n";

$id = reset($ids);
foreach (['http://localhost:5173', 'http://eforms.test:5173'] as $origin) {
    $url = 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
        'client_id' => $id,
        'redirect_uri' => 'storagerelay://' . str_replace('://', '/', $origin) . '?id=auth1',
        'response_type' => 'permission id_token',
        'scope' => 'openid email profile',
        'prompt' => 'select_account',
    ]);
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 20, CURLOPT_SSL_VERIFYPEER => false]);
    $body = (string) curl_exec($ch);
    $final = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
    $err = curl_error($ch);
    curl_close($ch);

    if ($err) { echo "ERROR    $origin: $err\n"; continue; }
    $hay = $final . ' ' . $body;
    if (preg_match('/invalid_client|OAuth client was not found|deleted_client/i', $hay)) $verdict = 'PROBLEM  client not found / deleted';
    elseif (preg_match('/origin_mismatch|redirect_uri_mismatch|not a valid origin|Origin mismatch/i', $hay)) $verdict = 'PROBLEM  origin not authorized';
    elseif (preg_match('/ServiceLogin|signin|identifier|accountchooser/i', $final)) $verdict = 'OK       client exists, OAuth endpoint accepted origin (the GIS button may still need http://localhost too)';
    else $verdict = 'UNKNOWN  final URL: ' . substr($final, 0, 150);
    echo "$verdict  [$origin]\n";
}
