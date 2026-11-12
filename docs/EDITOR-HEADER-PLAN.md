# Kế hoạch: Header trang sửa form kiểu Google Forms, lưu tự động, hoàn tác/làm lại, cộng tác nhiều người

File này là nguồn duy nhất về phạm vi, quyết định và tiến độ. Chat mới đọc file này để làm tiếp.
Ảnh tham chiếu: header Google Forms, popup "Chia sẻ" của Google Forms, ô chọn loại câu hỏi (do người dùng gửi ngày 12/11/2026).

---

## 1. Trạng thái

| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| 0 | Thảo luận, chốt thiết kế | Đã chốt (12/11/2026) |
| 1 | Backend: vai trò cộng tác viên, kiểm tra quyền tập trung, lời mời, tìm người dùng | Xong (12/11/2026) |
| 2 | Backend: lưu theo thao tác, số phiên bản, nhật ký thay đổi, hiện diện | Xong (12/11/2026) |
| 3 | Frontend: layout trang sửa mới (header + 3 tab), bỏ phần header form khỏi `MainLayout` | Xong (12/11/2026) |
| 4 | Frontend: lưu tự động, chỉ báo lưu, cảnh báo thay đổi phá dữ liệu, hoàn tác/làm lại | Xong (12/11/2026) |
| 5 | Frontend: đồng bộ trực tiếp (polling) + hiện diện | Xong (12/11/2026) |
| 6 | Frontend: popup Chia sẻ, trang nhận lời mời, đăng ký theo lời mời, danh sách form được chia sẻ | Xong (12/11/2026) |
| 7 | Chi tiết giao diện (ô loại câu hỏi, tooltip, mobile) + kiểm thử toàn bộ | Xong (12/11/2026) |

## 2. Môi trường local

- Frontend: `http://eforms.test:5173` (`npm run dev` trong `frontend`)
- Backend: `http://eforms.test` qua Apache WAMP, PHP 8.3: `D:\wamp64\bin\php\php8.3.14\php.exe artisan ...`
- Database: MySQL `eforms_db` (root, không mật khẩu)

## 3. Hiện trạng code (trước khi làm)

- Header nằm trong `frontend/src/layouts/MainLayout.jsx`, dùng chung cho mọi trang. Ở trang sửa form, header nhận các hành động qua `FormBuilderContext` (`setFormBuilderActions`): logo + chữ "eForms", các nút có chữ (Cài đặt, Kết quả, Chia sẻ, Xem trước, Lưu, Xuất bản), menu ⋮ (Nhân bản, Hủy xuất bản, Xóa).
- Trang sửa: `frontend/src/components/FormBuilder/index.jsx`. `frontend/src/pages/forms/FormBuilder.jsx` là bản cũ, không có route nào dùng.
- Chỉ lưu khi bấm Lưu: `formAPI.update` (tiêu đề, mô tả, theme, settings) + `POST /forms/{form}/fields/bulk-update`. API này **xóa mọi câu hỏi không có trong danh sách gửi lên**, nên nếu nhiều người cùng sửa sẽ xóa mất câu hỏi của nhau.
- Theme đang xem thử được giữ trong `localStorage` (`previewTheme_{id}`) cho tới khi bấm Lưu.
- Form đã có câu trả lời: khi Lưu, nếu có thay đổi phá dữ liệu (`destructiveChanges` trong `utils/formStructure.js`) thì hiện `confirm()`.
- Câu trả lời là trang riêng `/forms/:id/responses` (`pages/forms/FormResponses.jsx` + `FormSummary`), chi tiết là `/forms/:id/responses/:responseId`.
- Cài đặt là popup `components/FormSettings.jsx`, có nút Lưu riêng.
- Mỗi câu hỏi đã có `key` ổn định (từ đợt Phần ngẫu nhiên), dùng được làm định danh cho thao tác.
- Ô chọn loại câu hỏi (`.eforms-type-selector` trong `FormQuestion.jsx`) luôn hiển thị, không phụ thuộc `isActive`.
- Backend (Laravel 12, Sanctum token, MySQL):
  - Mỗi form có đúng một chủ (`forms.user_id`). Có khoảng 15 chỗ kiểm tra lặp lại `if ($form->user_id !== $request->user()->id) return 403` trong `FormController`, `FormFieldController`, `FormResponseController`, `ExportController`, `ThumbnailController`.
  - Không có policy, không có cộng tác viên, không có API tìm người dùng.
  - Không có cấu hình email (`MAIL_*`), không có lớp Mail/Notification.
  - `forms.status` là enum('draft','published','closed'). `accept_responses` có cột nhưng `PublicFormController` không kiểm tra. Form công khai chỉ phục vụ khi `published` + `is_public`.
  - Đăng ký (`AuthController@register`): name, email, password (+ confirmation), trả token. Không xác thực email.
  - `FormController@update` nhận cập nhật từng phần. Không kiểm tra xung đột phiên bản.

---

## 4. Quyết định đã chốt

### 4.1 Header (hàng 1), thứ tự giống Google Forms

Từ trái sang phải:

1. Icon logo (không có chữ "eForms"), bấm vào thì về danh sách form.
2. Tiêu đề form: bấm vào để sửa tại chỗ, đồng bộ hai chiều với thẻ tiêu đề trong tab Câu hỏi. Ngay sau là **nhãn trạng thái** và **chỉ báo lưu** (mục 4.4).
3. (khoảng trống)
4. Avatar những người đang mở form (hiện diện, mục 4.7).
5. Tùy chỉnh giao diện (icon bảng màu): mở panel `FormTheme` hiện có.
6. Xem trước (icon mắt): mở `/forms/:id/preview` ở tab mới như hiện nay.
7. Hoàn tác, Làm lại.
8. Sao chép đường liên kết của người trả lời (icon liên kết). Nếu form chưa xuất bản: toast "Biểu mẫu chưa được xuất bản" kèm nút "Xuất bản".
9. Thêm cộng tác viên (icon người +): mở popup Chia sẻ (mục 4.8).
10. Nút xuất bản (mục 4.5).
11. Menu ⋮: Nhân bản, Xóa (chỉ Chủ sở hữu).
12. Avatar/menu người dùng.

- Các nút chỉ có icon. Rê chuột (hoặc focus bằng bàn phím) thì hiện tooltip tối màu như Google, dùng chung một component `Tooltip`, không dùng `title` mặc định của trình duyệt.
- Mỗi nút có `aria-label`.
- Mobile: giữ logo, tiêu đề, chỉ báo lưu, Hoàn tác/Làm lại, nút xuất bản. Các nút còn lại dồn vào menu ⋮.
- Người xem (vai trò chỉ xem): ẩn Hoàn tác/Làm lại, Giao diện, nút xuất bản; tiêu đề không sửa được; có nhãn "Chỉ xem".

### 4.2 Header (hàng 2): ba tab

| Tab | URL | Nội dung |
|---|---|---|
| Câu hỏi | `/forms/:id/edit` | Màn hình sửa form hiện tại |
| Câu trả lời (kèm số lượng) | `/forms/:id/responses`, chi tiết `/forms/:id/responses/:responseId` | Trang Xem kết quả hiện tại |
| Cài đặt | `/forms/:id/settings` | Nội dung popup Cài đặt hiện tại, chuyển thành trang |

- Một layout mới `FormEditorLayout` bọc cả ba tab. Header và trạng thái form (dữ liệu, lưu tự động, đồng bộ, hiện diện) sống trong layout, nên chuyển tab không tải lại form và không mất lịch sử hoàn tác.
- `MainLayout` bỏ toàn bộ phần header riêng của trang sửa form. Bỏ `FormBuilderContext` nếu không còn ai dùng.
- Popup `FormSettings` được bỏ. Nội dung được tách thành component dùng cho tab Cài đặt.

### 4.3 Tạo form

- Bấm "Tạo biểu mẫu" thì tạo ngay bản nháp trên server ("Biểu mẫu không có tiêu đề"), rồi chuyển tới `/forms/:id/edit`. Như vậy lưu tự động luôn có `id`.
- Route `/forms/create` chuyển thành bước tạo rồi chuyển hướng như trên.

### 4.4 Lưu tự động

- Bỏ nút Lưu.
- Mỗi thay đổi sinh ra một hoặc nhiều **thao tác** (mục 4.9) đưa vào hàng đợi. Hàng đợi được gửi sau 1,5 giây kể từ lần sửa cuối.
- Gửi ngay khi: chuyển tab, đóng/ẩn trang (`visibilitychange`, `pagehide`, dùng `fetch` với `keepalive` để mang được header Bearer), hoặc bấm Xem trước.
- Chỉ báo lưu cạnh tiêu đề:
  - "Đang lưu…"
  - "Đã lưu lúc HH:mm" (rê chuột vào thì hiện ngày giờ đầy đủ)
  - "Có thay đổi chưa lưu" khi đang tạm dừng (mục 4.6)
  - "Không lưu được – Thử lại" khi lỗi. Tự thử lại với độ trễ tăng dần, và chặn rời trang (`beforeunload`) nếu còn thay đổi chưa gửi.
- Lỗi kiểm tra dữ liệu (422) từ server: hiện thông báo như hiện nay và chọn câu hỏi bị lỗi. Thao tác lỗi được giữ lại trong hàng đợi để sửa.
- Theme lưu tự động như mọi thay đổi khác. Bỏ cơ chế `previewTheme` trong `localStorage`.
- Tab Cài đặt cũng lưu tự động: công tắc lưu ngay, ô số/văn bản lưu sau 1,5 giây.
- Ảnh thu nhỏ (`captureFormThumbnail`) không chụp sau mỗi lần lưu nữa. Chỉ chụp khi rời trang sửa, hoặc tối đa mỗi 2 phút nếu có thay đổi.
- Form đã xuất bản: thay đổi được lưu tự động và có hiệu lực ngay với người trả lời, giống hành vi hiện tại sau khi bấm Lưu (xem mục 7).

### 4.5 Nút xuất bản và nhãn trạng thái (như Google)

| Trạng thái | Nhãn cạnh tiêu đề | Nút |
|---|---|---|
| `draft` | "Bản nháp" (xám) | "Xuất bản" (màu chính) |
| `published` | "Đang nhận câu trả lời" (xanh lá) | "Đã xuất bản" (viền), bấm vào mở popup |
| `closed` | "Không nhận câu trả lời" (đỏ/cam) | "Đã xuất bản" (viền), bấm vào mở popup |

