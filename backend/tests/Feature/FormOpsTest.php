<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\FormChange;
use App\Models\FormCollaborator;
use App\Models\FormField;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class FormOpsTest extends TestCase
{
    use RefreshDatabase;

    private Form $form;
    private User $owner;
    private User $editor;

    protected function setUp(): void
    {
        parent::setUp();
        $this->form = $this->makeForm();
        $this->owner = $this->form->user;
        $this->editor = $this->makeUser();
        $this->share($this->editor, 'editor');
    }

    private function share(User $user, string $role): void
    {
        FormCollaborator::create(['form_id' => $this->form->id, 'user_id' => $user->id, 'role' => $role]);
    }

    private function ops(array $ops, string $client = 'c1', ?User $user = null)
    {
        return $this->actingAs($user ?? $this->owner)
            ->postJson("/api/forms/{$this->form->id}/ops", ['client_id' => $client, 'base_revision' => 0, 'ops' => $ops]);
    }

    private function poll(int $since, string $client = 'c1', ?User $user = null, ?string $active = null)
    {
        $query = http_build_query(array_filter(['since' => $since, 'client_id' => $client, 'active_field' => $active], fn ($v) => $v !== null));

        return $this->actingAs($user ?? $this->owner)->getJson("/api/forms/{$this->form->id}/changes?$query");
    }

    private function keys(): array
    {
        return FormField::where('form_id', $this->form->id)->orderBy('order')->pluck('key')->all();
    }

    private function field(string $key): FormField
    {
        return FormField::where('form_id', $this->form->id)->where('key', $key)->firstOrFail();
    }

    private function seedFields(string ...$keys): void
    {
        foreach ($keys as $key) {
            $this->addField($this->form, 'radio', ['key' => $key, 'label' => strtoupper($key), 'options' => ['x', 'y']]);
        }
    }

    public function test_batch_applies_in_one_revision_and_is_logged(): void
    {
        $this->seedFields('a', 'b');

        $res = $this->ops([
            ['type' => 'field.insert', 'key' => 'n', 'after_key' => 'a', 'data' => ['type' => 'short_text', 'label' => 'Mới', 'order' => 99, 'id' => 5]],
            ['type' => 'field.update', 'key' => 'b', 'set' => ['label' => 'B2']],
            ['type' => 'field.move', 'key' => 'b', 'after_key' => null],
            ['type' => 'field.delete', 'key' => 'a'],
        ])->assertOk();

        $res->assertJsonPath('revision', 1)->assertJsonCount(4, 'applied')->assertJsonPath('rejected', []);
        $this->assertSame(['b', 'n'], $this->keys());
        $this->assertSame('B2', $this->field('b')->label);
        $this->assertSame([0, 1], FormField::where('form_id', $this->form->id)->orderBy('order')->pluck('order')->all());
        $this->assertSame($this->field('n')->id, $res->json('applied.0.op.data.id'));

        $change = FormChange::sole();
        $this->assertSame(1, $change->revision);
        $this->assertSame('c1', $change->client_id);
        $this->assertSame(['field.insert', 'field.update', 'field.move', 'field.delete'], array_column($change->ops, 'type'));
        $this->assertSame(1, $this->form->fresh()->revision);

        $this->actingAs($this->owner)->getJson("/api/forms/{$this->form->id}")->assertJsonPath('revision', 1);
    }

    public function test_batch_with_nothing_applied_keeps_revision(): void
    {
        $this->ops([['type' => 'field.delete', 'key' => 'ghost']])
            ->assertOk()->assertJsonPath('revision', 0)->assertJsonPath('applied', []);
        $this->assertSame(0, FormChange::count());
    }

    public function test_last_writer_wins_per_property(): void
    {
        $this->seedFields('a');
        $this->field('a')->update(['settings' => ['min_select' => 1, 'other_option' => ['enabled' => false]]]);

        $this->ops([['type' => 'field.update', 'key' => 'a', 'set' => ['label' => 'Từ A', 'settings.min_select' => 2]]], 'c1');
        $this->ops([['type' => 'field.update', 'key' => 'a', 'set' => ['is_required' => true, 'settings.max_select' => 3]]], 'c2', $this->editor);
        $this->ops([['type' => 'field.update', 'key' => 'a', 'set' => ['settings.other_option' => null, 'options' => ['p', 'q', 'r']]]], 'c2', $this->editor);

        $field = $this->field('a');
        $this->assertSame('Từ A', $field->label);
        $this->assertTrue($field->is_required);
        $this->assertSame(['min_select' => 2, 'max_select' => 3], $field->settings);
        $this->assertSame(['p', 'q', 'r'], $field->options);

        $this->ops([['type' => 'field.update', 'key' => 'a', 'set' => ['label' => 'Từ B']]], 'c2', $this->editor);
        $this->assertSame('Từ B', $this->field('a')->label);
        $this->assertSame(4, $this->form->fresh()->revision);
    }

    public function test_ops_on_deleted_field_are_rejected_and_others_apply(): void
    {
        $this->seedFields('a', 'b');
        $this->ops([['type' => 'field.delete', 'key' => 'a']], 'c1');

        $res = $this->ops([
            ['type' => 'field.update', 'key' => 'a', 'set' => ['label' => 'x']],
            ['type' => 'field.move', 'key' => 'a', 'after_key' => 'b'],
            ['type' => 'field.update', 'key' => 'b', 'set' => ['label' => 'B ok']],
        ], 'c2', $this->editor)->assertOk();

        $res->assertJsonPath('revision', 2)->assertJsonCount(1, 'applied')->assertJsonPath('applied.0.index', 2);
        $this->assertSame(['deleted', 'deleted'], array_column($res->json('rejected'), 'reason'));
        $this->assertSame([0, 1], array_column($res->json('rejected'), 'index'));
        $this->assertSame('B ok', $this->field('b')->label);
    }

    public function test_insert_and_move_ordering(): void
    {
        $this->seedFields('a', 'b', 'c');

        $res = $this->ops([
            ['type' => 'field.insert', 'key' => 'first', 'after_key' => null, 'data' => ['type' => 'short_text']],
            ['type' => 'field.insert', 'key' => 'orphan', 'after_key' => 'gone', 'data' => ['type' => 'short_text', 'label' => null]],
            ['type' => 'field.move', 'key' => 'c', 'after_key' => 'a'],
            ['type' => 'field.move', 'key' => 'a', 'after_key' => 'missing'],
        ])->assertOk();

        $this->assertSame(['first', 'c', 'b', 'orphan', 'a'], $this->keys());
        $this->assertNull($res->json('applied.0.op.after_key'));
        $this->assertSame('c', $res->json('applied.1.op.after_key'));
        $this->assertSame('orphan', $res->json('applied.3.op.after_key'));
        $this->assertSame('', $this->field('orphan')->label);
    }

    public function test_form_update_merges_theme_and_settings(): void
    {
        $this->form->update(['settings' => ['a' => 1, 'b' => 2], 'secondary_color' => '#111111']);

        $res = $this->ops([
            ['type' => 'form.update', 'set' => ['primary_color' => '#ff0000', 'settings.b' => 3, 'settings.c' => 4]],
            ['type' => 'form.update', 'set' => ['respondent_limit' => ['enabled' => true, 'methods' => ['account']], 'require_login' => false]],
            ['type' => 'form.update', 'set' => ['title' => 'Tiêu đề mới', 'show_progress_bar' => true]],
        ])->assertOk();

        $form = $this->form->fresh();
        $this->assertSame('#ff0000', $form->primary_color);
        $this->assertSame('#111111', $form->secondary_color);
        $this->assertSame(['a' => 1, 'b' => 3, 'c' => 4], $form->settings);
        $this->assertTrue($form->require_login);
        $this->assertTrue($res->json('applied.1.op.set.require_login'));
        $this->assertSame('Tiêu đề mới', $form->title);
        $this->assertTrue($form->show_progress_bar);
        $this->assertSame(1, $form->revision);
    }

    public function test_invalid_ops_are_rejected_and_others_still_apply(): void
    {
        $this->seedFields('a');

        $res = $this->ops([
            ['type' => 'field.update', 'key' => 'a', 'set' => ['label' => ['not', 'a', 'string']]],
            ['type' => 'field.update', 'key' => 'a', 'set' => ['order' => 5]],
            ['type' => 'field.insert', 'key' => 'a', 'after_key' => null, 'data' => ['type' => 'short_text']],
            ['type' => 'field.insert', 'key' => 'z', 'after_key' => null, 'data' => ['label' => 'no type']],
            ['type' => 'form.update', 'set' => ['title' => null]],
            ['type' => 'form.update', 'set' => ['primary_color' => null]],
            ['type' => 'form.update', 'set' => ['respondent_limit' => ['methods' => ['fingerprint']]]],
            ['type' => 'nope'],
            ['type' => 'field.update', 'key' => 'a', 'set' => ['help_text' => 'kept']],
        ])->assertOk();

        $this->assertSame(
            ['invalid', 'invalid', 'exists', 'invalid', 'invalid', 'invalid', 'invalid', 'unknown_type'],
            array_column($res->json('rejected'), 'reason')
        );
        $this->assertArrayHasKey('set.label', $res->json('rejected.0.errors'));
        $this->assertArrayHasKey('set.order', $res->json('rejected.1.errors'));
        $res->assertJsonCount(1, 'applied')->assertJsonPath('applied.0.index', 8);
        $this->assertSame('kept', $this->field('a')->help_text);
        $this->assertSame('Survey', $this->form->fresh()->title);
    }

    public function test_reference_errors_are_checked_at_end_of_batch(): void
    {
        $this->seedFields('a', 'b');
        $this->addField($this->form, 'checkbox', ['key' => 'src', 'options' => ['x']]);

        $res = $this->ops([
            ['type' => 'field.update', 'key' => 'a', 'set' => ['conditional_logic' => ['rules' => [['field_key' => 'b', 'operator' => 'answered']]]]],
            ['type' => 'field.update', 'key' => 'b', 'set' => ['label' => 'content only']],
        ])->assertOk();
        $res->assertJsonPath('rejected.0.reason', 'structure')->assertJsonPath('rejected.0.index', 0)->assertJsonCount(1, 'applied');
        $this->assertArrayHasKey('fields.a.conditional_logic.rules.0', $res->json('rejected.0.errors'));
        $this->assertNull($this->field('a')->conditional_logic);
        $this->assertSame('content only', $this->field('b')->label);

        // Condition becomes valid once its source is moved before it in the same batch.
        $this->ops([
            ['type' => 'field.update', 'key' => 'a', 'set' => ['conditional_logic' => ['rules' => [['field_key' => 'b', 'operator' => 'answered']]]]],
            ['type' => 'field.move', 'key' => 'b', 'after_key' => null],
        ])->assertOk()->assertJsonPath('rejected', []);
        $this->assertSame(['b', 'a', 'src'], $this->keys());

        // Deleting a question another one depends on is rejected.
        $this->ops([['type' => 'field.delete', 'key' => 'b']])
            ->assertOk()->assertJsonPath('rejected.0.reason', 'structure');
        $this->assertContains('b', $this->keys());
    }

    public function test_random_section_is_built_from_basic_ops_in_one_batch(): void
    {
        $this->seedFields('a');
        $header = ['type' => 'random_section', 'label' => 'Phần', 'settings' => ['mode' => 'same', 'pick_count' => 1, 'variants' => [['key' => 'v1'], ['key' => 'v2']]]];

        // A member alone (no header yet) is invalid; header + members in one batch are fine.
        $this->ops([['type' => 'field.insert', 'key' => 'm1', 'after_key' => 'a', 'data' => ['type' => 'short_text', 'random_group_key' => 'blk']]])
            ->assertOk()->assertJsonPath('rejected.0.reason', 'structure');

        $this->ops([
            ['type' => 'field.insert', 'key' => 'm1', 'after_key' => 'a', 'data' => ['type' => 'short_text', 'random_group_key' => 'blk']],
            ['type' => 'field.insert', 'key' => 'blk', 'after_key' => 'a', 'data' => $header],
            ['type' => 'field.update', 'key' => 'a', 'set' => ['random_group_key' => 'blk']],
            ['type' => 'field.move', 'key' => 'a', 'after_key' => 'm1'],
        ])->assertOk()->assertJsonPath('rejected', [])->assertJsonCount(4, 'applied');

        $this->assertSame(['blk', 'm1', 'a'], $this->keys());
        $this->assertSame('blk', $this->field('a')->random_group_key);
    }

    public function test_viewer_cannot_post_ops_but_can_poll(): void
    {
        $viewer = $this->makeUser();
        $this->share($viewer, 'viewer');
        $this->seedFields('a');

        $this->ops([['type' => 'field.delete', 'key' => 'a']], 'v1', $viewer)->assertForbidden();
        $this->poll(0, 'v1', $viewer)->assertOk()->assertJsonPath('revision', 0)->assertJsonPath('my_role', 'viewer');
        $this->poll(0, 'o1')->assertJsonPath('my_role', 'owner');
        $this->actingAs($this->makeUser())->getJson("/api/forms/{$this->form->id}/changes?since=0&client_id=x")->assertForbidden();
    }

    public function test_changes_exclude_own_client(): void
    {
        $this->seedFields('a');
        $this->ops([['type' => 'field.update', 'key' => 'a', 'set' => ['label' => 'one']]], 'c1');
        $this->ops([['type' => 'field.update', 'key' => 'a', 'set' => ['label' => 'two']]], 'c2', $this->editor);
        $this->ops([['type' => 'field.update', 'key' => 'a', 'set' => ['label' => 'three']]], 'c1');

        $res = $this->poll(0, 'c1')->assertOk();
        $res->assertJsonPath('revision', 3)->assertJsonPath('reset', false)->assertJsonCount(1, 'changes');
        $res->assertJsonPath('changes.0.revision', 2)
            ->assertJsonPath('changes.0.client_id', 'c2')
            ->assertJsonPath('changes.0.user.id', $this->editor->id)
            ->assertJsonPath('changes.0.ops.0.set.label', 'two');

        $this->poll(3, 'c1')->assertJsonPath('changes', [])->assertJsonPath('reset', false);
        $this->poll(0, 'c3')->assertJsonCount(3, 'changes');
    }

    public function test_reset_when_gap_is_too_large_log_pruned_or_wholesale_save(): void
    {
        $this->seedFields('a');
        $this->ops([['type' => 'field.update', 'key' => 'a', 'set' => ['label' => 'one']]], 'c2', $this->editor);

        $this->form->forceFill(['revision' => 300])->save();
        $this->poll(0, 'c1')->assertJsonPath('reset', true)->assertJsonPath('changes', []);
        $this->poll(301, 'c1')->assertJsonPath('reset', true);
        $this->form->forceFill(['revision' => 1])->save();

        $this->travel(25)->hours();
        $this->artisan('forms:prune-changes')->assertSuccessful();
        $this->assertSame(0, FormChange::count());
        $this->poll(0, 'c1')->assertJsonPath('reset', true);
        $this->poll(1, 'c1')->assertJsonPath('reset', false);

        // Wholesale saves through the classic endpoints tell other editors to reload.
        $this->actingAs($this->editor)->postJson("/api/forms/{$this->form->id}/fields/bulk-update", ['fields' => []])->assertOk();
        $this->poll(1, 'c1')->assertJsonPath('revision', 2)->assertJsonPath('reset', true);
    }

    public function test_classic_form_update_is_broadcast_as_form_update_op(): void
    {
        $this->actingAs($this->editor)
            ->withHeader('X-Client-Id', 'legacy')
            ->putJson("/api/forms/{$this->form->id}", ['title' => 'Đổi tên', 'primary_color' => '#123456', 'thumbnail' => 'data:x'])
            ->assertOk()->assertJsonPath('form.revision', 1);

        $res = $this->poll(0, 'c1')->assertJsonPath('reset', false);
        $this->assertSame(['title' => 'Đổi tên', 'primary_color' => '#123456'], $res->json('changes.0.ops.0.set'));

        $this->actingAs($this->editor)->putJson("/api/forms/{$this->form->id}", ['title' => 'Đổi tên'])->assertOk();
        $this->assertSame(1, $this->form->fresh()->revision);
    }

    public function test_presence_is_recorded_and_expires(): void
    {
        $this->poll(0, 'c2', $this->editor, 'q1');
        $this->poll(0, 'c1')->assertJsonCount(1, 'presence')
            ->assertJsonPath('presence.0.user_id', $this->editor->id)
            ->assertJsonPath('presence.0.client_id', 'c2')
            ->assertJsonPath('presence.0.active_field_key', 'q1');

        $this->poll(0, 'c2', $this->editor);
        $this->poll(0, 'c1')->assertJsonPath('presence.0.active_field_key', null);
        $this->assertSame(2, DB::table('form_presence')->count());

        $this->travel(31)->seconds();
        $this->poll(0, 'c1')->assertJsonPath('presence', []);

        $this->travel(2)->hours();
        $this->artisan('forms:prune-changes')->assertSuccessful();
        $this->assertSame(0, DB::table('form_presence')->count());
    }
}
