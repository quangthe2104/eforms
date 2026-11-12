<?php

namespace App\Http\Controllers;

use App\Models\Form;
use App\Models\FormResponse;
use App\Models\FormSession;
use App\Models\ResponseAnswer;
use App\Services\Forms\DeviceId;
use App\Services\Forms\FormStructure;
use App\Services\Forms\RespondentLimiter;
use App\Services\Forms\SubmissionValidator;
use App\Services\Forms\VariantAssigner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Public (no auth) endpoints used by respondents.
 */
class PublicFormController extends Controller
{
    public function __construct(
        private VariantAssigner $assigner,
        private SubmissionValidator $validator,
        private RespondentLimiter $limiter,
    ) {
    }

    /**
     * GET /forms/public/{slug}
     */
    public function show(Request $request, string $slug)
    {
        $form = Form::with('fields')
            ->where('slug', $slug)
            ->where('status', 'published')
            ->where('is_public', true)
            ->firstOrFail();

        $deviceId = DeviceId::fromRequest($request) ?? DeviceId::issue();

        $data = $form->toArray();
        $data['respondent_limit'] = RespondentLimiter::publicConfig($form);
        $data['device_id'] = $deviceId;
        $data['accepting'] = $form->canAcceptResponses();
        $data['limit_status'] = $this->openingLimitStatus($form, $deviceId, $this->user($request));

        return response()->json($data)
            ->withCookie(cookie(DeviceId::COOKIE, $deviceId, DeviceId::COOKIE_MINUTES));
    }

    /**
     * POST /forms/public/{slug}/assign
     * Returns the variants assigned to this respondent, drawing new ones for
     * groups that have none yet.
     */
    public function assign(Request $request, string $slug)
    {
        $form = Form::where('slug', $slug)->firstOrFail();
        if (!$form->canAcceptResponses()) {
            return response()->json(['message' => 'Biểu mẫu này hiện không nhận câu trả lời.'], 403);
        }

        $request->validate([
            'token' => 'nullable|string|max:64',
            'answers' => 'nullable|array',
            'group_keys' => 'nullable|array',
            'group_keys.*' => 'string',
        ]);

        $structure = FormStructure::fromForm($form);
        if ($structure->groups() === []) {
            return response()->json(['token' => null, 'assignments' => (object) []]);
        }

        $session = $this->findSession($form, $request->input('token'))
            ?? $this->newSession($form, $request);

        $assignments = $this->assignMissing(
            $session,
            $structure,
            $request->input('answers', []) ?: [],
            $request->input('group_keys')
        );

        return response()->json(['token' => $session->token, 'assignments' => (object) $assignments]);
    }

    /**
     * POST /forms/public/{slug}/check-identity
     * Checks an email / phone just entered. Never returns previous answers.
     */
    public function checkIdentity(Request $request, string $slug)
    {
        $form = Form::where('slug', $slug)->firstOrFail();

        $request->validate([
            'token' => 'nullable|string|max:64',
            'values' => 'nullable|array',
            'values.email' => 'nullable|string|max:255',
            'values.phone' => 'nullable|string|max:50',
        ]);

        $config = RespondentLimiter::config($form);
        if (!$config) {
            return response()->json(['status' => 'ok']);
        }

        $values = $request->input('values', []) ?: [];
        $known = $this->strongIdentities($config, DeviceId::fromRequest($request), $this->user($request));
        foreach (['email', 'phone'] as $method) {
            if (in_array($method, $config['methods'], true) && array_key_exists($method, $values)) {
                $known[$method] = $values[$method];
            }
        }

        ['identities' => $identities, 'complete' => $complete] = $this->limiter->identities($form, $config, $known);
        $state = $this->limiter->evaluate($form, $config, $identities, $complete);

        if (!$state['reached']) {
            return response()->json(['status' => 'ok']);
        }

        if ($config['on_limit'] === 'edit') {
            $session = $this->findSession($form, $request->input('token'));
            if ($session && in_array($session->response_id, $state['response_ids'], true)) {
                return response()->json(['status' => 'ok']);
            }
            return response()->json([
                'status' => 'will_replace',
                'message' => 'Ông/Bà đã trả lời khảo sát này. Nếu gửi tiếp, câu trả lời mới sẽ thay thế câu trả lời trước.',
            ]);
        }

        return response()->json(['status' => 'limit_reached', 'message' => $config['message']]);
    }