- Popup của nút "Đã xuất bản" gồm: công tắc "Nhận câu trả lời" (chuyển `published` ↔ `closed`), nút "Sao chép liên kết", nút "Hủy xuất bản" (về `draft`).
- Backend: `PublicFormController` phải trả thông báo rõ ràng "Biểu mẫu không còn nhận câu trả lời" cho form `closed` (cả khi tải form và khi nộp), thay vì 404.
- Bỏ "Hủy xuất bản" khỏi menu ⋮ vì đã có trong popup.

### 4.6 Thay đổi phá dữ liệu (form đã có câu trả lời)

- Trước khi gửi hàng đợi, nếu form đã có câu trả lời và thao tác thuộc loại phá dữ liệu (xóa câu hỏi, đổi loại câu, xóa/sửa lựa chọn… theo `destructiveChanges`), thì **tạm dừng lưu tự động** cho các thao tác đó.
- Hiện thanh cảnh báo dưới header: "Thay đổi này ảnh hưởng tới N câu trả lời đã thu: …" với hai nút [Vẫn lưu] và [Hoàn tác].
- Các thao tác không phá dữ liệu vẫn được lưu bình thường.

### 4.7 Đồng bộ trực tiếp và hiện diện

- Truyền thay đổi bằng **polling** mỗi 2,5 giây (khi tab ẩn: 15 giây). Lớp truyền tải được tách riêng (`syncTransport`) để sau này chuyển sang WebSocket (Laravel Reverb) mà không sửa logic.
- Mỗi lần poll gửi `since=<revision>` + thông tin hiện diện (câu hỏi đang chọn). Server trả các thao tác của người khác từ revision đó + danh sách người đang mở form.
- Thao tác từ người khác được áp vào store **không** đánh dấu cần lưu và **không** vào lịch sử hoàn tác.
- Ô nhập đang được người dùng gõ không bị ghi đè giữa chừng. Giá trị từ xa được áp khi ô mất focus, nếu người dùng không sửa ô đó.
- Nếu khoảng cách revision quá lớn hoặc server báo nhật ký đã bị dọn: tải lại toàn bộ form (giữ hàng đợi chưa gửi rồi áp lại).
- **Hai người cùng sửa một câu hỏi:** làm theo hành vi quan sát được của Google Forms. Không khóa; ai lưu sau thắng **theo từng thuộc tính** (nội dung câu, mô tả, từng lựa chọn, bắt buộc…), không ghi đè cả câu hỏi.
- **Hiện diện:**
  - Avatar (chữ cái đầu, màu riêng mỗi người) trên header.
  - Câu hỏi đang được người khác chọn có viền màu của người đó + nhãn tên nhỏ.
  - Người dùng biến mất khỏi danh sách sau 30 giây không gửi poll.

### 4.8 Chia sẻ và vai trò

**Ba vai trò:** Chủ sở hữu, Người chỉnh sửa, Người xem.

| Quyền | Chủ sở hữu | Người chỉnh sửa | Người xem |
|---|---|---|---|
| Xem câu hỏi, cài đặt | ✓ | ✓ | ✓ (chỉ đọc) |
| Sửa câu hỏi, giao diện, cài đặt | ✓ | ✓ | |
| Xuất bản / đóng / hủy xuất bản | ✓ | ✓ | |
| Xem câu trả lời (tổng hợp + chi tiết), xuất Excel | ✓ | ✓ | ✓ |
| Xóa câu trả lời | ✓ | ✓ | |
| Nhân bản form (bản sao thuộc về người nhân bản) | ✓ | ✓ | ✓ |
| Mời/gỡ/đổi vai trò Người chỉnh sửa, Người xem | ✓ | ✓ | |
| Thêm/gỡ Chủ sở hữu | ✓ | | |
| Xóa form | ✓ | | |

- Có thể có nhiều Chủ sở hữu ngang quyền. Luôn phải còn ít nhất một Chủ sở hữu (server chặn việc gỡ hoặc hạ vai trò Chủ sở hữu cuối cùng).
- Người dùng có thể tự rời khỏi form, trừ khi là Chủ sở hữu cuối cùng.

**Popup Chia sẻ (theo hình 2):**

- Ô "Thêm người theo tên hoặc email":
  - Gợi ý khi gõ từ 3 ký tự, tối đa 8 kết quả, khớp theo tên hoặc email, loại những người đã có quyền.
  - Gõ một email chưa có tài khoản thì hiện lựa chọn "Mời <email>".
  - Chọn vai trò trước khi gửi. Có thể kèm lời nhắn và tùy chọn "Gửi email thông báo".
- "Những người có quyền truy cập": avatar, tên, email, "(bạn)", và ô chọn vai trò (Chủ sở hữu / Người chỉnh sửa / Người xem / Gỡ quyền truy cập). Ô chọn bị khóa theo bảng quyền.
- "Lời mời đang chờ": email, vai trò, hạn. Các nút: Sao chép link mời, Gửi lại email, Hủy lời mời.
- "Quyền truy cập chung":
  - Người chỉnh sửa: cố định "Hạn chế", chỉ người có quyền mới mở được.
  - Người trả lời: "Bất kỳ ai có đường liên kết" hoặc "Yêu cầu đăng nhập". Gắn với `require_login` / `respondent_limit` hiện có và đồng bộ với tab Cài đặt (dùng chung logic, kể cả quy tắc `respondent_limit.account` buộc `require_login`).
- Chân popup: nút "Sao chép đường liên kết của người trả lời" + nút "Xong".
- Người xem mở popup: chỉ thấy danh sách, không sửa được.

**Gửi lời mời (cả email lẫn link):**

- Tạo lời mời thì luôn sinh link `/invite/{token}`. Token ngẫu nhiên 40+ ký tự, DB chỉ lưu bản băm, gắn với email được mời, hết hạn sau 7 ngày, dùng một lần.
- Nếu đã cấu hình SMTP (`MAIL_MAILER` khác `log`/`array`), gửi email mời bằng Mailable (tiếng Việt). Nếu chưa, popup báo "Chưa cấu hình email – hãy sao chép link mời để gửi".
- Mời người **đã có** tài khoản: thêm quyền ngay, không cần lời mời. Gửi email thông báo nếu có SMTP và người mời chọn "Gửi email thông báo".

**Trang nhận lời mời `/invite/:token`:**

- Token hỏng hoặc hết hạn: báo lỗi và hướng dẫn xin mời lại.
- Đã đăng nhập đúng email: nhận lời mời rồi chuyển tới form (tab theo vai trò: Người xem vào Câu hỏi ở chế độ chỉ đọc).
- Đã đăng nhập nhưng khác email: báo "Lời mời gửi tới <email>", có nút đăng xuất để đăng nhập đúng tài khoản.
- Chưa đăng nhập, email chưa có tài khoản: chuyển sang trang Đăng ký. Email điền sẵn và khóa lại, `invite_token` được gửi kèm. Đăng ký thành công thì nhận lời mời và vào thẳng form.
- Chưa đăng nhập, email đã có tài khoản: chuyển sang Đăng nhập (điền sẵn email). Đăng nhập xong thì nhận lời mời và vào form.

**Danh sách form (`FormList`):**

- Hiện cả form của tôi và form được chia sẻ với tôi, có bộ lọc "Tất cả / Của tôi / Được chia sẻ".
- Mỗi thẻ form có biểu tượng chia sẻ, tên chủ sở hữu và vai trò của tôi.

### 4.9 Hoàn tác / Làm lại

- Áp dụng cho: câu hỏi (thêm, xóa, sửa, đổi loại, kéo thả, nhân bản, phần ngẫu nhiên), tiêu đề/mô tả form, giao diện. Không áp dụng cho tab Cài đặt.
- Mỗi thao tác cục bộ lưu kèm thao tác ngược. Lịch sử tối đa 100 bước, chỉ trong phiên làm việc (mất khi tải lại trang).
- Gõ chữ liên tiếp trên cùng một thuộc tính được gộp thành một bước (ngắt khi dừng 1 giây hoặc mất focus).
- Chỉ hoàn tác thao tác của chính mình. Nếu thuộc tính hoặc câu hỏi đã bị người khác sửa/xóa sau đó, bước hoàn tác đó bị bỏ qua và có toast "Không thể hoàn tác vì <tên> đã thay đổi nội dung này".
- Hoàn tác/làm lại sinh thao tác mới, đi qua lưu tự động như mọi thay đổi khác.
- Phím tắt: Ctrl+Z (hoàn tác), Ctrl+Y và Ctrl+Shift+Z (làm lại). Chỉ có tác dụng khi focus **không** nằm trong ô nhập. Trong ô nhập, trình duyệt tự hoàn tác văn bản.
- Nút bị mờ khi không có gì để hoàn tác/làm lại. Tooltip ghi rõ việc sẽ làm, ví dụ "Hoàn tác: Xóa câu hỏi 'Họ tên'".

### 4.10 Ô chọn loại câu hỏi

- `.eforms-type-selector` (hình 3) chỉ hiển thị khi câu hỏi đang được chọn (`isActive`). Bấm ra ngoài thì ẩn, đồng thời đóng dropdown nếu đang mở.
- Kiểm tra `RandomSectionCard.jsx` và các thẻ khác có ô tương tự để áp dụng cùng quy tắc.

---

## 5. Thiết kế kỹ thuật

### 5.1 Database (migration mới `2026_11_13_xxxxxx_*`)

- `form_collaborators`: id, form_id (cascade), user_id (cascade), role enum('owner','editor','viewer'), added_by (nullable), timestamps, unique(form_id, user_id).
  - Migration chèn mỗi form hiện có một dòng `owner` cho `forms.user_id`.
  - `forms.user_id` được giữ làm "người tạo" để tương thích. Quyền chỉ lấy từ `form_collaborators`.
