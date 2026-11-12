<?php

namespace App\Services\Forms;

use App\Models\FormField;
use Illuminate\Http\UploadedFile;

/**
 * Server-side validation of a submission against the instances the respondent
 * actually saw: conditional visibility, required, choice limits, "Other",
 * exclusive options, all-rows grids, number ranges and piped choices.
 *
 * Hidden instances are dropped; answers for unassigned variants are ignored.
 */
class SubmissionValidator
{
    private const MAX_TEXT = 20000;

    private FormStructure $structure;
    private array $assignments;

    /** @var array<string, mixed> answer_key => accepted value */
    private array $values = [];
    /** @var array<string, string[]> */
    private array $errors = [];
    /** @var array<int, array{field: FormField, variant: ?string, value: mixed, file: ?UploadedFile}> */
    private array $answers = [];

    /**
     * @param array<string, mixed> $raw answers keyed by answer key (`id` or `id@variant`)
     * @param array<string, UploadedFile> $files
     * @return array{answers: array, errors: array<string, string[]>, values: array<string, mixed>}
     */
    public function validate(FormStructure $structure, array $assignments, array $raw, array $files = []): array
    {
        $this->structure = $structure;
        $this->assignments = $assignments;
        $this->values = $this->errors = $this->answers = [];

        $pageHidden = false;
        $hiddenGroups = [];

        foreach ($structure->instances($assignments) as $inst) {
            /** @var FormField $field */
            $field = $inst['field'];

            if ($inst['group'] !== null && isset($hiddenGroups[$inst['group']])) {
                continue;
            }
            if ($inst['page_start']) {
                $pageHidden = false;
            }

            $resolve = fn (string $key) => $this->resolve($key, $inst);

            if ($field->type === 'random_section') {
                if (!ConditionEvaluator::passes($field->conditional_logic, $resolve)) {
                    $hiddenGroups[$inst['group']] = true;
                }
                continue;
            }
            if ($field->type === 'section') {
                $pageHidden = !ConditionEvaluator::passes($field->conditional_logic, $resolve);
                continue;
            }
            if ($pageHidden || !$field->collectsAnswer()) {
                continue;
            }
            if (!ConditionEvaluator::passes($field->conditional_logic, $resolve)) {
                continue;
            }

            $piped = null;
            if (in_array($field->type, ['radio', 'dropdown'], true) && $field->setting('piped_from')) {
                $piped = $this->pipedOptions($field, $resolve);
                if (count($piped['options']) < 2) {
                    if (count($piped['options']) === 1) {
                        $this->accept($inst, $this->pipedValue($piped['options'][0], $piped['other']));
                    }
                    continue;
                }
            }

            $key = $inst['answer_key'];
            $this->check($inst, $files[$key] ?? $raw[$key] ?? null, $piped);
        }

        return ['answers' => $this->answers, 'errors' => $this->errors, 'values' => $this->values];
    }

    /**
     * Source answer for a condition / piped reference, seen from an instance.
     * Fields in a random section resolve within the same variant when possible.
     */
    private function resolve(string $fieldKey, array $inst)
    {
        $source = $this->structure->field($fieldKey);
        if (!$source) {
            return null;
        }

        $variant = null;
        if ($source->random_group_key) {
            $variant = $inst['group'] === $source->random_group_key
                ? $inst['variant']
                : ($this->assignments[$source->random_group_key][0] ?? null);
            if ($variant === null) {
                return null;
            }
        }

        return $this->values[FormStructure::answerKey($source, $variant)] ?? null;
    }

    /** @return array{options: string[], other: ?string} */
    private function pipedOptions(FormField $field, callable $resolve): array
    {
        $source = $this->structure->field($field->setting('piped_from'));
        if (!$source) {
            return ['options' => [], 'other' => null];
        }

        $choices = AnswerValue::choices($resolve($source->key));
        $exclusive = array_map('strval', $source->setting('exclusive_options', []) ?: []);
        if (array_intersect($choices['selected'], $exclusive) !== []) {
            return ['options' => [], 'other' => null];
        }

        return ['options' => $choices['selected'], 'other' => $choices['other']];
    }

    private function pipedValue(string $option, ?string $other)
    {
        return $option === AnswerValue::OTHER ? ['selected' => [AnswerValue::OTHER], 'other' => $other] : $option;
    }