    /**
     * POST /forms/public/{slug}/submit
     */
    public function submit(Request $request, string $slug)
    {
        $form = Form::where('slug', $slug)->firstOrFail();

        if (!$form->canAcceptResponses()) {
            return response()->json(['message' => 'Biểu mẫu này hiện không nhận câu trả lời.'], 403);
        }

        $user = $this->user($request);
        if ($form->require_login && !$user) {
            return response()->json(['message' => 'Vui lòng đăng nhập để gửi biểu mẫu này.'], 401);
        }

        $raw = $request->input('answers', []);
        $raw = is_array($raw) ? $raw : [];
        $files = $request->file('answers', []);
        $files = is_array($files) ? $files : [];

        $structure = FormStructure::fromForm($form);
        $session = $this->findSession($form, $request->input('token'));

        if ($structure->groups() !== []) {
            $session ??= $this->newSession($form, $request);
            $assignments = $this->assignMissing($session, $structure, $raw, null);
        } else {
            $assignments = [];
        }

        $result = $this->validator->validate($structure, $assignments, $raw, $files);
        if ($result['errors'] !== []) {
            return response()->json([
                'message' => 'Một số câu trả lời chưa hợp lệ.',
                'errors' => $result['errors'],
            ], 422);
        }

        $config = RespondentLimiter::config($form);
        $identities = [];
        if ($config) {
            $known = $this->strongIdentities($config, DeviceId::fromRequest($request), $user);
            foreach (['email', 'phone'] as $method) {
                if (in_array($method, $config['methods'], true)) {
                    $known[$method] = $this->answerFor($structure, $result['answers'], $config['field_keys'][$method]);
                }
            }
            $identities = $this->limiter->identities($form, $config, $known)['identities'];
        }

        $outcome = DB::transaction(function () use ($form, $request, $user, $session, $assignments, $result, $config, $identities) {
            Form::whereKey($form->id)->lockForUpdate()->first();

            $target = null;
            if ($config) {
                if ($config['on_limit'] === 'edit' && $session?->response_id) {
                    $target = FormResponse::where('form_id', $form->id)->find($session->response_id);
                }
                if (!$target) {
                    $state = $this->limiter->evaluate($form, $config, $identities, true);
                    if ($state['reached']) {
                        if ($config['on_limit'] === 'block') {
                            return response()->json(['status' => 'limit_reached', 'message' => $config['message']], 409);
                        }
                        $target = FormResponse::find($state['latest_response_id']);
                    }
                }
            }

            if (!$target && $form->limit_responses && $form->responses()->count() >= $form->max_responses) {
                return response()->json(['message' => 'Biểu mẫu đã đủ số lượng câu trả lời.'], 403);
            }

            $meta = [
                'user_id' => $user?->id,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'assignments' => $assignments ?: null,
            ];

            if ($target) {
                foreach ($target->answers as $answer) {
                    if ($answer->file_path) {
                        Storage::disk('public')->delete($answer->file_path);
                    }
                }
                $target->answers()->delete();
                $target->update($meta + ['submitted_at' => now()]);
                $response = $target;
            } else {
                $response = FormResponse::create(['form_id' => $form->id] + $meta);
            }

            foreach ($result['answers'] as $answer) {
                $field = $answer['field'];
                $data = [
                    'response_id' => $response->id,
                    'field_id' => $field->id,
                    'variant_key' => $answer['variant'],
                    'value' => $field->setting('store_hash_only') ? null : $answer['value'],
                ];
                if ($answer['file']) {
                    $data['file_path'] = $answer['file']->store('form-uploads', 'public');
                }
                ResponseAnswer::create($data);
            }

            if ($config) {
                $this->limiter->record($response, $identities);
            }
            $session?->update(['response_id' => $response->id]);

            return ['response' => $response, 'edited' => (bool) $target];
        });

        if ($outcome instanceof JsonResponse) {
            return $outcome;
        }

        return response()->json([
            'message' => 'Form submitted successfully',
            'response_id' => $outcome['response']->id,
            'edited' => $outcome['edited'],
        ], 201);
    }

