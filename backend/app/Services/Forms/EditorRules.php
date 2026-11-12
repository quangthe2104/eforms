<?php

namespace App\Services\Forms;

/**
 * Validation rules and invariants shared by the classic form/field endpoints and the editor ops endpoint.
 */
class EditorRules
{
    /** Field columns an editor may write (`key` and `order` are managed separately). */
    public const FIELD_PROPS = [
        'type', 'label', 'description', 'image_url', 'video_url', 'placeholder', 'help_text',
        'options', 'rows', 'columns', 'validation_rules', 'is_required', 'conditional_logic',
        'settings', 'random_group_key', 'variant_key',
    ];

    /** JSON object columns whose top-level entries can be set one by one (`settings.<name>`). */
    public const FIELD_OBJECT_PROPS = ['settings', 'validation_rules'];

    public const FORM_THEME_PROPS = [
        'primary_color', 'secondary_color', 'background_color', 'header_image',
        'font_family', 'header_font_size', 'question_font_size', 'text_font_size',
    ];

    public const FORM_SETTINGS_PROPS = [
        'is_public', 'accept_responses', 'show_progress_bar', 'shuffle_questions', 'limit_responses',
        'max_responses', 'require_login', 'custom_thank_you_message', 'respondent_limit', 'settings',
    ];

    /** Form columns editable through `form.update`. */
    public const FORM_PROPS = ['title', 'description', 'status', ...self::FORM_THEME_PROPS, ...self::FORM_SETTINGS_PROPS];

    public const FORM_OBJECT_PROPS = ['settings', 'respondent_limit'];

    public static function field(): array
    {
        return [
            'type' => 'string|max:255',
            'label' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'image_url' => 'nullable|string|max:255',
            'video_url' => 'nullable|string|max:255',
            'placeholder' => 'nullable|string|max:255',
            'help_text' => 'nullable|string',
            'options' => 'nullable|array',
            'rows' => 'nullable|array',
            'columns' => 'nullable|array',
            'validation_rules' => 'nullable|array',
            'is_required' => 'boolean',
            'order' => 'integer',
            'conditional_logic' => 'nullable|array',
            'settings' => 'nullable|array',
            'key' => 'nullable|string|max:64',
            'random_group_key' => 'nullable|string|max:64',
            'variant_key' => 'nullable|string|max:64',
        ];
    }

    public static function form(): array
    {
        $required = 'sometimes|required|string|max:255';

        return [
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'status' => 'sometimes|in:draft,published,closed',
            'settings' => 'nullable|array',
            'is_public' => 'sometimes|boolean',
            'accept_responses' => 'sometimes|boolean',
            'show_progress_bar' => 'sometimes|boolean',
            'shuffle_questions' => 'sometimes|boolean',
            'limit_responses' => 'sometimes|boolean',
            'max_responses' => 'nullable|integer|min:1',
            'require_login' => 'sometimes|boolean',
            'custom_thank_you_message' => 'nullable|string',
            'thumbnail' => 'nullable|string', // Base64 image data
            'primary_color' => $required,
            'secondary_color' => $required,
            'background_color' => $required,
            'header_image' => 'nullable|string', // Base64 image data
            'font_family' => $required,
            'header_font_size' => $required,
            'question_font_size' => $required,
            'text_font_size' => $required,
            'respondent_limit' => 'nullable|array',
            'respondent_limit.enabled' => 'sometimes|boolean',
            'respondent_limit.methods' => 'sometimes|array',
            'respondent_limit.methods.*' => 'in:' . implode(',', RespondentLimiter::METHODS),
            'respondent_limit.field_keys' => 'sometimes|array',
            'respondent_limit.field_keys.email' => 'nullable|string|max:64',
            'respondent_limit.field_keys.phone' => 'nullable|string|max:64',
            'respondent_limit.match' => 'sometimes|in:any,all',
            'respondent_limit.max_per_person' => 'sometimes|integer|min:1|max:1000',
            'respondent_limit.on_limit' => 'sometimes|in:block,edit',
            'respondent_limit.message' => 'nullable|string|max:2000',
        ];
    }

    /** Rules with every key prefixed, e.g. `fields.*.` for array payloads. */
    public static function prefixed(array $rules, string $prefix): array
    {
        $out = [];
        foreach ($rules as $attribute => $rule) {
            $out[$prefix . $attribute] = $rule;
        }
        return $out;
    }

    /**
     * Limiting respondents by account only works for signed-in respondents.
     *
     * @param array $data attributes about to be written (must contain `respondent_limit` to have an effect)
     */
    public static function enforceFormInvariants(array $data): array
    {
        $limit = $data['respondent_limit'] ?? null;
        if (!empty($limit['enabled']) && in_array('account', $limit['methods'] ?? [], true)) {
            $data['require_login'] = true;
        }
        return $data;
    }
}
