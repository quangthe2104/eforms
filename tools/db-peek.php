<?php
// Usage: php tools/db-peek.php "SQL" [maxRows=20]  — prints rows as compact JSON lines.
$pdo = new PDO('mysql:host=127.0.0.1;dbname=eforms_db;charset=utf8mb4', 'root', '');
$stmt = $pdo->query($argv[1] ?? 'SELECT 1');
$max = (int) ($argv[2] ?? 20);
$i = 0;
while (($row = $stmt->fetch(PDO::FETCH_ASSOC)) && $i++ < $max) {
    echo json_encode($row, JSON_UNESCAPED_UNICODE), PHP_EOL;
}
