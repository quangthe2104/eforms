<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('forms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('title', 191);
            $table->text('description')->nullable();
            $table->string('slug', 191)->unique();
            $table->json('settings')->nullable();
            $table->enum('status', ['draft', 'published', 'closed'])->default('draft');
            $table->boolean('is_public')->default(true);
            $table->boolean('accept_responses')->default(true);
            $table->boolean('show_progress_bar')->default(false);
            $table->boolean('shuffle_questions')->default(false);
            $table->boolean('limit_responses')->default(false);
            $table->integer('max_responses')->nullable();
            $table->boolean('require_login')->default(false);
            $table->text('custom_thank_you_message')->nullable();
            $table->softDeletes();
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('forms');
    }
};

