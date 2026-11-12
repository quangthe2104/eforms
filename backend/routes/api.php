<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\FormController;
use App\Http\Controllers\FormFieldController;
use App\Http\Controllers\FormResponseController;
use App\Http\Controllers\ExportController;
use App\Http\Controllers\FormCollaboratorController;
use App\Http\Controllers\InvitationController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\PublicFormController;
use App\Http\Controllers\ThumbnailController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Public routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Public form routes (no auth required)
Route::get('/forms/public/{slug}', [PublicFormController::class, 'show']);
Route::post('/forms/public/{slug}/assign', [PublicFormController::class, 'assign'])->middleware('throttle:120,1');
Route::post('/forms/public/{slug}/check-identity', [PublicFormController::class, 'checkIdentity'])->middleware('throttle:30,1');
Route::post('/forms/public/{slug}/submit', [PublicFormController::class, 'submit'])->middleware('throttle:120,1');

// Invitation link info (public, the token is the secret)
Route::get('/invitations/{token}', [InvitationController::class, 'show'])->middleware('throttle:30,1');

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
    Route::post('/forms/{form}/thumbnail', [ThumbnailController::class, 'upload']);

    // Form field routes
    Route::post('/forms/{form}/fields', [FormFieldController::class, 'store']);
    Route::put('/forms/{form}/fields/{field}', [FormFieldController::class, 'update']);
    Route::delete('/forms/{form}/fields/{field}', [FormFieldController::class, 'destroy']);
    Route::post('/forms/{form}/fields/reorder', [FormFieldController::class, 'reorder']);
    Route::post('/forms/{form}/fields/bulk-update', [FormFieldController::class, 'bulkUpdate']);

    // Form response routes
    Route::get('/forms/{form}/responses', [FormResponseController::class, 'index']);
    Route::get('/forms/{form}/responses/summary', [FormResponseController::class, 'summary']);
    Route::get('/forms/{form}/responses/{response}', [FormResponseController::class, 'show']);
    Route::delete('/forms/{form}/responses/{response}', [FormResponseController::class, 'destroy']);

    // Export routes
    Route::get('/forms/{form}/export', [ExportController::class, 'exportResponses']);
    Route::get('/forms/{form}/responses/{response}/export', [ExportController::class, 'exportSingleResponse']);

    // Sharing
    Route::get('/users/search', [UserController::class, 'search'])->middleware('throttle:60,1');
    Route::get('/forms/{form}/collaborators', [FormCollaboratorController::class, 'index']);
    Route::post('/forms/{form}/collaborators', [FormCollaboratorController::class, 'store']);
    Route::patch('/forms/{form}/collaborators/{user}', [FormCollaboratorController::class, 'update']);
    Route::delete('/forms/{form}/collaborators/{user}', [FormCollaboratorController::class, 'destroy']);
    Route::post('/forms/{form}/invitations/{invitation}/resend', [FormCollaboratorController::class, 'resend']);
    Route::post('/forms/{form}/invitations/{invitation}/link', [FormCollaboratorController::class, 'link']);
    Route::delete('/forms/{form}/invitations/{invitation}', [FormCollaboratorController::class, 'cancel']);
    Route::post('/invitations/{token}/accept', [InvitationController::class, 'accept'])->middleware('throttle:30,1');
});

