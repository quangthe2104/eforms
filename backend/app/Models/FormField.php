<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class FormField extends Model
{
    use HasFactory;

    protected $fillable = [
        'form_id',
        'type',
        'label',
        'description',
        'image_url',
        'video_url',
        'placeholder',
        'help_text',
        'options',
        'rows',
        'columns',
        'validation_rules',
        'is_required',
        'order',
        'conditional_logic',
        'key',
        'settings',
        'random_group_key',
        'variant_key',
    ];

    protected $casts = [
        'options' => 'array',
        'rows' => 'array',
        'columns' => 'array',
        'validation_rules' => 'array',
        'conditional_logic' => 'array',
        'settings' => 'array',
        'is_required' => 'boolean',
        'order' => 'integer',
    ];

    /**
     * Types that only display content and never collect an answer.
     */
    public const NON_ANSWER_TYPES = ['section', 'description', 'image', 'video', 'random_section'];

    protected static function booted()
    {
        static::creating(function (FormField $field) {
            if (empty($field->key)) {
                $field->key = (string) Str::uuid();
            }
        });
    }

    public function collectsAnswer(): bool
    {
        return !in_array($this->type, self::NON_ANSWER_TYPES, true);
    }

    public function setting(string $name, $default = null)
    {
        return data_get($this->settings ?? [], $name, $default);
    }

    /**
     * Get the form that owns the field.
     */
    public function form()
    {
        return $this->belongsTo(Form::class);
    }

    /**
     * Get the answers for the field.
     */
    public function answers()
    {
        return $this->hasMany(ResponseAnswer::class, 'field_id');
    }

    /**
     * Field types available
     */
    public static function fieldTypes(): array
    {
        return [
            'short_text' => 'Short Text',
            'long_text' => 'Long Text',
            'email' => 'Email',
            'number' => 'Number',
            'phone' => 'Phone',
            'url' => 'URL',
            'date' => 'Date',
            'time' => 'Time',
            'datetime' => 'Date & Time',
            'dropdown' => 'Dropdown',
            'radio' => 'Multiple Choice',
            'checkbox' => 'Checkboxes',
            'multiple_choice_grid' => 'Multiple Choice Grid',
            'checkbox_grid' => 'Checkbox Grid',
            'file_upload' => 'File Upload',
            'rating' => 'Rating',
            'scale' => 'Linear Scale',
            'section' => 'Section Header',
            'random_section' => 'Random Section',
        ];
    }
}

