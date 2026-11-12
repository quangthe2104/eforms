<?php
// Usage: php tools/simulate-assign.php [--n=1000]
// Imports a throw-away copy of the 12.11.26 survey, calls POST /assign N times with random
// Câu 2 answers through the Laravel HTTP kernel, prints the distribution per event and the
// number of filter violations (must be 0). The temporary form and its sessions are deleted afterwards
// (the local tables are MyISAM, so a rollback would not undo anything).

use App\Models\Form;
use App\Models\FormField;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

$n = 1000;
foreach ($argv as $arg) {
    if (preg_match('/^--n=(\d+)$/', $arg, $m)) $n = (int) $m[1];
}

$base = dirname(__DIR__) . '/backend';
require $base . '/vendor/autoload.php';
$app = require $base . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$http = $app->make(Illuminate\Contracts\Http\Kernel::class);

$cleanup = function (int $formId) {
    DB::table('form_sessions')->where('form_id', $formId)->delete();
    DB::table('form_fields')->where('form_id', $formId)->delete();
    DB::table('forms')->where('id', $formId)->delete();
};
foreach (DB::table('forms')->where('title', 'SIM assign')->pluck('id') as $leftover) {
    $cleanup($leftover);
}

try {
    Artisan::call('survey:import-1211', ['--json' => true, '--title' => 'SIM assign']);
    $info = json_decode(trim(Artisan::output()), true);
    Form::whereKey($info['id'])->update(['status' => 'published', 'is_public' => true, 'accept_responses' => true]);

    $header = FormField::where('key', $info['keys']['block'])->first();
    $grid = FormField::where('key', $info['keys']['q2'])->first();
    $variants = $header->settings['variants'];
    $rowMap = $header->settings['filter']['row_map'];
    $unheard = $header->settings['filter']['exclude_columns'][0];
    $columns = $grid->columns;

    $call = function (array $body, int $i) use ($http, $info) {
        $req = Request::create("/api/forms/public/{$info['slug']}/assign", 'POST', [], [], [], [
            'REMOTE_ADDR' => '10.' . intdiv($i, 65536) % 256 . '.' . intdiv($i, 256) % 256 . '.' . $i % 256,
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode($body));
        $res = $http->handle($req);
        $http->terminate($req, $res);
        return [$res->getStatusCode(), json_decode($res->getContent(), true)];
    };

    $stats = array_fill_keys(array_column($variants, 'key'), ['assigned' => 0, 'expected' => 0.0, 'unheard' => 0]);
    $violations = 0;
    $fallbacks = 0;
    $errors = [];
    $tokens = [];

    for ($i = 0; $i < $n; $i++) {
        // ~5% have heard of nothing, ~10% of rows are left blank, the rest pick a random column.
        $allUnheard = mt_rand(1, 100) <= 5;
        $answer = [];
        foreach ($grid->rows as $row) {
            if ($allUnheard) { $answer[$row] = $unheard; continue; }
            if (mt_rand(1, 10) === 1) continue;
            $answer[$row] = $columns[array_rand($columns)];
        }
        foreach ($rowMap as $v => $row) {
            if (($answer[$row] ?? null) === $unheard) $stats[$v]['unheard']++;
        }

        [$status, $data] = $call(['answers' => [$grid->id => $answer]], $i);
        $picked = $data['assignments'][$header->key] ?? null;
        if ($status !== 200 || !is_array($picked) || count($picked) !== 1) {
            $errors[] = "#$i HTTP $status " . substr(json_encode($data, JSON_UNESCAPED_UNICODE), 0, 200);
            continue;
        }
        $v = $picked[0];
        $stats[$v]['assigned']++;

        $eligible = array_keys(array_filter($rowMap, fn ($row) => ($answer[$row] ?? null) !== $unheard));
        if ($eligible === []) {
            $fallbacks++;
            foreach ($stats as $k => $_) $stats[$k]['expected'] += 1 / count($stats);
        } else {
            if (!in_array($v, $eligible, true)) $violations++;
            foreach ($eligible as $k) $stats[$k]['expected'] += 1 / count($eligible);
        }
        if ($i < 50) $tokens[] = [$data['token'], $v];
    }

    // Calling again with the same token (and different answers) must return the same variant.
    $changed = 0;
    foreach ($tokens as $j => [$token, $v]) {
        $all = array_fill_keys($grid->rows, $unheard);
        [, $data] = $call(['token' => $token, 'answers' => [$grid->id => $all]], $n + $j);
        if (($data['assignments'][$header->key][0] ?? null) !== $v) $changed++;
    }

    $pad = fn ($s, $w) => $s . str_repeat(' ', max(0, $w - mb_strwidth($s)));
    $titles = array_column($variants, 'title', 'key');
    echo $pad('Mã', 5), ' ', $pad('Sự kiện', 58), " Được bốc  Kỳ vọng   Lệch Chưa nghe\n";
    $chi = 0.0;
    foreach ($stats as $k => $s) {
        $dev = $s['expected'] > 0 ? ($s['assigned'] - $s['expected']) / $s['expected'] * 100 : 0;
        $chi += $s['expected'] > 0 ? ($s['assigned'] - $s['expected']) ** 2 / $s['expected'] : 0;
        printf("%s %s %8d %8.1f %5.1f%% %9d\n", $pad($k, 5), $pad(mb_strimwidth($titles[$k], 0, 56, '…'), 58), $s['assigned'], $s['expected'], $dev, $s['unheard']);
    }
    $ok = $n - count($errors);
    echo "\nSố lượt bốc: $ok/$n | Vi phạm luật loại trừ: $violations | Bốc trong toàn bộ (không còn sự kiện hợp lệ): $fallbacks\n";
    printf("Chi-square so với kỳ vọng: %.2f (9 bậc tự do; > 21.7 là lệch đáng ngờ ở mức 1%%)\n", $chi);
    echo 'Gọi lại cùng token: ' . count($tokens) . " lượt, đổi phiên bản: $changed\n";
    foreach (array_slice($errors, 0, 5) as $e) echo "LỖI $e\n";
    $exit = ($violations === 0 && $changed === 0 && !$errors) ? 0 : 1;
} finally {
    if (!empty($info['id'])) $cleanup($info['id']);
}
exit($exit ?? 1);
