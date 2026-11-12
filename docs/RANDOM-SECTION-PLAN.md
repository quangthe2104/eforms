# Kế hoạch: Phần ngẫu nhiên + các kiểu câu hỏi mới + giới hạn mỗi người trả lời

Nguồn bảng hỏi: `docs/BẢN CÂU HỎI KHẢO SÁT TRỰC TUYẾN_12.11.26.docx`
File này là nguồn duy nhất về phạm vi, quyết định và tiến độ. Chat mới đọc file này để làm tiếp.

---

## 1. Trạng thái

| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| 0 | Thảo luận, chốt thiết kế | Đã chốt (12/11/2026) |
| 1 | Backend: schema, giao phiên bản, lưu & kiểm tra câu trả lời, nhận diện & chặn trùng người trả lời | **Xong (12/11/2026)**: 30 test PHPUnit đều qua. Xem mục 10 |
| 2 | Builder: khối Phần ngẫu nhiên + tùy chọn câu hỏi mới + loại câu "Điện thoại" + cài đặt giới hạn mỗi người | **Xong (12/11/2026)**: 32 kiểm tra logic + 23 kiểm tra E2E đều qua. Xem mục 11 |
| 3 | Form công khai: bốc phiên bản, điều kiện, giới hạn chọn, "Khác", loại trừ, đáp án lấy từ câu trước, chặn/sửa khi trùng | **Xong (12/11/2026)**: 50 kiểm tra logic + 45 kiểm tra E2E đều qua. Xem mục 12 |
| 4 | Xem trước, chi tiết câu trả lời, thống kê, xuất Excel, nhân bản form | **Xong (12/11/2026)**: 35 test PHPUnit + 37 kiểm tra E2E đều qua. Xem mục 13 |
| 5 | Dựng form khảo sát từ bản 12.11.26 + kiểm thử toàn bộ | **Xong (12/11/2026)**: form nháp #74; DB local chuyển InnoDB; Excel tách mỗi dòng bảng một cột; 39 test PHPUnit, 55 kiểm tra logic, E2E 23 + 45 + 37 + 61 kiểm tra, mô phỏng 1000 lượt bốc đều qua. Xem mục 14 |

## 2. Môi trường local

- Frontend: `http://eforms.test:5173` (`npm run dev` trong `frontend`)
- Backend: `http://eforms.test` qua Apache WAMP, PHP 8.3: `D:\wamp64\bin\php\php8.3.14\php.exe artisan ...`
- Database: MySQL `eforms_db` (root, không mật khẩu)

## 3. Hiện trạng code (trước khi làm)

- Form là danh sách câu hỏi phẳng, sắp theo `order`. Câu loại `section` là ngắt trang, mang tiêu đề/mô tả trang (`PublicForm.jsx` → `splitFieldsIntoPages`).
- Builder lưu bằng `POST /forms/{form}/fields/bulk-update`: câu có `id` thì cập nhật, câu không có `id` thì tạo mới, câu không còn trong danh sách thì **xóa**.
- Câu trả lời: `response_answers (response_id, field_id, value json, file_path)`. `form_responses` không lưu nội dung nào đã hiển thị.
- `form_fields.conditional_logic` (json) có sẵn nhưng giao diện không dùng.
- Chưa có: chọn tối thiểu/tối đa, "Khác (ghi rõ)", phương án loại trừ, bắt buộc mọi dòng của bảng, kiểm tra số trong khoảng.
- Kiểm tra "bắt buộc" hiện chỉ là `!answers[field.id]`, nên câu dạng bảng chỉ cần 1 dòng là qua.
- Giới hạn hiện có: `limit_responses` + `max_responses` giới hạn **tổng số** câu trả lời của form; `require_login` chỉ buộc đăng nhập. Chưa có giới hạn theo từng người. `form_responses` có lưu `ip_address`, `user_id`.
- Loại câu `email` đã có; chưa có loại câu điện thoại.

---

## 4. Quyết định đã chốt

### 4.1 Phần ngẫu nhiên

| Chủ đề | Quyết định |
|---|---|
| Tạo | Nút mới trong builder: **Thêm phần ngẫu nhiên** |
| Nội dung khối | Tiêu đề + mô tả chung của khối (ví dụ "PHẦN II…" và đoạn giới thiệu), cộng danh sách **phiên bản** (mỗi phiên bản có tiêu đề + mô tả tùy chọn) |
| Chế độ | **Câu hỏi giống nhau**: một bộ câu hỏi dùng chung. **Câu hỏi khác nhau**: mỗi phiên bản một bộ riêng |
| Nhiều trang | Khối được chứa ngắt trang bên trong; mỗi trang của khối nhắc lại tên phiên bản đang trả lời |
| Số phiên bản/người | Cấu hình được K (mặc định 1). K > 1: các phiên bản hiển thị nối tiếp, mỗi phiên bản đi hết các trang của khối |
| Cách bốc | Ngẫu nhiên thuần |
| Lọc theo câu trước | Tùy chọn. Chọn một câu dạng bảng (Câu 2), ghép mỗi phiên bản với một dòng (mặc định ghép theo thứ tự, sửa được), chọn các cột bị loại ("Chưa từng nghe nói") |
| Không còn phiên bản hợp lệ | Bốc trong toàn bộ phiên bản |
| Hợp lệ ít hơn K | Lấy hết số hợp lệ, bốc thêm từ phần còn lại cho đủ K |
| Thời điểm bốc | Server bốc khi người trả lời bấm "Tiếp" rời trang chứa câu lọc. Không có câu lọc thì bốc khi tới trang đầu tiên của khối |
| Tải lại / mở lại trước khi gửi | Giữ nguyên phiên bản đã giao |
| Quay lại sửa câu lọc sau khi đã bốc | Giữ nguyên phiên bản |
| Biến chèn tên phiên bản vào câu hỏi | Không làm |
| Xem trước | Người tạo form chọn phiên bản bằng danh sách thả xuống |

### 4.2 Kiểu câu hỏi / tùy chọn mới (cấu hình theo từng câu trong builder)

| Tùy chọn | Áp dụng cho | Hành vi |
|---|---|---|
| Chọn tối thiểu / tối đa N | Hộp kiểm (checkbox) | Chặn tích quá N; báo lỗi khi chưa đủ tối thiểu |
| "Khác (ghi rõ)" | Trắc nghiệm, hộp kiểm, danh sách thả xuống | Thêm phương án "Khác" (sửa được nhãn) kèm ô nhập chữ; ô chữ bắt buộc khi đã chọn "Khác" |
| Phương án loại trừ | Hộp kiểm | Đánh dấu từng phương án; chọn nó thì bỏ các phương án khác, chọn phương án khác thì bỏ nó |
| Hiển thị theo điều kiện | Mọi câu, kể cả ngắt trang | "Hiện câu này khi câu X chọn một trong / không chọn các phương án …". Câu bị ẩn không bắt buộc và câu trả lời không được lưu |
| Đáp án lấy từ câu trước | Trắc nghiệm | Phương án = các lựa chọn người trả lời đã tích ở câu nguồn. Chỉ 1 lựa chọn: ẩn câu và tự ghi lựa chọn đó. Chọn phương án loại trừ hoặc không chọn gì: ẩn, để trống |
| Bắt buộc mọi dòng | Bảng trắc nghiệm / bảng hộp kiểm | Câu đã bật bắt buộc thì phải trả lời đủ mọi dòng |
| Số trong khoảng | Câu số | Cấu hình số chữ số, giá trị nhỏ nhất/lớn nhất |
| Bắt buộc | Mọi câu | Mặc định không bắt buộc, bật theo từng câu (như hiện tại) |

