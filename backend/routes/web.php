<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'message' => 'eForms API',
        'version' => '1.0.0',
        'docs' => '/api/documentation',
    ]);
});

