<?php

use App\Models\FormChange;
use App\Models\FormSession;
use App\Services\Forms\FormChangeLog;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
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

Artisan::command('forms:prune-changes {--hours=' . FormChangeLog::RETAIN_HOURS . '}', function () {
    $changes = FormChange::where('created_at', '<', now()->subHours((int) $this->option('hours')))->delete();
    $presence = DB::table('form_presence')->where('last_seen_at', '<', now()->subHour())->delete();
    $this->info("Deleted {$changes} form changes and {$presence} stale presence rows.");
})->purpose('Delete editor change-log entries older than N hours and stale presence rows');

Schedule::command('forms:prune-sessions')->daily();
Schedule::command('forms:prune-changes')->hourly();
