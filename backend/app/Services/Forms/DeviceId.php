<?php

namespace App\Services\Forms;

use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Anonymous device id issued by the server and kept by the browser
 * (localStorage + long-lived cookie). Format: `<uuid>.<signature>`.
 */
class DeviceId
{
    public const COOKIE = 'eforms_did';
    public const COOKIE_MINUTES = 60 * 24 * 365 * 5;

    public static function issue(): string
    {
        $id = (string) Str::uuid();
        return $id . '.' . self::sign($id);
    }

    public static function isValid(?string $value): bool
    {
        if (!is_string($value) || !preg_match('/^([0-9a-f-]{36})\.([0-9a-f]{20})$/', $value, $m)) {
            return false;
        }
        return hash_equals(self::sign($m[1]), $m[2]);
    }

    public static function fromRequest(Request $request): ?string
    {
        foreach ([$request->input('device_id'), $request->header('X-Device-Id'), $request->cookie(self::COOKIE)] as $candidate) {
            if (is_string($candidate) && self::isValid($candidate)) {
                return $candidate;
            }
        }
        return null;
    }

    private static function sign(string $id): string
    {
        return substr(hash_hmac('sha256', 'device|' . $id, (string) config('app.key')), 0, 20);
    }
}