Mọi quy tắc trên được kiểm tra ở **cả trình duyệt lẫn server**.

### 4.3 Giới hạn mỗi người trả lời (cài đặt trong builder, mục Cài đặt)

| Chủ đề | Quyết định |
|---|---|
| Bật/tắt | Công tắc "Giới hạn mỗi người trả lời", độc lập với giới hạn tổng số câu trả lời đang có |
| Căn cứ nhận diện (chọn nhiều) | **Mã thiết bị ẩn danh**, **Email**, **Số điện thoại**, **Tài khoản đăng nhập** |
| Không làm | CCCD/Hộ chiếu, địa chỉ IP, vân tay trình duyệt, mã mời |
| Mã thiết bị | Mã ngẫu nhiên do server cấp, lưu trong trình duyệt (localStorage + cookie lâu dài). Không đọc được MAC. Người cố tình có thể lách bằng tab ẩn danh, trình duyệt khác hoặc xóa dữ liệu |
| Tài khoản | Chọn căn cứ này thì tự bật "Bắt buộc đăng nhập" |
| Email / Điện thoại | Lấy từ một câu trong form. Email dùng loại câu `email` có sẵn; thêm loại câu mới **Điện thoại**. Trong cài đặt chọn câu nào làm căn cứ. Câu căn cứ mặc định bắt buộc, có thể tắt; nếu người trả lời để trống thì bỏ qua căn cứ đó và chỉ xét các căn cứ còn lại |
| Kết hợp nhiều căn cứ | Builder cho chọn: **trùng bất kỳ** căn cứ nào thì chặn, hoặc chỉ chặn khi **trùng tất cả** |
| Số lần mỗi người | Cấu hình N (mặc định 1) |
| Khi đã đủ N lần | Builder cho chọn: **Chặn** và hiện thông báo (sửa được nội dung), hoặc **Cho sửa** câu trả lời gần nhất |
| Xác minh OTP | Không làm. Chỉ kiểm tra định dạng và trùng lặp |
| Lưu giá trị Email/Điện thoại | Cấu hình theo từng câu: **lưu bình thường**, hoặc **chỉ lưu mã băm** (ẩn khỏi Excel và trang xem câu trả lời, chỉ dùng để chặn trùng) |
| Thời điểm kiểm tra | Khi mở form (theo thiết bị/tài khoản); khi bấm "Tiếp" rời trang chứa câu Email/Điện thoại; kiểm tra lần cuối khi gửi |

Chuẩn hóa trước khi so trùng:
- Email: bỏ khoảng trắng, chuyển chữ thường.
- Điện thoại: bỏ khoảng trắng, dấu chấm, gạch ngang; `+84` / `84` chuyển thành `0`. Kiểm tra số di động Việt Nam 10 chữ số.

---

## 5. Thiết kế kỹ thuật

### 5.1 Database (migration mới, không xóa dữ liệu cũ)

**`form_fields`** thêm:
- `key` (chuỗi uuid, duy nhất trong form): mã cố định để các câu tham chiếu nhau (điều kiện, đáp án lấy từ câu trước, câu lọc). Builder tự sinh khi tạo câu nên tham chiếu được cả trước lần lưu đầu. Câu cũ được sinh `key` trong migration.
- `settings` (json): các tùy chọn ở mục 4.2. Ví dụ: `min_select`, `max_select`, `other_option {enabled, label}`, `exclusive_options [..]`, `require_all_rows`, `number {digits, min, max}`, `piped_from` (key câu nguồn).
- `random_group_key` (nullable): key của khối ngẫu nhiên chứa câu này.
- `variant_key` (nullable): chỉ dùng ở chế độ "khác nhau", câu thuộc phiên bản nào.
- `conditional_logic` (đã có) dùng định dạng:
  `{ "match": "any|all", "rules": [{ "field_key": "...", "operator": "includes_any|not_includes_any|answered|not_answered", "values": ["..."] }] }`

**Loại câu mới `random_section`** (là "đầu khối", đứng ngay trước các câu thành viên), cấu hình trong `settings`:
```json
{
  "mode": "same | different",
  "pick_count": 1,
  "variants": [{ "key": "v1", "title": "Ngày thành lập Đảng…", "description": "" }],
  "filter": { "field_key": "<key Câu 2>", "row_map": { "v1": "1. Ngày thành lập…" }, "exclude_columns": ["Chưa từng nghe nói"] }
}
```
Các câu thành viên (kể cả ngắt trang bên trong khối) có `random_group_key` = key của khối và đứng liền nhau sau đầu khối.

**Bảng mới `form_sessions`**: lưu phiên bản đã giao trước khi gửi.
- `token` (uuid), `form_id`, `assignments` (json: `{ group_key: [variant_key, ...] }`), `response_id` (nullable, điền khi đã gửi), timestamps.
- Trình duyệt giữ `token` trong localStorage theo slug, nhờ đó tải lại vẫn nhận đúng phiên bản.

**`form_responses`** thêm `assignments` (json), là bản chụp phiên bản đã giao lúc gửi.

**`response_answers`** thêm `variant_key` (nullable). Khi K > 1 ở chế độ "giống nhau", cùng một câu có nhiều câu trả lời, mỗi phiên bản một câu.

### 5.2 API

| Endpoint | Thay đổi |
|---|---|
| `GET /forms/public/{slug}` | Trả thêm `key`, `settings`, `random_group_key`, `variant_key` |
| `POST /forms/public/{slug}/assign` **(mới)** | Đầu vào: `token` (nếu có) + câu trả lời của câu lọc. Đã có phiên bản cho khối thì trả lại đúng phiên bản đó; chưa có thì bốc theo mục 4.1, lưu vào `form_sessions`, trả `{ token, assignments }` |
| `POST /forms/public/{slug}/submit` | Nhận thêm `token`. Server lấy phiên bản từ session (không tin client), chỉ nhận câu trả lời của phiên bản đã giao, kiểm tra điều kiện / tối thiểu / tối đa / "Khác" / loại trừ / mọi dòng / khoảng số, rồi tự tính câu "lấy từ câu trước" |
| `POST /forms/{form}/fields/bulk-update` | Lưu các cột mới; kiểm tra tham chiếu `key` hợp lệ |
| `POST /forms/{form}/duplicate` | Sinh `key` mới và đổi lại mọi tham chiếu (điều kiện, câu nguồn, câu lọc, khối) |
| Câu trả lời / thống kê / xuất Excel | Kèm phiên bản đã giao; thống kê có bộ lọc theo phiên bản |

Định dạng câu trả lời gửi lên: `answers[field_id]` như cũ; câu trong khối ngẫu nhiên gửi `answers[field_id@variant_key]`. Ô chữ của "Khác" gửi `answers[field_id]` dạng `{ "selected": [...], "other": "..." }`.

### 5.3 Builder (`frontend/src/components/FormBuilder/*`)

- `FormSidebar.jsx`: thêm nút **Thêm phần ngẫu nhiên**.
- Thẻ khối ngẫu nhiên (component mới):
  - Tiêu đề và mô tả của khối.
  - Bảng phiên bản: thêm, xóa, kéo đổi thứ tự, sửa tiêu đề/mô tả.
  - Chọn chế độ giống nhau hay khác nhau, và số phiên bản K.
  - Mục "Lọc theo câu" gồm: chọn câu dạng bảng, bảng ghép phiên bản với dòng, chọn cột bị loại.
