<?php

namespace App\Services\Auth;

use Google\Auth\Cache\FileSystemCacheItemPool;
use Google\Client;
use Illuminate\Validation\ValidationException;

/**
 * Verifies a Google Identity Services ID token (signature, iss, exp, aud = our client ID).
 */
class GoogleTokenVerifier
{
    /**
     * @return array{sub: string, email: string, email_verified: bool, name: ?string, picture: ?string}
     */
    public function verify(string $idToken): array
    {
        $clientId = config('services.google.client_id');
        if (!$clientId) {
            // Without a client ID the library skips the audience check and would accept tokens issued to any app.
            throw ValidationException::withMessages([
                'credential' => ['Đăng nhập bằng Google chưa được cấu hình trên máy chủ.'],
            ]);
        }

        $client = new Client(['client_id' => $clientId]);
        $client->setCache(new FileSystemCacheItemPool(storage_path('framework/cache/google')));

        try {
            $payload = $client->verifyIdToken($idToken);
        } catch (\UnexpectedValueException|\OutOfBoundsException|\InvalidArgumentException|\DomainException|\LogicException) {
            $payload = false;
        }

        if (!is_array($payload) || empty($payload['sub']) || empty($payload['email'])) {
            throw ValidationException::withMessages([
                'credential' => ['Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.'],
            ]);
        }

        return self::normalize($payload);
    }

    protected static function normalize(array $payload): array
    {
        $verified = $payload['email_verified'] ?? false;

        return [
            'sub' => (string) $payload['sub'],
            'email' => (string) $payload['email'],
            'email_verified' => $verified === true || $verified === 'true',
            'name' => $payload['name'] ?? null,
            'picture' => $payload['picture'] ?? null,
        ];
    }
}
