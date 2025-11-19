<?php

namespace App\Http\Controllers;

use App\Models\Form;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FormController extends Controller
{
    /**
     * Display a listing of the user's forms
     */
    public function index(Request $request)
    {
        $query = Form::with(['fields', 'responses'])
            ->where('user_id', $request->user()->id);

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
            'form' => $form,
        ], 201);
    }

    /**
     * Display the specified form
     */
    public function show(Request $request, Form $form)
    {
        // Check ownership
        if ($form->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $form->load(['fields', 'responses.answers']);

        return response()->json($form);
    }

    /**
     * Update the specified form
     */
    public function update(Request $request, Form $form)
    {
        // Check ownership
        if ($form->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'status' => 'sometimes|in:draft,published,closed',
            'settings' => 'nullable|array',
            'is_public' => 'sometimes|boolean',
            'accept_responses' => 'sometimes|boolean',
            'show_progress_bar' => 'sometimes|boolean',
            'shuffle_questions' => 'sometimes|boolean',
            'limit_responses' => 'sometimes|boolean',
            'max_responses' => 'nullable|integer|min:1',
            'require_login' => 'sometimes|boolean',
            'custom_thank_you_message' => 'nullable|string',
            'thumbnail' => 'nullable|string', // Base64 image data
            'primary_color' => 'nullable|string|max:255',
            'secondary_color' => 'nullable|string|max:255',
            'background_color' => 'nullable|string|max:255',
            'header_image' => 'nullable|string', // Base64 image data
            'font_family' => 'nullable|string|max:255',
            'header_font_size' => 'nullable|string|max:255',
            'question_font_size' => 'nullable|string|max:255',
            'text_font_size' => 'nullable|string|max:255',
        ]);

        $form->update($request->all());
        
        // Force refresh from database, not cache
        $form = Form::find($form->id);

        return response()->json([
            'message' => 'Form updated successfully',
            'form' => $form,
        ]);
    }

    /**
     * Remove the specified form
     */
    public function destroy(Request $request, Form $form)
    {
        // Check ownership
        if ($form->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

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
        // Check ownership
        if ($form->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        DB::beginTransaction();
        try {
            // Create new form
            $newForm = $form->replicate();
            $newForm->title = $form->title . ' (Copy)';
            $newForm->slug = null; // Will be auto-generated
            $newForm->status = 'draft';
            $newForm->save();

            // Copy fields
            foreach ($form->fields as $field) {
                $newField = $field->replicate();
                $newField->form_id = $newForm->id;
                $newField->save();
            }

            DB::commit();

            return response()->json([
                'message' => 'Form duplicated successfully',
                'form' => $newForm->load('fields'),
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
        // Check ownership
        if ($form->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

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

