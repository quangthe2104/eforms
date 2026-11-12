# Kế hoạch: Đăng nhập bằng Google

File này là nguồn duy nhất về phạm vi, quyết định và tiến độ. Chat mới đọc file này để làm tiếp.

---

## 1. Trạng thái

| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| 0 | Thảo luận, chốt thiết kế | Đã chốt (12/11/2026), không còn câu hỏi mở |
| 1 | Chuẩn bị Google Cloud: OAuth Client ID, consent screen | **Xong (12/11/2026)**: `GOOGLE_CLIENT_ID` (backend) và `VITE_GOOGLE_CLIENT_ID` (frontend) đã điền, khớp nhau; Google nhận origin `http://localhost:5173`, từ chối `http://eforms.test:5173` (đúng dự kiến). Kiểm tra lại bằng `php tools/check-google-client.php` |
| 2 | Backend: migration, xác minh ID token, endpoint `POST /auth/google`, test PHPUnit | **Xong (12/11/2026)**: `GoogleAuthTest` 12/12, toàn bộ suite 214/214. Xem mục 8 |
| 3 | Frontend: nút Google trên Login/Register, `authStore.googleLogin`, luồng lời mời | **Xong (12/11/2026)**: `npm run build` qua. Xem mục 8 |
| 4 | Mật khẩu cho tài khoản Google, hiển thị liên kết trong Hồ sơ | **Xong (12/11/2026)**, làm chung với giai đoạn 2 và 3 |
| 5 | Kiểm thử E2E | **Xong (12/11/2026)**: `node tools/e2e-google-login.mjs` 20/20 (dùng bản kiểm tra token giả). **Còn:** thử một lần với tài khoản Google thật, xem mục 8 |

## 2. Quyết định đã chốt

- **Luồng:** Google Identity Services (GIS) trên frontend lấy **ID token** (JWT), gửi lên backend. Backend xác minh token rồi cấp **Sanctum token** như `login()` hiện tại. Không dùng luồng redirect/Socialite vì app là SPA dùng Bearer token.
- **Gộp tài khoản:** khi email Google trùng với user đã có, **tự động gộp** (ghi `google_id` vào user đó), **chỉ khi** token có `email_verified = true`. Nếu không verified thì từ chối.
- **User mới từ Google:** tự tạo với `role = 'user'`, `password = null`, `email_verified_at = now()`.
- **Lời mời:** endpoint Google **không** nhận `invite_token`. Sau khi đăng nhập, frontend chuyển tới `/invite/{token}`, giống Login hiện tại. Trang lời mời tự nhận lời mời hoặc báo sai tài khoản, nên quy tắc "email phải trùng email được mời" vẫn giữ nguyên.

## 3. Hiện trạng code (trước khi làm)

- `backend/app/Http/Controllers/AuthController.php`: `register`, `login`, `logout`, `me`, `updateProfile`, `changePassword`. Token cấp bằng `$user->createToken('auth_token')`.
- `backend/routes/api.php`: `/register`, `/login` công khai; còn lại nằm trong `auth:sanctum`.
- Bảng `users` (`2024_01_01_000000_create_users_table.php`): `password` **NOT NULL**, chưa có cột Google.
- `User` model: `password` nằm trong `$hidden`, cast `hashed`.
- Frontend: `pages/auth/Login.jsx`, `Register.jsx` (có `?invite=`), `store/authStore.js` (zustand, lưu `user`/`token` vào localStorage), `services/api.js` (`authAPI`).
- `pages/ChangePassword.jsx`: lời gọi API đang bị comment, tức trang này chưa đổi mật khẩu thật.
- Backend dependency có sẵn `guzzlehttp/guzzle`.

## 4. Thiết kế chi tiết

### 4.1 Database (migration mới)

```php
Schema::table('users', function (Blueprint $table) {
    $table->string('google_id', 191)->nullable()->unique()->after('email');
    $table->string('avatar', 500)->nullable()->after('google_id');
    $table->string('password')->nullable()->change();
});
```

- `User::$fillable` thêm `google_id`, `avatar`. `google_id` thêm vào `$hidden`.
- Thêm accessor `has_password` (append vào JSON) để frontend biết có hiện "Đặt mật khẩu" thay cho "Đổi mật khẩu" hay không.

### 4.2 Xác minh ID token

Hai cách, chọn **A**:

- **A. Thư viện `google/apiclient`** (`Google\Client::verifyIdToken`): tự kiểm tra chữ ký bằng public key của Google (có cache), `iss`, `exp`, `aud`. Đây là cách chính thức, nhưng gói khá nặng. Có thể giới hạn chỉ cài service cần dùng bằng `"extra": {"google/apiclient-services": []}`.
- B. Gọi `https://oauth2.googleapis.com/tokeninfo?id_token=...` bằng Guzzle: không cần thêm gói, nhưng mỗi lần đăng nhập tốn một request ra ngoài và Google khuyến cáo không dùng cho production.

Tách thành service `App\Services\Auth\GoogleTokenVerifier`, có method `verify(string $idToken): array{sub, email, email_verified, name, picture}`. Method này ném `ValidationException` khi token sai. Viết thành service riêng để test có thể mock.

