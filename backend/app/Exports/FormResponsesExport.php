<?php

namespace App\Exports;

use App\Models\Form;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class FormResponsesExport implements FromCollection, WithHeadings, WithMapping, WithTitle, WithStyles
{
    protected $form;
    protected $responseId;
    protected $nonAnswerTypes = ['section', 'description', 'image', 'video'];

    public function __construct(Form $form, $responseId = null)
    {
        $this->form = $form;
        $this->responseId = $responseId;
    }
    
    /**
     * Get fields that should be included in export (exclude non-answer types)
     */
    protected function getExportableFields()
    {
        return $this->form->fields->filter(function($field) {
            return !in_array($field->type, $this->nonAnswerTypes);
        });
    }

    /**
     * Get the responses collection
     */
    public function collection()
    {
        $query = $this->form->responses()->with(['answers.field', 'user']);

        if ($this->responseId) {
            $query->where('id', $this->responseId);
        }

        return $query->get();
    }

    /**
     * Map each response to a row
     */
    public function map($response): array
    {
        $row = [
            $response->id,
            $response->submitted_at->format('Y-m-d H:i:s'),
            $response->user ? $response->user->email : 'Anonymous',
            $response->ip_address,
        ];

        // Add answers for each field (exclude non-answer types)
        foreach ($this->getExportableFields() as $field) {
            $answer = $response->answers->firstWhere('field_id', $field->id);
            
            if ($answer) {
                if ($answer->file_path) {
                    $row[] = url('storage/' . $answer->file_path);
                } else {
                    $value = $answer->value;
                    $row[] = is_array($value) ? implode(', ', $value) : $value;
                }
            } else {
                $row[] = '';
            }
        }

        return $row;
    }

    /**
     * Define the headings
     */
    public function headings(): array
    {
        $headings = [
            'Response ID',
            'Submitted At',
            'User',
            'IP Address',
        ];

        // Add field labels as headings (exclude non-answer types)
        foreach ($this->getExportableFields() as $field) {
            $headings[] = $field->label;
        }

        return $headings;
    }

    /**
     * Set the worksheet title
     */
    public function title(): string
    {
        return substr($this->form->title, 0, 31); // Excel sheet name limit
    }

    /**
     * Style the worksheet
     */
    public function styles(Worksheet $sheet)
    {
        return [
            1 => ['font' => ['bold' => true]],
        ];
    }
}

