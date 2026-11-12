<?php
// Usage: php tools/mint-token.php [user_id] [--revoke]
// Prints {"token": "...", "user": {...}} for a Sanctum token named "e2e"; --revoke deletes those tokens.
require __DIR__ . '/../backend/vendor/autoload.php';
$app = require __DIR__ . '/../backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$userId = (int) ($argv[1] ?? 1);
$user = App\Models\User::findOrFail($userId);
$user->tokens()->where('name', 'e2e')->delete();

if (in_array('--revoke', $argv, true)) {
    echo json_encode(['revoked' => true]), PHP_EOL;
    exit(0);
}

$token = $user->createToken('e2e')->plainTextToken;
echo json_encode(['token' => $token, 'user' => $user->only(['id', 'name', 'email'])]), PHP_EOL;