- `form_invitations`: id, form_id, email(191), role enum('owner','editor','viewer'), token_hash(64, unique), invited_by, message (nullable), expires_at, accepted_at (nullable), accepted_by (nullable), timestamps.
- `forms.revision` (unsigned bigint, mặc định 0): tăng sau mỗi lô thao tác.
- `form_changes`: id (bigint tự tăng), form_id, revision, user_id, client_id(64), ops json, created_at, index(form_id, revision). Tự dọn bản ghi cũ hơn 24 giờ bằng lệnh schedule.
- `form_presence`: form_id, user_id, client_id, active_field_key (nullable), last_seen_at, primary(form_id, client_id). Có thể chuyển sang cache sau.
- Đã làm (Giai đoạn 2, migration `2026_11_13_000001`): `form_changes` có unique(form_id, revision) + index(created_at), `client_id` nullable (thao tác từ API cũ không có client). Lệnh `forms:prune-changes {--hours=24}` chạy **mỗi giờ**: xóa `form_changes` cũ hơn 24 giờ và `form_presence` cũ hơn 1 giờ.
- Migration `2026_11_13_000002` (chỉ MySQL): MySQL local mặc định MyISAM nên `form_collaborators`/`form_invitations` của Giai đoạn 1 được tạo không có transaction/khóa ngoại → chuyển sang InnoDB và thêm khóa ngoại. Bảng mới khai báo `engine('InnoDB')`.

### 5.2 Kiểm tra quyền tập trung

- `App\Policies\FormPolicy` với các ability `view`, `update`, `manageResponses`, `share`, `manageOwners`, `delete`. Thêm quan hệ `Form::collaborators()`, `Form::roleFor(User)`, `User::sharedForms()`.
- Thay toàn bộ khoảng 15 chỗ kiểm tra `user_id` bằng `$this->authorize(...)` theo bảng quyền ở mục 4.8.
- `FormController@index` trả cả form được chia sẻ, kèm `my_role` và `owner`.
- Các response JSON của form trả thêm `my_role` để frontend ẩn/khóa thao tác.

### 5.3 API mới

| Method | Đường dẫn | Mục đích |
|---|---|---|
| GET | `/users/search?q=` | Gợi ý người dùng (≥3 ký tự, tối đa 8, chỉ trả id, tên, email), có throttle |
| GET | `/forms/{form}/collaborators` | Danh sách người có quyền + lời mời đang chờ |
| POST | `/forms/{form}/collaborators` | Thêm theo `user_id` hoặc `email` + `role` (+ `notify`, `message`). Email chưa có tài khoản thì tạo lời mời |
| PATCH | `/forms/{form}/collaborators/{user}` | Đổi vai trò |
| DELETE | `/forms/{form}/collaborators/{user}` | Gỡ quyền / tự rời |
| POST | `/forms/{form}/invitations/{invitation}/resend` | Gửi lại email, gia hạn 7 ngày |
| DELETE | `/forms/{form}/invitations/{invitation}` | Hủy lời mời |
| GET | `/invitations/{token}` (công khai) | Thông tin lời mời: tên form, người mời, email, vai trò, email đã có tài khoản chưa |
| POST | `/invitations/{token}/accept` | Nhận lời mời (đã đăng nhập, đúng email) |
| POST | `/register` (sửa) | Nhận thêm `invite_token`: email phải khớp lời mời, đăng ký xong thì nhận lời mời và trả `form_id` |
| POST | `/forms/{form}/ops` | Gửi lô thao tác `{client_id, base_revision, ops[]}`. Trả `{revision, applied, rejected[]}` |
| GET | `/forms/{form}/changes?since=&client_id=&active_field=` | Thao tác của người khác từ `since` + danh sách hiện diện. Đồng thời ghi nhận hiện diện. Trả `{revision, changes[], presence[], reset?}` |

- `bulk-update` cũ được giữ cho các luồng khác (nhân bản…), trang sửa không dùng nữa.

**Đã làm ở Giai đoạn 1 – quyết định và dạng dữ liệu cho frontend:**

- `my_role`: `"owner" | "editor" | "viewer"` (có trong show/store/update/duplicate của form và mỗi phần tử của `GET /forms`).
- `GET /forms?filter=all|mine|shared`: "Của tôi" = tôi là Chủ sở hữu; "Được chia sẻ" = tôi là Người chỉnh sửa/Người xem. Mỗi form thêm `my_role`, `owner {id,name,email}` (người tạo nếu còn là chủ, nếu không thì chủ đầu tiên), `collaborators_count` (>1 thì hiện biểu tượng chia sẻ).
- `GET /forms/{form}/collaborators` → `{my_role, collaborators: [{id,name,email,role,is_me}] (chủ → chỉnh sửa → xem, theo tên), invitations: [{id,email,role,message,expires_at,expired,invited_by{id,name},created_at}], mail_enabled}`. Người xem nhận `invitations: []` (không lộ email người được mời).
- `POST /forms/{form}/collaborators` `{user_id | email, role, notify? (mặc định true), message?}` → 201:
  - Tài khoản đã có: `{type:"collaborator", collaborator:{...}, email_sent, mail_enabled}`; đã có quyền rồi thì 422.
  - Email chưa có tài khoản: `{type:"invitation", invitation:{...}, invite_url, email_sent, mail_enabled}`. Mời lại cùng email thì thay lời mời đang chờ (link cũ hết hiệu lực).
  - `email_sent:false` + `mail_enabled:false` → popup hiện "Chưa cấu hình email – hãy sao chép link mời để gửi".
- **Sao chép link mời của lời mời đang chờ:** DB chỉ lưu bản băm nên không lấy lại được link cũ. Thêm `POST /forms/{form}/invitations/{invitation}/link`: sinh token mới, gia hạn 7 ngày, trả `invite_url` (link cũ hết hiệu lực). `.../resend` làm như vậy và gửi email nếu có SMTP. Cả hai trả `{invitation, invite_url, email_sent, mail_enabled}`.
- `PATCH`/`DELETE /forms/{form}/collaborators/{user}`: gỡ/hạ Chủ sở hữu cuối cùng → 422 `errors.role`. Tự rời: `DELETE` chính mình (mọi vai trò, trừ chủ cuối cùng).
- `GET /invitations/{token}` → `{email, role, expires_at, form{id,title}, inviter{name}, has_account}`. Lỗi: 404 `reason:"invalid"`, 410 `reason:"expired"|"used"`. `POST /invitations/{token}/accept` → `{form_id, role}`; sai email → 403 `{reason:"wrong_email", email}`. Đã có quyền thì giữ vai trò cao hơn.
- `POST /register` + `invite_token`: email phải khớp (422 `errors.email`), token hỏng/hết hạn → 422 `errors.invite_token`; thành công trả thêm `form_id`, `form_role`.
- `GET /users/search?q=&form_id=` → `{users:[{id,name,email}]}`; `q` < 3 ký tự → 422; tối đa 8; luôn loại chính mình, có `form_id` thì loại người đã có quyền (cần quyền `share`); throttle 60/phút.
- Form công khai `closed`: `GET /forms/public/{slug}` trả 200 với `closed:true, accepting:false, message:"Biểu mẫu không còn nhận câu trả lời.", fields:[]` (giữ tiêu đề/giao diện); `submit`/`assign` trả 403 `{message, closed:true}`. Bản nháp vẫn 404.
- Không có quyền → 403 (`This action is unauthorized.`), thay cho `Unauthorized` cũ.
- Nhân bản: bản sao thuộc về người nhân bản (`user_id` = người đó, vai trò owner).
- Tạo form (mọi đường, kể cả nhân bản/import) tự thêm dòng `owner` cho `forms.user_id` (sự kiện `created` của model).

**Đã làm ở Giai đoạn 2 – dạng dữ liệu cho frontend:**

- Mọi JSON form (show/store/update/duplicate/index) có `revision` (số nguyên). Client lấy làm mốc `since` đầu tiên. Bản nhân bản bắt đầu từ 0.
- `POST /forms/{form}/ops` (quyền `update`, Người xem 403) body `{client_id (≤64), base_revision? (chỉ để tham khảo, không dùng để chặn xung đột), ops[1..500]}` → luôn 200:
  `{revision, applied:[{index, op}], rejected:[{index, type, key?, reason, message, errors?}]}`.
  - `op` trong `applied` là thao tác **đã chuẩn hóa như đã áp** (vd. `after_key` thực tế, `label` null → `""`, `require_login:true` bị ép thêm, `data.id` của câu mới). Đây cũng là nội dung ghi vào `form_changes` và gửi cho người khác.
  - `revision` tăng 1 nếu lô có ≥1 thao tác được áp (một dòng `form_changes`); không áp được gì thì giữ nguyên, không ghi log.
  - `reason`: `invalid` (sai dạng/không qua kiểm tra; `errors` dạng `{"set.label":[…]}` / `{"data.type":[…]}`), `unknown_type`, `deleted` (không còn câu có `key` này – đã bị xóa hoặc chưa từng có; áp cho update/move/delete), `exists` (insert trùng `key`), `structure` (kiểm tra tham chiếu cuối lô; `errors` dạng `{"fields.<key>.<thuộc tính>":[…]}` để chọn câu lỗi).
- `GET /forms/{form}/changes?since=&client_id=&active_field=` (quyền `view`, Người xem cũng poll được) → `{revision, changes:[{revision, user:{id,name}|null, client_id, ops}], presence:[{user_id, name, client_id, active_field_key}], reset}`.
  - Ghi nhận hiện diện (upsert theo form_id + client_id). `presence` bỏ client hiện tại và các dòng quá 30 giây; sắp theo tên. Cùng người mở 2 tab = 2 dòng (frontend tự gộp theo `user_id`).
  - `changes` bỏ các lô của chính `client_id`, tăng dần theo `revision`.
  - `reset:true` (khi đó `changes:[]`) nếu: `since > revision`; `revision - since > 200`; nhật ký đã bị dọn (thiếu revision trong khoảng); hoặc có lô của người khác chứa `form.reload`. Khi `reset`: tải lại `GET /forms/{id}`, lấy `revision` mới, áp lại hàng đợi chưa gửi.
- API cũ vẫn chạy và báo cho trình sửa đang mở (header tùy chọn `X-Client-Id` để bỏ qua chính mình):
  - `PUT /forms/{form}`: nếu có cột thay đổi (trừ `thumbnail`) → tăng revision + ghi `form.update {set: các cột đã đổi}` (không bắt tải lại).
  - `fields` store/update/destroy/reorder/bulk-update → tăng revision + ghi `{type:"form.reload"}`.
