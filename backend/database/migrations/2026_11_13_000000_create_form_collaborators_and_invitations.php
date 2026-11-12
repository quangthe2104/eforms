<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('form_collaborators', function (Blueprint $table) {
            $table->id();
            $table->foreignId('form_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('role', ['owner', 'editor', 'viewer']);
            $table->foreignId('added_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['form_id', 'user_id']);
            $table->index(['user_id', 'role']);
        });

        Schema::create('form_invitations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('form_id')->constrained()->cascadeOnDelete();
            $table->string('email', 191);
            $table->enum('role', ['owner', 'editor', 'viewer']);
            $table->string('token_hash', 64)->unique();
            $table->foreignId('invited_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('message')->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('accepted_at')->nullable();
            $table->foreignId('accepted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['form_id', 'email']);
        });

        $now = now();
        DB::table('form_collaborators')->insertUsing(
            ['form_id', 'user_id', 'role', 'created_at', 'updated_at'],
            DB::table('forms')
                ->whereNotNull('user_id')
                ->select('id', 'user_id', DB::raw("'owner'"), DB::raw("'{$now}'"), DB::raw("'{$now}'"))
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('form_invitations');
        Schema::dropIfExists('form_collaborators');
    }
};
