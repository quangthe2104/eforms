<?php

namespace App\Services\Auth;

use Illuminate\Validation\ValidationException;

/**
 * E2E stand-in for the Google popup: accepts `fake:<email>` and `fake-unverified:<email>`.
 * Bound only when APP_ENV=local and GOOGLE_FAKE_VERIFIER=true (see AppServiceProvider).
 */
class FakeGoogleTokenVerifier extends GoogleTokenVerifier
{
    public function verify(string $idToken): array
    {
        if (!preg_match('/^(fake|fake-unverified):(.+)$/', $idToken, $m) || !filter_var($m[2], FILTER_VALIDATE_EMAIL)) {
            throw ValidationException::withMessages([
                'credential' => ['Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.'],
            ]);
        }

        $email = mb_strtolower($m[2]);

        return [
            'sub' => 'fake-' . md5($email),
            'email' => $email,
            'email_verified' => $m[1] === 'fake',
            'name' => strstr($email, '@', true),
            'picture' => null,
        ];
    }
}
