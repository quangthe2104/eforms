<?php

namespace App\Services\Forms;

use App\Models\Form;
use App\Models\FormField;
use App\Models\FormResponse;
use App\Models\FormSession;
use App\Models\ResponseAnswer;
use Illuminate\Support\Collection;

/**
 * Per-question statistics for the summary tab, plus per-variant counts of random sections.
 * A variant filter (group key => variant key) narrows the questions of that block to the
 * answers given for the chosen variant.
 */
class ResponseSummary
{
    private const TEXT_TYPES = ['short_text', 'long_text', 'email', 'url', 'phone'];
    private const CHOICE_TYPES = ['dropdown', 'radio', 'checkbox'];
    private const GRID_TYPES = ['multiple_choice_grid', 'checkbox_grid'];
    private const NUMBER_TYPES = ['number', 'rating', 'scale'];
    private const DATE_TYPES = ['date', 'time', 'datetime'];

    private FormStructure $structure;

    public function __construct(private Form $form)
    {
        $this->structure = FormStructure::fromForm($form);
    }

    /** @param array<string, string> $filter */
    public function build(array $filter = []): array
    {
        $responses = FormResponse::where('form_id', $this->form->id)->get(['id', 'assignments']);
        $groups = $this->groups($responses, $filter);
        $submitted = collect($groups)->mapWithKeys(fn ($g) => [$g['key'] => array_column($g['variants'], 'submitted', 'key')])->all();

        $fields = $this->structure->fields->filter(fn (FormField $f) => $f->collectsAnswer())->values();
        $answers = ResponseAnswer::whereIn('field_id', $fields->pluck('id'))
            ->get(['field_id', 'variant_key', 'value', 'file_path'])
            ->groupBy('field_id');

        $summary = [];
        foreach ($fields as $field) {
            $group = $field->random_group_key && $this->structure->group($field->random_group_key) ? $field->random_group_key : null;
            $variant = $group !== null ? ($filter[$group] ?? null) : null;
            $own = $group !== null && $field->variant_key ? (string) $field->variant_key : null;

            if ($variant !== null && $own !== null && $own !== $variant) {
                continue;
            }

            $fieldAnswers = ($answers[$field->id] ?? collect())
                ->when($variant !== null, fn ($c) => $c->where('variant_key', $variant))
                ->filter(fn ($a) => $a->file_path || !AnswerValue::isEmpty($a->value) || $field->setting('store_hash_only'))
                ->values();

            $hidden = (bool) $field->setting('store_hash_only');
            $summary[] = [
                'field_id' => $field->id,
                'label' => $field->label,
                'type' => $field->type,
                'group_key' => $group,
                'variant_key' => $own,
                'base' => $group === null ? $responses->count() : $this->base($submitted[$group] ?? [], $variant ?? $own),
                'hidden' => $hidden,
                'total_answers' => $fieldAnswers->count(),
                'chart_type' => $fieldAnswers->isEmpty() || $hidden ? 'none' : $this->chartType($field->type),
                'data' => $fieldAnswers->isEmpty() || $hidden ? null : $this->data($field, $fieldAnswers),
            ];
        }

        return [
            'total_responses' => $responses->count(),
            'groups' => $groups,
            'fields' => $summary,
        ];
    }

    /** Responses that answered the block (for one variant, or all rounds together). */
    private function base(array $submitted, ?string $variant): int
    {
        return $variant !== null ? (int) ($submitted[$variant] ?? 0) : (int) array_sum($submitted);
    }

    /**
     * "Assigned" = submitted responses + respondents who drew the variant but have not submitted
     * (unsubmitted sessions are pruned after 30 days).
     */
    private function groups(Collection $responses, array $filter): array
    {
        if (!$this->structure->groups()) {
            return [];
        }

        $pending = FormSession::where('form_id', $this->form->id)->whereNull('response_id')->get(['assignments']);
        $count = function (iterable $rows, string $key) {
            $counts = [];
            foreach ($rows as $row) {
                foreach ((array) ($row->assignments[$key] ?? []) as $variant) {
                    $counts[(string) $variant] = ($counts[(string) $variant] ?? 0) + 1;
                }
            }
            return $counts;
        };

        $out = [];
        foreach ($this->structure->groups() as $key => $header) {
            $titles = ResponseTable::variantTitles($header);
            $submitted = $count($responses, $key);
            $drawn = $count($pending, $key);

            $variants = [];
            foreach (array_unique(array_merge(array_keys($titles), array_keys($submitted), array_keys($drawn))) as $variant) {
                $variant = (string) $variant;
                $variants[] = [
                    'key' => $variant,
                    'title' => $titles[$variant] ?? $variant,
                    'deleted' => !isset($titles[$variant]),
                    'submitted' => $submitted[$variant] ?? 0,
                    'assigned' => ($submitted[$variant] ?? 0) + ($drawn[$variant] ?? 0),
                ];
            }

            $out[] = [
                'key' => $key,
                'label' => ResponseTable::blockName($header),
                'mode' => $header->setting('mode') === 'different' ? 'different' : 'same',
                'pick_count' => FormStructure::pickCount($header),
                'filter' => isset($filter[$key]) ? (string) $filter[$key] : null,
                'variants' => $variants,
            ];
        }
        return $out;
    }

