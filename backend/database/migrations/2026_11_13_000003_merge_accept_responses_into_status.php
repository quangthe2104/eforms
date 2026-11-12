<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * "Nhận câu trả lời" is the status (published ↔ closed); the old accept_responses checkbox is gone from the editor.
 * Forms that were published with it off become closed, and the column is set back on everywhere so it no longer
 * blocks responses silently (it is kept for API compatibility).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('forms')->where('status', 'published')->where('accept_responses', false)->update(['status' => 'closed']);
        DB::table('forms')->where('accept_responses', false)->update(['accept_responses' => true]);
    }

    public function down(): void
    {
    }
};
