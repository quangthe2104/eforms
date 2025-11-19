<?php

namespace App\Http\Controllers;

use App\Models\Form;
use App\Models\FormResponse;
use App\Models\ResponseAnswer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class FormResponseController extends Controller
{
    /**
     * Get all responses for a form
     */
    public function index(Request $request, Form $form)
    {
        // Check ownership
        if ($form->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $responses = FormResponse::with(['answers.field', 'user'])
            ->where('form_id', $form->id)
            ->latest('submitted_at')
            ->paginate(50);

        return response()->json($responses);
    }

    /**
     * Submit a form response (public endpoint)
     */
    public function submit(Request $request, $slug)
    {
        $form = Form::where('slug', $slug)->firstOrFail();

        // Check if form can accept responses
        if (!$form->canAcceptResponses()) {
            return response()->json([
                'message' => 'This form is not accepting responses',
            ], 403);
        }

        // Check if login is required
        if ($form->require_login && !$request->user()) {
            return response()->json([
                'message' => 'You must be logged in to submit this form',
            ], 401);
        }

        // Validate answers
        $fields = $form->fields;
        $rules = [];
        
        // Field types that don't require answers
        $nonAnswerTypes = ['section', 'description', 'image', 'video'];
        
        foreach ($fields as $field) {
            // Skip validation for non-answer field types
            if (in_array($field->type, $nonAnswerTypes)) {
                continue;
            }
            
            $fieldRules = [];
            
            if ($field->is_required) {
                $fieldRules[] = 'required';
            }
            
            // Add type-specific validation
            switch ($field->type) {
                case 'email':
                    $fieldRules[] = 'email';
                    break;
                case 'number':
                    $fieldRules[] = 'numeric';
                    break;
                case 'url':
                    $fieldRules[] = 'url';
                    break;
                case 'file_upload':
                    $fieldRules[] = 'file';
                    break;
            }
            
            if (!empty($fieldRules)) {
                $rules['answers.' . $field->id] = $fieldRules;
            }
        }

        $validated = $request->validate([
            'answers' => 'required|array',
        ] + $rules);

        DB::beginTransaction();
        try {
            // Create response
            $response = FormResponse::create([
                'form_id' => $form->id,
                'user_id' => $request->user()->id ?? null,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            // Save answers
            foreach ($validated['answers'] as $fieldId => $value) {
                $field = $fields->firstWhere('id', $fieldId);
                
                if (!$field) {
                    continue;
                }
                
                // Skip saving answers for non-answer field types
                if (in_array($field->type, $nonAnswerTypes)) {
                    continue;
                }

                $answerData = [
                    'response_id' => $response->id,
                    'field_id' => $fieldId,
                ];

                // Handle file upload
                if ($field->type === 'file_upload' && $request->hasFile('answers.' . $fieldId)) {
                    $file = $request->file('answers.' . $fieldId);
                    $path = $file->store('form-uploads', 'public');
                    $answerData['file_path'] = $path;
                    $answerData['value'] = $file->getClientOriginalName();
                } else {
                    // For grid fields (multiple_choice_grid, checkbox_grid), value is already an object/array
                    // Don't wrap it in another array
                    if (in_array($field->type, ['multiple_choice_grid', 'checkbox_grid'])) {
                        // Value is already an object like {"Row 1": "Col A", "Row 2": ["Col B", "Col C"]}
                        $answerData['value'] = $value;
                    } elseif (is_array($value)) {
                        // For checkbox and other array types
                        $answerData['value'] = $value;
                    } else {
                        // For single values (text, radio, etc)
                        $answerData['value'] = $value;
                    }
                }

                ResponseAnswer::create($answerData);
            }

            DB::commit();

            return response()->json([
                'message' => 'Form submitted successfully',
                'response_id' => $response->id,
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to submit form',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get a single response
     */
    public function show(Request $request, Form $form, FormResponse $response)
    {
        // Check ownership
        if ($form->user_id !== $request->user()->id || $response->form_id !== $form->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $response->load(['answers.field', 'user']);

        return response()->json($response);
    }

    /**
     * Delete a response
     */
    public function destroy(Request $request, Form $form, FormResponse $response)
    {
        // Check ownership
        if ($form->user_id !== $request->user()->id || $response->form_id !== $form->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Delete uploaded files
        foreach ($response->answers as $answer) {
            if ($answer->file_path) {
                Storage::disk('public')->delete($answer->file_path);
            }
        }

        $response->delete();

        return response()->json([
            'message' => 'Response deleted successfully',
        ]);
    }

    /**
     * Get form for public view (no auth required)
     */
    public function getPublicForm($slug)
    {
        $form = Form::with('fields')
            ->where('slug', $slug)
            ->where('status', 'published')
            ->where('is_public', true)
            ->firstOrFail();

        return response()->json($form);
    }
}