Cấu hình trong `config/services.php`. File này hiện chưa có trong `backend/config`, nên phải tạo mới:

```php
'google' => [
    'client_id' => env('GOOGLE_CLIENT_ID'),
],
```

### 4.3 Endpoint `POST /api/auth/google` (công khai, có `throttle`)

Request: `{ credential: string }`

Logic `AuthController::google()`:

1. Validate `credential` là chuỗi bắt buộc.
2. Gọi `$payload = $verifier->verify($credential)`.
3. Nếu `email_verified` khác `true` thì trả 422: "Email Google chưa được xác minh".
4. Tìm user theo `google_id = sub`.
5. Nếu không thấy, tìm theo email (không phân biệt hoa thường). Nếu thấy thì gộp: ghi `google_id`; nếu `email_verified_at` đang trống thì đặt `now()`; nếu `avatar` đang trống thì lấy ảnh Google.
6. Nếu vẫn không thấy thì tạo user mới (`name`, `email`, `google_id`, `avatar`, `password = null`, `role = 'user'`, `email_verified_at = now()`).
7. Trả `{ message, user, token }`, cùng định dạng với `login()`.

Trường hợp biên:
- User đã gắn **một `google_id` khác** mà email vẫn trùng (người dùng đổi tài khoản Google): từ chối, không ghi đè.
- Khi đổi email qua `updateProfile`, `google_id` vẫn giữ. Đăng nhập Google lần sau vẫn tìm theo `sub`, nên vẫn đúng.

### 4.4 Mật khẩu cho user Google

- `login()`: nếu `$user->password === null` thì báo "Tài khoản này đăng nhập bằng Google", không gọi `Hash::check` với giá trị null.
- `changePassword()`: nếu user chưa có mật khẩu thì **không yêu cầu** `current_password` (coi đây là "đặt mật khẩu lần đầu").
- `ChangePassword.jsx`: bật lại lời gọi API thật, ẩn ô "Mật khẩu hiện tại" khi `user.has_password === false`.
- Quên mật khẩu: hiện chưa có luồng này, nên nằm ngoài phạm vi.

### 4.5 Frontend

- `.env`: `VITE_GOOGLE_CLIENT_ID=...` (cùng Client ID với backend).
- Tải script GIS `https://accounts.google.com/gsi/client`: thêm thẳng vào `index.html` hoặc dùng gói `@react-oauth/google`. Chọn **gói `@react-oauth/google`**: nhỏ, có sẵn `GoogleOAuthProvider` và `<GoogleLogin onSuccess>` trả `credential`.
- Bọc `App` trong `GoogleOAuthProvider`, nhưng chỉ khi có `VITE_GOOGLE_CLIENT_ID`. Không có biến này thì ẩn nút, để môi trường chưa cấu hình vẫn chạy bình thường.
- Component `components/GoogleSignInButton.jsx`: dùng chung cho Login và Register, có dải phân cách "hoặc" với form email.
- `authAPI.google = (credential) => api.post('/auth/google', { credential })`.
- `authStore.googleLogin(credential)`: giống `login`, lưu `user`/`token` vào localStorage.
- Sau khi thành công: có `invite` thì `navigate('/invite/{token}')`, không thì `/forms`, giống Login.
- Lỗi (chưa verified, token sai, popup bị chặn): hiện qua `react-hot-toast`.
- `vite.config.js` đang đặt `server.host: 'eforms.test'`. Để mở được `http://localhost:5173` khi test nút Google, đổi thành `host: true` (nghe trên mọi địa chỉ, vẫn mở được bằng `eforms.test`). CORS backend đã có sẵn `http://localhost:5173`.
- Khi frontend chạy trên `eforms.test:5173`, nút Google sẽ báo lỗi origin. Đây là giới hạn của Google, không phải lỗi app.

### 4.6 Hồ sơ (tùy chọn, làm nếu còn thời gian)

- Hiển thị avatar Google ở header nếu có.
- Trong Hồ sơ, ghi "Đã liên kết Google" khi user có `google_id` (backend trả cờ `has_google`, không trả `google_id`).

## 5. Việc người dùng cần làm trên Google Cloud Console

1. Tạo (hoặc chọn) project tại https://console.cloud.google.com/.
2. **APIs & Services → OAuth consent screen**: loại *External*; điền tên app, email hỗ trợ, domain; scopes chỉ cần `openid`, `email`, `profile` (không cần Google xét duyệt). Ở trạng thái *Testing* thì phải thêm test users; muốn ai cũng đăng nhập được thì chuyển sang *In production*.
3. **Credentials → Create credentials → OAuth client ID**, loại *Web application*.
   - **Authorized JavaScript origins:** `http://localhost:5173` và domain production (https).
   - GIS dạng popup/button **không cần** Authorized redirect URIs.
4. Copy **Client ID** vào `backend/.env` (`GOOGLE_CLIENT_ID`) và `frontend/.env` (`VITE_GOOGLE_CLIENT_ID`). Luồng này **không cần** Client Secret.

