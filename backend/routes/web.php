<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\File;

Route::get('/', function () {
    return response()->json([
        'message' => 'eForms API',
        'version' => '1.0.0',
        'docs' => '/api/documentation',
    ]);
});

// Serve thumbnails from storage/thumbnails at project root
Route::get('/storage/thumbnails/{filename}', function ($filename) {
    $path = base_path('storage/thumbnails/' . $filename);
    
    if (!File::exists($path)) {
        abort(404);
    }
    
    $file = File::get($path);
    $type = File::mimeType($path);
    
    return response($file, 200)->header('Content-Type', $type);
})->where('filename', '[A-Za-z0-9._-]+');

