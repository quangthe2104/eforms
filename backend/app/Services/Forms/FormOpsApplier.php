<?php

namespace App\Services\Forms;

use App\Models\Form;
use App\Models\FormField;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

/**
 * Applies a batch of editor operations to a form in one transaction.
 *
 * Ops are replayed on an in-memory copy of the form first. Each op is validated on its own
 * (failures go to `rejected`); afterwards the cross-field references of the resulting question
 * list are checked once, so multi-op edits such as building a random section may pass through
 * intermediate invalid states. Ops that introduce new reference errors are rejected and the
 * batch is replayed without them. Only the columns an op names are written, so concurrent
 * edits to different properties of the same field both survive (last writer wins per property).
 */
class FormOpsApplier
{
    public const TYPES = ['field.insert', 'field.update', 'field.delete', 'field.move', 'form.update'];

    /** field.update props that can affect the reference check. */
    private const STRUCTURAL_FIELD_PROPS = ['type', 'conditional_logic', 'settings', 'random_group_key', 'variant_key'];

    private const SUB_PROP = '/^([a-z_]+)\.([A-Za-z0-9_]+)$/';

    /**
     * @return array{revision: int, applied: array<int, array{index: int, op: array}>, rejected: array<int, array>}
     */
    public function apply(Form $form, array $ops, ?int $userId, ?string $clientId): array
    {
        $ops = array_values($ops);

        return DB::transaction(function () use ($form, $ops, $userId, $clientId) {
            $form = Form::whereKey($form->id)->lockForUpdate()->firstOrFail();
            $models = FormField::where('form_id', $form->id)->orderBy('order')->orderBy('id')->get();
            foreach ($models->whereNull('key') as $model) {
                $model->forceFill(['key' => (string) Str::uuid()])->save();
            }
            $models = $models->keyBy('key');

            $initial = $this->snapshot($form, $models);
            $baseline = $this->structureErrors($initial);
            $skip = [];

            for ($level = 0; ; $level++) {
                [$state, $applied, $rejected] = $this->run($initial, $ops, $skip);
                $new = array_diff_key($this->structureErrors($state), $baseline);
                if ($new === [] || $applied === []) {
                    break;
                }
                $errors = [];
                foreach ($new as $error) {
                    $errors["fields.{$error['key']}.{$error['attribute']}"] = $error['messages'];
                }
                $culprits = $this->culprits($applied, $new, $level);
                if ($culprits === []) {
                    break;
                }
                foreach ($culprits as $entry) {
                    $skip[$entry['index']] = $this->rejection($entry['index'], $entry['op'], 'structure', 'Cấu hình câu hỏi chưa hợp lệ.', $errors);
                }
            }

            if ($applied === []) {
                return ['revision' => (int) $form->revision, 'applied' => [], 'rejected' => $rejected];
            }

            $ids = $this->persist($form, $models, $state);
            foreach ($applied as &$entry) {
                if ($entry['op']['type'] === 'field.insert' && isset($ids[$entry['op']['key']])) {
                    $entry['op']['data']['id'] = $ids[$entry['op']['key']];
                }
            }
            unset($entry);

            $revision = FormChangeLog::record($form, $userId, $clientId, array_column($applied, 'op'));

            return ['revision' => $revision, 'applied' => $applied, 'rejected' => $rejected];
        });
    }

    private function snapshot(Form $form, $models): array
    {
        $fields = [];
        foreach ($models as $key => $model) {
            $fields[$key] = $model->only(['key', ...EditorRules::FIELD_PROPS]);
        }

        return [
            'fields' => $fields,
            'order' => array_keys($fields),
            'new' => [],
            'touched' => [],
            'form' => $form->only(EditorRules::FORM_PROPS),
            'form_touched' => [],
        ];
    }

