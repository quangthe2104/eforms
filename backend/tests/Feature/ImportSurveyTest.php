<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\FormField;
use App\Services\Forms\FieldReferenceValidator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class ImportSurveyTest extends TestCase
{
    use RefreshDatabase;

    private const OTHER = '__other__';

    private function import(int $userId, array $options = []): array
    {
        $code = Artisan::call('survey:import-1211', ['--user' => $userId, '--json' => true] + $options);
        $output = Artisan::output();
        $this->assertSame(0, $code, $output);
        return json_decode(trim($output), true);
    }

    private function field(array $info, string $code): FormField
    {
        return FormField::where('key', $info['keys'][$code])->firstOrFail();
    }

    public function test_import_builds_a_valid_draft_survey(): void
    {
        $info = $this->import($this->makeUser()->id);
        $form = Form::findOrFail($info['id']);
        $fields = $form->fields()->get();

        $this->assertSame('draft', $form->status);
        $this->assertCount(33, $fields);
        $this->assertSame([], (new FieldReferenceValidator())->validate($fields->map->toArray()->all()));

        $header = $this->field($info, 'block');
        $this->assertCount(10, $header->settings['variants']);
        $this->assertSame('Sự kiện được lựa chọn là', $header->settings['variant_label']);
        $this->assertSame(['Chưa từng nghe nói'], $header->settings['filter']['exclude_columns']);
        $this->assertSame($this->field($info, 'q2')->rows, array_values($header->settings['filter']['row_map']));
        $this->assertSame(15, $fields->where('random_group_key', $header->key)->count());

        $limit = $form->respondent_limit;
        $this->assertTrue($limit['enabled']);
        $this->assertSame(['email'], $limit['methods']);
        $this->assertSame($info['keys']['email'], $limit['field_keys']['email']);
        $this->assertSame('block', $limit['on_limit']);

        $this->assertCount(17, $this->field($info, 'a5')->rows);
        $this->assertSame(['min_select' => 3, 'max_select' => 3], array_intersect_key($this->field($info, 'a7')->settings, ['min_select' => 1, 'max_select' => 1]));
    }

    public function test_imported_survey_accepts_a_response_and_blocks_the_same_email(): void
    {
        $info = $this->import($this->makeUser()->id);
        $form = Form::findOrFail($info['id']);
        $form->update(['status' => 'published', 'is_public' => true]);
        $id = fn (string $code) => $this->field($info, $code)->id;

        $q2 = $this->field($info, 'q2');
        $heard = array_fill_keys($q2->rows, 'Chưa từng nghe nói');
        $heard[$q2->rows[3]] = 'Biết những nội dung cơ bản';
        $assign = $this->postJson("/api/forms/public/{$form->slug}/assign", ['answers' => [$q2->id => $heard]])->assertOk();
        $this->assertSame(['v4'], $assign->json('assignments.' . $info['keys']['block']));

        $v = fn (string $code) => $id($code) . '@v4';
        $a5 = array_fill_keys($this->field($info, 'a5')->rows, 'Vài lần');
        $answers = [
            $id('email') => 'Nguoi.Dung@Test.vn',
            $id('q2') => $heard,
            $v('q3') => ['selected' => ['Những diễn biến chính của sự kiện', self::OTHER], 'other' => 'Võ Nguyên Giáp'],
            $v('q5') => 'Ít cảm nhận được mối liên hệ với bản thân hoặc cộng đồng của mình',
            $v('q6') => ['Để hiểu biết về lịch sử hình thành và phát triển của đất nước'],
            $v('q10') => ['Không nhớ rõ'],
            $v('q10a') => ['Địa điểm tổ chức không thuận tiện'],
            $id('a2') => '45',
            $id('a5') => $a5,
            $id('a7') => ['Tên đường phố bị trùng, sai', 'Phát huy giá trị của các khu di tích', 'Việc đặt tên cho các công trình công cộng lớn'],
        ];
        $token = $assign->json('token');

        $tooFew = $answers;
        $tooFew[$id('a7')] = ['Tên đường phố bị trùng, sai'];
        $this->submit($form, $tooFew, ['token' => $token])->assertStatus(422)->assertJsonValidationErrors(['answers.' . $id('a7')]);

        $this->submit($form, $answers, ['token' => $token])->assertCreated();
        $response = $form->responses()->with('answers')->firstOrFail();
        $byKey = $response->answers->keyBy(fn ($a) => $a->field_id . ($a->variant_key ? '@' . $a->variant_key : ''));
        $this->assertSame('Để hiểu biết về lịch sử hình thành và phát triển của đất nước', $byKey[$v('q6a')]->value, 'single reason is piped into 6a');
        $this->assertArrayNotHasKey($v('q5a'), $byKey->all(), '5a is hidden for this Câu 5 answer');

        $this->submit($form, [$id('email') => ' nguoi.dung@test.vn '] + $answers)->assertStatus(409);
    }

    public function test_replace_swaps_an_unused_import_and_refuses_one_with_responses(): void
    {
        $user = $this->makeUser();
        $first = $this->import($user->id);
        $second = $this->import($user->id, ['--replace' => true]);

        $this->assertSoftDeleted('forms', ['id' => $first['id']]);
        $this->assertNotSame($first['id'], $second['id']);

        Form::findOrFail($second['id'])->responses()->create(['ip_address' => '127.0.0.1']);
        $this->assertSame(1, Artisan::call('survey:import-1211', ['--user' => $user->id, '--replace' => true]));
        $this->assertNotSoftDeleted('forms', ['id' => $second['id']]);
    }
}