- Quy tắc kiểm tra dùng chung: `App\Services\Forms\EditorRules` (dùng bởi `FormController@update`, `FormFieldController`, ops). Thay đổi nhỏ so với trước: các cột giao diện NOT NULL (`primary_color`… `text_font_size`) gửi `null` → 422 thay vì lỗi 500; `label` null được lưu là `""`; bulk-update giờ kiểm tra cả kiểu từng thuộc tính câu hỏi.

### 5.4 Thao tác (ops)

Định danh câu hỏi bằng `key`.

- `field.insert {key, after_key, data}`
- `field.update {key, set: {prop: value}}`: chỉ các thuộc tính thay đổi, ai đến sau thắng theo từng thuộc tính
- `field.delete {key}`
- `field.move {key, after_key}`: server sắp lại `order` theo thứ tự gửi đến
- `form.update {set: {title|description|theme props|settings props}}`

Quy tắc:

- Server áp cả lô trong một transaction, kiểm tra dữ liệu bằng cùng các quy tắc `FormFieldController` đang dùng (tách ra dùng chung), rồi ghi `form_changes`.
- Một thao tác lỗi thì trả trong `rejected` kèm lý do, các thao tác khác vẫn được áp.
- Câu hỏi đã bị xóa mà vẫn nhận `field.update`: bỏ qua và báo lại cho client.
- Các thao tác trên phần ngẫu nhiên (khối nhiều câu) được biểu diễn bằng nhiều thao tác cơ bản trong cùng một lô.

**Đã làm ở Giai đoạn 2 – dạng chính xác (`App\Services\Forms\FormOpsApplier`):**

- `field.insert {key (≤64), after_key: string|null, data}`: `data` chỉ lấy các thuộc tính sửa được (bỏ qua `id`, `order`, `form_id`… nếu có), `type` bắt buộc. `after_key: null` = đầu danh sách; `after_key` không còn tồn tại → thêm vào **cuối** (op chuẩn hóa ghi `after_key` thực tế). Op chuẩn hóa có `data` đầy đủ mọi thuộc tính + `data.id`.
- `field.update {key, set}`: chỉ ghi các thuộc tính có trong `set`. Thuộc tính sửa được: `type, label, description, image_url, video_url, placeholder, help_text, options, rows, columns, validation_rules, is_required, conditional_logic, settings, random_group_key, variant_key`. `key`, `order`, `id` → `invalid` (đổi vị trí dùng `field.move`).
- **Mức "từng thuộc tính":**
  - Cột thường: cả giá trị (văn bản ghi đè cả ô).
  - `settings` và `validation_rules` (object JSON): gửi `"settings.<tên>": giá trị` để chỉ đổi một mục cấp 1 (vd. `settings.other_option`, `settings.min_select`, `settings.piped_from`); giá trị `null` = xóa mục đó. Chỉ một cấp (`settings.filter` là một mục, gửi cả object `filter`). Gửi `settings: {...}` = thay cả object. Trong cùng `set`, thuộc tính nguyên được áp trước rồi mới tới `settings.<tên>`.
  - `options`, `rows`, `columns` (mảng chuỗi, không có id riêng): **thay cả mảng**. Lệch so với mục 4.7 "từng lựa chọn": hai người cùng lúc sửa hai lựa chọn khác nhau của cùng một câu thì người lưu sau thắng cả danh sách. Muốn gộp từng lựa chọn cần thêm id cho lựa chọn (đổi dữ liệu câu trả lời) – để sau nếu cần.
  - `conditional_logic`: cả object.
- `field.delete {key}`; `field.move {key, after_key: string|null}` (cùng quy tắc `after_key` như insert, `after_key == key` → `invalid`). Server đánh lại `order` = 0..n-1 sau mỗi lô.
- `form.update {set}`: `title, description, status`, giao diện (`primary_color, secondary_color, background_color, header_image, font_family, header_font_size, question_font_size, text_font_size`), cài đặt (`is_public, accept_responses, show_progress_bar, shuffle_questions, limit_responses, max_responses, require_login, custom_thank_you_message, respondent_limit, settings`). `settings.<tên>` và `respondent_limit.<tên>` đổi một mục như trên. Nếu sau khi gộp `respondent_limit` bật với phương thức `account` thì server ép `require_login:true` (có trong op chuẩn hóa). Không nhận `thumbnail` (dùng endpoint riêng).
- **Kiểm tra cấu trúc (điều kiện, câu nguồn, bộ lọc, khối ngẫu nhiên) chạy một lần ở cuối lô** bằng `FieldReferenceValidator`, nên trạng thái trung gian trong lô được phép sai. Chỉ tính lỗi **mới** so với trước lô (form cũ đã sai sẵn vẫn sửa nội dung được). Nếu có lỗi mới: loại dần các thao tác có thể gây lỗi (insert/delete/move và update có `type, conditional_logic, settings*, random_group_key, variant_key`), hẹp trước: thao tác trên câu bị lỗi → trên câu mà câu lỗi tham chiếu (vd. xóa câu đang được điều kiện dùng) → mọi thao tác cấu trúc; rồi áp lại lô. Các thao tác bị loại có `reason:"structure"`. Thao tác chỉ đổi nội dung (nhãn, lựa chọn…) không bao giờ bị loại vì lỗi cấu trúc.
- **Phần ngẫu nhiên dưới dạng thao tác cơ bản (cùng một lô):** tạo khối = `field.insert` câu tiêu đề `random_section` (settings variants/mode/pick_count) + `field.insert`/`field.update {random_group_key}` + `field.move` cho từng câu thành viên, đứng liền sau tiêu đề. Xóa khối = `field.delete` tiêu đề + mọi thành viên. Đổi phiên bản/chế độ = `field.update` tiêu đề (`settings.variants`, `settings.mode`…) + `field.update {variant_key}` các thành viên. Gửi thiếu (vd. chỉ thêm thành viên) → `structure`.
- Server không chặn thay đổi phá dữ liệu (form đã có câu trả lời); việc tạm dừng/cảnh báo là của frontend (mục 4.6).
- Các lô được tuần tự hóa bằng khóa dòng `forms` (`SELECT … FOR UPDATE`) nên "ai đến sau" = lô commit sau.

### 5.5 Frontend: cấu trúc mới

- `layouts/FormEditorLayout.jsx`: tải form, giữ store, render `EditorHeader` + `<Outlet/>` cho 3 tab.
- `components/editor/`:
  - `EditorHeader.jsx`, `HeaderIconButton.jsx` + `Tooltip.jsx`
  - `StatusBadge.jsx`, `SaveIndicator.jsx`
  - `PublishButton.jsx` (popover), `PresenceAvatars.jsx`
  - `ShareDialog.jsx`, `DestructiveBanner.jsx`
- `store/formStore.js` được viết lại quanh thao tác. Mỗi hành động hiện có (`updateField`, `insertFields`, `removeField`, `duplicateField`, `reorderFields`…) sinh `ops` + `inverseOps`, đẩy vào hàng đợi lưu và lịch sử hoàn tác. Thêm `applyRemoteOps`.
- `services/autosave.js` (hàng đợi, debounce, thử lại, keepalive), `services/syncTransport.js` (polling, sau này WebSocket), `utils/ops.js` (áp/đảo thao tác, dùng chung cho cục bộ và từ xa).
- `pages/forms/FormSettingsTab.jsx` (tách nội dung từ `FormSettings.jsx`), `pages/Invite.jsx`. `Register.jsx`/`Login.jsx` nhận `?invite=`.
- `App.jsx`: route lồng `/forms/:id` → `edit | responses | responses/:responseId | settings`, thêm `/invite/:token`.

**Đã làm ở Giai đoạn 3 – cấu trúc thực tế và điểm nối cho giai đoạn sau:**