    private function run(array $state, array $ops, array $skip): array
    {
        $applied = [];
        $rejected = [];

        foreach ($ops as $i => $op) {
            if (isset($skip[$i])) {
                $rejected[] = $skip[$i];
                continue;
            }
            if (!is_array($op) || !in_array($op['type'] ?? null, self::TYPES, true)) {
                $rejected[] = $this->rejection($i, is_array($op) ? $op : [], 'unknown_type', 'Loại thao tác không hợp lệ.');
                continue;
            }

            $method = match ($op['type']) {
                'field.insert' => 'insert',
                'field.update' => 'update',
                'field.delete' => 'delete',
                'field.move' => 'move',
                'form.update' => 'updateForm',
            };
            $result = $this->{$method}($state, $op);

            if (isset($result['reason'])) {
                $rejected[] = $this->rejection($i, $op, $result['reason'], $result['message'], $result['errors'] ?? null);
            } else {
                $applied[] = ['index' => $i, 'op' => $result];
            }
        }

        return [$state, $applied, $rejected];
    }

    private function insert(array &$state, array $op): array
    {
        $key = $op['key'] ?? null;
        $data = $op['data'] ?? null;
        if (!is_string($key) || $key === '' || strlen($key) > 64 || !is_array($data) || !$this->validAfterKey($op)) {
            return $this->fail('invalid', 'Thao tác thêm câu hỏi cần key, after_key và data.');
        }
        if (isset($state['fields'][$key])) {
            return $this->fail('exists', 'Mã câu hỏi đã tồn tại.');
        }

        $data = array_intersect_key($data, array_flip(EditorRules::FIELD_PROPS));
        $rules = array_merge(EditorRules::field(), ['type' => 'required|string|max:255']);
        if ($errors = $this->validate($data, $rules, 'data.')) {
            return $this->fail('invalid', 'Dữ liệu câu hỏi không hợp lệ.', $errors);
        }

        $attrs = array_merge(array_fill_keys(EditorRules::FIELD_PROPS, null), $data, ['key' => $key]);
        $attrs['label'] ??= '';
        $attrs['is_required'] = (bool) ($attrs['is_required'] ?? false);

        $after = $this->place($state, $key, $op['after_key'] ?? null);
        $state['fields'][$key] = $attrs;
        $state['new'][$key] = true;

        $normalized = $attrs;
        unset($normalized['key']);

        return ['type' => 'field.insert', 'key' => $key, 'after_key' => $after, 'data' => $normalized];
    }

    private function update(array &$state, array $op): array
    {
        $key = $op['key'] ?? null;
        $set = $op['set'] ?? null;
        if (!is_string($key) || !is_array($set) || $set === [] || array_is_list($set)) {
            return $this->fail('invalid', 'Thao tác sửa câu hỏi cần key và set.');
        }
        if (!isset($state['fields'][$key])) {
            return $this->fail('deleted', 'Câu hỏi đã bị xóa.');
        }

        [$values, $set, $errors] = $this->merge($state['fields'][$key], $set, EditorRules::FIELD_PROPS, EditorRules::FIELD_OBJECT_PROPS);
        if ($errors === []) {
            $errors = $this->validate($values, array_intersect_key(EditorRules::field(), $values), 'set.');
        }
        if ($errors) {
            return $this->fail('invalid', 'Dữ liệu câu hỏi không hợp lệ.', $errors);
        }

        if (array_key_exists('label', $values) && $values['label'] === null) {
            $values['label'] = '';
            $set['label'] = '';
        }

        $state['fields'][$key] = array_merge($state['fields'][$key], $values);
        $state['touched'][$key] = ($state['touched'][$key] ?? []) + array_fill_keys(array_keys($values), true);

        return ['type' => 'field.update', 'key' => $key, 'set' => $set];
    }

    private function delete(array &$state, array $op): array
    {
        $key = $op['key'] ?? null;
        if (!is_string($key)) {
            return $this->fail('invalid', 'Thao tác xóa câu hỏi cần key.');
        }
        if (!isset($state['fields'][$key])) {
            return $this->fail('deleted', 'Câu hỏi đã bị xóa.');
        }

        unset($state['fields'][$key], $state['new'][$key], $state['touched'][$key]);
        $state['order'] = array_values(array_diff($state['order'], [$key]));

        return ['type' => 'field.delete', 'key' => $key];
    }

    private function move(array &$state, array $op): array
    {
        $key = $op['key'] ?? null;
        if (!is_string($key) || !$this->validAfterKey($op) || ($op['after_key'] ?? null) === $key) {
            return $this->fail('invalid', 'Thao tác di chuyển cần key và after_key khác key.');
        }
        if (!isset($state['fields'][$key])) {
            return $this->fail('deleted', 'Câu hỏi đã bị xóa.');
        }

        $state['order'] = array_values(array_diff($state['order'], [$key]));
        $after = $this->place($state, $key, $op['after_key'] ?? null);

        return ['type' => 'field.move', 'key' => $key, 'after_key' => $after];
    }

