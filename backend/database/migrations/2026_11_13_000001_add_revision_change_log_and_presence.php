<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('forms', function (Blueprint $table) {
            $table->unsignedBigInteger('revision')->default(0)->after('status');
        });

        // Some servers default to MyISAM, which ignores transactions and foreign keys.
        Schema::create('form_changes', function (Blueprint $table) {
            $table->engine('InnoDB');
            $table->id();
            $table->foreignId('form_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('revision');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('client_id', 64)->nullable();
            $table->json('ops');
            $table->timestamp('created_at')->nullable();

            $table->unique(['form_id', 'revision']);
            $table->index('created_at');
        });

        Schema::create('form_presence', function (Blueprint $table) {
            $table->engine('InnoDB');
            $table->foreignId('form_id')->constrained()->cascadeOnDelete();
            $table->string('client_id', 64);
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('active_field_key', 64)->nullable();
            $table->timestamp('last_seen_at');

            $table->primary(['form_id', 'client_id']);
            $table->index(['form_id', 'last_seen_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('form_presence');
        Schema::dropIfExists('form_changes');
        Schema::table('forms', function (Blueprint $table) {
            $table->dropColumn('revision');
        });
    }
};
