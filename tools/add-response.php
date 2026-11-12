<?php
// Usage: php tools/add-response.php <form_id> [count]
// Adds bare responses (no answers) so the editor treats the form as "has responses". Prints {"count": N}.
require __DIR__ . '/../backend/vendor/autoload.php';
$app = require __DIR__ . '/../backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$form = App\Models\Form::findOrFail((int) ($argv[1] ?? 0));
$count = max(1, (int) ($argv[2] ?? 1));
for ($i = 0; $i < $count; $i++) {
    App\Models\FormResponse::create([
        'form_id' => $form->id,
        'ip_address' => '127.0.0.1',
        'user_agent' => 'e2e',
        'submitted_at' => now(),
    ]);
}
echo json_encode(['count' => $form->responses()->count()]), PHP_EOL;
