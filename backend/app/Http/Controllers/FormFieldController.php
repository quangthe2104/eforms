<?php

namespace App\Http\Controllers;

use App\Models\Form;
use App\Models\FormField;
use Illuminate\Http\Request;

class FormFieldController extends Controller
{
    /**
     * Store a newly created field
     */
    public function store(Request $request, Form $form)
    {
        // Check ownership
        if ($form->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'type' => 'required|string',
            'label' => 'required|string|max:255',
            'placeholder' => 'nullable|string',
            'help_text' => 'nullable|string',
            'options' => 'nullable|array',
            'rows' => 'nullable|array',
            'columns' => 'nullable|array',
            'validation_rules' => 'nullable|array',
            'is_required' => 'boolean',
            'order' => 'integer',
            'conditional_logic' => 'nullable|array',
        ]);

        $field = FormField::create([
            'form_id' => $form->id,
            'type' => $request->type,
            'label' => $request->label,
            'placeholder' => $request->placeholder,
            'help_text' => $request->help_text,
            'options' => $request->options,
            'rows' => $request->rows,
            'columns' => $request->columns,
            'validation_rules' => $request->validation_rules,
            'is_required' => $request->is_required ?? false,
            'order' => $request->order ?? 0,
            'conditional_logic' => $request->conditional_logic,
        ]);

        return response()->json([
            'message' => 'Field created successfully',
            'field' => $field,
        ], 201);
    }

    /**
     * Update the specified field
     */
    public function update(Request $request, Form $form, FormField $field)
    {
        // Check ownership
        if ($form->user_id !== $request->user()->id || $field->form_id !== $form->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'type' => 'sometimes|string',
            'label' => 'sometimes|string|max:255',
            'placeholder' => 'nullable|string',
            'help_text' => 'nullable|string',
            'options' => 'nullable|array',
            'rows' => 'nullable|array',
            'columns' => 'nullable|array',
            'validation_rules' => 'nullable|array',
            'is_required' => 'boolean',
            'order' => 'integer',
            'conditional_logic' => 'nullable|array',
        ]);

        $field->update($request->all());

        return response()->json([
            'message' => 'Field updated successfully',
            'field' => $field,
        ]);
    }

    /**
     * Remove the specified field
     */
    public function destroy(Request $request, Form $form, FormField $field)
    {
        // Check ownership
        if ($form->user_id !== $request->user()->id || $field->form_id !== $form->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $field->delete();

        return response()->json([
            'message' => 'Field deleted successfully',
        ]);
    }

    /**
     * Reorder fields
     */
    public function reorder(Request $request, Form $form)
    {
        // Check ownership
        if ($form->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'fields' => 'required|array',
            'fields.*.id' => 'required|exists:form_fields,id',
            'fields.*.order' => 'required|integer',
        ]);

        foreach ($request->fields as $fieldData) {
            FormField::where('id', $fieldData['id'])
                ->where('form_id', $form->id)
                ->update(['order' => $fieldData['order']]);
        }

        return response()->json([
            'message' => 'Fields reordered successfully',
        ]);
    }

    /**
     * Bulk update fields
     */
    public function bulkUpdate(Request $request, Form $form)
    {
        // Check ownership
        if ($form->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'fields' => 'required|array',
        ]);

        foreach ($request->fields as $fieldData) {
            if (isset($fieldData['id'])) {
                // Update existing field
                $field = FormField::where('id', $fieldData['id'])
                    ->where('form_id', $form->id)
                    ->first();
                
                if ($field) {
                    $field->update($fieldData);
                }
            } else {
                // Create new field
                FormField::create(array_merge($fieldData, ['form_id' => $form->id]));
            }
        }

        return response()->json([
            'message' => 'Fields updated successfully',
            'fields' => $form->fields()->orderBy('order')->get(),
        ]);
    }
}

