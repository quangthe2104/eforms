<?php

namespace App\Console\Commands;

use App\Models\Form;
use App\Models\FormField;
use App\Models\User;
use App\Services\Forms\FieldReferenceValidator;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Builds the online survey "BẢN CÂU HỎI KHẢO SÁT TRỰC TUYẾN_12.11.26" as a draft form.
 */
class ImportSurvey1211 extends Command
{
    protected $signature = 'survey:import-1211
        {--user= : Owner user id (default: first user)}
        {--title= : Override the form title}
        {--replace : Delete earlier imports of this survey that have no responses}
        {--json : Print {id, slug, keys} as JSON}';

    protected $description = 'Create the 12.11.26 history survey as a draft form';

    public const MARKER = 'survey-1211';

    private const EVENTS = [
        'Ngày thành lập Đảng Cộng sản Việt Nam (03/02/1930)',
        'Giỗ Tổ Hùng Vương (10/3 âm lịch)',
        'Ngày Giải phóng miền Nam, thống nhất đất nước (30/04/1975)',
        'Chiến thắng Điện Biên Phủ (07/05/1954)',
        'Ngày sinh Chủ tịch Hồ Chí Minh (19/05/1890)',
        'Cách mạng tháng Tám năm 1945',
        'Quốc khánh và Tuyên ngôn Độc lập (02/09/1945)',
        'Tổng tuyển cử đầu tiên bầu Quốc hội Việt Nam (06/01/1946)',
        'Hội nghị Văn hóa toàn quốc lần thứ nhất (24/11/1946), gắn với Ngày Văn hóa Việt Nam',
        'Ngày Toàn quốc kháng chiến (19/12/1946)',
    ];

    private const UNHEARD = 'Chưa từng nghe nói';

    /** @var array<string, string> short code => field key */
    private array $keys = [];

    public function handle(): int
    {
        $user = $this->option('user') ? User::find($this->option('user')) : User::orderBy('id')->first();
        if (!$user) {
            $this->error('Không tìm thấy người dùng làm chủ form.');
            return self::FAILURE;
        }

        $previous = Form::where('user_id', $user->id)->where('settings->imported_from', self::MARKER)->withCount('responses')->get();
        if ($this->option('replace')) {
            $used = $previous->where('responses_count', '>', 0);
            if ($used->isNotEmpty()) {
                $this->error('Không thay được: form đã import có câu trả lời (id ' . $used->pluck('id')->join(', ') . ').');
                return self::FAILURE;
            }
        }

        $fields = $this->fields();
        $errors = (new FieldReferenceValidator())->validate($fields);
        if ($errors) {
            foreach ($errors as $path => $messages) {
                $this->error("$path: " . implode(' ', $messages));
            }
            return self::FAILURE;
        }

        $form = DB::transaction(function () use ($user, $fields, $previous) {
            if ($this->option('replace')) {
                $previous->each->delete();
            }

            $form = Form::create([
                'user_id' => $user->id,
                'title' => $this->option('title') ?: 'Thăm dò dư luận xã hội về các sự kiện lịch sử và hoạt động kỷ niệm ở Việt Nam hiện nay',
                'description' => $this->formDescription(),
                'settings' => ['imported_from' => self::MARKER],
                'status' => 'draft',
                'is_public' => false,
                'accept_responses' => true,
                'show_progress_bar' => true,
                'respondent_limit' => [
                    'enabled' => true,
                    'methods' => ['email'],
                    'field_keys' => ['email' => $this->keys['email']],
                    'match' => 'any',
                    'max_per_person' => 1,
                    'on_limit' => 'block',
                    'message' => 'Ông/Bà đã tham gia khảo sát này. Xin cảm ơn!',
                ],
                'custom_thank_you_message' => 'Xin chân thành cảm ơn Ông/Bà đã tham gia khảo sát!',
            ]);

            foreach ($fields as $order => $field) {
                FormField::create($field + ['form_id' => $form->id, 'order' => $order]);
            }

            return $form;
        });

        if ($this->option('json')) {
            $this->line(json_encode(['id' => $form->id, 'slug' => $form->slug, 'keys' => $this->keys], JSON_UNESCAPED_UNICODE));
        } else {
            $this->info("Đã tạo form nháp #{$form->id} ({$form->slug}) với " . count($fields) . ' mục.');
            if ($this->option('replace') && $previous->isNotEmpty()) {
                $this->line('Đã xóa form import cũ: ' . $previous->pluck('id')->join(', '));
            }
        }

        return self::SUCCESS;
    }

