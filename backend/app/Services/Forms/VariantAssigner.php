<?php

namespace App\Services\Forms;

use App\Models\FormField;

/**
 * Picks which variants of a random section a respondent gets.
 *
 * Optional filter: a grid question whose rows map to variants; a variant is
 * excluded when the respondent picked an excluded column on its row. If fewer
 * than K variants remain, the rest is topped up from the excluded ones; if
 * none remain, the pick is made from all variants.
 */
class VariantAssigner
{
    /**
     * @param array<string|int, mixed> $answersById raw answers keyed by field id
     * @return string[]
     */
    public function pick(FormField $header, FormStructure $structure, array $answersById): array
    {
        $all = FormStructure::variantKeys($header);
        if ($all === []) {
            return [];
        }

        $count = FormStructure::pickCount($header);
        $eligible = array_values(array_diff($all, $this->excludedVariants($header, $structure, $answersById)));

        if ($eligible === []) {
            return array_slice($this->shuffle($all), 0, $count);
        }

        $picked = array_slice($this->shuffle($eligible), 0, $count);
        if (count($picked) < $count) {
            $rest = $this->shuffle(array_values(array_diff($all, $picked)));
            $picked = array_merge($picked, array_slice($rest, 0, $count - count($picked)));
        }

        return $picked;
    }

    /** @return string[] */
    public function excludedVariants(FormField $header, FormStructure $structure, array $answersById): array
    {
        $filter = $header->setting('filter');
        if (!is_array($filter) || empty($filter['field_key'])) {
            return [];
        }

        $filterField = $structure->field($filter['field_key']);
        if (!$filterField) {
            return [];
        }

        $excludeColumns = array_map('strval', $filter['exclude_columns'] ?? []);
        if ($excludeColumns === []) {
            return [];
        }

        $answer = AnswerValue::decode($answersById[$filterField->id] ?? $answersById[(string) $filterField->id] ?? null);
        if (!is_array($answer)) {
            return [];
        }

        $rows = array_values($filterField->rows ?? []);
        $rowMap = is_array($filter['row_map'] ?? null) ? $filter['row_map'] : [];
        $excluded = [];

        foreach (FormStructure::variantKeys($header) as $index => $variantKey) {
            $row = $rowMap[$variantKey] ?? ($rows[$index] ?? null);
            if ($row === null || !array_key_exists($row, $answer)) {
                continue;
            }
            $picked = array_map('strval', (array) $answer[$row]);
            if (array_intersect($picked, $excludeColumns) !== []) {
                $excluded[] = $variantKey;
            }
        }

        return $excluded;
    }

    private function shuffle(array $items): array
    {
        $items = array_values($items);
        for ($i = count($items) - 1; $i > 0; $i--) {
            $j = random_int(0, $i);
            [$items[$i], $items[$j]] = [$items[$j], $items[$i]];
        }
        return $items;
    }
}