- Chế độ "khác nhau": thanh tab theo phiên bản; câu hỏi hiển thị và thêm vào theo tab đang chọn. Có nút "Sao chép bộ câu hỏi từ phiên bản…" để không phải nhập lại.
- Câu hỏi trong khối được viền/thụt lề để thấy rõ phạm vi khối. Kéo thả giữ đúng thành viên khối.
- `FormQuestion.jsx`: thêm mục **Tùy chọn nâng cao** (thu gọn mặc định) chứa các tùy chọn ở mục 4.2 tùy theo loại câu.
- Trình soạn điều kiện: chọn câu nguồn (chỉ những câu đứng trước), toán tử, các phương án.
- Cảnh báo khi xóa hoặc sửa phiên bản/phương án trong lúc form đã có câu trả lời.

### 5.4 Form công khai và xem trước (`PublicForm.jsx`, `FormPreview.jsx`)

- Dựng "danh sách trang hiệu lực" từ câu hỏi + phiên bản đã giao: khối ngẫu nhiên được thay bằng các trang của từng phiên bản đã giao.
- Đầu mỗi trang của khối hiện tiêu đề khối và dòng "Sự kiện được lựa chọn là: **<tên phiên bản>**" kèm mô tả phiên bản.
- Khi bấm "Tiếp" rời trang chứa câu lọc, gọi `/assign` (có trạng thái đang tải; báo lỗi và thử lại nếu mạng lỗi).
- Câu ẩn do điều kiện được bỏ khỏi bước kiểm tra bắt buộc và khỏi dữ liệu gửi đi. Trang mà mọi câu đều ẩn thì tự bỏ qua.
- Thanh tiến độ tính theo số trang hiệu lực.
- Xem trước: danh sách chọn phiên bản; không gọi `/assign` và không ghi session.
- Phần hiển thị câu hỏi tách thành component dùng chung cho cả form công khai và xem trước, để hai nơi không lệch nhau.

### 5.5 Câu trả lời, thống kê, xuất Excel

- `ResponseDetail.jsx`: hiện phiên bản đã giao; câu ẩn ghi "(không hiển thị)"; "Khác" hiện kèm nội dung ghi rõ.
- Thống kê (`summary`): thêm bộ lọc theo phiên bản cho các câu trong khối ngẫu nhiên (đã chốt: làm trong đợt này). Thêm bảng số lượt được giao / đã gửi theo từng phiên bản.
- Xuất Excel (`FormResponsesExport.php`):
  - Chế độ giống nhau, K = 1: thêm cột "<tên khối> – phiên bản", tiếp theo là một bộ cột chung.
  - Chế độ giống nhau, K > 1: mỗi lượt có bộ cột "Lượt 1 – …", "Lượt 2 – …".
  - Chế độ khác nhau: mỗi phiên bản có cột riêng, đặt tiền tố bằng tên phiên bản.
  - "Khác (ghi rõ)": thêm cột "<câu> – Khác (ghi rõ)".

### 5.6 Giới hạn mỗi người trả lời

**Database:**
- `forms.respondent_limit` (json):
  ```json
  { "enabled": true, "methods": ["device", "email", "phone", "account"],
    "field_keys": { "email": "<key câu email>", "phone": "<key câu điện thoại>" },
    "match": "any | all", "max_per_person": 1,
    "on_limit": "block | edit", "message": "Ông/Bà đã tham gia khảo sát này. Xin cảm ơn!" }
  ```
- Loại câu mới `phone`. `form_fields.settings.store_hash_only` cho câu email/điện thoại.
- Bảng mới `response_identities`: `form_id`, `response_id`, `method` (device/email/phone/account), `value_hash`, index `(form_id, method, value_hash)`.
- Mã băm = HMAC-SHA256(giá trị đã chuẩn hóa, `APP_KEY` + id form). Số điện thoại có ít khả năng nên băm thường dễ dò ngược; HMAC với khóa bí mật thì không dò được. Cùng một số ở hai form khác nhau ra hai mã khác nhau.
- Câu "chỉ lưu mã băm": `response_answers.value` lưu `null`, chỉ `response_identities` giữ mã băm.
- `form_sessions` (mục 5.1) thêm `device_id` và `response_id` để làm chế độ "Cho sửa".

**API:**
- `GET /forms/public/{slug}`: trả về cấu hình giới hạn (không kèm dữ liệu nhạy cảm). Nếu mã thiết bị/tài khoản đã đủ N lần thì trả về trạng thái `limit_reached` + thông báo; ở chế độ sửa thì kèm câu trả lời cũ.
- `POST /forms/public/{slug}/check-identity` **(mới)**: nhận email/điện thoại vừa nhập, trả về `ok` hoặc `limit_reached`. Không bao giờ trả về nội dung câu trả lời cũ khi chỉ khớp theo email/điện thoại (xem mục 8).
- `submit`: kiểm tra lại trong transaction có khóa (tránh gửi hai lần cùng lúc lọt qua), ghi `response_identities`. Ở chế độ sửa thì cập nhật câu trả lời cũ thay vì tạo mới.

**Builder (`FormSettings.jsx`):** mục "Giới hạn mỗi người trả lời" gồm:
- Công tắc bật/tắt; các ô chọn căn cứ.
- Danh sách chọn câu Email / Điện thoại; nếu form chưa có câu phù hợp thì có nút "Thêm câu vào trang đầu".
- Chọn "trùng bất kỳ" hay "trùng tất cả"; ô N; chọn Chặn hay Cho sửa; ô nội dung thông báo.

**Form công khai:** màn hình thông báo khi bị chặn; ở chế độ sửa thì nạp lại câu trả lời cũ và giữ nguyên phiên bản ngẫu nhiên đã giao.

**Câu trả lời / Excel:** thêm cột "Căn cứ nhận diện" (ví dụ "thiết bị, email"). Câu chỉ lưu mã băm hiện "(đã ẩn)".

---

## 6. Áp dụng cho bảng hỏi 12.11.26

### 6.1 Cấu trúc trang

| Trang | Nội dung |
|---|---|
| Mô tả form | Tiêu đề, đối tượng, hình thức, thời gian, lời ngỏ |
| 1 – Phần I | Câu Email (mới, đầu trang), Câu 1, Câu 2 |
| 2 – Phần II (khối ngẫu nhiên, trang 1) | Đoạn giới thiệu + tên sự kiện; Câu 3 → 8a |
| 3 – Phần III (khối ngẫu nhiên, trang 2) | Nhắc tên sự kiện; Câu 9, 10, 10a |
| 4 – Phần IV | A1 → A8 |
| Lời cảm ơn | "Xin chân thành cảm ơn Ông/Bà đã tham gia khảo sát!" (thông điệp sau khi gửi) |

Khối ngẫu nhiên: chế độ **giống nhau**, K = 1, 10 phiên bản là 10 sự kiện của Câu 2. Lọc theo Câu 2, loại cột "Chưa từng nghe nói".

### 6.2 Từng câu

