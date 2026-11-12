<?php

namespace App\Http\Controllers;

use App\Models\Form;
use App\Models\FormResponse;
use App\Services\Forms\ResponseSummary;
use Illuminate\Http\Request;
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

        $responses->getCollection()->each(fn ($response) => $this->maskHidden($response));

        return response()->json($responses);
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

        $response->load(['answers.field', 'user', 'identities']);
        $this->maskHidden($response);
        $response->setAttribute('identity_methods', $response->identities->pluck('method')->unique()->values());
        $response->unsetRelation('identities');

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
     * Summary statistics; `variants[<block key>]=<variant key>` narrows a random section to one variant.
     */
    public function summary(Request $request, Form $form)
    {
        // Check ownership
        if ($form->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $filter = array_filter(
            (array) $request->query('variants', []),
            fn ($v, $k) => is_string($k) && is_string($v) && $v !== '',
            ARRAY_FILTER_USE_BOTH
        );

        return response()->json((new ResponseSummary($form))->build($filter));
    }

    /** Hash-only questions never expose a value; uploaded files get a public URL. */
    private function maskHidden(FormResponse $response): void
    {
        foreach ($response->answers as $answer) {
            if ($answer->field?->setting('store_hash_only')) {
                $answer->value = null;
                $answer->setAttribute('hidden', true);
            }
            if ($answer->file_path) {
                $answer->setAttribute('file_url', url('storage/' . $answer->file_path));
            }
        }
    }
}
