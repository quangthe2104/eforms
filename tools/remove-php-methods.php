<?php
// Usage: php tools/remove-php-methods.php <file> <method> [<method>...]
// Removes public methods (with their preceding docblock) by brace matching.
[$script, $file] = $argv;
$methods = array_slice($argv, 2);
$src = file_get_contents($file);

foreach ($methods as $method) {
    if (!preg_match('/\n(    \/\*\*(?:(?!\*\/).)*?\*\/\n)?    public function ' . preg_quote($method) . '\s*\(/s', $src, $m, PREG_OFFSET_CAPTURE)) {
        fwrite(STDERR, "not found: $method\n");
        exit(1);
    }
    $start = $m[0][1];
    $open = strpos($src, '{', $start + strlen($m[0][0]));
    $depth = 0;
    for ($i = $open, $n = strlen($src); $i < $n; $i++) {
        if ($src[$i] === '{') $depth++;
        if ($src[$i] === '}' && --$depth === 0) break;
    }
    $end = $i + 1;
    if (substr($src, $end, 1) === "\n") $end++;
    $src = substr($src, 0, $start) . substr($src, $end);
    echo "removed $method\n";
}
file_put_contents($file, $src);