    private function user(Request $request)
    {
        return $request->user() ?? $request->user('sanctum');
    }

    /** Device / account identities, which are known as soon as the form opens. */
    private function strongIdentities(array $config, ?string $deviceId, $user): array
    {
        $known = [];
        if (in_array('device', $config['methods'], true)) {
            $known['device'] = $deviceId;
        }
        if (in_array('account', $config['methods'], true)) {
            $known['account'] = $user?->id ? (string) $user->id : null;
        }
        return $known;
    }

    private function openingLimitStatus(Form $form, string $deviceId, $user): ?array
    {
        $config = RespondentLimiter::config($form);
        if (!$config) {
            return null;
        }

        $known = $this->strongIdentities($config, $deviceId, $user);
        ['identities' => $identities, 'complete' => $complete] = $this->limiter->identities($form, $config, $known);
        $state = $this->limiter->evaluate($form, $config, $identities, $complete);

        if (!$state['reached']) {
            return ['status' => 'ok'];
        }
        if ($config['on_limit'] === 'block') {
            return ['status' => 'limit_reached', 'message' => $config['message']];
        }

        $response = FormResponse::with('answers')->find($state['latest_response_id']);
        if (!$response) {
            return ['status' => 'ok'];
        }
        $session = FormSession::where('form_id', $form->id)->where('response_id', $response->id)->latest('id')->first()
            ?? FormSession::create([
                'form_id' => $form->id,
                'device_id' => $deviceId,
                'user_id' => $user?->id,
                'assignments' => $response->assignments,
                'response_id' => $response->id,
            ]);

        return [
            'status' => 'editing',
            'token' => $session->token,
            'response_id' => $response->id,
            'assignments' => (object) ($response->assignments ?? []),
            'answers' => (object) $this->answersPayload($response),
        ];
    }

    /** Previous answers keyed like submissions (`id` or `id@variant`). */
    private function answersPayload(FormResponse $response): array
    {
        $payload = [];
        foreach ($response->answers as $answer) {
            if ($answer->file_path || $answer->value === null) {
                continue;
            }
            $key = $answer->variant_key ? $answer->field_id . '@' . $answer->variant_key : (string) $answer->field_id;
            $payload[$key] = $answer->value;
        }
        return $payload;
    }

    private function answerFor(FormStructure $structure, array $answers, ?string $fieldKey): ?string
    {
        $field = $structure->field($fieldKey);
        if (!$field) {
            return null;
        }
        foreach ($answers as $answer) {
            if ($answer['field']->id === $field->id && is_string($answer['value'])) {
                return $answer['value'];
            }
        }
        return null;
    }

    private function findSession(Form $form, $token): ?FormSession
    {
        if (!is_string($token) || $token === '') {
            return null;
        }

        $session = FormSession::where('form_id', $form->id)->where('token', $token)->first();
        if ($session && $session->response_id && (RespondentLimiter::config($form)['on_limit'] ?? null) !== 'edit') {
            return null;
        }
        return $session;
    }

    private function newSession(Form $form, Request $request): FormSession
    {
        return FormSession::create([
            'form_id' => $form->id,
            'device_id' => DeviceId::fromRequest($request),
            'user_id' => $this->user($request)?->id,
            'assignments' => [],
        ]);
    }

    /**
     * @param string[]|null $groupKeys limit to these groups (null = all)
     */
    private function assignMissing(FormSession $session, FormStructure $structure, array $answers, ?array $groupKeys): array
    {
        $assignments = $session->assignments ?? [];
        $changed = false;

        foreach ($structure->groups() as $groupKey => $header) {
            if (!empty($assignments[$groupKey]) || ($groupKeys !== null && !in_array($groupKey, $groupKeys, true))) {
                continue;
            }
            $assignments[$groupKey] = $this->assigner->pick($header, $structure, $answers);
            $changed = true;
        }

        if ($changed) {
            $session->update(['assignments' => $assignments]);
        }

        return array_intersect_key($assignments, $structure->groups());
    }
}
