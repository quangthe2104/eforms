<?php

namespace Tests\Feature;

use App\Exports\FormResponsesExport;
use App\Models\Form;
use App\Models\FormField;
use App\Models\FormResponse;
use App\Models\FormSession;
use App\Services\Forms\ResponseTable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Cell\DefaultValueBinder;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

class ResponseReportingTest extends TestCase
{
    use RefreshDatabase;

    private const OTHER = '__other__';

    private Form $form;
    private FormField $block;

    private function block(array $settings): FormField
    {
        return $this->block = $this->addField($this->form, 'random_section', [
            'label' => 'PHẦN II',
            'settings' => array_merge([
                'mode' => 'same',
                'pick_count' => 1,
                'variants' => [['key' => 'v1', 'title' => 'Sự kiện 1'], ['key' => 'v2', 'title' => 'Sự kiện 2']],
            ], $settings),
        ]);
    }

    private function member(string $type, string $label, array $attributes = []): FormField
    {
        return $this->addField($this->form, $type, array_merge(['label' => $label, 'random_group_key' => $this->block->key], $attributes));
    }

    /** Submits with a session holding the given variants (no random draw). */
    private function submitAs(array $variants, array $answers)
    {
        $session = FormSession::create(['form_id' => $this->form->id, 'assignments' => [$this->block->key => $variants]]);
        return $this->submit($this->form, $answers, ['token' => $session->token])->assertCreated();
    }

    private function table(): ResponseTable
    {
        $responses = $this->form->responses()->with(['answers', 'user', 'identities'])->orderBy('id')->get();
        return new ResponseTable($this->form->fresh(), $responses);
    }

    private function rows(): array
    {
        $table = $this->table();
        $responses = $this->form->responses()->with(['answers', 'user', 'identities'])->orderBy('id')->get();
        return $responses->map(fn ($r) => array_combine($table->headings(), $table->row($r)))->all();
    }

    public function test_export_splits_grid_rows_into_columns(): void
    {
        $this->form = $this->makeForm();
        $grid = $this->addField($this->form, 'multiple_choice_grid', ['label' => 'Câu 2', 'rows' => ['1. Hùng Vương', '2. Điện Biên'], 'columns' => ['Biết', 'Chưa']]);
        $multi = $this->addField($this->form, 'checkbox_grid', ['label' => 'Bảng chọn', 'rows' => ['R'], 'columns' => ['C1', 'C2']]);
        $this->submit($this->form, [$grid->id => ['1. Hùng Vương' => 'Biết'], $multi->id => ['R' => ['C1', 'C2']]])->assertCreated();

        $this->assertSame(
            ['Câu 2 – 1. Hùng Vương', 'Câu 2 – 2. Điện Biên', 'Bảng chọn – R'],
            array_slice($this->table()->headings(), 4),
            'one column per row, no stray column while every answer uses current rows'
        );
        $row = $this->rows()[0];
        $this->assertSame('Biết', $row['Câu 2 – 1. Hùng Vương']);
        $this->assertSame('', $row['Câu 2 – 2. Điện Biên']);
        $this->assertSame('C1, C2', $row['Bảng chọn – R']);

        $grid->update(['rows' => ['1. Giỗ Tổ Hùng Vương', '2. Điện Biên']]);
        $row = $this->rows()[0];
        $this->assertSame('1. Hùng Vương: Biết', $row['Câu 2 – dòng khác'], 'answers on a renamed row are kept');
        $this->assertSame('', $row['Câu 2 – 1. Giỗ Tổ Hùng Vương']);
    }

