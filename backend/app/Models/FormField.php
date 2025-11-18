<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FormField extends Model
{
    use HasFactory;

    protected $fillable = [
        'form_id',
        'type',
        'label',
        'placeholder',
        'help_text',
        'options',
        'rows',
        'columns',
        'validation_rules',
        'is_required',
        'order',
        'conditional_logic',
    ];

    protected $casts = [
        'options' => 'array',
        'rows' => 'array',
        'columns' => 'array',
        'validation_rules' => 'array',
        'conditional_logic' => 'array',
        'is_required' => 'boolean',
        'order' => 'integer',
    ];

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
        ];
    }
}