- `layouts/FormEditorLayout.jsx`: route `/forms/:id` (index → `edit`). Tải form **một lần** (`GET /forms/{id}`) vào `useFormStore.loadForm`, render `EditorHeader` + `<Outlet context={editor}/>`. Các tab lấy trạng thái bằng `useEditor()` (= `useOutletContext`): `form, role, canEdit, readOnly, isOwner, theme, showTheme/openTheme, save, saveSettings, saving, savedAt, dirty, changeStatus, statusBusy, copyLink, openPreview, openShare, duplicate, remove, presence, activeQuestionIndex/setActiveQuestionIndex, responseCount`. `FormResponses`/`ResponseDetail` dùng `form` từ layout (không gọi lại `GET /forms/{id}`); chỉ còn tải danh sách/chi tiết câu trả lời.
- `store/formStore.js`: thêm `title`, `description`, `metaDirty`, `loadForm`, `setMeta`, `markMetaSaved`, `patchForm` (gộp thuộc tính form như `status`, cài đặt mà không đụng câu hỏi). Tiêu đề header và thẻ tiêu đề cùng đọc/ghi `title` trong store (đồng bộ hai chiều).
- **Lưu tạm thời (Giai đoạn 4 thay):** `save()` trong layout = logic Lưu cũ chuyển từ `FormBuilder` (PUT form + `bulk-update` nếu `isDirty`, `confirm()` phá dữ liệu, theme `previewTheme_{id}` trong `localStorage`, chụp ảnh thu nhỏ sau mỗi lần lưu). Gọi từ nút icon **Lưu** (`data-hdr="save"`, ngay sau Làm lại) và Ctrl+S. `saveSettings()` lưu câu hỏi đang sửa trước (như cũ). Xuất bản bản nháp đang có thay đổi chưa lưu thì lưu trước rồi mới đổi trạng thái. Giai đoạn 4: thay `save`/`saveSettings` bằng `services/autosave.js`, bỏ nút Lưu + Ctrl+S, nối `SaveIndicator` (props `saving/dirty/savedAt`, thêm trạng thái tạm dừng/lỗi), bật `Undo/Redo` (đang `disabled`, `data-hdr="undo|redo"`), thêm `DestructiveBanner` dưới header trong layout.
- `components/editor/`: `EditorHeader` (hàng 1 + hàng tab), `HeaderIconButton` + `Tooltip` (portal, tối màu, hiện khi hover/focus bằng bàn phím, Esc để ẩn; header không còn `title`), `StatusBadge`, `SaveIndicator`, `PublishButton` (popover: công tắc Nhận câu trả lời `published↔closed`, Sao chép liên kết, Hủy xuất bản), `PresenceAvatars` (nhận `users=[{user_id,name}]`, hiện chưa có dữ liệu – Giai đoạn 5 truyền `editor.presence`; `presenceColor(userId)` dùng lại cho viền câu hỏi), `ShareDialog` (**bản tạm, chỉ đọc**: danh sách người có quyền từ `GET /collaborators` + nút sao chép link + Xong – Giai đoạn 6 viết đầy đủ, mở qua `editor.openShare`), `useDismiss`. `components/UserMenu.jsx` dùng chung cho `MainLayout` và header (trên mobile các mục tài khoản nằm trong ⋮).
- Mọi phần tử header có `data-hdr` (logo, title, status, save-indicator, presence, theme, preview, undo, redo, save, copy-link, share, publish, more, user; người xem có `readonly`), tab có `data-tab` – dùng cho E2E.
- Vai trò: Người xem ẩn Hoàn tác/Làm lại/Lưu/Giao diện/Xuất bản, tiêu đề là chữ thường, nhãn "Chỉ xem"; tab Câu hỏi đặt `inert` lên `.eforms-main` và ẩn thanh công cụ bên (chỉ đọc mức rẻ – chỉnh tiếp ở Giai đoạn 7); tab Cài đặt dùng `<fieldset disabled>` và ẩn nút lưu; tab Câu trả lời ẩn nút xóa. ⋮: Nhân bản (mọi vai trò), Xóa (chỉ Chủ sở hữu). "Hủy xuất bản" đã bỏ khỏi ⋮.
- Mobile (< 768px): hiện logo, tiêu đề, chỉ báo lưu (chỉ icon), Hoàn tác/Làm lại, Lưu, nút xuất bản, ⋮. Ẩn nhãn trạng thái; Giao diện, Xem trước, Sao chép liên kết, Thêm cộng tác viên và các mục tài khoản dồn vào ⋮.
- `/forms/create` → `pages/forms/CreateForm.jsx`: tạo bản nháp "Biểu mẫu không có tiêu đề" rồi `replace` sang `/forms/:id/edit` (có chặn chạy 2 lần do StrictMode).
- Cài đặt: `components/FormSettings.jsx` → `pages/forms/FormSettingsTab.jsx` (trang, vẫn có nút "Lưu Cài Đặt" cho tới Giai đoạn 4).
- Đã xóa: `contexts/FormBuilderContext.jsx`, `pages/forms/FormBuilder.jsx` (bản cũ), `components/FormPreview.jsx` (modal không còn ai dùng). `MainLayout` chỉ còn logo + tìm kiếm + `UserMenu`.
- Lệch/ghi chú:
  - Toast chuyển từ góc trên-phải xuống **giữa-dưới** (cách đáy 72px để không che thanh công cụ mobile) vì toast che các nút bên phải header.
  - Lưu form không gửi các cột giao diện đang `null` (form chưa từng chọn theme) – quy tắc Giai đoạn 2 trả 422 cho `null`, khiến nút Lưu cũ cũng lỗi với các form này.
  - Bảng màu ở header khi đang ở tab khác thì chuyển về tab Câu hỏi rồi mở panel. Panel `FormTheme` nằm dưới cả 2 hàng header (`top-28`); thanh công cụ bên dính ở `top-[128px]`.
  - Mở panel giao diện không còn bị tính là thay đổi (chỉ coi là thay đổi khi khác theme đã lưu).
  - Xem trước khi còn thay đổi chưa lưu: mở tab xem trước (nội dung đã lưu) + toast nhắc; Giai đoạn 4 gửi hàng đợi trước khi mở.
  - Sao chép liên kết khi form chưa xuất bản: toast "Biểu mẫu chưa được xuất bản" + nút "Xuất bản" (Người xem không có nút).
  - Ô "Chấp Nhận Phản Hồi" (`accept_responses`) trong tab Cài đặt vẫn còn, độc lập với công tắc "Nhận câu trả lời" (`status`). Nên bỏ/gộp ở Giai đoạn 6–7.
- Kiểm thử: `tools/e2e-editor-header.mjs` (54 kiểm tra: thứ tự nút, aria-label, tooltip hover/focus, 3 tab không gọi lại `GET /forms/{id}`, đồng bộ tiêu đề, popover xuất bản, Người xem/Người chỉnh sửa, mobile 390px, `/forms/create`). Người xem tạo bằng `tools/ensure-user.php` (`e2e-viewer@eforms.test`). `e2e-builder.mjs` chỉ đổi selector (tab Cài đặt, `[data-hdr=save]`).

**Đã làm ở Giai đoạn 4 – quyết định, lệch và điểm nối cho Giai đoạn 5:**

- `utils/ops.js` (thuần): `applyOp(s)` (bỏ qua thao tác không còn hợp: update/move/delete câu không còn, insert trùng `key` – để hoàn tác và thao tác từ xa áp được lên trạng thái đã đổi), `invertOp(s)`, `diffFields/diffForm/diffDocs` (xóa → thêm/di chuyển theo thứ tự mới, dùng dãy con tăng dài nhất nên số `field.move` ít nhất → update; `settings`/`validation_rules`/`respondent_limit` so theo từng mục cấp 1), `mergeOps`, `typingSignature`, `opsConflict`, `describeOps` (nhãn tooltip). So sánh coi `null`/`""`/`[]`/`{}` là như nhau (server chuẩn hóa) để không gửi lặp.
- **Store sinh thao tác bằng diff:** mọi action (`updateField`, `setFields`, `insertFields`, `duplicateField`, `reorderFields`, `setMeta`, `setTheme`, `updateSettings`, `commitDoc`) tính tài liệu mới rồi `commit()`: `ops = diffDocs(cũ, mới)`, `inverse = invertOps(cũ, ops)`. Các component (FormQuestion, RandomSectionCard, ConditionEditor, AdvancedOptions, FormSidebar, thẻ tiêu đề, FormTheme, tab Cài đặt) giữ nguyên lời gọi action cũ. Tài liệu `docOf(state)` = `{fields, form:{title, description, giao diện, cài đặt}}` (thuộc tính form nằm trong `currentForm`).
- **Lịch sử:** `undoStack/redoStack`, mỗi mục `{ops, inverse, label, sig, at, batch, sealed?, conflict?}`, tối đa 100. Một bước = (a) mọi commit trong cùng một sự kiện (vd. đổi tên lựa chọn + cập nhật điều kiện dùng nó); (b) gõ liên tiếp cùng thuộc tính văn bản (kể cả `options/rows/columns`, màu) cách nhau < 1 giây; ngắt khi `focusout` khỏi ô nhập. Gõ về đúng giá trị cũ thì bước bị bỏ. Hoàn tác/làm lại = áp `inverse`/`ops` lên trạng thái hiện tại rồi `commit` không ghi lịch sử → autosave gửi diff; sau đó chọn câu bị ảnh hưởng. Cài đặt không vào lịch sử.
- **`services/autosave.js` – hàng đợi dựa trên trạng thái:** giữ ảnh chụp "server đang có"; lúc gửi tính `diffDocs(server, local)`, nên thay đổi liên tiếp tự gộp và thao tác bị tạm dừng/bị từ chối tự nằm lại. Gửi sau 1,5 giây kể từ lần sửa cuối; ngay khi chuyển tab, Xem trước (mở tab trống trước để tránh chặn popup, lưu xong mới trỏ tới bản xem trước), Xuất bản bản nháp, Nhân bản, rời trang sửa; `visibilitychange→hidden`/`pagehide` dùng `fetch keepalive` với `credentials:'include'` + Bearer + `X-XSRF-TOKEN` + `X-Client-Id` (thiếu XSRF thì Sanctum trả 419 vì origin dev là stateful – `authHeaders()` trong `api.js`). Mỗi lúc một request. Sau phản hồi: ảnh chụp được cập nhật bằng thao tác **đã gửi** (tránh vòng gửi lại do khác biệt chuẩn hóa nhỏ); `data.id` câu mới và thuộc tính server ép thêm (`require_login`) lấy từ bản chuẩn hóa (`adoptServerValues`, không phải chỉnh sửa).
- Lỗi mạng/5xx: `error`, tự thử lại 2s, 4s… tối đa 60s (403 thì thôi). `rejected`: toast như cũ, chọn câu theo `key` hoặc `errors["fields.<key>.…"]` (chuyển về tab Câu hỏi nếu cần); thao tác đó được giữ theo chữ ký JSON và **không tự gửi lại** cho tới khi bị sửa hoặc bấm "Không lưu được – Thử lại".
- `SaveIndicator` `data-state`: `pending` (chờ debounce, cũng hiện "Đang lưu…"), `saving`, `saved` ("Đã lưu lúc HH:mm", tooltip `HH:mm:ss dd/MM/yyyy`), `paused` ("Có thay đổi chưa lưu"), `error` (nút "Không lưu được – Thử lại"). `beforeunload` chỉ chặn khi còn thay đổi ở `error`/`paused` (thay đổi thường đã có keepalive).
- **Phá dữ liệu:** form có câu trả lời thì từng `field.delete`/`field.update` được kiểm bằng `destructiveChanges([câu trên server], [câu sau thao tác])`. `field.update` được tách: phần rủi ro (`type, options, rows, columns, settings*, validation_rules*`) tạm dừng, phần còn lại (nhãn, mô tả, bắt buộc…) vẫn gửi. `DestructiveBanner` (sticky dưới header): [Vẫn lưu] cho phép các câu đó tới khi lưu xong; [Hoàn tác] đưa riêng phần bị tạm dừng về giá trị server (thêm lại câu đã xóa đúng chỗ), là một bước lịch sử. **Lệch:** thay đổi đi kèm không phá dữ liệu (vd. gỡ điều kiện trỏ tới câu bị xóa) đã được lưu ngay và [Hoàn tác] không khôi phục chúng.
- Giao diện lưu tự động (`setTheme`, "Đổi giao diện", kéo màu được gộp); bỏ `previewTheme_{id}`. Khi tải form, cột giao diện `null` được điền mặc định trong store để hoàn tác không gửi `null` (422). `FormTheme` đồng bộ state nội bộ khi `theme` đổi từ ngoài.
- Tab Cài đặt: bỏ nút "Lưu Cài Đặt", đọc thẳng từ store; công tắc/radio/select lưu ngay, ô số/văn bản sau 1,5 giây. `respondent_limit` giữ cục bộ khi chưa hợp lệ (hiện gợi ý dưới trang), hợp lệ mới đưa vào store (chuẩn hóa như trước; bật `account` thì kèm `require_login:true`).
- Ảnh thu nhỏ: chụp khi rời trang sửa nếu có lưu kể từ lần chụp trước, mỗi 2 phút nếu có thay đổi đã lưu, và khi xuất bản.
- `clientId` (`api.js`, tạo bằng `newKey()`), axios gửi `X-Client-Id` cho mọi request. (Giai đoạn 5: đổi sang mỗi lần tải trang, bỏ sessionStorage.)
- `revision` trong store: phản hồi `ops`/`PUT` chỉ tăng khi revision mới = cũ + 1 (`advanceRevision`), nếu không thì giữa đó có lô của người khác mà poll phải lấy về; `setRevision` (tuyệt đối) dành cho poll.
- Đã bỏ: `save()/saveSettings()`, nút Lưu `data-hdr="save"`, Ctrl+S, `isDirty/metaDirty/markAsSaved/applySavedFields/setCurrentForm/markMetaSaved`. Trang sửa không gọi `bulk-update` nữa (API vẫn giữ).
- **Điểm nối Giai đoạn 5:**
  - `editor.applyRemoteOps(ops, { user: {id, name} })` (= `autosave.applyRemote`): áp `ops` vào ảnh chụp server và vào store qua `useFormStore.getState().applyRemoteOps(opsCụcBộ, { user, conflictOps: ops })` – không vào lịch sử, không thành "cần lưu"; thuộc tính đang có thay đổi **chưa lưu** giữ giá trị cục bộ (gửi sau và thắng). Gọi lần lượt cho từng `changes[i]` theo revision, rồi `setRevision`.
  - Xung đột lịch sử: `applyRemoteOps` đặt `conflict: {user}` cho mục undo/redo nếu `opsConflict([...ops, ...inverse], conflictOps)` (cùng câu + thuộc tính chồng nhau theo đường dẫn `settings`↔`settings.x`; thêm/xóa câu chồng mọi thứ của câu; `form.update` theo tên). `undo()/redo()` gặp mục bị đánh dấu thì bỏ nó và toast "Không thể hoàn tác vì <tên> đã thay đổi nội dung này".
  - Ô đang gõ: hiện mới bảo vệ giá trị chưa lưu; ô đang focus có giá trị đã lưu vẫn có thể bị ghi đè (FormQuestion đồng bộ `editData` từ `field`). Cần thêm trong `applyRemote`: tách thuộc tính của ô đang focus (vd. `activeElement.closest('[data-field-key]')` + registry thuộc tính đang sửa) khỏi `opsCụcBộ`, giữ lại và áp khi `focusout` nếu người dùng không sửa ô đó (ảnh chụp server vẫn cập nhật ngay).
  - `reset:true`: lấy `diffDocs(server, local)` trước, `loadForm` + `autosave.reset()`, rồi áp lại diff bằng `commitDoc(…, {history:false})` (nên xóa lịch sử).