    public function test_export_same_mode_one_variant_with_other_column_and_identity(): void
    {
        $this->form = $this->makeForm();
        $phone = $this->addField($this->form, 'phone', ['label' => 'Điện thoại']);
        $note = $this->addField($this->form, 'short_text', ['label' => 'Ghi chú']);
        $this->block([]);
        $q3 = $this->member('checkbox', 'Câu 3', ['options' => ['A', 'B'], 'settings' => ['other_option' => ['enabled' => true, 'label' => 'Khác (ghi rõ)']]]);
        $this->member('section', 'PHẦN III');
        $age = $this->member('number', 'Tuổi');
        $this->addField($this->form, 'short_text', ['label' => 'Cuối']);
        $this->form->update(['respondent_limit' => [
            'enabled' => true, 'methods' => ['phone'], 'field_keys' => ['phone' => $phone->key], 'match' => 'any', 'max_per_person' => 1, 'on_limit' => 'block',
        ]]);

        $this->submitAs(['v2'], [
            $phone->id => '0912 345 678',
            $note->id => '=1+1',
            "{$q3->id}@v2" => ['selected' => ['A', self::OTHER], 'other' => 'Điều khác'],
            "{$age->id}@v2" => '45',
        ]);

        $this->assertSame([
            'Mã câu trả lời', 'Thời gian gửi', 'Người dùng', 'Địa chỉ IP', 'Căn cứ nhận diện',
            'Điện thoại', 'Ghi chú', 'PHẦN II – phiên bản', 'Câu 3', 'Câu 3 – Khác (ghi rõ)', 'Tuổi', 'Cuối',
        ], $this->table()->headings());

        $row = $this->rows()[0];
        $this->assertSame('điện thoại', $row['Căn cứ nhận diện']);
        $this->assertSame('Sự kiện 2', $row['PHẦN II – phiên bản']);
        $this->assertSame('A, Khác (ghi rõ)', $row['Câu 3']);
        $this->assertSame('Điều khác', $row['Câu 3 – Khác (ghi rõ)']);
        $this->assertSame(45, $row['Tuổi']);

        $path = 'test-export.xlsx';
        Excel::store(new FormResponsesExport($this->form->fresh()), $path, 'local');
        $file = \Storage::disk('local')->path($path);
        Cell::setValueBinder(new DefaultValueBinder());
        $sheet = IOFactory::load($file)->getActiveSheet();
        @unlink($file);
        $this->assertSame('0912345678', $sheet->getCell('F2')->getValue(), 'phone keeps its leading zero');
        $this->assertSame(DataType::TYPE_STRING, $sheet->getCell('G2')->getDataType(), 'answers are never formulas');
        $this->assertSame('=1+1', $sheet->getCell('G2')->getValue());
        $this->assertSame(DataType::TYPE_NUMERIC, $sheet->getCell('K2')->getDataType());
    }

    public function test_export_rounds_and_different_mode(): void
    {
        $this->form = $this->makeForm();
        $this->block(['pick_count' => 2]);
        $q = $this->member('radio', 'Câu 5', ['options' => ['Có', 'Không']]);
        $this->submitAs(['v2', 'v1'], ["{$q->id}@v2" => 'Có', "{$q->id}@v1" => 'Không']);

        $this->assertSame(
            ['Lượt 1 – PHẦN II – phiên bản', 'Lượt 1 – Câu 5', 'Lượt 2 – PHẦN II – phiên bản', 'Lượt 2 – Câu 5'],
            array_slice($this->table()->headings(), 4)
        );
        $row = $this->rows()[0];
        $this->assertSame(['Sự kiện 2', 'Có', 'Sự kiện 1', 'Không'], array_values(array_slice($row, 4)));

        $this->form = $this->makeForm();
        $this->block(['mode' => 'different']);
        $own = $this->member('short_text', 'Riêng 1', ['variant_key' => 'v1']);
        $shared = $this->member('short_text', 'Chung');
        $this->submitAs(['v1'], ["{$own->id}@v1" => 'r', "{$shared->id}@v1" => 'c']);

        $this->assertSame(
            ['PHẦN II – phiên bản', 'Sự kiện 1 – Riêng 1', 'Sự kiện 1 – Chung', 'Sự kiện 2 – Chung'],
            array_slice($this->table()->headings(), 4)
        );
        $this->assertSame(['Sự kiện 1', 'r', 'c', ''], array_values(array_slice($this->rows()[0], 4)));
    }

    public function test_hash_only_value_is_hidden_in_detail_export_and_summary(): void
    {
        $this->form = $this->makeForm();
        $email = $this->addField($this->form, 'email', ['label' => 'Email', 'settings' => ['store_hash_only' => true]]);
        $this->form->update(['respondent_limit' => [
            'enabled' => true, 'methods' => ['email'], 'field_keys' => ['email' => $email->key], 'match' => 'any', 'max_per_person' => 1, 'on_limit' => 'block',
        ]]);
        $id = $this->submit($this->form, [$email->id => 'secret@x.vn'])->assertCreated()->json('response_id');
        $owner = $this->form->user;

        $detail = $this->actingAs($owner)->getJson("/api/forms/{$this->form->id}/responses/{$id}")->assertOk();
        $detail->assertJsonPath('identity_methods', ['email'])->assertJsonPath('answers.0.hidden', true)->assertJsonPath('answers.0.value', null);
        $this->assertStringNotContainsString('value_hash', $detail->getContent());
        $this->assertStringNotContainsString('secret@x.vn', $detail->getContent());

        $this->assertSame('(đã ẩn)', $this->rows()[0]['Email']);

        $summary = $this->actingAs($owner)->getJson("/api/forms/{$this->form->id}/responses/summary")->assertOk();
        $summary->assertJsonPath('fields.0.hidden', true)->assertJsonPath('fields.0.data', null)->assertJsonPath('fields.0.total_answers', 1);
    }

