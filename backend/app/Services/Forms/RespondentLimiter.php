<?php

namespace App\Services\Forms;

use App\Models\Form;
use App\Models\FormResponse;
use App\Models\ResponseIdentity;

/**
 * "Limit per respondent": identifies a respondent by device id, email, phone
 * and/or account, and counts how many responses they already submitted.
 * Identity values are stored only as HMAC hashes keyed per form.
 */
class RespondentLimiter
{
    public const METHODS = ['device', 'email', 'phone', 'account'];
    public const DEFAULT_MESSAGE = 'Ông/Bà đã tham gia khảo sát này. Xin cảm ơn!';

    /** Normalized config, or null when the limit is off. */
    public static function config(Form $form): ?array
    {
        $raw = $form->respondent_limit;
        if (!is_array($raw) || empty($raw['enabled'])) {
            return null;
        }

        $methods = array_values(array_intersect(self::METHODS, (array) ($raw['methods'] ?? [])));
        if ($methods === []) {
            return null;
        }

        $message = trim((string) ($raw['message'] ?? ''));

        return [
            'enabled' => true,
            'methods' => $methods,
            'field_keys' => [
                'email' => $raw['field_keys']['email'] ?? null,
                'phone' => $raw['field_keys']['phone'] ?? null,
            ],
            'match' => ($raw['match'] ?? 'any') === 'all' ? 'all' : 'any',
            'max_per_person' => max(1, (int) ($raw['max_per_person'] ?? 1)),
            'on_limit' => ($raw['on_limit'] ?? 'block') === 'edit' ? 'edit' : 'block',
            'message' => $message !== '' ? $message : self::DEFAULT_MESSAGE,
        ];
    }

    /** Config sent to the public form (no hashes, no answers). */
    public static function publicConfig(Form $form): ?array
    {
        $config = self::config($form);
        if (!$config) {
            return null;
        }
        unset($config['message']);
        return $config;
    }

    public static function normalizeEmail(?string $email): string
    {
        return mb_strtolower(preg_replace('/\s+/u', '', (string) $email));
    }

    public static function normalizePhone(?string $phone): string
    {
        $phone = preg_replace('/[\s.\-()]/u', '', (string) $phone);
        if (str_starts_with($phone, '+84')) {
            $phone = '0' . substr($phone, 3);
        } elseif (str_starts_with($phone, '84') && strlen($phone) === 11) {
            $phone = '0' . substr($phone, 2);
        }
        return $phone;
    }

    public static function isValidPhone(string $normalized): bool
    {
        return (bool) preg_match('/^0[35789]\d{8}$/', $normalized);
    }

    public static function hash(Form $form, string $method, string $value): string
    {
        return hash_hmac('sha256', $method . '|' . $value, config('app.key') . '|' . $form->id);
    }

    /**
     * Hash the identities available for the configured methods.
     *
     * @param array<string, ?string> $known method => raw value. A method missing
     *        from $known is "not known yet" (e.g. email field on a later page).
     * @return array{identities: array<string, string>, complete: bool}
     */
    public function identities(Form $form, array $config, array $known): array
    {
        $identities = [];
        $complete = true;

        foreach ($config['methods'] as $method) {
            if (!array_key_exists($method, $known)) {
                $complete = false;
                continue;
            }

            $value = $this->normalize($method, $known[$method]);
            if ($value !== null) {
                $identities[$method] = self::hash($form, $method, $value);
            }
        }

        return ['identities' => $identities, 'complete' => $complete];
    }

    private function normalize(string $method, $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        switch ($method) {
            case 'email':
                $email = self::normalizeEmail((string) $value);
                return filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : null;
            case 'phone':
                $phone = self::normalizePhone((string) $value);
                return self::isValidPhone($phone) ? $phone : null;
            case 'device':
                return DeviceId::isValid((string) $value) ? (string) $value : null;
            default:
                return (string) $value;
        }
    }

    /**
     * @return array{reached: bool, response_ids: int[], latest_response_id: ?int, matched: string[]}
     */
    public function evaluate(Form $form, array $config, array $identities, bool $complete): array
    {
        $none = ['reached' => false, 'response_ids' => [], 'latest_response_id' => null, 'matched' => []];

        if ($identities === [] || ($config['match'] === 'all' && !$complete)) {
            return $none;
        }

        $perMethod = [];
        foreach ($identities as $method => $hash) {
            $perMethod[$method] = ResponseIdentity::where('form_id', $form->id)
                ->where('method', $method)
                ->where('value_hash', $hash)
                ->pluck('response_id')
                ->unique()
                ->values()
                ->all();
        }

        if ($config['match'] === 'all') {
            $ids = array_values(array_intersect(...array_values($perMethod)));
        } else {
            $ids = array_values(array_unique(array_merge(...array_values($perMethod))));
        }

        if ($ids === []) {
            return $none;
        }

        return [
            'reached' => count($ids) >= $config['max_per_person'],
            'response_ids' => $ids,
            'latest_response_id' => max($ids),
            'matched' => array_keys(array_filter($perMethod, fn ($list) => array_intersect($list, $ids) !== [])),
        ];
    }

    public function record(FormResponse $response, array $identities): void
    {
        ResponseIdentity::where('response_id', $response->id)->delete();

        foreach ($identities as $method => $hash) {
            ResponseIdentity::create([
                'form_id' => $response->form_id,
                'response_id' => $response->id,
                'method' => $method,
                'value_hash' => $hash,
            ]);
        }
    }
}