    private function updateForm(array &$state, array $op): array
    {
        $set = $op['set'] ?? null;
        if (!is_array($set) || $set === [] || array_is_list($set)) {
            return $this->fail('invalid', 'Thao tác sửa biểu mẫu cần set.');
        }

        [$values, $set, $errors] = $this->merge($state['form'], $set, EditorRules::FORM_PROPS, EditorRules::FORM_OBJECT_PROPS);
        if ($errors === []) {
            $rules = array_filter(
                EditorRules::form(),
                fn ($attribute) => array_key_exists(explode('.', $attribute)[0], $values),
                ARRAY_FILTER_USE_KEY
            );
            $errors = $this->validate($values, $rules, 'set.');
        }
        if ($errors) {
            return $this->fail('invalid', 'Dữ liệu biểu mẫu không hợp lệ.', $errors);
        }

        if (array_key_exists('respondent_limit', $values) || array_key_exists('require_login', $values)) {
            $enforced = EditorRules::enforceFormInvariants($values + ['respondent_limit' => $state['form']['respondent_limit']]);
            if (($enforced['require_login'] ?? null) === true && ($values['require_login'] ?? $state['form']['require_login']) !== true) {
                $values['require_login'] = true;
                $set['require_login'] = true;
            }
        }

        $state['form'] = array_merge($state['form'], $values);
        $state['form_touched'] += array_fill_keys(array_keys($values), true);

        return ['type' => 'form.update', 'set' => $set];
    }

    /**
     * Resolves `set` into whole-column values. `<object prop>.<name>` changes one entry of a JSON
     * object column (null removes it); whole props are applied before sub-props.
     *
     * @return array{0: array, 1: array, 2: array} [column values, normalized set, errors]
     */
    private function merge(array $current, array $set, array $props, array $objectProps): array
    {
        $values = [];
        $errors = [];
        $subs = [];

        foreach ($set as $prop => $value) {
            if (in_array($prop, $props, true)) {
                $values[$prop] = $value;
            } elseif (preg_match(self::SUB_PROP, (string) $prop, $m) && in_array($m[1], $objectProps, true)) {
                $subs[] = [$m[1], $m[2], $value];
            } else {
                $errors["set.$prop"][] = 'Thuộc tính này không sửa được.';
            }
        }

        foreach ($subs as [$column, $name, $value]) {
            $object = array_key_exists($column, $values) ? $values[$column] : ($current[$column] ?? null);
            $object = is_array($object) ? $object : [];
            if ($value === null) {
                unset($object[$name]);
            } else {
                $object[$name] = $value;
            }
            $values[$column] = $object;
        }

        return [$values, $set, $errors];
    }

    private function validate(array $data, array $rules, string $prefix): array
    {
        $validator = Validator::make($data, $rules);
        if (!$validator->fails()) {
            return [];
        }
        $errors = [];
        foreach ($validator->errors()->toArray() as $attribute => $messages) {
            $errors[$prefix . $attribute] = $messages;
        }
        return $errors;
    }

    private function validAfterKey(array $op): bool
    {
        if (!array_key_exists('after_key', $op)) {
            return false;
        }
        return $op['after_key'] === null || is_string($op['after_key']);
    }

    /**
     * Puts `$key` after `$afterKey` (null = first). A missing anchor (e.g. deleted meanwhile)
     * appends at the end. Returns the anchor actually used.
     */
    private function place(array &$state, string $key, ?string $afterKey): ?string
    {
        if ($afterKey === null) {
            array_unshift($state['order'], $key);
            return null;
        }

        $index = array_search($afterKey, $state['order'], true);
        if ($index === false) {
            $after = $state['order'] === [] ? null : end($state['order']);
            $state['order'][] = $key;
            return $after;
        }

        array_splice($state['order'], $index + 1, 0, [$key]);
        return $afterKey;
    }

