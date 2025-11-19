<?php
require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

try {
    $columns = DB::select("SHOW COLUMNS FROM forms WHERE Field LIKE '%color%' OR Field LIKE '%font%' OR Field LIKE '%header_image%'");
    
    echo "Theme columns in forms table:\n";
    foreach ($columns as $column) {
        echo "- {$column->Field}: {$column->Type}\n";
    }
    
    if (empty($columns)) {
        echo "\n⚠️  NO THEME COLUMNS FOUND!\n";
        echo "\nYou need to run this SQL:\n\n";
        echo file_get_contents(__DIR__ . '/add_theme_columns.sql');
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