| Câu | Loại | Cấu hình |
|---|---|---|
| Email | Email, bắt buộc | Căn cứ nhận diện. Nhãn đề xuất: "Email của Ông/Bà (chỉ dùng để tránh trả lời trùng)" |
| 1 | 3 ô nhập ngắn "Sự kiện 1/2/3" | Ghi chú: "Nếu không nhớ được sự kiện cụ thể, ghi: Chưa nhớ được" |
| 2 | Bảng trắc nghiệm 10 dòng × 4 cột | Câu lọc của khối ngẫu nhiên |
| 3 | Hộp kiểm | "Khác (xin ghi rõ)"; loại trừ: "Tôi chủ yếu nhớ tên gọi…", "Tôi không nhớ hoặc chưa có đủ thông tin…" |
| 3 (ghi thêm) | Văn bản dài | "Nếu được, xin viết ngắn gọn một điều cụ thể nhất…" |
| 4 | Hộp kiểm, tối đa 3 | "Nguồn hoặc trải nghiệm khác (xin ghi rõ)"; loại trừ: "Không nhớ rõ nguồn…" |
| 5 | Trắc nghiệm | — |
| 5a | Hộp kiểm | "Khác"; loại trừ: "Không có mối liên hệ cụ thể"; **hiện khi** Câu 5 chọn một trong 4 phương án đầu |
| 6 | Hộp kiểm, tối đa 3 | "Lý do khác (xin ghi rõ)"; loại trừ: "Tôi chưa thấy có lý do đặc biệt/không có ý kiến" |
| 6a | Trắc nghiệm, đáp án lấy từ Câu 6 | Quy tắc ẩn/tự ghi theo mục 4.2 |
| 7 | Hộp kiểm, tối đa 3 | "Ý nghĩa khác (xin ghi rõ)"; loại trừ: "Tôi chưa cảm nhận được ý nghĩa cụ thể…" |
| 7a | Trắc nghiệm | Luôn hiện (đổi được trong builder) |
| 8 | Hộp kiểm, tối đa 3 | "Cảm xúc khác"; loại trừ: "Cảm thấy bình thường…", "Chưa từng tiếp xúc nên không thể đánh giá" |
| 8a | Trắc nghiệm | "Khác"; luôn hiện (đổi được trong builder) |
| 9 | Hộp kiểm, tối đa 3 | "Hình thức khác (xin ghi rõ)" |
| 10 | Hộp kiểm | Loại trừ: "Chưa thực hiện hoạt động nào…", "Không nhớ rõ" |
| 10a | Hộp kiểm, tối đa 2 | "Lý do khác"; loại trừ: "Không có lý do cụ thể"; **hiện khi** Câu 10 chọn "Chưa thực hiện hoạt động nào…" hoặc "Không nhớ rõ" |
| A1 | Trắc nghiệm | Nam / Nữ |
| A2 | Số | 2 chữ số, từ 18 đến 99 |
| A3 | Trắc nghiệm | Đô thị / Nông thôn |
| A3a | Trắc nghiệm | Miền Bắc / Miền Trung / Miền Nam |
| A4 | Trắc nghiệm | 6 phương án + "Khác (ghi rõ)" |
| A5 | Bảng trắc nghiệm 17 dòng × 3 cột (Nghe nhiều / Vài lần / Chưa) | Bắt buộc, trả lời đủ mọi dòng |
| A6 | Hộp kiểm | "Nguồn khác (ghi rõ)" |
| A7 | Hộp kiểm, đúng 3 (tối thiểu 3, tối đa 3) | "Khác (ghi rõ)" |
| A8 | Trắc nghiệm | 5 mức |

Sửa chính tả: "Trủng" → "Trùng", "thương mai" → "thương mại", "sự kiên" → "sự kiện". Bỏ ghi chú nội bộ "(các nhóm chỉnh sửa bổ sung…)", cột TT "8a/8b/8c" ở A5, và chữ "A" thừa trong "PHẦN IV. A". Các câu không ghi ở trên đều không bắt buộc.

Giới hạn mỗi người cho form này (cấu hình ban đầu, người dùng đổi được trong builder): bật, căn cứ **Email**, N = 1, chế độ **Chặn**. Email bắt buộc, lưu bình thường.

Form được dựng bằng một seeder/lệnh artisan (`php artisan survey:import-1211`) để chạy lại được. Dựng ở trạng thái **nháp** để người dùng kiểm tra trước khi xuất bản.

---

## 7. Kiểm thử

- **Feature test backend (PHPUnit)** cho:
  - Bốc phiên bản: loại theo Câu 2, không còn phiên bản hợp lệ, bổ sung cho đủ K, giữ nguyên khi gọi lại.
  - Kiểm tra khi gửi: điều kiện, tối thiểu/tối đa, "Khác", loại trừ, mọi dòng, khoảng số, câu lấy từ câu trước, chặn câu trả lời của phiên bản không được giao.
  - Nhân bản form đổi đúng các tham chiếu.
  - Giới hạn mỗi người: chuẩn hóa email/điện thoại, "trùng bất kỳ" và "trùng tất cả", N > 1, chặn hoặc sửa, hai lần gửi đồng thời, câu chỉ lưu mã băm không lộ giá trị ở API/Excel.
- **Script `tools/simulate-assign.php`**: gọi `/assign` 1000 lần với câu trả lời Câu 2 ngẫu nhiên, in bảng phân bố theo sự kiện và số lần vi phạm luật loại trừ (phải bằng 0).
- **Script headless `tools/e2e-survey.mjs`** (Playwright + Chrome local): điền trọn form khảo sát qua 4 trang, kiểm tra ẩn/hiện 5a, 6a, 10a, giới hạn chọn, tải lại giữ phiên bản, gửi thành công; rồi tải file Excel và kiểm tra tiêu đề cột. In bảng tóm tắt, chỉ liệt kê lỗi.
- Form cũ không dùng tính năng mới vẫn hiển thị, gửi và xuất Excel như trước.

## 8. Rủi ro / lưu ý

- `bulk-update` xóa câu không còn trong danh sách. Nếu xóa phiên bản hoặc câu khi đã có câu trả lời, dữ liệu cũ của câu đó mất theo cơ chế hiện tại. Builder sẽ cảnh báo trước khi lưu.
- Session chưa gửi tích lũy dần; thêm lệnh dọn các session quá 30 ngày chưa gửi.
- **Chế độ "Cho sửa" + email/điện thoại không OTP:** ai biết email của người khác có thể mở được câu trả lời của họ. Vì vậy khi chỉ khớp theo email/điện thoại, hệ thống **không nạp lại câu trả lời cũ**: người trả lời điền lại từ đầu, và bản mới thay thế bản cũ. Chỉ khi khớp mã thiết bị hoặc tài khoản thì mới nạp lại câu trả lời cũ để sửa.
- Câu trả lời gửi trước khi bật giới hạn không có dữ liệu nhận diện (trừ `user_id`), nên không chặn trùng ngược về trước được.
- Hỏi email làm giảm tính ẩn danh mà lời ngỏ của bảng hỏi cam kết, có thể làm giảm tỷ lệ tham gia. Nên sửa lời ngỏ cho khớp, ví dụ "email chỉ dùng để tránh trả lời trùng".
- Đổi tên phương án làm hỏng điều kiện tham chiếu theo tên. Builder cập nhật luôn các điều kiện liên quan khi đổi tên phương án trong cùng lần lưu.

## 9. Câu hỏi còn mở (cần người dùng xác nhận khi duyệt)

Đã trả lời:
- Câu 2 không bắt buộc; dòng bỏ trống coi như "đã nghe", sự kiện đó vẫn có thể được bốc. **Đồng ý.**
- Danh sách phương án loại trừ ở mục 6.2. **Đúng.**
- Bộ lọc theo phiên bản trong trang thống kê. **Làm trong đợt này.**

- CCCD/Hộ chiếu. **Bỏ, không làm.**
- Căn cứ của form khảo sát. **Người dùng tự cài trong builder**; agent dựng form với cấu hình mặc định ở mục 6.2.
- Email ở form khảo sát. **Lưu bình thường, hiện trong Excel.**

Không còn câu hỏi mở.

---

## 10. Ghi chú triển khai (giai đoạn 1, frontend phải làm khớp)

