<?php

namespace App\Services\Forms;

/**
 * Helpers for reading answer values in every stored shape:
 * plain strings, arrays, grid objects, `{selected, other}` objects and
 * legacy JSON strings (multipart uploads used to store arrays as JSON text).
 */
class AnswerValue
{
    /** Value stored in `selected` when the respondent picks the "Other (specify)" option. */
    public const OTHER = '__other__';

    public static function decode($value)
    {
        while (is_string($value)) {
            $trimmed = trim($value);
            if ($trimmed === '' || !in_array($trimmed[0], ['[', '{'], true)) {
                break;
            }
            $decoded = json_decode($trimmed, true);
            if (json_last_error() !== JSON_ERROR_NONE || $decoded === $value) {
                break;
            }
            $value = $decoded;
        }

        return $value;
    }

    /**
     * @return array{selected: string[], other: ?string}
     */
    public static function choices($value): array
    {
        $value = self::decode($value);
        $other = null;

        if (is_array($value) && array_key_exists('selected', $value)) {
            $other = isset($value['other']) && is_scalar($value['other']) ? trim((string) $value['other']) : null;
            $value = $value['selected'];
        }

        if ($value === null || $value === '') {
            $selected = [];
        } elseif (is_array($value)) {
            $selected = array_values(array_filter(
                array_map(fn ($v) => is_scalar($v) ? (string) $v : '', $value),
                fn ($v) => $v !== ''
            ));
        } elseif (is_scalar($value)) {
            $selected = [(string) $value];
        } else {
            $selected = [];
        }

        return ['selected' => array_values(array_unique($selected)), 'other' => $other === '' ? null : $other];
    }

    public static function isEmpty($value): bool
    {
        $value = self::decode($value);

        if ($value === null) {
            return true;
        }
        if (is_string($value)) {
            return trim($value) === '';
        }
        if (is_array($value)) {
            if (array_key_exists('selected', $value)) {
                return self::choices($value)['selected'] === [];
            }
            foreach ($value as $item) {
                if (!self::isEmpty($item)) {
                    return false;
                }
            }
            return true;
        }

        return false;
    }

    /**
     * Human readable text, used by exports and summaries.
     */
    public static function toText($value, ?string $otherLabel = null): string
    {
        $value = self::decode($value);

        if (is_array($value) && array_key_exists('selected', $value)) {
            $choices = self::choices($value);
            return implode(', ', array_map(function ($item) use ($choices, $otherLabel) {
                if ($item !== self::OTHER) {
                    return $item;
                }
                $label = $otherLabel ?: 'Khác';
                return $choices['other'] ? "{$label}: {$choices['other']}" : $label;
            }, $choices['selected']));
        }

        if (is_array($value)) {
            $isList = array_is_list($value);
            $parts = [];
            foreach ($value as $k => $v) {
                $text = is_array($v) ? implode(', ', array_map('strval', $v)) : (string) $v;
                $parts[] = $isList ? $text : "{$k}: {$text}";
            }
            return implode($isList ? ', ' : '; ', $parts);
        }

        return $value === null ? '' : (string) $value;
    }
}
