<?php

namespace App\Http\Controllers;

use App\Models\Form;
use Illuminate\Support\Str;

/**
 * Serves the SPA shell for /f/{slug} with the form's title and Open Graph tags filled in,
 * so link previews (Zalo, Facebook, Messenger…) show the form instead of the generic app title.
 */
class FormPageController extends Controller
{
    private const DEFAULT_DESCRIPTION = 'Mời bạn tham gia trả lời biểu mẫu.';

    public function show(string $slug)
    {
        $indexPath = base_path('../frontend/dist/index.html');
        if (!is_file($indexPath)) {
            abort(404);
        }
        $html = file_get_contents($indexPath);

        $form = Form::where('slug', $slug)
            ->whereIn('status', ['published', 'closed'])
            ->where('is_public', true)
            ->first();

        if ($form) {
            $html = $this->withMeta($html, $form);
        }

        return response($html, 200)
            ->header('Content-Type', 'text/html; charset=UTF-8')
            ->header('Cache-Control', 'no-cache, must-revalidate');
    }

    private function withMeta(string $html, Form $form): string
    {
        $e = fn ($v) => htmlspecialchars((string) $v, ENT_QUOTES | ENT_HTML5, 'UTF-8');

        $title = trim($form->title) ?: 'eForms';
        $text = trim(preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags(str_replace(['<br>', '</p>'], ' ', (string) $form->description)), ENT_QUOTES | ENT_HTML5, 'UTF-8')));
        $description = $text !== '' ? Str::limit($text, 200) : self::DEFAULT_DESCRIPTION;
        $image = $form->thumbnail_url ?: $form->header_image;
        if ($image && str_starts_with($image, 'data:')) {
            $image = null;
        }
        if ($image && !preg_match('#^https?://#', $image)) {
            $image = url($image);
        }

        $tags = [
            '<meta name="description" content="' . $e($description) . '" />',
            '<meta property="og:type" content="website" />',
            '<meta property="og:site_name" content="eForms" />',
            '<meta property="og:title" content="' . $e($title) . '" />',
            '<meta property="og:description" content="' . $e($description) . '" />',
            '<meta property="og:url" content="' . $e(url('/f/' . $form->slug)) . '" />',
            '<meta name="twitter:card" content="' . ($image ? 'summary_large_image' : 'summary') . '" />',
        ];
        if ($image) {
            $tags[] = '<meta property="og:image" content="' . $e($image) . '" />';
        }

        $html = preg_replace_callback('#<title>.*?</title>#s', fn () => '<title>' . $e($title) . '</title>', $html, 1);

        return preg_replace_callback('#</head>#i', fn () => '    ' . implode("\n    ", $tags) . "\n  </head>", $html, 1);
    }
}
