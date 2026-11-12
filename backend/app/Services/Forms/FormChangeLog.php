<?php

namespace App\Services\Forms;

use App\Models\Form;
use App\Models\FormChange;
use Illuminate\Support\Facades\DB;

/**
 * Bumps a form's revision and records the ops that produced it, so open editors can catch up.
 */
class FormChangeLog
{
    /** Polls further behind than this reload the whole form instead of replaying changes. */
    public const MAX_GAP = 200;

    public const RETAIN_HOURS = 24;

    /** Presence rows older than this are hidden from other editors. */
    public const PRESENCE_TTL_SECONDS = 30;

    /** Op telling other editors to reload the form (written by endpoints that replace data wholesale). */
    public const RELOAD = ['type' => 'form.reload'];

    /**
     * Must run inside a transaction; the revision update locks the form row until commit.
     *
     * @return int the new revision
     */
    public static function record(Form $form, ?int $userId, ?string $clientId, array $ops): int
    {
        DB::table('forms')->where('id', $form->id)->increment('revision', 1, ['updated_at' => now()]);
        $revision = (int) DB::table('forms')->where('id', $form->id)->value('revision');

        FormChange::create([
            'form_id' => $form->id,
            'revision' => $revision,
            'user_id' => $userId,
            'client_id' => $clientId !== null ? substr($clientId, 0, 64) : null,
            'ops' => array_values($ops),
        ]);

        $form->forceFill(['revision' => $revision])->syncOriginalAttribute('revision');

        return $revision;
    }

    /** Records a wholesale change made outside the ops endpoint. */
    public static function recordReload(Form $form, ?int $userId, ?string $clientId): int
    {
        return DB::transaction(fn () => self::record($form, $userId, $clientId, [self::RELOAD]));
    }
}
