<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\FormField;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FormStructureEditingTest extends TestCase
{
    use RefreshDatabase;

    private function payload(): array
    {
        return [
            ['key' => 'grid', 'type' => 'multiple_choice_grid', 'label' => 'Câu 2', 'order' => 0, 'rows' => ['E1', 'E2'], 'columns' => ['Có', 'Không']],
            ['key' => 'blk', 'type' => 'random_section', 'label' => 'Phần II', 'order' => 1, 'settings' => [
                'mode' => 'same', 'pick_count' => 1,
                'variants' => [['key' => 'v1', 'title' => 'E1'], ['key' => 'v2', 'title' => 'E2']],
                'filter' => ['field_key' => 'grid', 'exclude_columns' => ['Không']],
            ]],
            ['key' => 'q6', 'type' => 'checkbox', 'label' => 'Câu 6', 'order' => 2, 'options' => ['a', 'b'], 'random_group_key' => 'blk'],
            ['key' => 'q6a', 'type' => 'radio', 'label' => 'Câu 6a', 'order' => 3, 'options' => [], 'random_group_key' => 'blk', 'settings' => ['piped_from' => 'q6']],
            ['key' => 'tail', 'type' => 'short_text', 'label' => 'Cuối', 'order' => 4, 'conditional_logic' => [
                'match' => 'any', 'rules' => [['field_key' => 'q6', 'operator' => 'includes_any', 'values' => ['a']]],
            ]],
        ];
    }

    private function save(Form $form, array $fields)
    {
        return $this->actingAs($form->user)->postJson("/api/forms/{$form->id}/fields/bulk-update", ['fields' => $fields]);
    }

    public function test_valid_structure_saves_new_columns(): void
    {
        $form = $this->makeForm();
        $this->save($form, $this->payload())->assertOk()->assertJsonCount(5, 'fields');

        $q6a = FormField::where('key', 'q6a')->first();
        $this->assertSame('blk', $q6a->random_group_key);
        $this->assertSame('q6', $q6a->setting('piped_from'));
    }

    public function test_invalid_references_are_rejected(): void
    {
        $form = $this->makeForm();

        $cases = ['condition on later question', 'piped from non-checkbox', 'filter not grid', 'member not adjacent', 'duplicate key', 'pick count too big'];

        foreach ($cases as $case) {
            $this->assertSame(422, $this->save($form, $this->mutated($case))->status(), $case);
        }
        $this->assertSame(0, FormField::count());
    }

    private function mutated(string $case): array
    {
        $p = $this->payload();
        switch ($case) {
            case 'condition on later question':
                $p[0]['conditional_logic'] = ['rules' => [['field_key' => 'tail', 'operator' => 'answered']]];
                break;
            case 'piped from non-checkbox':
                $p[3]['settings']['piped_from'] = 'grid';
                break;
            case 'filter not grid':
                $p[1]['settings']['filter']['field_key'] = 'tail';
                break;
            case 'member not adjacent':
                $p[3]['random_group_key'] = null;
                $p[3]['settings'] = [];
                $p[4]['random_group_key'] = 'blk';
                $p[4]['conditional_logic'] = null;
                break;
            case 'duplicate key':
                $p[4]['key'] = 'q6';
                break;
            case 'pick count too big':
                $p[1]['settings']['pick_count'] = 5;
                break;
        }
        return $p;
    }

    public function test_existing_fields_keep_their_key_when_payload_omits_it(): void
    {
        $form = $this->makeForm();
        $field = $this->addField($form, 'short_text');
        $key = $field->key;

        $this->save($form, [['id' => $field->id, 'type' => 'short_text', 'label' => 'Đổi tên', 'order' => 0]])->assertOk();
        $this->assertSame($key, $field->fresh()->key);
        $this->assertSame('Đổi tên', $field->fresh()->label);

        $this->save($form, [])->assertOk();
        $this->assertSame(0, FormField::count());
    }

    public function test_duplicate_remaps_all_references(): void
    {
        $form = $this->makeForm();
        $this->save($form, $this->payload())->assertOk();
        $form->update(['respondent_limit' => ['enabled' => true, 'methods' => ['email'], 'field_keys' => ['email' => 'tail']]]);

        $copyId = $this->actingAs($form->user)->postJson("/api/forms/{$form->id}/duplicate")->assertCreated()->json('form.id');
        $copy = Form::find($copyId);
        $fields = $copy->fields()->get()->keyBy('label');

        $oldKeys = ['grid', 'blk', 'q6', 'q6a', 'tail'];
        foreach ($fields as $f) {
            $this->assertNotContains($f->key, $oldKeys);
        }
        $this->assertSame($fields['Câu 2']->key, $fields['Phần II']->setting('filter.field_key'));
        $this->assertSame($fields['Phần II']->key, $fields['Câu 6']->random_group_key);
        $this->assertSame($fields['Câu 6']->key, $fields['Câu 6a']->setting('piped_from'));
        $this->assertSame($fields['Câu 6']->key, $fields['Cuối']->conditional_logic['rules'][0]['field_key']);
        $this->assertSame($fields['Cuối']->key, $copy->respondent_limit['field_keys']['email']);
    }
}
