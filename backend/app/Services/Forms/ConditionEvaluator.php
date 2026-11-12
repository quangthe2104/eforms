<?php

namespace App\Services\Forms;

/**
 * Evaluates `conditional_logic`:
 * { "match": "any|all", "rules": [{ "field_key", "operator", "values": [] }] }
 */
class ConditionEvaluator
{
    public const OPERATORS = ['includes_any', 'not_includes_any', 'answered', 'not_answered'];

    public static function hasRules($logic): bool
    {
        return is_array($logic) && !empty($logic['rules']) && is_array($logic['rules']);
    }

    /**
     * @param callable(string $fieldKey): mixed $resolve returns the source answer, or null when unanswered/hidden
     */
    public static function passes($logic, callable $resolve): bool
    {
        if (!self::hasRules($logic)) {
            return true;
        }

        $results = [];
        foreach ($logic['rules'] as $rule) {
            if (!is_array($rule) || empty($rule['field_key'])) {
                continue;
            }
            $results[] = self::rulePasses($rule, $resolve($rule['field_key']));
        }

        if ($results === []) {
            return true;
        }

        return ($logic['match'] ?? 'all') === 'any'
            ? in_array(true, $results, true)
            : !in_array(false, $results, true);
    }

    private static function rulePasses(array $rule, $answer): bool
    {
        $answered = !AnswerValue::isEmpty($answer);
        $values = array_map('strval', (array) ($rule['values'] ?? []));
        $selected = $answered ? AnswerValue::choices($answer)['selected'] : [];
        $hit = array_intersect($selected, $values) !== [];

        return match ($rule['operator'] ?? 'includes_any') {
            'answered' => $answered,
            'not_answered' => !$answered,
            'not_includes_any' => !$hit,
            default => $hit,
        };
    }
}
