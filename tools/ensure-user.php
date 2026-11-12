<?php
// Usage: php tools/ensure-user.php email [name]  — creates the user if missing (random password), prints {"id": ...}.
require __DIR__ . '/../backend/vendor/autoload.php';
$app = require __DIR__ . '/../backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$email = $argv[1] ?? 'e2e-viewer@eforms.test';
$user = App\Models\User::firstOrCreate(
    ['email' => $email],
    ['name' => $argv[2] ?? 'E2E Viewer', 'password' => Illuminate\Support\Str::random(32)]
);
echo json_encode(['id' => $user->id]), PHP_EOL;
