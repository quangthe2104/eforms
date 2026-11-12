<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('form_fields', function (Blueprint $table) {
            $table->string('key', 64)->nullable()->after('form_id');
            $table->json('settings')->nullable()->after('conditional_logic');
            $table->string('random_group_key', 64)->nullable()->after('settings');
            $table->string('variant_key', 64)->nullable()->after('random_group_key');
        });

        DB::table('form_fields')->whereNull('key')->orderBy('id')->chunkById(500, function ($fields) {
            foreach ($fields as $field) {
                DB::table('form_fields')->where('id', $field->id)->update(['key' => (string) Str::uuid()]);
            }
        });

        Schema::table('form_fields', function (Blueprint $table) {
            $table->unique(['form_id', 'key']);
        });

        Schema::table('forms', function (Blueprint $table) {
            $table->json('respondent_limit')->nullable()->after('require_login');
        });

        Schema::table('form_responses', function (Blueprint $table) {
            $table->json('assignments')->nullable()->after('user_agent');
        });

        Schema::table('response_answers', function (Blueprint $table) {
            $table->string('variant_key', 64)->nullable()->after('field_id');
        });

        Schema::create('form_sessions', function (Blueprint $table) {
            $table->id();
            $table->uuid('token')->unique();
            $table->foreignId('form_id')->constrained()->onDelete('cascade');
            $table->string('device_id', 100)->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->onDelete('set null');
            $table->json('assignments')->nullable();
            $table->foreignId('response_id')->nullable()->constrained('form_responses')->onDelete('set null');
            $table->timestamps();

            $table->index(['form_id', 'response_id']);
        });

        Schema::create('response_identities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('form_id')->constrained()->onDelete('cascade');
            $table->foreignId('response_id')->constrained('form_responses')->onDelete('cascade');
            $table->string('method', 16);
            $table->string('value_hash', 64);
            $table->timestamps();

            $table->index(['form_id', 'method', 'value_hash']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('response_identities');
        Schema::dropIfExists('form_sessions');

        Schema::table('response_answers', function (Blueprint $table) {
            $table->dropColumn('variant_key');
        });

        Schema::table('form_responses', function (Blueprint $table) {
            $table->dropColumn('assignments');
        });

        Schema::table('forms', function (Blueprint $table) {
            $table->dropColumn('respondent_limit');
        });

        Schema::table('form_fields', function (Blueprint $table) {
            $table->dropUnique(['form_id', 'key']);
            $table->dropColumn(['key', 'settings', 'random_group_key', 'variant_key']);
        });
    }
};