    private function key(string $code): string
    {
        return $this->keys[$code] ??= (string) Str::uuid();
    }

    private function formDescription(): string
    {
        return implode('', [
            '<p><strong>Đối tượng khảo sát:</strong> Người dân Việt Nam từ đủ 18 tuổi trở lên.<br>',
            '<strong>Hình thức:</strong> Khảo sát trực tuyến.<br>',
            '<strong>Thời gian trả lời dự kiến:</strong> 10–15 phút.</p>',
            '<p>Kính thưa Ông/Bà!</p>',
            '<p>Khảo sát này được thực hiện nhằm tìm hiểu nhận thức, thái độ và hành vi của người dân đối với một số sự kiện lịch sử và hoạt động kỷ niệm ở Việt Nam hiện nay.</p>',
            '<p>Chúng tôi đặc biệt quan tâm đến việc người dân ghi nhớ những nội dung gì về các sự kiện lịch sử; những yếu tố nào hình thành và duy trì ký ức đó; và các hoạt động kỷ niệm có ý nghĩa như thế nào đối với cá nhân, gia đình và cộng đồng.</p>',
            '<p>Khảo sát phục vụ mục đích nghiên cứu khoa học. Không có câu trả lời đúng hoặc sai đối với cảm nhận và quan điểm cá nhân. Ông/Bà có thể lựa chọn phương án phù hợp nhất với suy nghĩ của mình hoặc bỏ qua câu hỏi không muốn trả lời.</p>',
            '<p>Việc tham gia hoàn toàn tự nguyện. Thông tin thu thập được xử lý theo nguyên tắc bảo mật và chỉ sử dụng cho mục đích nghiên cứu. Địa chỉ email Ông/Bà cung cấp chỉ dùng để tránh trả lời trùng lặp.</p>',
            '<p>Xin trân trọng cảm ơn sự hợp tác của Ông/Bà!</p>',
        ]);
    }

