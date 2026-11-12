<?php

namespace Tests\Feature;

use App\Models\ResponseAnswer;
use App\Services\Forms\AnswerValue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SubmissionValidationTest extends TestCase
{
    use RefreshDatabase;

    private const OTHER = AnswerValue::OTHER;

    public function test_condition_hides_question_and_drops_its_answer(): void
    {
        $form = $this->makeForm();
        $q5 = $this->addField($form, 'radio', ['options' => ['Có', 'Không']]);
        $q5a = $this->addField($form, 'checkbox', [
            'options' => ['X', 'Y'],
            'is_required' => true,
            'conditional_logic' => ['match' => 'any', 'rules' => [['field_key' => $q5->key, 'operator' => 'includes_any', 'values' => ['Có']]]],
        ]);

        $this->submit($form, [$q5->id => 'Có'])->assertStatus(422)->assertJsonValidationErrors(["answers.{$q5a->id}"]);

        $this->submit($form, [$q5->id => 'Không', $q5a->id => ['X']])->assertCreated();
        $this->assertDatabaseMissing('response_answers', ['field_id' => $q5a->id]);
    }

    public function test_hidden_section_hides_whole_page(): void
    {
        $form = $this->makeForm();
        $gate = $this->addField($form, 'radio', ['options' => ['Có', 'Không']]);
        $this->addField($form, 'section', [
            'conditional_logic' => ['rules' => [['field_key' => $gate->key, 'operator' => 'includes_any', 'values' => ['Có']]]],
        ]);
        $inside = $this->addField($form, 'short_text', ['is_required' => true]);
        $this->addField($form, 'section');
        $after = $this->addField($form, 'short_text', ['is_required' => true]);

        $this->submit($form, [$gate->id => 'Không', $after->id => 'x'])->assertCreated();
        $this->submit($form, [$gate->id => 'Có', $after->id => 'x'])->assertStatus(422)->assertJsonValidationErrors(["answers.{$inside->id}"]);
    }

    public function test_checkbox_min_max(): void
    {
        $form = $this->makeForm();
        $q = $this->addField($form, 'checkbox', ['options' => ['a', 'b', 'c', 'd'], 'settings' => ['min_select' => 2, 'max_select' => 3]]);

        $this->submit($form, [$q->id => ['a']])->assertStatus(422);
        $this->submit($form, [$q->id => ['a', 'b', 'c', 'd']])->assertStatus(422);
        $this->submit($form, [$q->id => ['a', 'b', 'c']])->assertCreated();
        $this->submit($form, [])->assertCreated();
    }

    public function test_other_option_requires_text(): void
    {
        $form = $this->makeForm();
        $q = $this->addField($form, 'checkbox', ['options' => ['a', 'b'], 'settings' => ['other_option' => ['enabled' => true, 'label' => 'Khác']]]);
        $r = $this->addField($form, 'radio', ['options' => ['x'], 'settings' => ['other_option' => ['enabled' => true]]]);

        $this->submit($form, [$q->id => ['selected' => ['a', self::OTHER], 'other' => ' ']])
            ->assertStatus(422)->assertJsonValidationErrors(["answers.{$q->id}"]);
        $this->submit($form, [$q->id => ['selected' => ['a', self::OTHER], 'other' => 'Tự ghi'], $r->id => ['selected' => [self::OTHER], 'other' => 'R']])
            ->assertCreated();

        $this->assertSame(['selected' => ['a', self::OTHER], 'other' => 'Tự ghi'], ResponseAnswer::where('field_id', $q->id)->first()->value);
        $this->submit($form, [$q->id => ['zzz']])->assertStatus(422);
    }

    public function test_exclusive_option_cannot_combine(): void
    {
        $form = $this->makeForm();
        $q = $this->addField($form, 'checkbox', ['options' => ['a', 'b', 'Không nhớ'], 'settings' => ['exclusive_options' => ['Không nhớ'], 'min_select' => 2]]);

        $this->submit($form, [$q->id => ['a', 'Không nhớ']])->assertStatus(422);
        $this->submit($form, [$q->id => ['Không nhớ']])->assertCreated();
    }

    public function test_grid_require_all_rows(): void
    {
        $form = $this->makeForm();
        $q = $this->addField($form, 'multiple_choice_grid', [
            'rows' => ['r1', 'r2'], 'columns' => ['c1', 'c2'], 'is_required' => true, 'settings' => ['require_all_rows' => true],
        ]);

        $this->submit($form, [$q->id => ['r1' => 'c1']])->assertStatus(422);
        $this->submit($form, [$q->id => ['r1' => 'c1', 'r2' => 'c9']])->assertStatus(422);
        $this->submit($form, [$q->id => json_encode(['r1' => 'c1', 'r2' => 'c2'])])->assertCreated();
    }

    public function test_number_range_and_digits(): void
    {
        $form = $this->makeForm();
        $q = $this->addField($form, 'number', ['settings' => ['number' => ['digits' => 2, 'min' => 18, 'max' => 99]]]);

        foreach (['17', '100', '25.5', 'abc'] as $bad) {
            $this->submit($form, [$q->id => $bad])->assertStatus(422);
        }
        $this->submit($form, [$q->id => '18'])->assertCreated();
    }

    public function test_piped_choices(): void
    {
        $form = $this->makeForm();
        $q6 = $this->addField($form, 'checkbox', ['options' => ['a', 'b', 'c', 'none'], 'settings' => ['exclusive_options' => ['none']]]);
        $q6a = $this->addField($form, 'radio', ['options' => [], 'is_required' => true, 'settings' => ['piped_from' => $q6->key]]);

        // Several picked: must choose one of them.
        $this->submit($form, [$q6->id => ['a', 'b']])->assertStatus(422);
        $this->submit($form, [$q6->id => ['a', 'b'], $q6a->id => 'c'])->assertStatus(422);
        $this->submit($form, [$q6->id => ['a', 'b'], $q6a->id => 'b'])->assertCreated();

        // Single pick: auto-filled.
        $res = $this->submit($form, [$q6->id => ['c']])->assertCreated();
        $this->assertSame('c', ResponseAnswer::where('response_id', $res->json('response_id'))->where('field_id', $q6a->id)->value('value'));

        // Exclusive pick or nothing: hidden, empty.
        $res = $this->submit($form, [$q6->id => ['none']])->assertCreated();
        $this->assertNull(ResponseAnswer::where('response_id', $res->json('response_id'))->where('field_id', $q6a->id)->first());
        $this->submit($form, [])->assertCreated();
    }

    public function test_phone_and_email_formats(): void
    {
        $form = $this->makeForm();
        $phone = $this->addField($form, 'phone');
        $email = $this->addField($form, 'email');

        $this->submit($form, [$phone->id => '12345'])->assertStatus(422);
        $this->submit($form, [$email->id => 'not-an-email'])->assertStatus(422);
        $this->submit($form, [$phone->id => '+84 912.345-678', $email->id => ' a@b.vn '])->assertCreated();
        $this->assertSame('0912345678', ResponseAnswer::where('field_id', $phone->id)->value('value'));
    }

    public function test_legacy_form_without_new_features_still_works(): void
    {
        $form = $this->makeForm();
        $text = $this->addField($form, 'short_text', ['is_required' => true]);
        $box = $this->addField($form, 'checkbox', ['options' => ['Một', 'Hai']]);
        $this->addField($form, 'section');
        $grid = $this->addField($form, 'checkbox_grid', ['rows' => ['r'], 'columns' => ['c1', 'c2']]);

        // The current public form sends arrays / objects as JSON text inside multipart data.
        $this->post("/api/forms/public/{$form->slug}/submit", [
            'answers' => [$text->id => 'hi', $box->id => json_encode(['Hai']), $grid->id => json_encode(['r' => ['c1', 'c2']])],
        ], ['Accept' => 'application/json'])->assertCreated();

        $this->assertSame(['Hai'], ResponseAnswer::where('field_id', $box->id)->value('value'));
        $this->assertSame(['r' => ['c1', 'c2']], ResponseAnswer::where('field_id', $grid->id)->value('value'));
        $this->submit($form, [])->assertStatus(422)->assertJsonValidationErrors(["answers.{$text->id}"]);
    }

    public function test_closed_form_rejects_submission(): void
    {
        $form = $this->makeForm(['accept_responses' => false]);
        $this->submit($form, [])->assertForbidden();
    }
}
