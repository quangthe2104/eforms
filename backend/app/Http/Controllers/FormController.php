<?php

namespace App\Http\Controllers;

use App\Models\Form;
use App\Services\Forms\ConditionEvaluator;
use App\Services\Forms\EditorRules;
use App\Services\Forms\FormChangeLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class FormController extends Controller
{
    /**
     * Display the user's own and shared forms; `filter` = all | mine (owner) | shared (editor/viewer).
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $roles = match ($request->query('filter')) {
            'mine' => [Form::ROLE_OWNER],
            'shared' => [Form::ROLE_EDITOR, Form::ROLE_VIEWER],
            default => Form::ROLES,
        };

        $query = Form::with(['fields', 'responses', 'collaborators:id,name,email'])
            ->withCount('collaboratorRecords as collaborators_count')
            ->whereHas('collaboratorRecords', fn ($q) => $q->where('user_id', $user->id)->whereIn('role', $roles));

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Search
        if ($request->has('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('title', 'like', '%' . $request->search . '%')
                    ->orWhere('description', 'like', '%' . $request->search . '%');
            });
        }

        $forms = $query->latest()->paginate(15);

        $forms->getCollection()->each(function (Form $form) use ($user) {
            $owners = $form->collaborators->where('pivot.role', Form::ROLE_OWNER);
            $owner = $owners->firstWhere('id', $form->user_id) ?? $owners->first();

            $form->setAttribute('my_role', $form->collaborators->firstWhere('id', $user->id)?->pivot->role);
            $form->setAttribute('owner', $owner ? $owner->only(['id', 'name', 'email']) : null);
            $form->unsetRelation('collaborators');
        });

        return response()->json($forms);
    }

    /**
     * Store a newly created form
     */
    public function store(Request $request)
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'settings' => 'nullable|array',
        ]);

        $form = Form::create([
            'user_id' => $request->user()->id,
            'title' => $request->title,
            'description' => $request->description,
            'settings' => $request->settings ?? [],
            'status' => 'draft',
        ]);

        return response()->json([
            'message' => 'Form created successfully',
            'form' => $form->withRoleOf($request->user()),
        ], 201);
    }

    /**
     * Display the specified form
     */
    public function show(Request $request, Form $form)
    {
        $this->authorize('view', $form);

        $form->load(['fields', 'responses.answers']);

        return response()->json($form->withRoleOf($request->user()));
    }

    /**
     * Update the specified form
     */
    public function update(Request $request, Form $form)
    {
        $this->authorize('update', $form);

        $request->validate(EditorRules::form());

        $data = EditorRules::enforceFormInvariants($request->all());

        DB::transaction(function () use ($form, $data, $request) {
            $form->update($data);
            $changed = array_values(array_intersect(array_keys($form->getChanges()), EditorRules::FORM_PROPS));
            if ($changed !== []) {
                $op = ['type' => 'form.update', 'set' => $form->only($changed)];
                FormChangeLog::record($form, $request->user()->id, $request->header('X-Client-Id'), [$op]);
            }
        });

        // Force refresh from database, not cache
        $form = Form::find($form->id);

        return response()->json([
            'message' => 'Form updated successfully',
            'form' => $form->withRoleOf($request->user()),
        ]);
    }

    /**
     * Remove the specified form
     */
    public function destroy(Request $request, Form $form)
    {
        $this->authorize('delete', $form);

        $form->delete();

        return response()->json([
            'message' => 'Form deleted successfully',
        ]);
    }

    /**
     * Duplicate a form
     */
    public function duplicate(Request $request, Form $form)
    {
        $this->authorize('view', $form);

        DB::beginTransaction();
        try {
            // Create new form; the copy belongs to whoever duplicates it
            $newForm = $form->replicate();
            $newForm->user_id = $request->user()->id;
            $newForm->title = $form->title . ' (Copy)';
            $newForm->slug = null; // Will be auto-generated
            $newForm->status = 'draft';
            $newForm->revision = 0;

            $keyMap = [];
            foreach ($form->fields as $field) {
                $keyMap[$field->key] = (string) Str::uuid();
            }
            $remap = fn ($key) => $key !== null && isset($keyMap[$key]) ? $keyMap[$key] : $key;

            $limit = $newForm->respondent_limit;
            if (is_array($limit) && isset($limit['field_keys'])) {
                $limit['field_keys'] = array_map($remap, $limit['field_keys']);
                $newForm->respondent_limit = $limit;
            }
            $newForm->save();

            foreach ($form->fields as $field) {
                $newField = $field->replicate();
                $newField->form_id = $newForm->id;
                $newField->key = $keyMap[$field->key] ?? null;
                $newField->random_group_key = $remap($field->random_group_key);

                $logic = $field->conditional_logic;
                if (ConditionEvaluator::hasRules($logic)) {
                    foreach ($logic['rules'] as &$rule) {
                        $rule['field_key'] = $remap($rule['field_key'] ?? null);
                    }
                    unset($rule);
                    $newField->conditional_logic = $logic;
                }

                $settings = $field->settings;
                if (is_array($settings)) {
                    if (isset($settings['piped_from'])) {
                        $settings['piped_from'] = $remap($settings['piped_from']);
                    }
                    if (isset($settings['filter']['field_key'])) {
                        $settings['filter']['field_key'] = $remap($settings['filter']['field_key']);
                    }
                    $newField->settings = $settings;
                }

                $newField->save();
            }

            DB::commit();

            return response()->json([
                'message' => 'Form duplicated successfully',
                'form' => $newForm->load('fields')->withRoleOf($request->user()),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to duplicate form',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get form statistics
     */
    public function statistics(Request $request, Form $form)
    {
        $this->authorize('view', $form);

        $stats = [
            'total_responses' => $form->responses()->count(),
            'responses_today' => $form->responses()->whereDate('submitted_at', today())->count(),
            'responses_this_week' => $form->responses()->whereBetween('submitted_at', [now()->startOfWeek(), now()->endOfWeek()])->count(),
            'responses_this_month' => $form->responses()->whereMonth('submitted_at', now()->month)->count(),
            'average_completion_time' => null, // Can be calculated if you track start/end time
        ];

        return response()->json($stats);
    }
}