### 10.1 File đã thêm/sửa
- Migration `2026_11_12_000000_add_random_sections_and_respondent_limit.php` (đã chạy trên `eforms_db`, câu cũ đã có `key`).
- Model mới `FormSession`, `ResponseIdentity`; cập nhật `Form`, `FormField` (tự sinh `key`, hằng `NON_ANSWER_TYPES`, hàm `setting()`), `FormResponse`, `ResponseAnswer`.
- `app/Services/Forms/`: `AnswerValue` (đọc mọi dạng giá trị, kể cả dữ liệu cũ), `FormStructure` (bung khối ngẫu nhiên thành danh sách câu hiệu lực), `VariantAssigner`, `ConditionEvaluator`, `SubmissionValidator`, `RespondentLimiter`, `DeviceId`, `FieldReferenceValidator`.
- Endpoint công khai chuyển sang `PublicFormController` (`show`, `assign`, `checkIdentity`, `submit`); đã gỡ `getPublicForm`/`submit` khỏi `FormResponseController`.
- `FormFieldController::bulkUpdate`: gán `key` còn thiếu, kiểm tra tham chiếu, chạy trong transaction, chấp nhận danh sách rỗng.
- `FormController`: nhận `respondent_limit` (chọn căn cứ `account` thì tự bật `require_login`); **nhân bản form đổi lại mọi tham chiếu `key` (làm sớm, vốn thuộc giai đoạn 4)**.
- Lệnh `php artisan forms:prune-sessions` (mặc định 30 ngày), lên lịch hằng ngày trong `routes/console.php`.
- Test: `tests/Feature/*` chạy bằng `php artisan test` trên SQLite in-memory (`phpunit.xml` đã đổi `DB_CONNECTION`).
- Tool: `tools/db-peek.php "SQL"` (xem nhanh DB), `tools/remove-php-methods.php`.

### 10.2 Quy ước dữ liệu câu trả lời
- Mã câu trả lời: `field_id` cho câu thường, `field_id@variant_key` cho câu trong khối ngẫu nhiên. Lỗi 422 trả về dạng `errors["answers.<mã>"]`.
- Phương án "Khác" được biểu diễn bằng giá trị cố định `__other__` (không dùng nhãn, để đổi nhãn không hỏng dữ liệu/điều kiện). Gửi lên: `{ "selected": [..., "__other__"], "other": "nội dung" }`. Nhãn hiển thị lấy từ `settings.other_option.label`.
- Lưu: trắc nghiệm là chuỗi; hộp kiểm là mảng; khi có "Khác" thì là object `{selected, other}`; bảng là object `{dòng: cột}` hoặc `{dòng: [cột]}`.
- Server tự giải mã mảng/object gửi dưới dạng chuỗi JSON trong multipart (cách form công khai hiện tại đang gửi). Dữ liệu hộp kiểm cũ bị lưu "chuỗi JSON lồng" vẫn đọc được qua `AnswerValue::decode`.
- Điện thoại được lưu ở dạng đã chuẩn hóa (`0912345678`).
- `settings.number.digits` = số chữ số **tối đa**, bắt buộc số nguyên. `min_select` không áp dụng khi người trả lời chọn phương án loại trừ.
- Câu "lấy từ câu trước" chỉ hiện khi câu nguồn có từ 2 lựa chọn (không tính trường hợp có phương án loại trừ); 1 lựa chọn thì server tự ghi.

### 10.3 Quy ước trang
- Đầu khối ngẫu nhiên luôn mở trang mới cho **mỗi** phiên bản được giao; câu đầu tiên sau khối cũng mở trang mới. Câu `section` trong khối là ngắt trang bên trong phiên bản.
- `section` bị ẩn theo điều kiện thì ẩn cả trang của nó (tới ngắt trang kế tiếp). Đầu khối bị ẩn thì ẩn cả khối.
- Điều kiện tham chiếu câu trong khối: cùng khối thì lấy câu trả lời của cùng phiên bản; từ ngoài khối thì lấy phiên bản đầu tiên được giao.

### 10.4 API công khai
- `GET /forms/public/{slug}?device_id=…`: trả thêm `device_id` (server cấp, có chữ ký; client lưu localStorage và gửi lại qua `device_id` trong body/query hoặc header `X-Device-Id`; cookie `eforms_did` là dự phòng), `respondent_limit` (không có nội dung thông báo), `limit_status`: `null` | `{status:"ok"}` | `{status:"limit_reached", message}` | `{status:"editing", token, response_id, assignments, answers}`. Chế độ `editing` chỉ xảy ra khi khớp thiết bị/tài khoản.
- `POST /assign` `{token?, device_id?, answers, group_keys?}` → `{token, assignments: {group_key: [variant_key…]}}`. Không truyền `group_keys` thì bốc cho mọi khối chưa có phiên bản. Form không có khối thì trả `token: null`.
- `POST /check-identity` `{token?, device_id?, values: {email?, phone?}}` → `status`: `ok` | `limit_reached` (+`message`) | `will_replace` (+`message`, chế độ "Cho sửa" khi khớp email/điện thoại; không bao giờ trả câu trả lời cũ). Chỉ gửi khóa `email`/`phone` khi người trả lời đã đi qua câu đó; ở chế độ "trùng tất cả" server chỉ kết luận khi đủ mọi căn cứ.
- `POST /submit` `{answers, token?, device_id?}` → 201 `{response_id, edited}` | 422 lỗi theo câu | 409 `{status:"limit_reached", message}` | 403 form đóng/đủ số lượng | 401 cần đăng nhập. Client nên xóa `token` khỏi localStorage sau khi gửi thành công.
- Giới hạn tần suất: `assign`, `submit` 120 lần/phút; `check-identity` 30 lần/phút (theo IP).
- Lỗi `bulk-update` trả 422 dạng `errors["fields.<vị trí>.<thuộc tính>"]`.

### 10.5 Việc còn lại liên quan backend
- ~~`summary` và `FormResponsesExport` chưa hiểu `{selected, other}`, `variant_key`, câu chỉ lưu mã băm, cột "Căn cứ nhận diện".~~ Đã làm ở giai đoạn 4 (mục 13).
- ~~`tools/simulate-assign.php` làm ở giai đoạn 5 (cần form khảo sát thật).~~ Đã làm (mục 14).

## 11. Ghi chú triển khai (giai đoạn 2)

### 11.1 File đã thêm/sửa (frontend)
- `src/utils/formStructure.js` (mới): sinh `key` (uuid bằng `crypto.getRandomValues`, vì `crypto.randomUUID` không chạy trên http `eforms.test`), chuẩn hóa câu, xác định khối, vị trí chèn, kéo thả, nhân bản có đổi tham chiếu, xóa có gỡ tham chiếu treo, đổi tên phương án/dòng/cột kéo theo điều kiện và bộ lọc, so sánh thay đổi gây mất dữ liệu. Giai đoạn 3–4 nên dùng lại các hằng `CHOICE_TYPES`, `GRID_TYPES`, `NON_ANSWER_TYPES`, `OTHER_VALUE`, hàm `choiceValues`.
- `src/store/formStore.js`: chuẩn hóa câu khi nạp (`settings`/`conditional_logic` rỗng dạng `[]` từ PHP thành `{}`/`null`), `insertFields`, `applySavedFields`, `setFields` tự đánh lại `order`, nhân bản đầu khối thì nhân bản cả khối.
- `src/components/FormBuilder/`: `RandomSectionCard.jsx` (mới, kèm `BlockFooter`), `AdvancedOptions.jsx` (mới), `ConditionEditor.jsx` (mới); sửa `index.jsx`, `FormQuestion.jsx`, `FormSidebar.jsx`.
- `src/components/FormSettings.jsx`: mục "Giới hạn mỗi người trả lời".
- `src/index.css`: lớp `eforms-block-member`, `eforms-block-footer`, `eforms-variant-tab`, `eforms-chip`, `eforms-adv-input`.
- `src/layouts/MainLayout.jsx`: `toast.info` (không tồn tại trong react-hot-toast) đổi thành `toast`.
- Tool: `tools/test-form-structure.mjs` (kiểm tra logic, chạy `node`), `tools/e2e-builder.mjs` (Playwright + Chrome local; `--shots` lưu ảnh vào `tools/out/`, `--keep` giữ form thử), `tools/mint-token.php` (cấp/thu hồi token Sanctum tên `e2e` cho user 1). `tools/package.json` chứa `playwright-core`.

