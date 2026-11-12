<?php

namespace App\Http\Controllers;

use App\Models\Form;
use App\Models\FormField;
use App\Services\Forms\FieldReferenceValidator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class FormFieldController extends Controller
{
    /**
     * Store a newly created field
     */
    public function store(Request $request, Form $form)
    {
        $this->authorize('update', $form);

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
        $this->authorize('update', $form);

        if ($field->form_id !== $form->id) {
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
        $this->authorize('update', $form);

        if ($field->form_id !== $form->id) {
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
        $this->authorize('update', $form);

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
        $this->authorize('update', $form);

        $request->validate([
            'fields' => 'present|array',
            'fields.*.key' => 'nullable|string|max:64',
            'fields.*.settings' => 'nullable|array',
            'fields.*.conditional_logic' => 'nullable|array',
            'fields.*.random_group_key' => 'nullable|string|max:64',
            'fields.*.variant_key' => 'nullable|string|max:64',
        ]);

        $existing = FormField::where('form_id', $form->id)->get()->keyBy('id');
        $fields = [];
        foreach (array_values($request->fields) as $fieldData) {
            unset($fieldData['form_id']);
            $current = isset($fieldData['id']) ? $existing->get($fieldData['id']) : null;
            if (!$current) {
                unset($fieldData['id']);
            }
            if (empty($fieldData['key'])) {
                $fieldData['key'] = $current->key ?? (string) Str::uuid();
            }
            $fields[] = $fieldData;
        }

        $errors = (new FieldReferenceValidator())->validate($fields);
        if ($errors !== []) {
            return response()->json([
                'message' => 'Cấu hình câu hỏi chưa hợp lệ.',
                'errors' => $errors,
            ], 422);
        }

        DB::transaction(function () use ($form, $fields, $existing) {
            $keptIds = array_filter(array_column($fields, 'id'));
            FormField::where('form_id', $form->id)->whereNotIn('id', $keptIds)->delete();

            // Park kept keys first so keys can move between fields without hitting the unique index.
            foreach ($fields as $fieldData) {
                if (isset($fieldData['id']) && $existing[$fieldData['id']]->key !== $fieldData['key']) {
                    FormField::whereKey($fieldData['id'])->update(['key' => (string) Str::uuid()]);
                }
            }

            foreach ($fields as $fieldData) {
                if (isset($fieldData['id'])) {
                    FormField::find($fieldData['id'])->update($fieldData);
                } else {
                    FormField::create(array_merge($fieldData, ['form_id' => $form->id]));
                }
            }
        });

        return response()->json([
            'message' => 'Fields updated successfully',
            'fields' => $form->fields()->orderBy('order')->get(),
        ]);
    }
}

