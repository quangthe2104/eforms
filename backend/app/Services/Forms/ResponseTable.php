<?php

namespace App\Services\Forms;

use App\Models\Form;
use App\Models\FormField;
use App\Models\FormResponse;
use App\Models\ResponseAnswer;
use Illuminate\Support\Collection;

/**
 * Column layout of the responses spreadsheet.
 *
 * Random sections expand to:
 * - same questions, one variant per respondent: a "variant" column, then one shared set of columns;
 * - same questions, several variants: one set per round ("Lượt 1 – …");
 * - different questions: one set per variant, prefixed with the variant title.
 * Choice questions with "Other (specify)" get an extra column for the written text.
 * Grid questions get one column per row; answers on rows that no longer exist go to one extra column.
 */
class ResponseTable
{
    public const HIDDEN = '(đã ẩn)';

    public const METHOD_LABELS = ['device' => 'thiết bị', 'email' => 'email', 'phone' => 'điện thoại', 'account' => 'tài khoản'];

    private const NUMERIC_TYPES = ['number', 'rating', 'scale'];

    private const GRID_TYPES = ['multiple_choice_grid', 'checkbox_grid'];

    private FormStructure $structure;

    private Collection $responses;

    /** @var array<int, array{heading: string, value: callable}> */
    private array $columns = [];

    public function __construct(private Form $form, Collection $responses)
    {
        $this->structure = FormStructure::fromForm($form);
        $this->responses = $responses;
        $this->build($responses);
    }

    public function headings(): array
    {
        return array_column($this->columns, 'heading');
    }

    public function row(FormResponse $response): array
    {
        $answers = self::index($response);
        return array_map(fn ($column) => ($column['value'])($response, $answers), $this->columns);
    }

    /**
     * Answers keyed by "field_id@variant" ("field_id@" outside blocks), plus "field_id" for the first
     * answer of each field, used for responses that have no recorded assignment.
     *
     * @return array<string, ResponseAnswer>
     */
    public static function index(FormResponse $response): array
    {
        $out = [];
        foreach ($response->answers as $answer) {
            $out[$answer->field_id . '@' . ($answer->variant_key ?? '')] ??= $answer;
            $out[(string) $answer->field_id] ??= $answer;
        }
        return $out;
    }

    public static function identityText(FormResponse $response): string
    {
        $methods = $response->identities->pluck('method')->unique()->all();
        $labels = array_intersect_key(self::METHOD_LABELS, array_flip($methods));
        return implode(', ', $labels);
    }

    /** Variant titles by key; deleted variants keep their key so old responses stay readable. */
    public static function variantTitles(FormField $header): array
    {
        $titles = [];
        foreach (FormStructure::variants($header) as $variant) {
            $title = trim((string) ($variant['title'] ?? ''));
            $titles[(string) $variant['key']] = $title !== '' ? $title : (string) $variant['key'];
        }
        return $titles;
    }

    public static function blockName(FormField $header): string
    {
        return trim(strip_tags((string) $header->label)) ?: 'Phần ngẫu nhiên';
    }

    private function build(Collection $responses): void
    {
        $this->add('Mã câu trả lời', fn ($r) => $r->id);
        $this->add('Thời gian gửi', fn ($r) => $r->submitted_at?->format('Y-m-d H:i:s') ?? '');
        $this->add('Người dùng', fn ($r) => $r->user ? $r->user->email : 'Ẩn danh');
        $this->add('Địa chỉ IP', fn ($r) => (string) $r->ip_address);

        if (RespondentLimiter::config($this->form) || $responses->contains(fn ($r) => $r->identities->isNotEmpty())) {
            $this->add('Căn cứ nhận diện', fn ($r) => self::identityText($r));
        }

        foreach ($this->structure->fields as $field) {
            if ($field->random_group_key && $this->structure->group($field->random_group_key)) {
                continue;
            }
            if ($field->type === 'random_section') {
                $this->addBlock($field, $responses);
            } elseif ($field->collectsAnswer()) {
                $this->addField($field, $field->label, fn ($r, $a) => $a[$field->id . '@'] ?? $a[(string) $field->id] ?? null);
            }
        }
    }