    private function chartType(string $type): string
    {
        return match (true) {
            in_array($type, self::TEXT_TYPES, true), $type === 'file_upload' => 'text_list',
            in_array($type, ['dropdown', 'radio'], true) => 'pie',
            in_array($type, self::GRID_TYPES, true) => 'column',
            default => 'bar',
        };
    }

    private function data(FormField $field, Collection $answers): array
    {
        $total = $answers->count();
        $type = $field->type;

        if (in_array($type, self::TEXT_TYPES, true) || $type === 'file_upload') {
            $values = $answers->map(fn ($a) => $a->file_path ? url('storage/' . $a->file_path) : AnswerValue::toText($a->value))
                ->filter(fn ($v) => $v !== '')->values()->all();
            return ['values' => $values];
        }

        if (in_array($type, self::CHOICE_TYPES, true)) {
            $source = $this->structure->field($field->setting('piped_from')) ?? $field;
            $otherLabel = $source->setting('other_option.label') ?: 'Khác';
            $counts = [];
            $others = [];
            foreach ($answers as $answer) {
                $choices = AnswerValue::choices($answer->value);
                foreach ($choices['selected'] as $choice) {
                    $label = $choice === AnswerValue::OTHER ? $otherLabel : $choice;
                    $counts[$label] = ($counts[$label] ?? 0) + 1;
                    if ($choice === AnswerValue::OTHER && $choices['other'] !== null) {
                        $others[] = $choices['other'];
                    }
                }
            }
            $chart = $this->chartData($counts, $total);
            usort($chart, fn ($a, $b) => $b['value'] <=> $a['value']);
            return ['chart_data' => $chart, 'total' => $total, 'other_label' => $otherLabel, 'other_values' => $others];
        }

        if (in_array($type, self::GRID_TYPES, true)) {
            $rows = $field->rows ?? [];
            $columns = $field->columns ?? [];
            $grid = array_fill_keys($rows, array_fill_keys($columns, 0));
            foreach ($answers as $answer) {
                $value = AnswerValue::decode($answer->value);
                if (!is_array($value)) {
                    continue;
                }
                foreach ($value as $row => $cols) {
                    foreach ((array) $cols as $col) {
                        if (is_scalar($col) && isset($grid[$row][(string) $col])) {
                            $grid[$row][(string) $col]++;
                        }
                    }
                }
            }
            return ['grid_data' => $grid, 'rows' => $rows, 'columns' => $columns];
        }

        $counts = [];
        foreach ($answers as $answer) {
            $value = AnswerValue::decode($answer->value);
            $value = is_array($value) ? ($value[0] ?? null) : $value;
            if ($value === null || $value === '' || !is_scalar($value)) {
                continue;
            }
            $label = in_array($type, self::NUMBER_TYPES, true) ? (string) (float) $value : (string) $value;
            $counts[$label] = ($counts[$label] ?? 0) + 1;
        }
        $chart = $this->chartData($counts, $total);
        if (in_array($type, self::NUMBER_TYPES, true)) {
            usort($chart, fn ($a, $b) => (float) $a['label'] <=> (float) $b['label']);
        } elseif (in_array($type, self::DATE_TYPES, true)) {
            usort($chart, fn ($a, $b) => strcmp($a['label'], $b['label']));
        }
        return ['chart_data' => $chart, 'total' => $total];
    }

    private function chartData(array $counts, int $total): array
    {
        $out = [];
        foreach ($counts as $label => $count) {
            $out[] = [
                'label' => (string) $label,
                'value' => $count,
                'percentage' => $total > 0 ? round($count / $total * 100, 1) : 0,
            ];
        }
        return $out;
    }
}
