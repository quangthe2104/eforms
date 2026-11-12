<?php
// Usage: php tools/convert-innodb.php [database=eforms_db]
// Converts every MyISAM table of the database to InnoDB and prints one line per table.
// Back up first (mysqldump). Foreign keys declared in migrations are NOT created by this.
$db = $argv[1] ?? 'eforms_db';
$pdo = new PDO("mysql:host=127.0.0.1;dbname=$db;charset=utf8mb4", 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

$tables = $pdo->query("SELECT TABLE_NAME, TABLE_ROWS FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = " . $pdo->quote($db) . " AND TABLE_TYPE = 'BASE TABLE' AND ENGINE = 'MyISAM'")->fetchAll(PDO::FETCH_KEY_PAIR);

$failed = 0;
foreach ($tables as $table => $rows) {
    $before = (int) $pdo->query("SELECT COUNT(*) FROM `$table`")->fetchColumn();
    try {
        $pdo->exec("ALTER TABLE `$table` ENGINE=InnoDB");
        $after = (int) $pdo->query("SELECT COUNT(*) FROM `$table`")->fetchColumn();
        $ok = $before === $after;
        $failed += $ok ? 0 : 1;
        printf("%-28s %7d rows  %s\n", $table, $after, $ok ? 'InnoDB' : "ROW COUNT CHANGED (was $before)");
    } catch (PDOException $e) {
        $failed++;
        printf("%-28s FAILED: %s\n", $table, $e->getMessage());
    }
}

$left = $pdo->query("SELECT GROUP_CONCAT(TABLE_NAME) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = " . $pdo->quote($db) . " AND TABLE_TYPE = 'BASE TABLE' AND ENGINE <> 'InnoDB'")->fetchColumn();
echo count($tables) . " table(s) processed, $failed problem(s). Non-InnoDB left: " . ($left ?: 'none') . PHP_EOL;
exit($failed ? 1 : 0);
