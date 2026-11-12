<?php
// Prints the rows of an .xlsx file as JSON: php tools/xlsx-peek.php file.xlsx
// Each cell is {v: value, t: PhpSpreadsheet data type}.
require __DIR__ . '/../backend/vendor/autoload.php';

$sheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($argv[1])->getActiveSheet();
$rows = [];
foreach ($sheet->getRowIterator() as $row) {
    $cells = [];
    foreach ($row->getCellIterator() as $cell) {
        $cells[] = ['v' => $cell->getValue(), 't' => $cell->getDataType()];
    }
    $rows[] = $cells;
}
echo json_encode(['title' => $sheet->getTitle(), 'rows' => $rows], JSON_UNESCAPED_UNICODE);