- Kiểm thử: `tools/test-ops.mjs` (109 kiểm tra: khứ hồi áp/đảo mọi loại op, `after_key` null/không tồn tại, thuộc tính dạng chấm, diff ít `move`, gộp gõ chữ, xung đột, nhãn); `tools/e2e-autosave.mjs` (68 kiểm tra, dùng `tools/add-response.php` tạo câu trả lời trống); `e2e-editor-header` (bỏ `save` khỏi thứ tự nút, chờ lưu tự động), `e2e-builder` (`save()` = chờ lưu tự động, bước Cài đặt chờ request `ops` có `respondent_limit`); `e2e-phase4` không đổi.

**Đã làm ở Giai đoạn 5 – quyết định và lệch:**

- `services/syncTransport.js` (`createPollingTransport`): chỉ chuyển tin – poll `GET /changes` mỗi 2,5 giây (tab ẩn 15 giây, hiện lại thì poll ngay), không chồng request (request sau chờ xử lý xong tin trước), lỗi mạng/5xx lùi dần 5→10→…30 giây, 401/403/404 thì dừng (toast "Bạn không còn quyền truy cập…"/"Biểu mẫu không còn tồn tại"). Giao diện `start/stop/poke` – thay bằng WebSocket chỉ cần một transport khác cùng giao diện.
- `services/liveSync.js` (`createLiveSync`): logic. Trước khi áp tin luôn chờ `autosave.idle()` (không có lô `ops` của mình đang gửi) – nếu không, ảnh chụp server có thể nhận lô của người khác sau lô của mình theo thứ tự sai. Áp lần lượt từng `changes[i]` (bỏ lô có revision ≤ revision đang có) bằng `autosave.applyRemote(ops, {user, revision})`, rồi `setRevision`. Mọi vai trò đều poll (Người xem thấy thay đổi + hiện diện, chỉ đọc).
- **Thứ tự với lô của mình:** autosave giữ các lô của mình đã áp mà poll chưa vượt qua (`ownBatches`, khi `advanceRevision` không tăng được vì có lô người khác chen giữa). Lô từ xa có revision **nhỏ hơn** lô của mình thì các thuộc tính mà lô của mình đặt sau bị bỏ (server cũng cho lô sau thắng); `field.move` của người khác bị bỏ nếu mình di chuyển/thêm câu đó sau.
- **`reset:true` hoặc có `form.reload`:** chờ lưu xong → `GET /forms/{id}` (lặp tối đa 3 lần nếu có lô lưu chạy trong lúc tải) → lấy hàng đợi chưa gửi (`pendingOps`) → `loadForm` + `autosave.reset()` → áp lại hàng đợi bằng `commitDoc(…, {history:false})`. Lịch sử hoàn tác bị xóa (như dự kiến).
- **Ô đang gõ (vá lỗ hổng Giai đoạn 4):** khi áp từ xa, nếu `document.activeElement` là ô nhập văn bản (input/textarea/contentEditable), lấy câu từ `[data-field-key]` gần nhất (không có = form) và thuộc tính từ `[data-prop]` gần nhất; không có `data-prop` thì đoán bằng cách so chữ trong ô với giá trị các thuộc tính (đủ cho tab Cài đặt, nhãn lựa chọn…). Thuộc tính đó **được giữ lại** (ảnh chụp server cập nhật ngay, store giữ giá trị cũ, `pendingOps` bỏ nó để không gửi ngược giá trị cũ). Khi focus rời phạm vi (`[data-prop]` hoặc chính ô): nếu người dùng không sửa → áp giá trị server (không vào lịch sử, không thành cần lưu); nếu đã sửa → giữ cục bộ, gửi đi và thắng. Đã gắn `data-prop`: nhãn/hướng dẫn/mô tả/lựa chọn (`options`)/hàng/cột/"Khác" (`settings.other_option`) trong `FormQuestion`, nhãn + mô tả `RandomSectionCard`, tiêu đề + mô tả thẻ tiêu đề, ô tiêu đề header.
- **Hiện diện:** layout gộp `presence` theo `user_id` (nhiều tab = một người) và **bỏ chính mình** (kể cả tab khác của mình). `editor.presence = [{user_id, name, fields[]}]`, `editor.presenceByField = {key: [user…]}`. `PresenceAvatars`: chữ cái đầu + cuối của tên, màu `presenceColor`, tooltip tên, tối đa 5 + "+N", `data-presence-user`. Câu đang được người khác chọn: khung viền màu người đó + nhãn tên nhỏ ở góc trên phải (`PresenceFrame` trong `FormBuilder/index.jsx`, bọc chung cho `FormQuestion`, `RandomSectionCard`, câu trong khối; `data-presence`, `data-presence-label`). Đổi câu đang chọn thì poll sớm (`poke`, ~0,3 giây). Thẻ tiêu đề không có hiện diện (không phải "câu đang chọn").
- **Câu đang chọn theo `key`** (trước theo chỉ số): layout giữ `activeKey`, `activeQuestionIndex` tính lại từ `fields` – thêm/di chuyển câu từ xa phía trên không làm nhảy vùng chọn. `setActiveQuestionIndex(index)` giữ nguyên chữ ký.
- **`clientId` mỗi lần tải trang** (`newKey()` trong `api.js`, bỏ sessionStorage): nhân bản tab không còn chung id; tải lại trang có id mới cũng đúng (trang mới tải form từ đầu, và lô `keepalive` của trang cũ không bị trang mới bỏ qua).
- Tab Cài đặt đọc thẳng từ store nên giá trị cài đặt cập nhật trực tiếp; trạng thái (`status` từ `PUT` của người khác) cập nhật nhãn/nút xuất bản. **Không làm:** tự làm mới số câu trả lời/danh sách câu trả lời (không có revision cho câu trả lời; để Giai đoạn 7 nếu cần).
- Hoàn tác khi người khác đã sửa cùng thuộc tính: toast "Không thể hoàn tác vì <tên> đã thay đổi nội dung này" chạy thật với thao tác từ xa (E2E). Chỉ thao tác thực sự được áp lên server (sau khi bỏ phần thua lô của mình) mới đánh dấu xung đột.
- Kiểm thử: `tools/e2e-sync.mjs` (40 kiểm tra, 3 phiên: chủ `user 1`, Người chỉnh sửa `e2e-editor@eforms.test`, Người xem `e2e-viewer@eforms.test`, thêm qua `POST /collaborators`): nhãn/thêm/xóa/di chuyển/giao diện/tiêu đề hiện ở phiên kia trong ~0,5–2 giây sau khi lưu; hai người sửa hai thuộc tính cùng câu; ô đang focus không bị ghi đè (áp khi blur / mình sửa thì mình thắng); avatar hai phía (không có mình); khung + tên câu đang chọn; toast xung đột hoàn tác; Người xem thấy thay đổi, không sửa được (403); hai tab cùng người có `clientId` khác nhau và nhận thay đổi của nhau; `form.reload` (API `fields/reorder` cũ) → tải lại; đóng phiên → mất khỏi hiện diện sau ~31 giây (`--skip-expiry` để bỏ bước này). Script gọi store của app qua `import()` đúng URL module Vite đã nạp (HMR có thể thêm `?t=`).
- Ghi chú: ô nhãn câu hỏi của `FormQuestion` vẫn ở chế độ sửa khi câu bị bỏ chọn bằng cú bấm ra ngoài (input bị gỡ trước khi `blur`), lần chọn lại mở thẳng ô nhập – có từ trước, để Giai đoạn 7.

