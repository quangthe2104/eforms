<?php

namespace App\Services\Forms;

use App\Models\Form;
use App\Models\FormField;
use Illuminate\Support\Collection;

/**
 * Ordered view of a form's fields that understands random sections.
 *
 * A random section is a `random_section` header field followed by its member
 * fields (members carry `random_group_key` = header key). Given the variants
 * assigned to a respondent, `instances()` expands every block into the
 * question instances that respondent actually sees.
 */
class FormStructure
{
    /** @var Collection<int, FormField> */
    public Collection $fields;

    /** @var array<string, FormField> */
    private array $byKey = [];

    /** @var array<string, FormField> header fields by group key */
    private array $groups = [];

    public function __construct(iterable $fields)
    {
        $this->fields = collect($fields)->sortBy([['order', 'asc'], ['id', 'asc']])->values();

        foreach ($this->fields as $field) {
            if ($field->key) {
                $this->byKey[$field->key] = $field;
            }
            if ($field->type === 'random_section' && $field->key) {
                $this->groups[$field->key] = $field;
            }
        }
    }

    public static function fromForm(Form $form): self
    {
        return new self($form->fields()->get());
    }

    public function field(?string $key): ?FormField
    {
        return $key !== null ? ($this->byKey[$key] ?? null) : null;
    }

    public function fieldById($id): ?FormField
    {
        return $this->fields->first(fn ($f) => (string) $f->id === (string) $id);
    }

    /** @return array<string, FormField> */
    public function groups(): array
    {
        return $this->groups;
    }

    public function group(?string $groupKey): ?FormField
    {
        return $groupKey !== null ? ($this->groups[$groupKey] ?? null) : null;
    }

    /** @return array<int, array{key: string, title?: string, description?: string}> */
    public static function variants(FormField $header): array
    {
        return array_values(array_filter(
            $header->setting('variants', []) ?: [],
            fn ($v) => is_array($v) && !empty($v['key'])
        ));
    }

    public static function variantKeys(FormField $header): array
    {
        return array_map(fn ($v) => (string) $v['key'], self::variants($header));
    }

    public static function pickCount(FormField $header): int
    {
        $count = count(self::variants($header));
        return max(1, min((int) $header->setting('pick_count', 1), max(1, $count)));
    }

    /** Members of a group that belong to the given variant. */
    public function membersFor(string $groupKey, string $variantKey): Collection
    {
        $header = $this->group($groupKey);
        $different = $header && $header->setting('mode') === 'different';

        return $this->fields->filter(function ($f) use ($groupKey, $variantKey, $different) {
            if ($f->random_group_key !== $groupKey) {
                return false;
            }
            return !$different || $f->variant_key === null || $f->variant_key === '' || $f->variant_key === $variantKey;
        })->values();
    }

    public static function answerKey(FormField $field, ?string $variantKey): string
    {
        return $variantKey === null ? (string) $field->id : $field->id . '@' . $variantKey;
    }

    /**
     * Expand the form into the instances seen by a respondent.
     *
     * Each instance: field, variant (null outside blocks), group, answer_key,
     * page_start (true when the instance opens a new page).
     *
     * @param array<string, string[]> $assignments group key => assigned variant keys
     * @return array<int, array{field: FormField, variant: ?string, group: ?string, answer_key: string, page_start: bool}>
     */
    public function instances(array $assignments): array
    {
        $instances = [];
        $forceNewPage = false;

        foreach ($this->fields as $field) {
            if ($field->random_group_key && isset($this->groups[$field->random_group_key])) {
                continue;
            }

            if ($field->type === 'random_section') {
                foreach ($assignments[$field->key] ?? [] as $variantKey) {
                    $instances[] = [
                        'field' => $field,
                        'variant' => $variantKey,
                        'group' => $field->key,
                        'answer_key' => self::answerKey($field, $variantKey),
                        'page_start' => true,
                    ];
                    foreach ($this->membersFor($field->key, $variantKey) as $member) {
                        $instances[] = [
                            'field' => $member,
                            'variant' => $variantKey,
                            'group' => $field->key,
                            'answer_key' => self::answerKey($member, $variantKey),
                            'page_start' => $member->type === 'section',
                        ];
                    }
                }
                $forceNewPage = true;
                continue;
            }

            $instances[] = [
                'field' => $field,
                'variant' => null,
                'group' => null,
                'answer_key' => self::answerKey($field, null),
                'page_start' => $field->type === 'section' || $forceNewPage,
            ];
            $forceNewPage = false;
        }

        return $instances;
    }
}
