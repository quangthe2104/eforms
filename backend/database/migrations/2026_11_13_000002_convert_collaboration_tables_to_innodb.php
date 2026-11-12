<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * On servers whose default engine is MyISAM the collaboration tables were created without
 * transactions or foreign keys. Convert them and add the foreign keys MyISAM dropped.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        if ($this->isMyIsam('form_collaborators')) {
            DB::table('form_collaborators')->whereNotIn('form_id', DB::table('forms')->select('id'))->delete();
            DB::table('form_collaborators')->whereNotIn('user_id', DB::table('users')->select('id'))->delete();
            DB::table('form_collaborators')->whereNotIn('added_by', DB::table('users')->select('id'))->update(['added_by' => null]);
            DB::statement('ALTER TABLE form_collaborators ENGINE=InnoDB');
            Schema::table('form_collaborators', function (Blueprint $table) {
                $table->foreign('form_id')->references('id')->on('forms')->cascadeOnDelete();
                $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
                $table->foreign('added_by')->references('id')->on('users')->nullOnDelete();
            });
        }

        if ($this->isMyIsam('form_invitations')) {
            DB::table('form_invitations')->whereNotIn('form_id', DB::table('forms')->select('id'))->delete();
            foreach (['invited_by', 'accepted_by'] as $column) {
                DB::table('form_invitations')->whereNotIn($column, DB::table('users')->select('id'))->update([$column => null]);
            }
            DB::statement('ALTER TABLE form_invitations ENGINE=InnoDB');
            Schema::table('form_invitations', function (Blueprint $table) {
                $table->foreign('form_id')->references('id')->on('forms')->cascadeOnDelete();
                $table->foreign('invited_by')->references('id')->on('users')->nullOnDelete();
                $table->foreign('accepted_by')->references('id')->on('users')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        // Engine and foreign keys are kept.
    }

    private function isMyIsam(string $table): bool
    {
        $row = DB::selectOne(
            'SELECT ENGINE AS engine FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
            [$table]
        );

        return $row !== null && strcasecmp((string) $row->engine, 'MyISAM') === 0;
    }
};