### 11.2 Hành vi builder
- Nút thêm ở thanh bên chèn **sau câu đang chọn** (trước đây luôn thêm cuối form); câu đang chọn nằm trong khối thì câu mới vào khối (chế độ "khác nhau" thì thuộc tab đang mở). Phần ngẫu nhiên mới không bao giờ lồng: chèn sau khối chứa câu đang chọn, tạo sẵn 2 phiên bản + 1 câu.
- Kéo thả: kéo đầu khối thì di chuyển cả khối. Kéo một câu: nằm giữa hai câu cùng khối thì vào khối; ở ranh giới cuối khối thì giữ nguyên trạng thái cũ.
- Chế độ "khác nhau": câu có `variant_key = null` là câu dùng chung cho mọi phiên bản (backend đã hỗ trợ). Chuyển "giống nhau" → "khác nhau" giữ mọi câu là dùng chung. Chuyển ngược lại thì giữ câu của tab đang mở, xóa câu riêng của tab khác (có hỏi xác nhận). Xóa phiên bản thì xóa luôn câu riêng của phiên bản đó.
- Bộ lọc: `row_map` luôn được ghi đầy đủ khi chọn câu lọc; `""` = phiên bản không ghép dòng (luôn có thể được bốc). Nút "Đặt tên phiên bản theo các dòng" đặt tên/thêm phiên bản theo dòng của câu lọc, giữ nguyên `key` phiên bản cũ.
- Đổi loại câu thì bỏ các `settings` không áp dụng cho loại mới (`sanitizeSettings`).
- Loại câu `phone` đã có sẵn trong danh sách loại câu từ trước; giai đoạn này chỉ thêm tùy chọn "Chỉ lưu mã băm" cho Email/Điện thoại.
- Cài đặt giới hạn: chỉ cho chọn câu Email/Điện thoại nằm ngoài khối ngẫu nhiên. Nút "Thêm câu … vào trang đầu" chèn câu bắt buộc ở đầu trang 1 (sau ngắt trang nếu form mở đầu bằng ngắt trang). Bấm "Lưu Cài Đặt" khi builder có thay đổi chưa lưu thì lưu câu hỏi trước rồi mới lưu cài đặt.
- Lưu khi form đã có câu trả lời: nếu có xóa câu/phiên bản, đổi loại câu, đổi/xóa phương án/dòng/cột thì hiện danh sách thay đổi để xác nhận. Lỗi 422 của `bulk-update` hiện theo tên câu và chọn sẵn câu bị lỗi.
- **Sửa lỗi cũ:** sau khi lưu, câu mới tạo không nhận `id` từ server nên lần lưu sau bị xóa rồi tạo lại (mất câu trả lời của câu đó). Nay `applySavedFields` gán `id` theo `key`.

### 11.3 Lưu ý môi trường local
- Thỉnh thoảng một request API trả 500 do Apache/mod_php trên Windows mất biến `.env` khi có request đồng thời, Laravel rơi về kết nối `sqlite` mặc định (log: `database.sqlite does not exist`, đã gặp từ 11/2025). Không liên quan code. Cách tránh khi test nhiều: `php artisan config:cache` (nhớ chạy `config:clear` khi sửa `.env`).
- Form công khai và xem trước chưa hiểu `random_section` và các tùy chọn mới: đó là việc của giai đoạn 3–4. Chưa nên xuất bản form dùng tính năng mới.

## 12. Ghi chú triển khai (giai đoạn 3)

### 12.1 File đã thêm/sửa
- `frontend/src/utils/formRuntime.js` (mới): logic chạy form phía trình duyệt, viết khớp `FormStructure` / `ConditionEvaluator` / `SubmissionValidator` của server: `buildInstances` (khối chưa bốc là một mục `pending`), `evaluateForm` (ẩn/hiện, câu lấy từ câu trước), `paginate` (trang hiệu lực), `validateInstance` / `validatePages` (thông báo lỗi giống server), `submissionAnswers` (chỉ gửi câu đang hiện), `filterAnswers`, `filterGroupsOnPage`. Sửa logic ẩn/hiện hay kiểm tra thì sửa **cả hai phía**.
- `frontend/src/components/FormRenderer/` (mới): `QuestionInput.jsx` (ô trả lời theo loại câu, gồm "Khác", loại trừ, tối đa, bảng đánh dấu dòng thiếu) và `FormPageView.jsx` (một trang: băng tiêu đề khối, thẻ câu hỏi, lỗi dưới từng câu). **Giai đoạn 4: trang xem trước dùng lại hai component này + `formRuntime`, với `assignments` lấy từ danh sách chọn phiên bản.**
- `frontend/src/pages/PublicForm.jsx`: viết lại trên nền trên.
- `frontend/src/services/api.js`: `getPublicForm(slug, params)`, `assignVariants`, `checkIdentity`; `submitForm` gửi kèm `token`, `device_id`. Mọi request công khai gửi kèm token đăng nhập nếu có (để căn cứ "Tài khoản" nhận ra người dùng). POST công khai tự lấy lại cookie CSRF và thử lại một lần khi gặp 419.
- `PublicFormController::show` trả thêm `accepting` (form có đang nhận câu trả lời không).
- Builder: khối ngẫu nhiên có thêm ô **"Nhãn trước tên phiên bản"** (`settings.variant_label`, mặc định "Phiên bản được lựa chọn là"). Form khảo sát (giai đoạn 5) đặt "Sự kiện được lựa chọn là".
- Tool: `tools/test-form-runtime.mjs` (chạy `node`), `tools/e2e-public.mjs` (Playwright; dựng 3 form thử qua API rồi xóa, `--keep` giữ lại, `--shots` lưu ảnh vào `tools/out/`; đối chiếu dữ liệu đã lưu bằng `db-peek.php`).

