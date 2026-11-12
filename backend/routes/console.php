<?php

use App\Models\FormSession;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote')->hourly();

Artisan::command('forms:prune-sessions {--days=30}', function () {
    $deleted = FormSession::whereNull('response_id')
        ->where('updated_at', '<', now()->subDays((int) $this->option('days')))
        ->delete();
    $this->info("Deleted {$deleted} unsubmitted form sessions.");
})->purpose('Delete unsubmitted random-section sessions older than N days');

Schedule::command('forms:prune-sessions')->daily();
