<?php

namespace App\Http\Controllers;

use App\Models\Form;
use App\Models\FormChange;
use App\Services\Forms\FormChangeLog;
use App\Services\Forms\FormOpsApplier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Autosave (batches of ops) and live sync (polling for other editors' changes + presence).
 */
class FormSyncController extends Controller
{
    public function ops(Request $request, Form $form, FormOpsApplier $applier)
    {
        $this->authorize('update', $form);

        $data = $request->validate([
            'client_id' => 'required|string|max:64',
            'base_revision' => 'nullable|integer|min:0',
            'ops' => 'required|array|min:1|max:500',
            'ops.*' => 'array',
        ]);

        return response()->json($applier->apply($form, $data['ops'], $request->user()->id, $data['client_id']));
    }

    /**
     * Polled every few seconds by each open editor; keep it to a few indexed queries.
     */
    public function changes(Request $request, Form $form)
    {
        $this->authorize('view', $form);

        $data = $request->validate([
            'since' => 'required|integer|min:0',
            'client_id' => 'required|string|max:64',
            'active_field' => 'nullable|string|max:64',
        ]);
        $clientId = $data['client_id'];
        $now = now();

        DB::table('form_presence')->upsert([[
            'form_id' => $form->id,
            'client_id' => $clientId,
            'user_id' => $request->user()->id,
            'active_field_key' => $data['active_field'] ?? null,
            'last_seen_at' => $now,
        ]], ['form_id', 'client_id'], ['user_id', 'active_field_key', 'last_seen_at']);

        $revision = (int) $form->revision;
        $since = (int) $data['since'];
        $reset = $since > $revision || $revision - $since > FormChangeLog::MAX_GAP;
        $changes = [];

        if (!$reset && $since < $revision) {
            $window = FormChange::where('form_id', $form->id)
                ->where('revision', '>', $since)
                ->where('revision', '<=', $revision);
            $reset = (clone $window)->count() < $revision - $since;

            if (!$reset) {
                $rows = $window
                    ->where(fn ($q) => $q->whereNull('client_id')->orWhere('client_id', '!=', $clientId))
                    ->leftJoin('users', 'users.id', '=', 'form_changes.user_id')
                    ->orderBy('revision')
                    ->toBase()
                    ->get(['form_changes.revision', 'form_changes.user_id', 'users.name', 'form_changes.client_id', 'form_changes.ops']);

                foreach ($rows as $row) {
                    $ops = json_decode($row->ops, true) ?: [];
                    if (in_array('form.reload', array_column($ops, 'type'), true)) {
                        $reset = true;
                        break;
                    }
                    $changes[] = [
                        'revision' => (int) $row->revision,
                        'user' => $row->user_id ? ['id' => (int) $row->user_id, 'name' => $row->name] : null,
                        'client_id' => $row->client_id,
                        'ops' => $ops,
                    ];
                }
            }
        }

        $presence = DB::table('form_presence')
            ->join('users', 'users.id', '=', 'form_presence.user_id')
            ->where('form_presence.form_id', $form->id)
            ->where('form_presence.client_id', '!=', $clientId)
            ->where('form_presence.last_seen_at', '>=', $now->copy()->subSeconds(FormChangeLog::PRESENCE_TTL_SECONDS))
            ->orderBy('users.name')
            ->orderBy('form_presence.client_id')
            ->get(['form_presence.user_id', 'users.name', 'form_presence.client_id', 'form_presence.active_field_key'])
            ->map(fn ($p) => [
                'user_id' => (int) $p->user_id,
                'name' => $p->name,
                'client_id' => $p->client_id,
                'active_field_key' => $p->active_field_key,
            ]);

        return response()->json([
            'revision' => $revision,
            'changes' => $reset ? [] : $changes,
            'presence' => $presence,
            'reset' => $reset,
        ]);
    }
}
