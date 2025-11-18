<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\FormController;
use App\Http\Controllers\FormFieldController;
use App\Http\Controllers\FormResponseController;
use App\Http\Controllers\ExportController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Public routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Public form routes (no auth required)
Route::get('/forms/public/{slug}', [FormResponseController::class, 'getPublicForm']);
Route::post('/forms/public/{slug}/submit', [FormResponseController::class, 'submit']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    // Auth routes
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/profile', [AuthController::class, 'updateProfile']);
    Route::post('/change-password', [AuthController::class, 'changePassword']);

    // Form routes
    Route::apiResource('forms', FormController::class);
    Route::post('/forms/{form}/duplicate', [FormController::class, 'duplicate']);
    Route::get('/forms/{form}/statistics', [FormController::class, 'statistics']);

    // Form field routes
    Route::post('/forms/{form}/fields', [FormFieldController::class, 'store']);
    Route::put('/forms/{form}/fields/{field}', [FormFieldController::class, 'update']);
    Route::delete('/forms/{form}/fields/{field}', [FormFieldController::class, 'destroy']);
    Route::post('/forms/{form}/fields/reorder', [FormFieldController::class, 'reorder']);
    Route::post('/forms/{form}/fields/bulk-update', [FormFieldController::class, 'bulkUpdate']);

    // Form response routes
    Route::get('/forms/{form}/responses', [FormResponseController::class, 'index']);
    Route::get('/forms/{form}/responses/{response}', [FormResponseController::class, 'show']);
    Route::delete('/forms/{form}/responses/{response}', [FormResponseController::class, 'destroy']);

    // Export routes
    Route::get('/forms/{form}/export', [ExportController::class, 'exportResponses']);
    Route::get('/forms/{form}/responses/{response}/export', [ExportController::class, 'exportSingleResponse']);
});

