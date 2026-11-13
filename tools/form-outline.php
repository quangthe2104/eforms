<?php
// Usage: php tools/form-outline.php <formId>  — prints fields in order with type, title and any branching/logic settings.
$pdo = new PDO('mysql:host=127.0.0.1;dbname=eforms_db;charset=utf8mb4', 'root', '');
$formId = (int) ($argv[1] ?? 0);
$cols = $pdo->query("SELECT column_name FROM information_schema.columns WHERE table_schema='eforms_db' AND table_name='form_fields'")->fetchAll(PDO::FETCH_COLUMN);
echo 'columns: ', implode(',', $cols), PHP_EOL;
$order = in_array('order', $cols) ? '`order`' : (in_array('position', $cols) ? 'position' : 'id');
$stmt = $pdo->prepare("SELECT * FROM form_fields WHERE form_id=? ORDER BY $order, id");
$stmt->execute([$formId]);
$i = 0;
foreach ($stmt as $f) {
    $i++;
    $title = mb_substr(strip_tags($f['label'] ?? $f['title'] ?? ''), 0, 70);
    $extra = [];
    foreach ($f as $k => $v) {
        if ($v === null || $v === '' || $v === '[]' || $v === '{}') continue;
        if (preg_match('/logic|branch|go_to|goto|next|navigation|condition|section|page|jump|after|settings|validation/i', $k)) {
            $extra[$k] = is_string($v) && strlen($v) > 300 ? substr($v, 0, 300) . '…' : $v;
        }
    }
    printf("%3d #%s [%s] %s %s\n", $i, $f['id'], $f['type'] ?? '?', $title, $extra ? json_encode($extra, JSON_UNESCAPED_UNICODE) : '');
}