**Đã làm ở Giai đoạn 6 – quyết định và lệch:**

- `components/editor/ShareDialog.jsx` (mở bằng `editor.openShare`, nhận `role` từ layout, tự lấy `my_role` mới nhất từ `GET /collaborators`):
  - Ô "Thêm người theo tên hoặc email" là combobox (`role=combobox` + `listbox`, phím ↑/↓/Enter/Esc, Backspace xóa người vừa chọn). Gợi ý từ 3 ký tự, trễ 250 ms, tối đa 8, server loại người đã có quyền và frontend loại thêm (danh sách đang hiện + người đã chọn). Email hợp lệ chưa có trong gợi ý → "Mời <email>". Chọn được **nhiều người** (chip) rồi chọn vai trò chung (mặc định Người chỉnh sửa; "Chủ sở hữu" chỉ hiện với chủ), "Gửi email thông báo" (mặc định bật) + lời nhắn, nút Gửi gọi `POST /collaborators` cho từng người. Lỗi từng người hiện trong khung lỗi của popup, người lỗi được giữ lại.
  - Sau khi tạo lời mời (và khi "Gửi lại" mà không gửi được email) popup hiện khung link mời (ô chỉ đọc + Sao chép) kèm "Chưa cấu hình email – hãy sao chép link mời để gửi". `mail_enabled:false` cũng được nhắc trong phần soạn và phần "Lời mời đang chờ".
  - Danh sách người có quyền: ô chọn vai trò khóa theo bảng quyền – Người chỉnh sửa thấy dòng Chủ sở hữu là chữ có khóa (tooltip "Chỉ chủ sở hữu mới đổi được vai trò này") và không chọn được "Chủ sở hữu"; Chủ sở hữu cuối cùng chỉ chọn được "Chủ sở hữu" (dòng chú thích "Phải còn ít nhất một chủ sở hữu"). Lỗi server (vd. 422 chủ cuối cùng khi danh sách đã cũ) hiện ở khung `role=alert` + toast, rồi tải lại danh sách. Mục cuối: "Gỡ quyền truy cập" (người khác, không hỏi lại như Google) / "Rời khỏi biểu mẫu" (chính mình, có `confirm`, xong thì về `/forms`).
  - **Người xem:** chỉ thấy danh sách (vai trò là chữ), không có ô thêm người/lời mời, "Quyền truy cập chung" bị khóa. **Lệch nhỏ:** dòng của chính Người xem có nút "Rời khỏi" vì mục 4.8 cho mọi người tự rời.
  - "Lời mời đang chờ": email, vai trò, "Hết hạn dd/mm/yyyy" hoặc "Đã hết hạn" (đỏ). Sao chép link mời = `POST …/link` (tooltip và toast báo link cũ ngừng hoạt động), Gửi lại = `…/resend`, Hủy = `DELETE`. Lời mời vai trò Chủ sở hữu bị khóa với Người chỉnh sửa.
  - "Quyền truy cập chung": Người chỉnh sửa cố định "Hạn chế"; Người trả lời = ô chọn "Bất kỳ ai có đường liên kết" / "Yêu cầu đăng nhập" ghi `require_login` qua `updateSettings(…, {delay:0})` của store (cùng đường lưu tự động với tab Cài đặt, nên hai nơi luôn khớp và đồng bộ trực tiếp). `respondent_limit` bật căn cứ `account` → ô bị khóa ở "Yêu cầu đăng nhập" kèm giải thích (dùng chung `utils/respondentAccess.js` với tab Cài đặt). "Biểu mẫu công khai" đang tắt thì có dòng nhắc.
  - Truy cập: `role=dialog`, `aria-modal`, tiêu đề `aria-labelledby`, focus vào ô thêm người (Người xem: nút Đóng), Tab/Shift+Tab vòng trong popup, Esc đóng (Esc trong danh sách gợi ý chỉ đóng gợi ý), trả focus về nút đã mở. Nút icon dùng `Tooltip` chung.
- **Đổi vai trò tới trình sửa đang mở:** `GET /forms/{form}/changes` trả thêm `my_role` (thay đổi backend nhỏ, có PHPUnit); `liveSync` thấy khác thì `patchForm({my_role})` + toast "Vai trò của bạn đã đổi thành …" → header/tab chuyển chỉ đọc (hoặc ngược lại) trong ~2,5 giây, không cần tải lại. Bị gỡ quyền thì poll 403 → toast cũ "Bạn không còn quyền truy cập…".
- `pages/Invite.jsx` (`/invite/:token`, trong `AuthLayout`, không cần đăng nhập): 404/410/429 → thông báo theo `reason` (`data-invite-error=invalid|expired|used|busy`) + hướng dẫn xin mời lại; đăng nhập đúng email → `accept` → `/forms/:id/edit` (mọi vai trò vào tab Câu hỏi, Người xem ở chế độ chỉ đọc); khác email → "Lời mời gửi tới <email>" + nút Đăng xuất (đăng xuất xong trang tự chuyển tiếp như chưa đăng nhập); chưa đăng nhập → `/register?invite=` (chưa có tài khoản) hoặc `/login?invite=&email=` (`has_account`). 401 trên trang này (token cũ) không đá về `/login` (interceptor bỏ qua `/invite/*`) mà đăng xuất rồi đi tiếp như chưa đăng nhập.
- `Register.jsx` với `?invite=`: lấy thông tin lời mời (`useInvitation` + `InviteBanner` dùng chung), email điền sẵn + `readOnly`, gửi `invite_token`; thành công có `form_id` → vào thẳng form. Lời mời hỏng → về `/invite/:token` để báo lỗi; email đã có tài khoản → sang Login. `Login.jsx` với `?invite=` (+ `?email=`): điền sẵn email (sửa được), đăng nhập xong → `/invite/:token` (trang này nhận lời mời hoặc báo sai tài khoản). Hai trang giữ `?invite=` khi chuyển qua lại. Không có `?invite=` thì như cũ.
- Chuyển hướng đăng nhập: `PublicRoute` chỉ chuyển hướng người **đã đăng nhập khi mới tới** (có `?invite=` thì tới `/invite/:token`, không thì `/forms`) – trước đây nó chuyển về `/forms` ngay khi đăng nhập xong, tranh với điều hướng của trang lời mời. `ProtectedRoute` gửi kèm `state.from`, Login quay lại trang đó (vd. link email "đã chia sẻ với bạn" tới `/forms/:id/edit`).
- `FormList`: nhóm nút "Tất cả / Của tôi / Được chia sẻ" (`?filter=` trên URL, gửi `GET /forms?filter=`), giữ bộ lọc trạng thái cũ. Mỗi thẻ: biểu tượng chia sẻ (khi `collaborators_count > 1` hoặc tôi không phải chủ, tooltip số người), "Chủ sở hữu: <tên>|Tôi", nhãn vai trò của tôi. Menu: "Xóa" chỉ cho Chủ sở hữu, Người xem thấy "Mở (chỉ xem)". "Được chia sẻ" rỗng có thông báo riêng. Danh sách vẫn chỉ trang đầu (15 form) như trước.
- **"Chấp Nhận Phản Hồi" (`accept_responses`) – đã gộp vào trạng thái:** backend `canAcceptResponses()` vẫn chặn khi `accept_responses = false`, nên ô cũ là một công tắc ẩn thứ hai. Đã bỏ ô khỏi tab Cài đặt; công tắc "Nhận câu trả lời" (`published ↔ closed`) là nguồn duy nhất. Migration `2026_11_13_000003` chuyển form `published` + `accept_responses=0` thành `closed` và đặt `accept_responses=1` cho mọi form (local không có form nào bị ảnh hưởng). Cột và API vẫn giữ để tương thích; xuất bản/mở lại từ header gửi kèm `accept_responses:true` nếu form còn giá trị cũ `false`.
- Tiện ích mới: `utils/roles.js` (nhãn + `canShare/canManageOwners`), `utils/clipboard.js` (`copyText`, chuyển từ layout), `utils/respondentAccess.js`, `api.js`: `collaboratorAPI.add/update/remove/resendInvitation/invitationLink/cancelInvitation`, `userAPI.search`, `invitationAPI.show/accept` (accept tự lấy cookie CSRF nếu thiếu). `authStore.register` trả thêm `data`.
- Kiểm thử: `tools/e2e-share.mjs` (77 kiểm tra, 5–6 phiên: chủ `user 1`, `e2e-share-b` (Người chỉnh sửa → Người xem), `e2e-share-d` (chủ thứ hai/sai tài khoản), người mới đăng ký và người "đã có tài khoản" theo từng lần chạy – bị xóa sau khi chạy; mật khẩu biết trước qua `tools/share-fixture.php`, cũng dùng để làm hết hạn lời mời). Clipboard trong Chrome headless không cấp quyền được nên script thay `navigator.clipboard` để đọc lại nội dung app ghi. `tools/run-e2e-all.ps1` chạy lần lượt `test-ops` + 6 script E2E, in một dòng mỗi script (log ở `tools/out/<script>.log`).
- Ghi chú: `GET /invitations/{token}` có throttle 30/phút/IP. Lúc đầu mỗi trang (Invite, Login, Register, cả lần chạy đôi của StrictMode) gọi lại API này nên chạy E2E 2 lần liền bị 429 và bước đăng nhập theo lời mời hỏng. Đã sửa: `useInvitation` dùng chung một request cho mỗi token trong 60 giây (lỗi thì không giữ), 429 có thông báo riêng "Thử lại sau ít phút". Sau khi sửa, chạy liền 2 lần đều qua, không còn 429.

**Đã làm ở Giai đoạn 7 – quyết định và lệch:**