    /**
     * @return array<string, array{key: string, attribute: string, messages: string[], refs: string[]}>
     */
    private function structureErrors(array $state): array
    {
        $fields = [];
        foreach ($state['order'] as $key) {
            $fields[] = $state['fields'][$key];
        }

        $out = [];
        foreach ((new FieldReferenceValidator())->validate($fields) as $path => $messages) {
            if (!preg_match('/^fields\.(\d+)\.(.+)$/', $path, $m)) {
                continue;
            }
            $field = $fields[(int) $m[1]] ?? [];
            $key = (string) ($field['key'] ?? '');
            $out["$key|{$m[2]}"] = [
                'key' => $key,
                'attribute' => $m[2],
                'messages' => $messages,
                'refs' => $this->references($field),
            ];
        }
        return $out;
    }

    private function references(array $field): array
    {
        $refs = [$field['random_group_key'] ?? null, data_get($field, 'settings.piped_from'), data_get($field, 'settings.filter.field_key')];
        if (ConditionEvaluator::hasRules($field['conditional_logic'] ?? null)) {
            foreach ($field['conditional_logic']['rules'] as $rule) {
                $refs[] = $rule['field_key'] ?? null;
            }
        }
        return array_values(array_filter($refs, fn ($r) => is_string($r) && $r !== ''));
    }

    /**
     * Ops to drop so the batch stops introducing reference errors, narrowest first. Only ops that
     * can affect references are candidates (content-only updates such as label/options never are):
     * level 0 = ops on the fields with new errors, 1 = ops on the fields those reference,
     * 2 = every such op, 3+ = every field op.
     */
    private function culprits(array $applied, array $newErrors, int $level): array
    {
        $fieldOps = array_filter($applied, fn ($e) => $e['op']['type'] !== 'form.update');
        $structural = array_filter($fieldOps, function ($e) {
            if ($e['op']['type'] !== 'field.update') {
                return true;
            }
            foreach (array_keys($e['op']['set']) as $prop) {
                if (in_array(explode('.', $prop)[0], self::STRUCTURAL_FIELD_PROPS, true)) {
                    return true;
                }
            }
            return false;
        });

        $errorKeys = [];
        $refKeys = [];
        foreach ($newErrors as $error) {
            $errorKeys[$error['key']] = true;
            $refKeys += array_fill_keys($error['refs'], true);
        }

        $levels = [
            fn () => array_filter($structural, fn ($e) => isset($errorKeys[$e['op']['key']])),
            fn () => array_filter($structural, fn ($e) => isset($refKeys[$e['op']['key']])),
            fn () => $structural,
        ];
        for ($l = $level; $l < count($levels); $l++) {
            if ($hit = $levels[$l]()) {
                return $hit;
            }
        }

        return $fieldOps;
    }

    /** @return array<string, int> ids of created fields by key */
    private function persist(Form $form, $models, array $state): array
    {
        $doomed = $models->filter(fn ($m, $key) => !isset($state['fields'][$key]) || isset($state['new'][$key]));
        if ($doomed->isNotEmpty()) {
            FormField::whereIn('id', $doomed->pluck('id'))->delete();
        }

        $ids = [];
        foreach ($state['order'] as $order => $key) {
            $attrs = $state['fields'][$key];
            if (isset($state['new'][$key])) {
                $field = FormField::create(array_merge($attrs, ['form_id' => $form->id, 'order' => $order]));
                $ids[$key] = $field->id;
                continue;
            }

            $model = $models[$key];
            $model->fill(array_intersect_key($attrs, $state['touched'][$key] ?? []));
            $model->order = $order;
            if ($model->isDirty()) {
                $model->save();
            }
        }

        if ($state['form_touched'] !== []) {
            $form->fill(array_intersect_key($state['form'], $state['form_touched']))->save();
        }

        return $ids;
    }

    private function fail(string $reason, string $message, ?array $errors = null): array
    {
        return array_filter(['reason' => $reason, 'message' => $message, 'errors' => $errors], fn ($v) => $v !== null);
    }

    private function rejection(int $index, array $op, string $reason, string $message, ?array $errors = null): array
    {
        return array_filter([
            'index' => $index,
            'type' => is_string($op['type'] ?? null) ? $op['type'] : null,
            'key' => is_string($op['key'] ?? null) ? $op['key'] : null,
            'reason' => $reason,
            'message' => $message,
            'errors' => $errors,
        ], fn ($v) => $v !== null);
    }
}