    private function check(array $inst, $raw, ?array $piped): void
    {
        /** @var FormField $field */
        $field = $inst['field'];

        if ($field->type === 'file_upload') {
            if ($raw instanceof UploadedFile) {
                $this->accept($inst, $raw->getClientOriginalName(), $raw);
            } elseif ($field->is_required) {
                $this->fail($inst, 'Vui lòng tải lên tệp.');
            }
            return;
        }

        $value = in_array($field->type, ['checkbox', 'radio', 'dropdown', 'multiple_choice_grid', 'checkbox_grid'], true)
            ? AnswerValue::decode($raw)
            : $raw;

        if (AnswerValue::isEmpty($value)) {
            if ($field->is_required) {
                $this->fail($inst, 'Vui lòng trả lời câu hỏi này.');
            }
            return;
        }

        switch ($field->type) {
            case 'radio':
            case 'dropdown':
                $this->checkSingleChoice($inst, $value, $piped);
                return;
            case 'checkbox':
                $this->checkMultiChoice($inst, $value);
                return;
            case 'multiple_choice_grid':
            case 'checkbox_grid':
                $this->checkGrid($inst, $value);
                return;
            case 'email':
                $email = trim((string) $value);
                if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                    $this->fail($inst, 'Email không hợp lệ.');
                    return;
                }
                $this->accept($inst, $email);
                return;
            case 'phone':
                $phone = RespondentLimiter::normalizePhone((string) $value);
                if (!RespondentLimiter::isValidPhone($phone)) {
                    $this->fail($inst, 'Số điện thoại di động không hợp lệ (10 chữ số, ví dụ 0912345678).');
                    return;
                }
                $this->accept($inst, $phone);
                return;
            case 'number':
                $this->checkNumber($inst, $value);
                return;
            case 'url':
                $url = trim((string) $value);
                if (!filter_var($url, FILTER_VALIDATE_URL)) {
                    $this->fail($inst, 'Đường dẫn không hợp lệ.');
                    return;
                }
                $this->accept($inst, $url);
                return;
            default:
                if (is_array($value)) {
                    $this->accept($inst, $value);
                    return;
                }
                $text = (string) $value;
                if (mb_strlen($text) > self::MAX_TEXT) {
                    $this->fail($inst, 'Nội dung quá dài.');
                    return;
                }
                $this->accept($inst, $text);
        }
    }

    private function allowedOptions(FormField $field): array
    {
        $options = array_map('strval', $field->options ?? []);
        if ($field->setting('other_option.enabled')) {
            $options[] = AnswerValue::OTHER;
        }
        return $options;
    }

    private function checkSingleChoice(array $inst, $value, ?array $piped): void
    {
        $field = $inst['field'];
        $choices = AnswerValue::choices($value);

        if (count($choices['selected']) !== 1) {
            $this->fail($inst, 'Chỉ được chọn một phương án.');
            return;
        }
        $choice = $choices['selected'][0];

        if ($piped !== null) {
            if (!in_array($choice, $piped['options'], true)) {
                $this->fail($inst, 'Lựa chọn không hợp lệ.');
                return;
            }
            $this->accept($inst, $this->pipedValue($choice, $piped['other']));
            return;
        }

        if (!in_array($choice, $this->allowedOptions($field), true)) {
            $this->fail($inst, 'Lựa chọn không hợp lệ.');
            return;
        }

        if ($choice === AnswerValue::OTHER) {
            if ($choices['other'] === null) {
                $this->fail($inst, 'Vui lòng ghi rõ nội dung phương án "Khác".');
                return;
            }
            $this->accept($inst, ['selected' => [AnswerValue::OTHER], 'other' => mb_substr($choices['other'], 0, self::MAX_TEXT)]);
            return;
        }

        $this->accept($inst, $choice);
    }

    private function checkMultiChoice(array $inst, $value): void
    {
        $field = $inst['field'];
        $choices = AnswerValue::choices($value);
        $selected = $choices['selected'];

        if (array_diff($selected, $this->allowedOptions($field)) !== []) {
            $this->fail($inst, 'Lựa chọn không hợp lệ.');
            return;
        }

        $exclusive = array_intersect($selected, array_map('strval', $field->setting('exclusive_options', []) ?: []));
        if ($exclusive !== [] && count($selected) > 1) {
            $this->fail($inst, 'Phương án "' . reset($exclusive) . '" không thể chọn cùng các phương án khác.');
            return;
        }

        $min = (int) $field->setting('min_select', 0);
        $max = (int) $field->setting('max_select', 0);
        $isExclusiveOnly = $exclusive !== [];
        if ($min > 0 && count($selected) < $min && !$isExclusiveOnly) {
            $this->fail($inst, "Vui lòng chọn ít nhất {$min} phương án.");
            return;
        }
        if ($max > 0 && count($selected) > $max) {
            $this->fail($inst, "Chỉ được chọn tối đa {$max} phương án.");
            return;
        }

        if (in_array(AnswerValue::OTHER, $selected, true)) {
            if ($choices['other'] === null) {
                $this->fail($inst, 'Vui lòng ghi rõ nội dung phương án "Khác".');
                return;
            }
            $this->accept($inst, ['selected' => $selected, 'other' => mb_substr($choices['other'], 0, self::MAX_TEXT)]);
            return;
        }

        $this->accept($inst, $selected);
    }

    private function checkGrid(array $inst, $value): void
    {
        $field = $inst['field'];
        if (!is_array($value) || array_is_list($value)) {
            $this->fail($inst, 'Câu trả lời không hợp lệ.');
            return;
        }

        $rows = array_map('strval', $field->rows ?? []);
        $columns = array_map('strval', $field->columns ?? []);
        $multi = $field->type === 'checkbox_grid';
        $clean = [];

        foreach ($value as $row => $cols) {
            $row = (string) $row;
            $picked = array_values(array_filter(array_map('strval', (array) $cols), fn ($c) => $c !== ''));
            if ($picked === []) {
                continue;
            }
            if (!in_array($row, $rows, true) || array_diff($picked, $columns) !== [] || (!$multi && count($picked) > 1)) {
                $this->fail($inst, 'Lựa chọn không hợp lệ.');
                return;
            }
            $clean[$row] = $multi ? $picked : $picked[0];
        }

        if ($field->is_required && $field->setting('require_all_rows') && count($clean) < count($rows)) {
            $this->fail($inst, 'Vui lòng trả lời tất cả các dòng.');
            return;
        }

        if ($clean === []) {
            if ($field->is_required) {
                $this->fail($inst, 'Vui lòng trả lời câu hỏi này.');
            }
            return;
        }

        $this->accept($inst, $clean);
    }

    private function checkNumber(array $inst, $value): void
    {
        $field = $inst['field'];
        $text = str_replace(',', '.', trim((string) $value));

        if (!is_numeric($text)) {
            $this->fail($inst, 'Vui lòng nhập một số.');
            return;
        }

        $digits = (int) $field->setting('number.digits', 0);
        $min = $field->setting('number.min');
        $max = $field->setting('number.max');

        if ($digits > 0) {
            if (!preg_match('/^-?\d+$/', $text)) {
                $this->fail($inst, 'Vui lòng nhập số nguyên.');
                return;
            }
            if (strlen(ltrim($text, '-')) > $digits) {
                $this->fail($inst, "Chỉ được nhập tối đa {$digits} chữ số.");
                return;
            }
        }

        $number = $text + 0;
        if (is_numeric($min) && $number < $min) {
            $this->fail($inst, is_numeric($max) ? "Vui lòng nhập số từ {$min} đến {$max}." : "Vui lòng nhập số không nhỏ hơn {$min}.");
            return;
        }
        if (is_numeric($max) && $number > $max) {
            $this->fail($inst, is_numeric($min) ? "Vui lòng nhập số từ {$min} đến {$max}." : "Vui lòng nhập số không lớn hơn {$max}.");
            return;
        }

        $this->accept($inst, $text);
    }

    private function accept(array $inst, $value, ?UploadedFile $file = null): void
    {
        $this->values[$inst['answer_key']] = $value;
        $this->answers[] = [
            'field' => $inst['field'],
            'variant' => $inst['variant'],
            'value' => $value,
            'file' => $file,
        ];
    }

    private function fail(array $inst, string $message): void
    {
        $this->errors['answers.' . $inst['answer_key']][] = $message;
    }
}
