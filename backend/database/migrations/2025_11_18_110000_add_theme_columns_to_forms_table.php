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
        Schema::table('forms', function (Blueprint $table) {
            $table->string('primary_color')->default('#4285F4')->after('thumbnail');
            $table->string('secondary_color')->default('#C6DAFC')->after('primary_color');
            $table->string('background_color')->default('#FFFFFF')->after('secondary_color');
            $table->longText('header_image')->nullable()->after('background_color');
            $table->string('font_family')->default('system-ui, -apple-system, sans-serif')->after('header_image');
            $table->string('header_font_size')->default('32px')->after('font_family');
            $table->string('question_font_size')->default('16px')->after('header_font_size');
            $table->string('text_font_size')->default('14px')->after('question_font_size');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('forms', function (Blueprint $table) {
            $table->dropColumn([
                'primary_color',
                'secondary_color',
                'background_color',
                'header_image',
                'font_family',
                'header_font_size',
                'question_font_size',
                'text_font_size',
            ]);
        });
    }
};