### 12.2 Hành vi form công khai
- Trang đầu khối hiện băng tiêu đề đầy đủ: tiêu đề và mô tả khối, "<nhãn>: **<tên phiên bản>**", mô tả phiên bản. Các trang sau trong khối chỉ nhắc tiêu đề khối và tên phiên bản. Khối bắt đầu bằng ngắt trang thì băng tiêu đề gộp vào trang đó (không có trang trống).
- Bốc phiên bản: khi bấm "Tiếp theo" rời trang chứa câu lọc (chỉ gửi câu trả lời của câu lọc); khối không có câu lọc thì bốc khi tới trang của khối (hiện "Đang chuẩn bị nội dung…", lỗi mạng thì có nút "Thử lại").
- `token` của phiên lưu ở localStorage `eforms_session:<slug>`, xóa sau khi gửi thành công. Mã thiết bị lưu ở localStorage `eforms_device_id`. Bản nháp câu trả lời và trang đang mở lưu ở **sessionStorage** `eforms_draft:<slug>` (tải lại vẫn còn, đóng tab là mất, để không lộ câu trả lời trên máy dùng chung). Bản nháp chỉ được nạp khi cùng `token`.
- Kiểm tra bắt buộc/định dạng ngay khi bấm "Tiếp theo" (lỗi hiện dưới từng câu, cuộn tới câu lỗi đầu tiên). Khi gửi thì kiểm tra lại mọi trang đang hiện; lỗi 422 của server được gắn vào đúng câu và chuyển tới trang có lỗi.
- Hộp kiểm có tối đa N: đủ N thì các ô còn lại bị khóa (trừ phương án loại trừ). Có gợi ý "Chọn tối đa / ít nhất / đúng N phương án". Chữ đã nhập ở ô "Khác" được giữ khi bỏ tích tạm thời, nhưng không được gửi đi nếu "Khác" không được chọn.
- Câu trắc nghiệm không bắt buộc có nút "Bỏ chọn".
- Giới hạn mỗi người: `limit_reached` khi mở form, khi `check-identity` (rời trang có câu Email/Điện thoại) hoặc 409 khi gửi thì hiện màn hình thông báo. `will_replace` và chế độ `editing` hiện dải cảnh báo màu vàng phía trên form; `editing` nạp lại câu trả lời cũ cùng phiên bản đã giao. Sau khi sửa, màn hình cảm ơn ghi "Đã cập nhật câu trả lời".
- Màn hình riêng cho: không tìm thấy form, form đã đóng (`accepting = false` hoặc 403), cần đăng nhập (`require_login` mà chưa có token).
- **Thay đổi so với trước:** mô tả form chỉ hiện ở trang đầu (trước đây hiện ở mọi trang); tắt kiểm tra HTML mặc định (`noValidate`), mọi kiểm tra do code đảm nhận.

### 12.3 Lưu ý môi trường dev
- `main.jsx` bật `React.StrictMode`, nên ở dev form công khai được tải hai lần cùng lúc. Hai phản hồi cấp hai phiên Laravel (driver `cookie`) và hai mã thiết bị khác nhau. `loadForm` bỏ qua kết quả của lần tải đã bị hủy; nếu thao tác quá nhanh thì POST đầu có thể bị 419, và lần thử lại tự động sẽ thành công. Trên bản build production không có hiện tượng này.

## 13. Ghi chú triển khai (giai đoạn 4)

### 13.1 File đã thêm/sửa
- Backend mới: `app/Services/Forms/ResponseTable.php` (bố cục cột Excel, dùng chung cho xuất cả form và xuất một câu trả lời), `app/Services/Forms/ResponseSummary.php` (thống kê + đếm theo phiên bản).
- `app/Exports/FormResponsesExport.php`: viết lại trên `ResponseTable`; tự làm value binder: **chuỗi luôn ghi dạng chữ** (giữ số 0 đầu của số điện thoại, câu trả lời bắt đầu bằng `=` không thành công thức). Câu loại số/đánh giá/thang điểm ghi dạng số. Tên sheet cắt theo ký tự UTF-8 và bỏ ký tự Excel cấm.
- `FormResponseController`: `summary` dùng `ResponseSummary`, nhận `?variants[<key khối>]=<key phiên bản>`; `show` trả thêm `identity_methods` (chỉ tên căn cứ, không bao giờ trả mã băm); `index`/`show` gán `value = null`, `hidden = true` cho câu chỉ lưu mã băm, thêm `file_url` cho tệp tải lên.
- Frontend mới: `components/FormRenderer/FormChrome.jsx` (`useFormTheme`, `FormFrame`, `PageProgress`, dùng chung cho form công khai và xem trước), `utils/responseView.js` (đọc câu trả lời đã lưu: giải mã JSON lồng, khóa `id@phiên bản`, dựng lại phiên bản đã giao cho câu trả lời cũ).
- Viết lại: `pages/forms/FormPreview.jsx`, `pages/forms/ResponseDetail.jsx`. Sửa: `PublicForm.jsx` (dùng `FormChrome`, hành vi không đổi), `FormResponses.jsx` (cột "Phiên bản"), `FormSummary.jsx`, `QuestionBox.jsx`, `services/api.js` (`getSummary(formId, variants)`).
- Test: `tests/Feature/ResponseReportingTest.php` (5 test). Tool: `tools/e2e-phase4.mjs` (dựng 2 form thử qua API, gửi câu trả lời qua API công khai, kiểm tra API thống kê, file Excel, xem trước, chi tiết, thống kê, nhân bản; `--keep`, `--shots`), `tools/xlsx-peek.php file.xlsx` (in các dòng + kiểu ô dạng JSON).
- Modal cũ `components/FormPreview.jsx` không còn được mở ở đâu (builder mở tab `/forms/:id/preview`); để nguyên, chưa xóa.

### 13.2 Hành vi
- **Xem trước:** dùng cùng `formRuntime` + `FormPageView` như form công khai, có kiểm tra bắt buộc/định dạng. Thanh vàng có danh sách chọn phiên bản cho từng khối (K > 1 thì có "Lượt 1…K"; chọn phiên bản đang dùng ở lượt khác thì hai lượt đổi chỗ cho nhau). Mặc định là K phiên bản đầu. Không gọi `/assign` hay `/submit`. Có nút "Làm lại". Xem trước đọc bản **đã lưu** của form.
- **Chi tiết câu trả lời:** hiện theo trang như người trả lời đã thấy, có tiêu đề khối và phiên bản ở đầu trang của khối. Thẻ thông tin có "Phiên bản được giao" và "Căn cứ nhận diện". Câu ẩn theo điều kiện: "(không hiển thị)". "Khác": "<nhãn>: <nội dung>". Câu chỉ lưu mã băm: "(đã ẩn …)". Câu lấy từ câu trước được server tự ghi thì có ghi chú. Quy tắc: có dữ liệu đã lưu thì luôn hiện dữ liệu, kể cả khi điều kiện hiện tại tính ra là ẩn (form có thể đã sửa sau khi gửi).
- **Thống kê:** mỗi khối có thẻ đặt trước câu đầu tiên của khối, gồm bảng phiên bản (Được giao = đã gửi + đang làm dở chưa gửi; session chưa gửi bị dọn sau 30 ngày) và bộ lọc phiên bản. Bộ lọc chỉ áp dụng cho các câu **trong khối đó**; câu ngoài khối không đổi. Câu trong khối tính % trên số lượt được giao phần này. Chế độ "khác nhau": câu riêng của phiên bản khác bị ẩn khi lọc. "Khác" được đếm chung dưới nhãn của phương án "Khác", nội dung ghi rõ liệt kê trong mục thu gọn. Câu trả lời rỗng không còn được tính.
- **Excel:** tiêu đề cột chuyển sang tiếng Việt ("Mã câu trả lời", "Thời gian gửi", "Người dùng", "Địa chỉ IP"; người ẩn danh ghi "Ẩn danh"). Cột "Căn cứ nhận diện" có khi form bật giới hạn mỗi người hoặc đã có dữ liệu nhận diện. Khối: theo mục 5.5 (tên cột phiên bản: "<tên khối> – phiên bản"; số lượt = max(K, số phiên bản nhiều nhất đã giao)). Bảng (grid) vẫn **một cột** dạng "dòng: cột; …" như trước. Câu chỉ lưu mã băm: "(đã ẩn)".
- **Nhân bản:** backend đã làm ở giai đoạn 1; E2E xác nhận bản sao có key mới, tham chiếu đúng và xem trước được.