- **Ô chọn loại câu hỏi (4.10):** `.eforms-type-selector` của `FormQuestion` chỉ render khi `isActive`. Bỏ chọn (bấm ra ngoài) thì ô biến mất và dropdown đóng; Esc cũng đóng dropdown. `RandomSectionCard` không có ô chọn loại (các điều khiển đã chỉ hiện khi đang chọn); không thẻ nào khác có ô tương tự.
- **Lỗi chế độ sửa nhãn (ghi chú Giai đoạn 5):** `FormQuestion` đặt lại `editingQuestion`, `editingOptionIndex`, dropdown khi `isActive` thành false, nên chọn lại câu hiện nhãn chứ không mở thẳng ô nhập.
- **Người xem:** tab Câu hỏi có dòng "Bạn đang xem biểu mẫu ở chế độ chỉ xem…" (`data-readonly-note`), `.eforms-main[inert]` + CSS bỏ bóng/viền khi rê chuột và con trỏ mặc định, thẻ tiêu đề không còn chuyển sang ô nhập (`EditableTitle readOnly`, ẩn "Mô tả biểu mẫu" khi trống), `isActive` luôn false nên không có ô chọn loại/tay kéo/chân thẻ. Khi vai trò đổi trực tiếp thành Người xem (Giai đoạn 6), layout bỏ câu đang chọn và đóng panel giao diện. Tab Cài đặt: nhãn "Chỉ xem" + dòng giải thích, vẫn `<fieldset disabled>`.
- **Tooltip/truy cập:** `Tooltip` lật lên trên khi sát đáy màn hình, giới hạn bề rộng (cắt bằng dấu …). Không còn `title` gốc ở header, thanh công cụ bên, chân thẻ câu hỏi/phần ngẫu nhiên, nút xóa phiên bản (chuyển sang `aria-label` + `Tooltip`; E2E cũ đổi selector `button[title=…]` → `button[aria-label=…]`). Còn `title` ở ô màu `FormTheme`, `FormList`, `FormResponses`, trang công khai (ngoài phạm vi). Nút tài khoản có tooltip. Vòng focus `focus-visible` cho nút header, logo, tab, mục menu. Esc đóng menu ⋮, popup xuất bản, menu tài khoản (trả focus về nút mở), popup Chia sẻ, panel giao diện (mới thêm Esc), dropdown loại câu hỏi.
- **Mobile:** 390px theo 4.1 (logo, tiêu đề, chỉ báo lưu, Hoàn tác/Làm lại, xuất bản, ⋮). **Lệch:** 768–1023px dùng bộ nút desktop nhưng ẩn nhãn trạng thái (chỉ hiện từ 1024px, nút "Xuất bản/Đã xuất bản" vẫn cho biết trạng thái) vì ở 768px tiêu đề chỉ còn 36px. Thanh công cụ dưới trên mobile thu nút còn 44px để vừa 390px. Popup xuất bản giới hạn `100vw - 1rem`, thanh cảnh báo phá dữ liệu xuống dòng gọn, panel giao diện `max-w-full`. Không cuộn ngang ở trang sửa, câu trả lời, cài đặt, danh sách form, lời mời, đăng nhập, đăng ký (390 và 768).
- **Kiểm thử:** `tools/e2e-polish.mjs` (62 kiểm tra). `tools/run-e2e-all.ps1` chạy đủ 3 script đơn vị + 9 script E2E (kể cả `e2e-public`, `e2e-survey` của đợt Phần ngẫu nhiên).
- **Sự cố DB local (12/11/2026, đã khắc phục):** chạy PHPUnit khi đang có `config:cache` (dùng cho Apache) khiến test bỏ qua cấu hình SQLite trong `phpunit.xml` và `RefreshDatabase` xóa `eforms_db`. Đã khôi phục từ `backup-before-phase2.sql` + chạy lại migration Giai đoạn 2–6 (mọi dữ liệu tạo sau 19:16 ngày 12/11 bị mất – form E2E vốn bị xóa sau mỗi lần chạy, tài khoản E2E được script tạo lại; bản sau khôi phục: `backend/storage/app/backup-phase7-restored.sql`). Chặn tái diễn: `phpunit.xml` đặt `APP_CONFIG_CACHE=bootstrap/cache/config.testing.php` (test không đọc cache của Apache) và `tests/TestCase.php` dừng nếu DB không phải SQLite `:memory:`. Script `tools/restore-db.ps1` dựng lại DB từ một bản dump.

---

## 6. Thứ tự làm và kiểm thử

| Giai đoạn | Kiểm thử khi xong |
|---|---|
| 1 | PHPUnit: bảng quyền 3 vai trò trên mọi endpoint; không thể gỡ Chủ sở hữu cuối cùng; lời mời hết hạn, dùng lại, sai email; đăng ký với `invite_token`; tìm người dùng (độ dài tối thiểu, giới hạn kết quả, không lộ trường thừa) |
| 2 | PHPUnit: áp lô thao tác, ai đến sau thắng theo thuộc tính, thao tác trên câu đã xóa, `changes?since=` loại thao tác của chính client, dọn nhật ký, hiện diện hết hạn |
| 3 | Script E2E: thứ tự nút, tooltip, chuyển 3 tab không tải lại form, quyền hiển thị theo vai trò, mobile 390px |
| 4 | Kiểm tra logic `utils/ops.js` (áp + đảo + gộp gõ chữ) + E2E: sửa rồi chờ thì lưu, tải lại vẫn còn; hoàn tác/làm lại qua nút và phím tắt; thanh cảnh báo phá dữ liệu |
| 5 | E2E hai phiên trình duyệt (hai tài khoản): thay đổi hiện ở phiên kia trong khoảng 3 giây, cùng sửa một câu, ô đang gõ không bị ghi đè, avatar/viền hiện diện |
| 6 | E2E: mời người có tài khoản / chưa có tài khoản → đăng ký → vào form; đổi vai trò; quyền truy cập chung đồng bộ với tab Cài đặt |
| 7 | Chạy lại toàn bộ PHPUnit + các script E2E đã có của dự án (đợt Phần ngẫu nhiên) để bảo đảm không hỏng |

- Các script E2E đặt trong `tools/`, in bảng tóm tắt (chỉ lỗi), chi tiết ghi ra file.
- Cập nhật mục 1 của file này sau mỗi giai đoạn.

---

## 7. Câu hỏi còn mở / rủi ro (danh sách cuối, sau Giai đoạn 7)

**Cần làm khi đưa lên production**

- **Sao lưu DB trước khi chạy migration:** migration gán Chủ sở hữu cho mọi form hiện có (`form_collaborators`), thêm `revision`/nhật ký, gộp `accept_responses` vào `status`.
- **MyISAM → InnoDB:** MySQL WAMP local mặc định MyISAM. Production cần kiểm tra `@@default_storage_engine`; migration `2026_11_13_000002` chuyển bảng cộng tác sang InnoDB, bảng mới khai báo `engine('InnoDB')`. Migration sau này nên làm như vậy.
- **Cron:** cần `php artisan schedule:run` mỗi phút để `forms:prune-changes` (mỗi giờ) dọn `form_changes`/`form_presence`. Không có cron thì nhật ký chỉ lớn dần, không sai chức năng.
- **SMTP:** cần host, port, tài khoản, địa chỉ gửi để bật email mời/thông báo. Chưa có thì dùng link mời. Email gửi đồng bộ trong request; SMTP chậm thì chuyển sang queue.
- **Chạy PHPUnit:** không chạy trên máy có DB thật mà thiếu bảo vệ – đã thêm `APP_CONFIG_CACHE` riêng cho test và kiểm tra SQLite trong `TestCase` (xem sự cố ở Giai đoạn 7).

**Giới hạn đã biết của thiết kế**

- **Lựa chọn gộp theo cả danh sách:** `options/rows/columns` là mảng chuỗi không id, hai người cùng sửa hai lựa chọn khác nhau của một câu thì người lưu sau thắng cả danh sách (lệch 4.7). Muốn gộp từng lựa chọn cần thêm id cho lựa chọn (đổi dữ liệu câu trả lời).
- **Cùng sửa một ô văn bản:** ai lưu sau thắng cả ô, không gộp từng ký tự.
- **Polling:** trễ 2–3 giây, mỗi người đang mở form gửi 1 request/2,5 giây. Nhiều người cùng lúc hoặc cần tức thời thì chuyển sang Reverb (`syncTransport` đã tách sẵn).
- **Sửa form đã xuất bản** có hiệu lực ngay với người trả lời. Kiểu "bản nháp riêng, xuất bản lại mới áp dụng" là phạm vi riêng.
- **[Hoàn tác] trên thanh cảnh báo phá dữ liệu** không khôi phục các thay đổi đi kèm đã được lưu ngay (vd. gỡ điều kiện trỏ tới câu bị xóa).
- **`respondent_limit.field_keys`** không được kiểm tra khi câu hỏi bị xóa (như trước).

**Quyền riêng tư / bảo mật**

- **Tìm người dùng:** mọi người đăng nhập tìm được tên/email người khác (≥3 ký tự, 8 kết quả, throttle 60/phút). Muốn kín hơn: bắt buộc `form_id` hoặc chỉ khớp email đầy đủ.
- **Tra cứu lời mời** `GET /invitations/{token}` có throttle 30/phút/IP; token 40+ ký tự, chỉ lưu bản băm. Có thể siết thêm nếu cần.

**Chưa làm (để sau nếu cần)**

- Tự làm mới số câu trả lời / danh sách câu trả lời khi đang mở trình sửa (không có revision cho câu trả lời).
- Danh sách form chỉ trang đầu (15 form), chưa phân trang/cuộn thêm.
- Hiện diện trên thẻ tiêu đề form (hiện chỉ theo câu đang chọn).
- `title` gốc của trình duyệt còn ở ô màu `FormTheme`, `FormList`, `FormResponses`, trang công khai (ngoài phạm vi header/popup).
- Popup xuất bản chưa tự đưa focus vào bên trong khi mở bằng bàn phím (Esc vẫn đóng và trả focus).

**Môi trường local**

- **Apache/WAMP thỉnh thoảng không nạp `.env`** khi có nhiều request song song → 500 ngẫu nhiên. Chữa: `php artisan config:cache` (chạy lại sau khi sửa `.env`). Test PHPUnit đã được tách khỏi cache này.
- **Vite dev đôi khi trả CSS rỗng** sau nhiều lần sửa `index.css` liên tiếp (trang không có style). Chữa: lưu lại `index.css` (hoặc khởi động lại `npm run dev`).
