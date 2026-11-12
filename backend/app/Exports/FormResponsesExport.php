<?php

namespace App\Exports;

use App\Models\Form;
use App\Services\Forms\ResponseTable;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithCustomValueBinder;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Cell\DefaultValueBinder;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class FormResponsesExport extends DefaultValueBinder implements FromCollection, WithHeadings, WithMapping, WithTitle, WithStyles, WithCustomValueBinder
{
    protected $form;
    protected $responseId;

    private ?Collection $responses = null;
    private ?ResponseTable $table = null;

    public function __construct(Form $form, $responseId = null)
    {
        $this->form = $form;
        $this->responseId = $responseId;
    }

    public function collection()
    {
        return $this->responses();
    }

    public function map($response): array
    {
        return $this->table()->row($response);
    }

    public function headings(): array
    {
        return $this->table()->headings();
    }

    /** Text stays text: keeps leading zeros of phone numbers and never turns answers into formulas. */
    public function bindValue(Cell $cell, $value)
    {
        if (is_string($value)) {
            $cell->setValueExplicit($value, DataType::TYPE_STRING);
            return true;
        }
        return parent::bindValue($cell, $value);
    }

    public function title(): string
    {
        $title = trim(preg_replace('/[\\\\\/\?\*\[\]:]/u', ' ', (string) $this->form->title)) ?: 'Responses';
        return mb_substr($title, 0, 31);
    }

    public function styles(Worksheet $sheet)
    {
        return [
            1 => ['font' => ['bold' => true]],
        ];
    }

    private function responses(): Collection
    {
        if ($this->responses === null) {
            $query = $this->form->responses()->with(['answers', 'user', 'identities'])->orderBy('id');
            if ($this->responseId) {
                $query->where('id', $this->responseId);
            }
            $this->responses = $query->get();
        }
        return $this->responses;
    }

    private function table(): ResponseTable
    {
        return $this->table ??= new ResponseTable($this->form, $this->responses());
    }
}
