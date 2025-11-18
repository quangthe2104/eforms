<?php

namespace App\Http\Controllers;

use App\Models\Form;
use App\Exports\FormResponsesExport;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;

class ExportController extends Controller
{
    /**
     * Export form responses to Excel
     */
    public function exportResponses(Request $request, Form $form)
    {
        // Check ownership
        if ($form->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $fileName = 'form-' . $form->slug . '-responses-' . now()->format('Y-m-d') . '.xlsx';

        return Excel::download(new FormResponsesExport($form), $fileName);
    }

    /**
     * Export single response to Excel
     */
    public function exportSingleResponse(Request $request, Form $form, $responseId)
    {
        // Check ownership
        if ($form->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $response = $form->responses()->findOrFail($responseId);

        $fileName = 'response-' . $response->id . '-' . now()->format('Y-m-d') . '.xlsx';

        return Excel::download(new FormResponsesExport($form, $response->id), $fileName);
    }
}

