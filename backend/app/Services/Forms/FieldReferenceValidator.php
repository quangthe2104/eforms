<?php

namespace App\Services\Forms;

/**
 * Validates the cross-field references in a builder payload (fields in final
 * order): conditions, piped choices, random-section filters and block members.
 */
class FieldReferenceValidator
{
    private const GRID_TYPES = ['multiple_choice_grid', 'checkbox_grid'];

    /**
     * @param array<int, array> $fields payload fields, each with a `key`
     * @return array<string, string[]> errors keyed `fields.<index>.<attribute>`
     */
    public function validate(array $fields): array
    {
        $errors = [];
        $position = [];
        $byKey = [];

        foreach ($fields as $i => $field) {
            $key = (string) ($field['key'] ?? '');
            if ($key === '') {
                $errors["fields.$i.key"][] = 'Thiếu mã câu hỏi.';
                continue;
            }
            if (isset($byKey[$key])) {
                $errors["fields.$i.key"][] = 'Mã câu hỏi bị trùng.';
                continue;
            }
            $byKey[$key] = $field;
            $position[$key] = $i;
        }

        $openGroup = null;

        foreach ($fields as $i => $field) {
            $type = $field['type'] ?? '';
            $settings = is_array($field['settings'] ?? null) ? $field['settings'] : [];
            $groupKey = $field['random_group_key'] ?? null;

            $before = fn (?string $ref) => $ref !== null && isset($position[$ref]) && $position[$ref] < $i;

            $logic = $field['conditional_logic'] ?? null;
            if (ConditionEvaluator::hasRules($logic)) {
                foreach ($logic['rules'] as $r => $rule) {
                    if (!$before($rule['field_key'] ?? null)) {
                        $errors["fields.$i.conditional_logic.rules.$r"][] = 'Điều kiện phải dựa trên một câu hỏi đứng trước.';
                    } elseif (!in_array($rule['operator'] ?? 'includes_any', ConditionEvaluator::OPERATORS, true)) {
                        $errors["fields.$i.conditional_logic.rules.$r"][] = 'Toán tử điều kiện không hợp lệ.';
                    }
                }
            }

            if (!empty($settings['piped_from'])) {
                $source = $byKey[$settings['piped_from']] ?? null;
                if (!$before($settings['piped_from']) || ($source['type'] ?? null) !== 'checkbox') {
                    $errors["fields.$i.settings.piped_from"][] = 'Câu nguồn phải là câu hộp kiểm đứng trước.';
                }
            }

            if ($type === 'random_section') {
                if ($groupKey) {
                    $errors["fields.$i.random_group_key"][] = 'Không thể lồng phần ngẫu nhiên trong phần ngẫu nhiên khác.';
                }
                $errors += $this->validateHeader($i, $settings, $byKey, $before);
                $openGroup = $field['key'] ?? null;
                continue;
            }

            if ($groupKey) {
                $header = $byKey[$groupKey] ?? null;
                if (($header['type'] ?? null) !== 'random_section') {
                    $errors["fields.$i.random_group_key"][] = 'Phần ngẫu nhiên chứa câu hỏi này không tồn tại.';
                } elseif ($openGroup !== $groupKey) {
                    $errors["fields.$i.random_group_key"][] = 'Câu hỏi của phần ngẫu nhiên phải đứng liền sau phần đó.';
                }

                $variantKey = $field['variant_key'] ?? null;
                if ($variantKey !== null && $variantKey !== '' && $header) {
                    $headerSettings = is_array($header['settings'] ?? null) ? $header['settings'] : [];
                    $variantKeys = array_column($headerSettings['variants'] ?? [], 'key');
                    if (($headerSettings['mode'] ?? 'same') !== 'different' || !in_array($variantKey, $variantKeys, true)) {
                        $errors["fields.$i.variant_key"][] = 'Phiên bản của câu hỏi không hợp lệ.';
                    }
                }
            } else {
                $openGroup = null;
            }
        }

        return $errors;
    }

    private function validateHeader(int $i, array $settings, array $byKey, callable $before): array
    {
        $errors = [];
        $variants = $settings['variants'] ?? [];
        $keys = is_array($variants) ? array_filter(array_column($variants, 'key')) : [];

        if ($keys === []) {
            $errors["fields.$i.settings.variants"][] = 'Phần ngẫu nhiên cần ít nhất một phiên bản.';
        } elseif (count($keys) !== count(array_unique($keys)) || count($keys) !== count($variants)) {
            $errors["fields.$i.settings.variants"][] = 'Mỗi phiên bản cần một mã riêng.';
        }

        if (!in_array($settings['mode'] ?? 'same', ['same', 'different'], true)) {
            $errors["fields.$i.settings.mode"][] = 'Chế độ không hợp lệ.';
        }

        $pick = $settings['pick_count'] ?? 1;
        if (!is_numeric($pick) || (int) $pick < 1 || ($keys !== [] && (int) $pick > count($keys))) {
            $errors["fields.$i.settings.pick_count"][] = 'Số phiên bản mỗi người phải từ 1 đến số phiên bản hiện có.';
        }

        $filter = $settings['filter'] ?? null;
        if (is_array($filter) && !empty($filter['field_key'])) {
            $source = $byKey[$filter['field_key']] ?? null;
            if (!$before($filter['field_key']) || !in_array($source['type'] ?? null, self::GRID_TYPES, true)) {
                $errors["fields.$i.settings.filter.field_key"][] = 'Câu lọc phải là câu dạng bảng đứng trước phần ngẫu nhiên.';
            } elseif (!empty($source['random_group_key'])) {
                $errors["fields.$i.settings.filter.field_key"][] = 'Câu lọc không được nằm trong phần ngẫu nhiên.';
            }
        }

        return $errors;
    }
}