    public function test_summary_counts_other_and_filters_by_variant(): void
    {
        $this->form = $this->makeForm();
        $intro = $this->addField($this->form, 'short_text', ['label' => 'Tên']);
        $this->block([]);
        $q = $this->member('radio', 'Câu 5', ['options' => ['A', 'B'], 'settings' => ['other_option' => ['enabled' => true, 'label' => 'Khác']]]);

        $this->submitAs(['v1'], [$intro->id => 'An', "{$q->id}@v1" => 'A']);
        $this->submitAs(['v1'], ["{$q->id}@v1" => ['selected' => [self::OTHER], 'other' => 'ý riêng']]);
        $this->submitAs(['v2'], ["{$q->id}@v2" => 'B']);
        FormSession::create(['form_id' => $this->form->id, 'assignments' => [$this->block->key => ['v2']]]);

        $owner = $this->form->user;
        $all = $this->actingAs($owner)->getJson("/api/forms/{$this->form->id}/responses/summary")->assertOk()->json();

        $this->assertSame(3, $all['total_responses']);
        $variants = collect($all['groups'][0]['variants'])->keyBy('key');
        $this->assertSame([2, 2], [$variants['v1']['submitted'], $variants['v1']['assigned']]);
        $this->assertSame([1, 2], [$variants['v2']['submitted'], $variants['v2']['assigned']]);

        $field = collect($all['fields'])->firstWhere('field_id', $q->id);
        $this->assertSame($this->block->key, $field['group_key']);
        $this->assertSame(3, $field['base']);
        $counts = collect($field['data']['chart_data'])->pluck('value', 'label')->all();
        $this->assertEquals(['A' => 1, 'B' => 1, 'Khác' => 1], $counts);
        $this->assertSame(['ý riêng'], $field['data']['other_values']);
        $this->assertSame(1, collect($all['fields'])->firstWhere('field_id', $intro->id)['total_answers']);

        $v1 = $this->actingAs($owner)->getJson("/api/forms/{$this->form->id}/responses/summary?variants[{$this->block->key}]=v1")->json();
        $field = collect($v1['fields'])->firstWhere('field_id', $q->id);
        $this->assertSame('v1', $v1['groups'][0]['filter']);
        $this->assertSame([2, 2], [$field['total_answers'], $field['base']]);
        $this->assertArrayNotHasKey('B', collect($field['data']['chart_data'])->pluck('value', 'label')->all());
    }

    public function test_legacy_form_export_and_summary_still_work(): void
    {
        $this->form = $this->makeForm();
        $name = $this->addField($this->form, 'short_text', ['label' => 'Tên']);
        $food = $this->addField($this->form, 'checkbox', ['label' => 'Món', 'options' => ['Phở', 'Bún']]);
        $grid = $this->addField($this->form, 'checkbox_grid', ['label' => 'Bảng', 'rows' => ['R1'], 'columns' => ['C1', 'C2']]);
        $response = FormResponse::create(['form_id' => $this->form->id]);
        $response->answers()->createMany([
            ['field_id' => $name->id, 'value' => 'An'],
            ['field_id' => $food->id, 'value' => '["Phở","Bún"]'],
            ['field_id' => $grid->id, 'value' => ['R1' => ['C1', 'C2']]],
        ]);

        $this->assertSame(['Tên', 'Món', 'Bảng – R1'], array_slice($this->table()->headings(), 4));
        $this->assertSame(['An', 'Phở, Bún', 'C1, C2'], array_values(array_slice($this->rows()[0], 4)));

        $summary = $this->actingAs($this->form->user)->getJson("/api/forms/{$this->form->id}/responses/summary")->json();
        $foodStats = collect($summary['fields'])->firstWhere('field_id', $food->id);
        $this->assertEquals(['Phở' => 1, 'Bún' => 1], collect($foodStats['data']['chart_data'])->pluck('value', 'label')->all());
        $this->assertSame(2, collect($summary['fields'])->firstWhere('field_id', $grid->id)['data']['grid_data']['R1']['C1'] + 1);
        $this->assertSame([], $summary['groups']);
    }
}
