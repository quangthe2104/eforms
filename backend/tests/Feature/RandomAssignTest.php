<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\FormField;
use App\Models\FormSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RandomAssignTest extends TestCase
{
    use RefreshDatabase;

    private const NEVER = 'Chưa từng nghe nói';

    private Form $form;
    private FormField $grid;
    private FormField $block;

    private function buildForm(int $pickCount = 1): void
    {
        $this->form = $this->makeForm();
        $this->grid = $this->addField($this->form, 'multiple_choice_grid', [
            'rows' => ['E1', 'E2', 'E3', 'E4'],
            'columns' => ['Biết rõ', self::NEVER],
        ]);
        $this->block = $this->addField($this->form, 'random_section', [
            'settings' => [
                'mode' => 'same',
                'pick_count' => $pickCount,
                'variants' => [['key' => 'v1', 'title' => 'E1'], ['key' => 'v2', 'title' => 'E2'], ['key' => 'v3', 'title' => 'E3'], ['key' => 'v4', 'title' => 'E4']],
                'filter' => ['field_key' => $this->grid->key, 'exclude_columns' => [self::NEVER]],
            ],
        ]);
        $this->addField($this->form, 'radio', ['options' => ['A', 'B'], 'random_group_key' => $this->block->key]);
    }

    private function assign(array $gridAnswer, ?string $token = null)
    {
        return $this->postJson("/api/forms/public/{$this->form->slug}/assign", [
            'token' => $token,
            'answers' => [$this->grid->id => $gridAnswer],
        ])->assertOk();
    }

    public function test_excluded_rows_are_never_picked(): void
    {
        $this->buildForm();
        $answer = ['E1' => self::NEVER, 'E2' => self::NEVER, 'E3' => 'Biết rõ'];

        for ($i = 0; $i < 30; $i++) {
            $picked = $this->assign($answer)->json('assignments.' . $this->block->key);
            $this->assertCount(1, $picked);
            $this->assertContains($picked[0], ['v3', 'v4'], 'E4 left blank counts as heard');
        }
    }

    public function test_all_excluded_falls_back_to_all_variants(): void
    {
        $this->buildForm();
        $answer = array_fill_keys(['E1', 'E2', 'E3', 'E4'], self::NEVER);

        $picked = $this->assign($answer)->json('assignments.' . $this->block->key);
        $this->assertCount(1, $picked);
        $this->assertContains($picked[0], ['v1', 'v2', 'v3', 'v4']);
    }

    public function test_tops_up_to_k_when_too_few_eligible(): void
    {
        $this->buildForm(3);
        $answer = ['E1' => 'Biết rõ', 'E2' => self::NEVER, 'E3' => self::NEVER, 'E4' => self::NEVER];

        for ($i = 0; $i < 10; $i++) {
            $picked = $this->assign($answer)->json('assignments.' . $this->block->key);
            $this->assertCount(3, $picked);
            $this->assertSame('v1', $picked[0], 'eligible variants come first');
            $this->assertCount(3, array_unique($picked));
        }
    }

    public function test_repeat_call_keeps_assignment(): void
    {
        $this->buildForm();
        $first = $this->assign(['E1' => 'Biết rõ']);
        $token = $first->json('token');
        $picked = $first->json('assignments.' . $this->block->key);

        $again = $this->assign(array_fill_keys(['E1', 'E2', 'E3', 'E4'], self::NEVER), $token);
        $this->assertSame($token, $again->json('token'));
        $this->assertSame($picked, $again->json('assignments.' . $this->block->key));
        $this->assertSame(1, FormSession::count());
    }

    public function test_submit_uses_session_assignment_and_ignores_other_variants(): void
    {
        $this->buildForm();
        $res = $this->assign(['E1' => 'Biết rõ']);
        $variant = $res->json('assignments.' . $this->block->key)[0];
        $other = $variant === 'v1' ? 'v2' : 'v1';
        $radio = FormField::where('type', 'radio')->first();

        $this->submit($this->form, [
            $this->grid->id => ['E1' => 'Biết rõ'],
            "{$radio->id}@{$variant}" => 'A',
            "{$radio->id}@{$other}" => 'B',
        ], ['token' => $res->json('token')])->assertCreated();

        $this->assertDatabaseHas('response_answers', ['field_id' => $radio->id, 'variant_key' => $variant]);
        $this->assertDatabaseMissing('response_answers', ['field_id' => $radio->id, 'variant_key' => $other]);
        $this->assertDatabaseCount('form_responses', 1);
        $this->assertSame([$this->block->key => [$variant]], \App\Models\FormResponse::first()->assignments);
    }

    public function test_different_mode_only_validates_members_of_assigned_variant(): void
    {
        $this->form = $this->makeForm();
        $block = $this->addField($this->form, 'random_section', [
            'settings' => ['mode' => 'different', 'pick_count' => 1, 'variants' => [['key' => 'a'], ['key' => 'b']]],
        ]);
        $qa = $this->addField($this->form, 'short_text', ['random_group_key' => $block->key, 'variant_key' => 'a', 'is_required' => true]);
        $qb = $this->addField($this->form, 'short_text', ['random_group_key' => $block->key, 'variant_key' => 'b', 'is_required' => true]);

        $res = $this->postJson("/api/forms/public/{$this->form->slug}/assign", [])->assertOk();
        $variant = $res->json('assignments.' . $block->key)[0];
        $mine = $variant === 'a' ? $qa : $qb;
        $theirs = $variant === 'a' ? $qb : $qa;

        $this->submit($this->form, [], ['token' => $res->json('token')])
            ->assertStatus(422)
            ->assertJsonValidationErrors(["answers.{$mine->id}@{$variant}"])
            ->assertJsonMissingValidationErrors(["answers.{$theirs->id}@{$variant}"]);

        $this->submit($this->form, ["{$mine->id}@{$variant}" => 'ok'], ['token' => $res->json('token')])->assertCreated();
    }
}