    /** @return array<int, array> fields in final order */
    private function fields(): array
    {
        $block = ['random_group_key' => $this->key('block')];
        $eventRows = $this->numbered(self::EVENTS);
        $variants = [];
        $rowMap = [];
        foreach (self::EVENTS as $i => $event) {
            $variantKey = 'v' . ($i + 1);
            $variants[] = [
                'key' => $variantKey,
                'title' => $event,
                'description' => 'Trong các câu hỏi tiếp theo, xin Ông/Bà chỉ tập trung vào sự kiện này. Nếu chưa biết hoặc chưa đủ thông tin, Ông/Bà có thể lựa chọn phương án tương ứng, không cần cố gắng đưa ra nhận định.',
            ];
            $rowMap[$variantKey] = $eventRows[$i];
        }

        $fields = [
            // Page 1 – Phần I
            $this->q('email', 'email', 'Email của Ông/Bà (chỉ dùng để tránh trả lời trùng)', [
                'is_required' => true,
                'placeholder' => 'Nhập email của bạn',
            ]),
            [
                'key' => $this->key('part1'),
                'type' => 'description',
                'label' => 'PHẦN I. NHẬN THỨC VÀ MỨC ĐỘ GHI NHỚ CÁC SỰ KIỆN LỊCH SỬ',
            ],
            [
                'key' => $this->key('q1_intro'),
                'type' => 'description',
                'label' => 'Câu 1. Khi nghĩ đến những sự kiện lịch sử hoặc ngày kỷ niệm lớn của Việt Nam, những sự kiện nào đầu tiên xuất hiện trong suy nghĩ của Ông/Bà?',
                'description' => '<p>Xin ghi tên tối đa 3 sự kiện mà Ông/Bà nhớ đến đầu tiên, không cần tra cứu tài liệu hoặc xem lại danh sách gợi ý.</p><p>Nếu không nhớ được sự kiện cụ thể, Ông/Bà có thể ghi: <em>Chưa nhớ được</em>.</p>',
            ],
            $this->q('q1_1', 'short_text', 'Câu 1 – Sự kiện 1', ['placeholder' => 'Tên sự kiện thứ nhất']),
            $this->q('q1_2', 'short_text', 'Câu 1 – Sự kiện 2', ['placeholder' => 'Tên sự kiện thứ hai']),
            $this->q('q1_3', 'short_text', 'Câu 1 – Sự kiện 3', ['placeholder' => 'Tên sự kiện thứ ba']),
            $this->q('q2', 'multiple_choice_grid', 'Câu 2. Ông/Bà đã từng nghe nói, tìm hiểu hoặc theo dõi những sự kiện/ngày kỷ niệm dưới đây ở mức độ nào?', [
                'help_text' => 'Xin đánh dấu một phương án cho mỗi sự kiện.',
                'rows' => $eventRows,
                'columns' => [self::UNHEARD, 'Đã nghe tên nhưng ít biết nội dung', 'Biết những nội dung cơ bản', 'Đã chủ động tìm hiểu, theo dõi'],
            ]),

            // Page 2 – Phần II (random block)
            [
                'key' => $this->key('block'),
                'type' => 'random_section',
                'label' => 'PHẦN II. GHI NHỚ, DIỄN GIẢI VÀ Ý NGHĨA CỦA SỰ KIỆN LỊCH SỬ',
                'description' => '<p>Hệ thống khảo sát sẽ lựa chọn ngẫu nhiên một sự kiện trong danh sách 10 sự kiện ở Câu 2 để Ông/Bà đánh giá sâu hơn.</p>',
                'settings' => [
                    'mode' => 'same',
                    'pick_count' => 1,
                    'variant_label' => 'Sự kiện được lựa chọn là',
                    'variants' => $variants,
                    'filter' => [
                        'field_key' => $this->key('q2'),
                        'row_map' => $rowMap,
                        'exclude_columns' => [self::UNHEARD],
                    ],
                ],
            ],
            $this->q('q3', 'checkbox', 'Câu 3. Ông/Bà ghi nhớ những nội dung gì về sự kiện này?', $block + [
                'help_text' => "Ngoài tên gọi hoặc ngày kỷ niệm, những nội dung nào sau đây Ông/Bà còn nhớ về sự kiện?\nCó thể chọn nhiều phương án.",
                'options' => $this->opts([
                    'Bối cảnh và những điều kiện dẫn đến sự kiện.',
                    'Nguyên nhân và mục đích của sự kiện.',
                    'Những diễn biến chính của sự kiện.',
                    'Thời gian, địa điểm và các dấu mốc quan trọng.',
                    'Vai trò của những nhân vật, tổ chức hoặc lực lượng liên quan.',
                    'Kết quả và những tác động của sự kiện.',
                    'Những câu chuyện về con người, sự hy sinh, mất mát hoặc trải nghiệm cá nhân.',
                    'Những hình ảnh, biểu tượng, địa danh hoặc tư liệu gắn với sự kiện.',
                    'Những giá trị, bài học lịch sử được nhắc đến trong các hoạt động kỷ niệm.',
                    'Tôi chủ yếu nhớ tên gọi hoặc ngày kỷ niệm, không nhớ nhiều nội dung cụ thể.',
                    'Tôi không nhớ hoặc chưa có đủ thông tin về sự kiện này.',
                ]),
                'settings' => [
                    'other_option' => ['enabled' => true, 'label' => 'Nội dung khác (xin ghi rõ)'],
                    'exclusive_options' => $this->opts([
                        'Tôi chủ yếu nhớ tên gọi hoặc ngày kỷ niệm, không nhớ nhiều nội dung cụ thể.',
                        'Tôi không nhớ hoặc chưa có đủ thông tin về sự kiện này.',
                    ]),
                ],
            ]),
            $this->q('q3_note', 'long_text', 'Nếu được, xin Ông/Bà viết ngắn gọn một điều cụ thể nhất mà Ông/Bà nhớ về sự kiện này', $block),
            $this->q('q4', 'checkbox', 'Câu 4. Ông/Bà biết đến và ghi nhớ sự kiện này chủ yếu thông qua những nguồn hoặc trải nghiệm nào?', $block + [
                'help_text' => 'Xin chọn những phương án quan trọng nhất.',
                'options' => $this->opts([
                    'Học tập tại nhà trường, sách giáo khoa và tài liệu giáo dục.',
                    'Báo chí, truyền hình, phát thanh và các phương tiện truyền thông chính thống.',
                    'Mạng xã hội và các nền tảng thông tin trực tuyến.',
                    'Sách lịch sử, công trình nghiên cứu và tài liệu chuyên khảo.',
                    'Gia đình, cha mẹ, ông bà và người thân kể lại.',
                    'Trải nghiệm trực tiếp của bản thân hoặc những người thân có liên quan đến sự kiện.',
                    'Các hoạt động kỷ niệm, tưởng niệm tại địa phương, cơ quan hoặc cộng đồng.',
                    'Tham quan bảo tàng, di tích và địa điểm lịch sử.',
                    'Phim ảnh, phim tài liệu, chương trình nghệ thuật và các sản phẩm văn hóa.',
                    'Hoạt động học tập, tìm hiểu lịch sử ngoài nhà trường.',
                    'Không nhớ rõ nguồn hình thành nhận thức của mình.',
                ]),
                'settings' => [
                    'max_select' => 3,
                    'other_option' => ['enabled' => true, 'label' => 'Nguồn hoặc trải nghiệm khác (xin ghi rõ)'],
                    'exclusive_options' => $this->opts(['Không nhớ rõ nguồn hình thành nhận thức của mình.']),
                ],
            ]),
            $this->q('q5', 'radio', 'Câu 5. Ông/Bà cảm thấy sự kiện lịch sử này có mối liên hệ với bản thân, gia đình hoặc cộng đồng của mình ở mức độ nào?', $block + [
                'options' => $q5 = $this->opts([
                    'Rất gần gũi, có mối liên hệ trực tiếp.',
                    'Khá gần gũi, có liên hệ thông qua gia đình hoặc cộng đồng.',
                    'Có liên hệ với bản sắc, truyền thống hoặc lịch sử chung của dân tộc.',
                    'Có ý nghĩa chung đối với lịch sử đất nước nhưng không có mối liên hệ cá nhân rõ rệt.',
                    'Ít cảm nhận được mối liên hệ với bản thân hoặc cộng đồng của mình.',
                    'Chưa xác định được/không có ý kiến.',
                ]),
            ]),
            $this->q('q5a', 'checkbox', '5a. Nếu có mối liên hệ, mối liên hệ đó chủ yếu xuất phát từ đâu?', $block + [
                'help_text' => 'Có thể chọn nhiều phương án.',
                'options' => $this->opts([
                    'Bản thân hoặc người thân từng trực tiếp trải qua sự kiện.',
                    'Gia đình có câu chuyện, ký ức hoặc kỷ vật liên quan.',
                    'Sự kiện gắn với lịch sử địa phương nơi tôi sinh sống hoặc quê quán.',
                    'Sự kiện có ý nghĩa đối với nhóm xã hội hoặc cộng đồng mà tôi thuộc về.',
                    'Sự kiện gắn với bản sắc và lịch sử dân tộc.',
                    'Những giá trị hoặc bài học của sự kiện có ý nghĩa đối với cuộc sống hiện nay.',
                    'Không có mối liên hệ cụ thể.',
                ]),
                'settings' => [
                    'other_option' => ['enabled' => true, 'label' => 'Khác'],
                    'exclusive_options' => ['Không có mối liên hệ cụ thể'],
                ],
                'conditional_logic' => $this->showWhen('q5', array_slice($q5, 0, 4)),
            ]),
            $this->q('q6', 'checkbox', 'Câu 6. Theo Ông/Bà, những lý do nào quan trọng nhất khiến sự kiện lịch sử này cần được xã hội ghi nhớ?', $block + [
                'options' => $this->opts([
                    'Để hiểu biết về lịch sử hình thành và phát triển của đất nước.',
                    'Để ghi nhận công lao, sự hy sinh và đóng góp của các thế hệ đi trước.',
                    'Để tưởng nhớ những người đã chịu đau khổ, mất mát hoặc hy sinh trong sự kiện.',
                    'Để rút ra bài học lịch sử cho hiện tại và tránh lặp lại những sai lầm trong quá khứ.',
                    'Để duy trì truyền thống, bản sắc và sự gắn kết của cộng đồng dân tộc.',
                    'Để hiểu rõ những biến đổi chính trị, kinh tế, văn hóa và xã hội do sự kiện tạo ra.',
                    'Để truyền lại kiến thức, câu chuyện và ký ức lịch sử cho các thế hệ sau.',
                    'Vì sự kiện gắn với lịch sử gia đình, địa phương hoặc trải nghiệm cá nhân.',
                    'Vì đây là một dấu mốc lịch sử được xã hội và Nhà nước chính thức ghi nhận, tổ chức kỷ niệm.',
                    'Tôi chưa thấy có lý do đặc biệt/không có ý kiến.',
                ]),
                'settings' => [
                    'max_select' => 3,
                    'other_option' => ['enabled' => true, 'label' => 'Lý do khác (xin ghi rõ)'],
                    'exclusive_options' => ['Tôi chưa thấy có lý do đặc biệt/không có ý kiến'],
                ],
            ]),
            $this->q('q6a', 'radio', '6a. Trong những lý do trên, đâu là lý do quan trọng nhất đối với cá nhân Ông/Bà?', $block + [
                'help_text' => 'Xin lựa chọn một phương án.',
                'settings' => ['piped_from' => $this->key('q6')],
            ]),
            $this->q('q7', 'checkbox', 'Câu 7. Theo Ông/Bà, việc tổ chức kỷ niệm sự kiện lịch sử này có ý nghĩa như thế nào đối với cá nhân và xã hội hiện nay?', $block + [
                'options' => $this->opts([
                    'Giúp xã hội không quên những sự kiện quan trọng trong quá khứ.',
                    'Thể hiện lòng biết ơn và sự tri ân đối với những người đã hy sinh, đóng góp.',
                    'Giúp người dân, đặc biệt là thế hệ trẻ, hiểu rõ hơn về lịch sử.',
                    'Tạo cơ hội để nhìn lại, suy ngẫm và rút ra những bài học cho hiện tại, tương lai.',
                    'Duy trì truyền thống, bản sắc dân tộc và sự gắn kết cộng đồng.',
                    'Ghi nhận những trải nghiệm, đóng góp và mất mát của các cá nhân, gia đình và cộng đồng liên quan.',
                    'Tạo cơ hội để người dân tìm hiểu, trao đổi và chia sẻ những câu chuyện lịch sử.',
                    'Giúp liên hệ lịch sử với đời sống và những vấn đề xã hội hiện nay.',
                    'Đây là một hoạt động văn hóa, nghi lễ hoặc truyền thống được duy trì hằng năm.',
                    'Tôi chưa cảm nhận được ý nghĩa cụ thể của hoạt động kỷ niệm này.',
                ]),
                'settings' => [
                    'max_select' => 3,
                    'other_option' => ['enabled' => true, 'label' => 'Ý nghĩa khác (xin ghi rõ)'],
                    'exclusive_options' => ['Tôi chưa cảm nhận được ý nghĩa cụ thể của hoạt động kỷ niệm này'],
                ],
            ]),
            $this->q('q7a', 'radio', '7a. Ông/Bà đánh giá mức độ ý nghĩa của hoạt động kỷ niệm này đối với bản thân như thế nào?', $block + [
                'options' => $this->opts([
                    'Rất có ý nghĩa.',
                    'Khá có ý nghĩa.',
                    'Có ý nghĩa ở một mức độ nhất định.',
                    'Ít có ý nghĩa đối với bản thân.',
                    'Không có ý nghĩa rõ rệt.',
                    'Chưa đủ trải nghiệm để đánh giá.',
                ]),
            ]),
            $this->q('q8', 'checkbox', 'Câu 8. Khi tiếp xúc với thông tin hoặc tham gia các hoạt động kỷ niệm về sự kiện này, Ông/Bà thường có những cảm xúc nào?', $block + [
                'options' => $this->opts([
                    'Tự hào.',
                    'Biết ơn.',
                    'Xúc động, thương cảm hoặc tưởng nhớ.',
                    'Quan tâm và muốn tìm hiểu sâu hơn.',
                    'Cảm thấy gần gũi và gắn bó hơn với lịch sử gia đình, cộng đồng hoặc dân tộc.',
                    'Suy ngẫm về những vấn đề của xã hội hiện nay.',
                    'Cảm thấy bình thường, không có cảm xúc đặc biệt.',
                    'Chưa từng tiếp xúc nên không thể đánh giá.',
                ]),
                'settings' => [
                    'max_select' => 3,
                    'other_option' => ['enabled' => true, 'label' => 'Cảm xúc khác'],
                    'exclusive_options' => ['Cảm thấy bình thường, không có cảm xúc đặc biệt', 'Chưa từng tiếp xúc nên không thể đánh giá'],
                ],
            ]),
            $this->q('q8a', 'radio', '8a. Việc tiếp xúc với các hoạt động kỷ niệm có ảnh hưởng như thế nào đến cách Ông/Bà hiểu và ghi nhớ sự kiện?', $block + [
                'help_text' => 'Chọn phương án phù hợp nhất.',
                'options' => $this->opts([
                    'Giúp tôi biết thêm những nội dung trước đây chưa biết.',
                    'Giúp tôi hiểu sâu hơn hoặc nhìn nhận sự kiện từ góc độ khác.',
                    'Củng cố những hiểu biết và ký ức tôi đã có.',
                    'Làm tăng sự gắn bó về cảm xúc với sự kiện, gia đình hoặc cộng đồng.',
                    'Thúc đẩy tôi chủ động tìm hiểu thêm các nguồn thông tin khác.',
                    'Không tạo ra thay đổi đáng kể trong nhận thức và ký ức của tôi.',
                    'Chưa từng tiếp xúc với hoạt động kỷ niệm nên không thể đánh giá.',
                ]),
                'settings' => ['other_option' => ['enabled' => true, 'label' => 'Khác']],
            ]),

            // Page 3 – Phần III (second page of the random block)
            [
                'key' => $this->key('part3'),
                'type' => 'section',
                'label' => 'PHẦN III. TIẾP NHẬN VÀ THAM GIA HOẠT ĐỘNG KỶ NIỆM',
            ] + $block,
            $this->q('q9', 'checkbox', 'Câu 9. Theo Ông/Bà, những hình thức hoặc nội dung nào dưới đây giúp người dân hiểu, cảm nhận và ghi nhớ sự kiện lịch sử sâu sắc hơn?', $block + [
                'options' => $this->opts([
                    'Lễ kỷ niệm, nghi lễ tưởng niệm và các hoạt động chính thức.',
                    'Triển lãm tư liệu, hình ảnh, hiện vật tại bảo tàng và di tích.',
                    'Phim tài liệu, chương trình truyền hình và các sản phẩm nghệ thuật.',
                    'Những câu chuyện, hồi ký và lời kể của nhân chứng lịch sử.',
                    'Câu chuyện và ký ức của gia đình, cộng đồng địa phương.',
                    'Các hoạt động trải nghiệm, tham quan và học tập tại di tích lịch sử.',
                    'Các chương trình giáo dục và hoạt động tìm hiểu lịch sử dành cho thanh thiếu niên.',
                    'Video, podcast, nội dung tương tác và các sản phẩm lịch sử trên nền tảng số.',
                    'Tọa đàm, hội thảo và trao đổi với các nhà nghiên cứu, chuyên gia lịch sử.',
                    'Các hoạt động cộng đồng gắn với việc tri ân, tưởng nhớ và phát huy giá trị lịch sử.',
                ]),
                'settings' => [
                    'max_select' => 3,
                    'other_option' => ['enabled' => true, 'label' => 'Hình thức khác (xin ghi rõ)'],
                ],
            ]),
            $this->q('q10', 'checkbox', 'Câu 10. Trong 12 tháng gần đây, hoặc trong dịp kỷ niệm gần nhất của sự kiện này mà Ông/Bà biết đến, Ông/Bà đã thực hiện những hoạt động nào sau đây?', $block + [
                'help_text' => 'Có thể chọn nhiều phương án.',
                'options' => $this->opts([
                    'Trực tiếp tham dự lễ kỷ niệm hoặc hoạt động tưởng niệm.',
                    'Theo dõi lễ kỷ niệm qua truyền hình hoặc chương trình phát trực tuyến.',
                    'Đọc báo, xem tin hoặc theo dõi nội dung truyền thông về sự kiện.',
                    'Chủ động tìm kiếm, đọc sách hoặc nghiên cứu thêm về sự kiện.',
                    'Tham quan bảo tàng, di tích hoặc địa điểm lịch sử liên quan.',
                    'Tham gia hoạt động kỷ niệm tại trường học, cơ quan hoặc địa phương.',
                    'Trao đổi, kể lại hoặc thảo luận về sự kiện với người thân, bạn bè.',
                    'Bình luận, chia sẻ hoặc đăng tải thông tin về sự kiện trên mạng xã hội.',
                    'Lưu giữ hoặc giới thiệu hình ảnh, kỷ vật, câu chuyện liên quan đến sự kiện.',
                    'Có hoạt động tưởng nhớ hoặc thực hành kỷ niệm riêng trong gia đình.',
                    'Chưa thực hiện hoạt động nào trong số trên.',
                    'Không nhớ rõ.',
                ]),
                'settings' => ['exclusive_options' => $q10none = ['Chưa thực hiện hoạt động nào trong số trên', 'Không nhớ rõ']],
            ]),
            $this->q('q10a', 'checkbox', '10a. Nếu chưa tham gia hoặc ít tham gia, lý do chủ yếu là gì?', $block + [
                'options' => $this->opts([
                    'Không có đủ thông tin về hoạt động kỷ niệm.',
                    'Không có thời gian hoặc điều kiện tham gia.',
                    'Địa điểm tổ chức không thuận tiện.',
                    'Hình thức tổ chức chưa phù hợp hoặc chưa thu hút sự quan tâm.',
                    'Tôi quan tâm đến sự kiện nhưng không có nhu cầu tham gia hoạt động kỷ niệm.',
                    'Tôi chủ yếu tiếp nhận thông tin qua các phương tiện truyền thông.',
                    'Tôi chưa cảm thấy có mối liên hệ cá nhân với sự kiện.',
                    'Không có lý do cụ thể.',
                ]),
                'settings' => [
                    'max_select' => 2,
                    'other_option' => ['enabled' => true, 'label' => 'Lý do khác'],
                    'exclusive_options' => ['Không có lý do cụ thể'],
                ],
                'conditional_logic' => $this->showWhen('q10', $q10none),
            ]),

            // Page 4 – Phần IV
            [
                'key' => $this->key('part4'),
                'type' => 'section',
                'label' => 'PHẦN IV. THÔNG TIN VỀ NGƯỜI TRẢ LỜI',
            ],
            $this->q('a1', 'radio', 'A1. Giới tính', ['options' => ['Nam', 'Nữ']]),
            $this->q('a2', 'number', 'A2. Tuổi của Ông/Bà', [
                'help_text' => 'Xin ghi số tuổi (từ 18 đến 99).',
                'settings' => ['number' => ['digits' => 2, 'min' => 18, 'max' => 99]],
            ]),
            $this->q('a3', 'radio', 'A3. Nơi ở hiện nay', ['options' => ['Đô thị', 'Nông thôn']]),
            $this->q('a3a', 'radio', 'A3a. Khu vực sống', ['options' => ['Miền Bắc', 'Miền Trung', 'Miền Nam']]),
            $this->q('a4', 'radio', 'A4. Nghề nghiệp/công việc chính hiện nay', [
                'options' => [
                    'Cán bộ, công chức, viên chức',
                    'Lao động tự do, buôn bán, kinh doanh',
                    'Lái xe, giao hàng, vận tải',
                    'Công nhân, nhân viên doanh nghiệp',
                    'Học sinh, sinh viên',
                    'Nghỉ hưu, nội trợ',
                ],
                'settings' => ['other_option' => ['enabled' => true, 'label' => 'Khác (ghi rõ)']],
            ]),
            $this->q('a5', 'multiple_choice_grid', 'A5. Ông/Bà đã từng nghe nói tới những vấn đề nào trong thời gian gần đây?', [
                'is_required' => true,
                'help_text' => 'Xin trả lời đủ tất cả các dòng.',
                'rows' => $this->numbered([
                    'Trùng tên đường phố đặc biệt sau sắp xếp ĐVHC',
                    'Sai hoặc chưa chính xác tên đường phố',
                    'Mất tên đường phố, địa danh truyền thống',
                    'Chọn nhân vật chưa phù hợp để đặt tên đường',
                    'Chọn nhân vật chưa phù hợp để tôn vinh trên phố, mạng',
                    'Tranh cãi về tiêu chí tôn vinh nhân vật lịch sử',
                    'Tranh cãi về tên, tiểu sử, công lao của nhân vật lịch sử',
                    'Tranh cãi về tiêu chí xác định quy mô tầm vóc sự kiện lịch sử',
                    'Sự khác nhau trong cách nhìn nhận các sự kiện lịch sử giữa các thế hệ',
                    'Những ý kiến khác nhau khi đánh giá cùng một sự kiện lịch sử',
                    'Việc lựa chọn những sự kiện lịch sử để tổ chức kỷ niệm ở quy mô quốc gia',
                    'Tranh cãi về việc thương mại hóa tại các khu di tích',
                    'Tranh cãi về tên, nguồn gốc, giá trị của một số di tích',
                    'Tranh cãi về quy trình tôn tạo và phát huy giá trị di tích',
                    'Tình trạng lấn chiếm, vi phạm vùng bảo vệ của các di tích',
                    'Khai thác kinh tế quá mức tại các di tích',
                    'Tranh cãi về việc đặt tên cho các công trình công cộng lớn',
                ]),
                'columns' => ['Nghe nhiều', 'Vài lần', 'Chưa'],
                'settings' => ['require_all_rows' => true],
            ]),
            $this->q('a6', 'checkbox', 'A6. Ông/Bà biết đến những vấn đề trên qua nguồn nào?', [
                'help_text' => 'Có thể chọn nhiều phương án.',
                'options' => [
                    'Truyền hình, phát thanh, báo chí',
                    'Mạng xã hội (Facebook, TikTok, YouTube...)',
                    'Các trang tin của cơ quan nhà nước',
                    'Gia đình, bạn bè, đồng nghiệp',
                    'Người dân địa phương, trao đổi trong cộng đồng',
                    'Trải nghiệm hoặc chứng kiến trực tiếp',
                ],
                'settings' => ['other_option' => ['enabled' => true, 'label' => 'Nguồn khác (ghi rõ)']],
            ]),
            $this->q('a7', 'checkbox', 'A7. Ba vấn đề mà Ông/Bà đang quan tâm nhất hiện nay', [
                'options' => [
                    'Tên đường phố bị trùng, sai',
                    'Mất tên đường phố, địa danh truyền thống',
                    'Lựa chọn nhân vật lịch sử đặt tên đường phố',
                    'Tiêu chí tôn vinh các nhân vật lịch sử',
                    'Tiêu chí xác định quy mô tầm vóc sự kiện lịch sử',
                    'Phát huy giá trị của các khu di tích',
                    'Việc đặt tên cho các công trình công cộng lớn',
                ],
                'settings' => [
                    'min_select' => 3,
                    'max_select' => 3,
                    'other_option' => ['enabled' => true, 'label' => 'Khác (ghi rõ)'],
                ],
            ]),
            $this->q('a8', 'radio', 'A8. Ông/Bà có thường xuyên tiếp xúc với các hoạt động giáo dục, nghiên cứu hoặc truyền thông về lịch sử không?', [
                'options' => ['Rất thường xuyên', 'Khá thường xuyên', 'Thỉnh thoảng', 'Hiếm khi', 'Chưa bao giờ'],
            ]),
        ];

        return array_map(fn ($f) => $f + ['is_required' => false], $fields);
    }

    private function q(string $code, string $type, string $label, array $extra = []): array
    {
        return ['key' => $this->key($code), 'type' => $type, 'label' => $label] + $extra;
    }

    /** Options are shown without the trailing full stop used in the printed questionnaire. */
    private function opts(array $options): array
    {
        return array_map(fn ($o) => preg_replace('/\.$/u', '', $o), $options);
    }

    private function numbered(array $rows): array
    {
        return array_map(fn ($row, $i) => ($i + 1) . '. ' . $row, $rows, array_keys($rows));
    }

    private function showWhen(string $code, array $values): array
    {
        return [
            'match' => 'any',
            'rules' => [['field_key' => $this->key($code), 'operator' => 'includes_any', 'values' => array_values($values)]],
        ];
    }
}