Lưu ý: Google chỉ chấp nhận origin có tên miền công khai hoặc `localhost`, nên `http://eforms.test:5173` sẽ bị từ chối. Khi test nút Google ở local, mở frontend bằng `http://localhost:5173` và kiểm tra lại cấu hình CORS/Sanctum của backend cho origin này.

## 6. Kiểm thử

### PHPUnit (`tests/Feature/GoogleAuthTest.php`, mock `GoogleTokenVerifier`)
- Token hợp lệ, email mới: tạo user, `password` null, `email_verified_at` có giá trị, trả token.
- Token hợp lệ, email trùng user mật khẩu: gộp (ghi `google_id`), không tạo user mới.
- Đăng nhập lần 2 bằng cùng `sub`: cùng user.
- `email_verified = false`: 422.
- Token sai (verifier ném lỗi): 422.
- Email trùng nhưng user đã gắn `google_id` khác: từ chối.
- `login()` bằng mật khẩu với user Google (password null): báo lỗi rõ ràng, không lỗi 500.
- `changePassword()` với user chưa có mật khẩu: đặt được mà không cần `current_password`.

### E2E (`tools/e2e-google-login.mjs`)
- Popup Google thật không tự động hóa được. Backend dùng một verifier giả, chỉ bật khi `APP_ENV=local` và `GOOGLE_FAKE_VERIFIER=true`, nhận token dạng `fake:<email>`. Script gọi thẳng `authStore.googleLogin('fake:...')` qua `page.evaluate`.
- Kiểm tra: nút hiện khi có Client ID; đăng nhập xong vào `/forms`; với `?invite=` thì vào trang lời mời và nhận đúng form; email sai lời mời thì trang lời mời báo sai tài khoản.
- Kiểm tra thủ công một lần với tài khoản Google thật trên localhost.

## 7. Phạm vi đã chốt thêm (12/11/2026)

- **Không giới hạn domain email:** mọi tài khoản Google có email đã xác minh đều đăng nhập được. Không kiểm tra claim `hd`.
- **Chưa làm hủy liên kết Google** trong Hồ sơ. Nếu sau này cần thì chỉ cho phép khi user đã có mật khẩu.

## 8. Kết quả triển khai (12/11/2026)

Các điểm lệch so với thiết kế ở mục 4:
- `has_password` và `has_google` **không** nằm trong `$appends` toàn cục. Chỉ các route auth (`login`, `google`, `register`, `me`, `profile`) trả hai cờ này, qua `User::withAuthFlags()`. Làm toàn cục sẽ làm hỏng test tìm user và để lộ cách đăng nhập của người khác.
- `composer.json` đặt `extra.google/apiclient-services: ["Oauth2"]`. Danh sách rỗng thì script dọn dẹp không xóa gì; giữ một service thì `vendor/google` chỉ còn khoảng 0,6 MB.
- Nếu `GOOGLE_CLIENT_ID` trống, verifier trả 422 chứ không bỏ qua bước kiểm tra `aud`. Khóa công khai của Google được cache ở `storage/framework/cache/google`.
- Migration `down()` không đặt lại `password` thành NOT NULL, vì user Google có `password` null.
- **Sửa lỗi có sẵn:** thêm `backend/bootstrap/providers.php` để nạp `AppServiceProvider`. Trước đó provider này không bao giờ chạy, nên `Schema::defaultStringLength(191)` cũng chưa từng có hiệu lực. **File này phải được commit và deploy.**
- Frontend: `ChangePassword.jsx` giờ gọi API thật, độ dài tối thiểu đổi 6 → 8 cho khớp backend. Ảnh avatar có `referrerPolicy="no-referrer"` (ảnh Google hay lỗi nếu thiếu). Hồ sơ hiện "Đã liên kết Google".

Chạy E2E:
- `node tools/e2e-google-login.mjs` cần dev server ở cổng 5173. Script tự bật `GOOGLE_FAKE_VERIFIER=true` + `config:cache` rồi trả về `false` + `config:clear` trong `finally`. Dùng `config:cache` vì Apache có lúc mất `DB_CONNECTION` khi config chưa cache.
- Route `/api/auth/google` giới hạn 10 lần/phút. Chạy liên tiếp có thể gặp 429, script tự chờ và thử lại một lần.

Còn lại:
- **Origin `http://localhost`:** nút Google thật in cảnh báo "origin is not allowed" trên `http://localhost:5173`. Google yêu cầu khai báo cả `http://localhost` lẫn `http://localhost:5173` cho môi trường local. Thay đổi trên Console có thể mất vài phút mới có hiệu lực. `tools/check-google-client.php` chỉ kiểm tra endpoint OAuth, không kiểm tra được nút GIS, nên báo OK chưa chắc nút đã chạy.
- Thử một lần với tài khoản Google thật trên `http://localhost:5173`.
- Khi deploy: thêm domain production vào Authorized JavaScript origins, chạy `php artisan migrate`, và đảm bảo `GOOGLE_FAKE_VERIFIER` không bật trên server.
- `composer audit` báo 68 cảnh báo bảo mật ở 17 gói đã khóa sẵn (không liên quan tính năng này). Nên lên kế hoạch cập nhật riêng.