### 13.3 Lưu ý khi test
- Lỗi 500 ngẫu nhiên do Apache mất `.env` (mục 11.3) có gặp lại khi chạy E2E. Cách chạy ổn định: `php artisan config:cache` → chạy E2E → **`php artisan config:clear` trước khi chạy PHPUnit** (khi config đã cache, PHPUnit bỏ qua `phpunit.xml` và có thể chạy `RefreshDatabase` trên MySQL thật).
- ~~Đề xuất: xuất bảng thành mỗi dòng một cột.~~ Đã làm ở giai đoạn 5 (mục 14.4).

## 14. Ghi chú triển khai (giai đoạn 5)

### 14.1 File đã thêm/sửa
- `backend/app/Console/Commands/ImportSurvey1211.php`: lệnh `php artisan survey:import-1211 [--user=ID] [--title=…] [--replace] [--json]`. Dựng form **nháp** (mặc định chủ form là user có id nhỏ nhất), kiểm tra tham chiếu bằng `FieldReferenceValidator` trước khi ghi. Form được đánh dấu `settings.imported_from = "survey-1211"`; `--replace` xóa (mềm) các bản import trước của cùng user nếu chưa có câu trả lời, có câu trả lời thì từ chối. `--json` in `{id, slug, keys}` (mã ngắn → key câu hỏi) cho các script kiểm thử.
- **Form đã dựng: #74** (nháp, chưa xuất bản). Giới hạn mỗi người: bật, căn cứ Email, N = 1, Chặn, thông báo "Ông/Bà đã tham gia khảo sát này. Xin cảm ơn!". Thông điệp sau khi gửi: "Xin chân thành cảm ơn Ông/Bà đã tham gia khảo sát!".
- Builder (`FormQuestion.jsx`): thêm ô **"Hướng dẫn dưới câu hỏi"** (`help_text`, chữ thường, giữ xuống dòng) cho mọi câu hỏi. Trước đây form công khai đã hiển thị `help_text` nhưng builder không có chỗ sửa; bảng hỏi dùng nhiều dòng hướng dẫn kiểu "Có thể chọn nhiều phương án."
- Form công khai: thanh tiến độ tính khối chưa bốc theo số trang dự kiến (`pendingPageCount` trong `formRuntime.js`), trước đây tính là 1 trang nên hiện "Trang 1 / 3" rồi nhảy thành "Trang 2 / 4".
- Test: `tests/Feature/ImportSurveyTest.php` (3 test: cấu trúc hợp lệ, gửi một lượt + chặn trùng email, `--replace`). `tools/test-form-runtime.mjs` thêm 5 kiểm tra cho `pendingPageCount`.
- Tool: `tools/simulate-assign.php [--n=1000]` (import bản tạm, gọi `/assign` qua HTTP kernel của Laravel, mỗi lượt một IP giả để không vướng giới hạn tần suất; in bảng phân bố, kỳ vọng, chi-square, số vi phạm; gọi lại 50 token để xác nhận giữ phiên bản; xóa bản tạm khi xong). `tools/e2e-survey.mjs [--keep] [--shots]` (import bản tạm, xuất bản, điền trọn 4 trang trong trình duyệt, kiểm tra dữ liệu lưu, chặn trùng email, đường đi ngắn nhất, thống kê, Excel 46 cột, xem trước, builder; xóa bản tạm). `tools/db-peek.php` nhận thêm tham số số dòng tối đa.

### 14.2 Cách dựng bảng hỏi (khác/bổ sung so với mục 6)
- Trang 1: câu Email đặt **đầu trang, trước** tiêu đề Phần I. "PHẦN I…" và lời dẫn Câu 1 là mục loại **Mô tả** (không phải ngắt trang), nên trang 1 = mô tả form + Email + Phần I.
- Câu 1: một mục Mô tả (câu hỏi + hướng dẫn) và 3 câu trả lời ngắn "Câu 1 – Sự kiện 1/2/3" (tên cột Excel rõ nghĩa).
- Dòng của Câu 2 và A5 được đánh số "1. …"; tên phiên bản là tên sự kiện không kèm số. Đoạn "Trong các câu hỏi tiếp theo, xin Ông/Bà chỉ tập trung vào sự kiện này…" là **mô tả của từng phiên bản** (hiện ngay dưới tên sự kiện ở trang đầu khối); sửa thì phải sửa ở cả 10 phiên bản.
- Phương án bỏ dấu chấm cuối câu. Dòng hướng dẫn trùng với gợi ý tự sinh ("Chọn tối đa 3 phương án.") được bỏ khỏi `help_text`.
- Phương án "Khác" luôn đứng **cuối** danh sách (giới hạn của renderer), nên ở Câu 4 và Câu 8 nó đứng sau phương án loại trừ, khác thứ tự trong bản Word.
- Lời ngỏ thêm câu "Địa chỉ email Ông/Bà cung cấp chỉ dùng để tránh trả lời trùng lặp." (mục 8).
- Tiêu đề form: "Thăm dò dư luận xã hội về các sự kiện lịch sử và hoạt động kỷ niệm ở Việt Nam hiện nay".

### 14.3 Kết quả kiểm thử (12/11/2026, sau khi chuyển InnoDB và tách cột bảng)
- PHPUnit 39/39; `test-form-runtime` 55/55; `test-form-structure` đạt; E2E builder 23/23, form công khai 45/45, giai đoạn 4 37/37, khảo sát 61/61.
- Mô phỏng 1000 lượt bốc: 0 vi phạm luật loại trừ; khoảng 5% lượt "chưa nghe sự kiện nào" bốc trong toàn bộ; chi-square 5.7–6.1 (ngưỡng nghi ngờ 21.7 ở 9 bậc tự do); gọi lại cùng token 50/50 giữ nguyên phiên bản.

### 14.4 Phát hiện và quyết định
- **Database local từng dùng MyISAM** (cả 16 bảng; `default_storage_engine` của MySQL 9.1 trong WAMP là MyISAM). MyISAM không có transaction và không khóa dòng: `bulk-update` lỗi giữa chừng không được hoàn tác, `lockForUpdate` khi gửi không chặn được hai lần gửi đồng thời (mục 5.6). PHPUnit chạy SQLite nên không phát hiện.
  - **Đã làm (người dùng chọn: chỉ local):** sao lưu `backend/storage/app/backups/eforms_db-before-innodb-20261112-1744.sql`, chuyển cả 16 bảng sang InnoDB bằng `tools/convert-innodb.php` (số dòng không đổi). Khóa ngoại khai báo trong migration không được tạo lại.
  - **Chưa làm:** mặc định của MySQL vẫn là MyISAM, nên bảng do migration mới tạo sẽ lại là MyISAM (chạy lại `tools/convert-innodb.php`, hoặc đặt `default-storage-engine=InnoDB` trong `my.ini` của WAMP). Server production cần tự kiểm tra engine.
- **Excel tách cột bảng (người dùng chọn):** câu dạng bảng (bảng trắc nghiệm, bảng hộp kiểm) xuất **mỗi dòng một cột** "<câu> – <dòng>"; bảng hộp kiểm ghi "C1, C2". Nếu câu trả lời cũ có dòng không còn trong câu hỏi (đã xóa/đổi tên) thì thêm cột "<câu> – dòng khác" dạng "dòng: cột; …" (chỉ xuất hiện khi có dữ liệu như vậy). Form khảo sát: 71 cột. Áp dụng cho cả xuất một câu trả lời.
- Trước khi xuất bản form #74: người dùng duyệt nội dung trong builder/xem trước.
