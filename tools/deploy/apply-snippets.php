<?php
// Usage: php apply-snippets.php <dist/index.html> [snippetsDir=<frontend>/snippets]
// Fills the <!-- site-snippets:NAME --> … <!-- /site-snippets:NAME --> blocks of a built index.html with
// snippetsDir/NAME.html (head.html, body.html). Those files are live-only config (analytics tags, widgets…),
// kept out of git and never overwritten by a release. A missing file leaves its block empty. Safe to re-run.
$index = $argv[1] ?? null;
if (!$index || !is_file($index)) {
    fwrite(STDERR, "usage: php apply-snippets.php <dist/index.html> [snippetsDir]\n");
    exit(1);
}
$dir = $argv[2] ?? dirname($index, 2) . '/snippets';
$html = file_get_contents($index);

foreach (['head', 'body'] as $name) {
    $file = "$dir/$name.html";
    $content = is_file($file) ? trim(file_get_contents($file)) : '';
    $open = "<!-- site-snippets:$name -->";
    $close = "<!-- /site-snippets:$name -->";
    $html = preg_replace_callback(
        '#' . preg_quote($open, '#') . '.*?' . preg_quote($close, '#') . '#s',
        fn () => $open . ($content === '' ? '' : "\n$content\n") . $close,
        $html,
        -1,
        $count
    );
    echo "$name: " . (!$count ? 'MARKER MISSING' : ($content === '' ? 'empty' : strlen($content) . ' bytes from ' . $file)) . PHP_EOL;
}

file_put_contents($index, $html);