    private function addBlock(FormField $header, Collection $responses): void
    {
        $key = $header->key;
        $titles = self::variantTitles($header);
        $title = fn (string $variant) => $titles[$variant] ?? $variant;
        $assigned = fn (FormResponse $r) => array_values(array_map('strval', (array) ($r->assignments[$key] ?? [])));
        $name = self::blockName($header);

        if ($header->setting('mode') === 'different') {
            $this->add("{$name} – phiên bản", fn ($r) => implode(', ', array_map($title, $assigned($r))));
            foreach (array_keys($titles) as $variant) {
                foreach ($this->structure->membersFor($key, $variant) as $member) {
                    if ($member->collectsAnswer()) {
                        $this->addField($member, $title($variant) . ' – ' . $member->label, fn ($r, $a) => $a[$member->id . '@' . $variant] ?? null);
                    }
                }
            }
            return;
        }

        $rounds = max(FormStructure::pickCount($header), (int) $responses->max(fn ($r) => count($assigned($r))));
        $members = $this->structure->fields->filter(fn ($f) => $f->random_group_key === $key && $f->collectsAnswer());

        for ($i = 0; $i < $rounds; $i++) {
            $prefix = $rounds > 1 ? 'Lượt ' . ($i + 1) . ' – ' : '';
            $this->add("{$prefix}{$name} – phiên bản", fn ($r) => isset($assigned($r)[$i]) ? $title($assigned($r)[$i]) : '');
            foreach ($members as $member) {
                $this->addField($member, $prefix . $member->label, function ($r, $a) use ($member, $assigned, $i, $rounds) {
                    $variant = $assigned($r)[$i] ?? null;
                    if ($variant !== null) {
                        return $a[$member->id . '@' . $variant] ?? null;
                    }
                    return $rounds === 1 ? ($a[(string) $member->id] ?? null) : null;
                });
            }
        }
    }

    private function addField(FormField $field, string $heading, callable $find): void
    {
        if (in_array($field->type, self::GRID_TYPES, true)) {
            $this->addGrid($field, $heading, $find);
            return;
        }

        $split = $field->setting('other_option.enabled') && in_array($field->type, ['radio', 'checkbox', 'dropdown'], true);

        $this->add($heading, fn ($r, $a) => $this->text($field, $find($r, $a), $split));

        if ($split) {
            $label = $field->setting('other_option.label') ?: 'Khác';
            $this->add("{$heading} – {$label}", fn ($r, $a) => $this->otherText($field, $find($r, $a)));
        }
    }

    private function addGrid(FormField $field, string $heading, callable $find): void
    {
        $rows = array_map('strval', array_values($field->rows ?? []));
        $cells = fn (?ResponseAnswer $answer) => $answer ? AnswerValue::decode($answer->value) : null;
        $cell = fn ($value) => is_array($value) ? implode(', ', array_map('strval', $value)) : (string) ($value ?? '');

        foreach ($rows as $row) {
            $this->add("{$heading} – {$row}", function ($r, $a) use ($find, $cells, $cell, $row) {
                $value = $cells($find($r, $a));
                return is_array($value) ? $cell($value[$row] ?? null) : '';
            });
        }

        $stray = function ($r, $a) use ($find, $cells, $rows) {
            $value = $cells($find($r, $a));
            if (is_array($value)) {
                return array_diff_key($value, array_flip($rows));
            }
            return AnswerValue::isEmpty($value) ? [] : ['?' => $value];
        };
        $hasStray = $rows === [] || $this->responses->contains(fn ($r) => $stray($r, self::index($r)) !== []);
        if ($hasStray) {
            $this->add($rows === [] ? $heading : "{$heading} – dòng khác", function ($r, $a) use ($stray, $cell) {
                $parts = [];
                foreach ($stray($r, $a) as $row => $value) {
                    $parts[] = $row . ': ' . $cell($value);
                }
                return implode('; ', $parts);
            });
        }
    }

    private function text(FormField $field, ?ResponseAnswer $answer, bool $splitOther)
    {
        if (!$answer) {
            return '';
        }
        if ($field->setting('store_hash_only')) {
            return self::HIDDEN;
        }
        if ($answer->file_path) {
            return url('storage/' . $answer->file_path);
        }

        $value = AnswerValue::decode($answer->value);
        if ($value === null) {
            return '';
        }
        if (in_array($field->type, self::NUMERIC_TYPES, true) && is_scalar($value) && is_numeric($value)) {
            return $value + 0;
        }
        if ($splitOther && is_array($value) && array_key_exists('selected', $value)) {
            $value = ['selected' => $value['selected'], 'other' => null];
        }

        return AnswerValue::toText($value, $this->otherLabel($field));
    }

    private function otherText(FormField $field, ?ResponseAnswer $answer): string
    {
        if (!$answer || $field->setting('store_hash_only')) {
            return '';
        }
        $choices = AnswerValue::choices($answer->value);
        return in_array(AnswerValue::OTHER, $choices['selected'], true) ? (string) $choices['other'] : '';
    }

    /** Piped questions show the "Other" label of their source question. */
    private function otherLabel(FormField $field): ?string
    {
        $source = $this->structure->field($field->setting('piped_from')) ?? $field;
        return $source->setting('other_option.label');
    }

    private function add(string $heading, callable $value): void
    {
        $this->columns[] = ['heading' => $heading, 'value' => $value];
    }
}
