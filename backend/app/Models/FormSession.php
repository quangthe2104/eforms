<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * Holds the random-section variants handed to a respondent before they submit,
 * so reloading the page keeps the same variants.
 */
class FormSession extends Model
{
    protected $fillable = [
        'token',
        'form_id',
        'device_id',
        'user_id',
        'assignments',
        'response_id',
    ];

    protected $casts = [
        'assignments' => 'array',
    ];

    protected static function booted()
    {
        static::creating(function (FormSession $session) {
            if (empty($session->token)) {
                $session->token = (string) Str::uuid();
            }
        });
    }

    public function form()
    {
        return $this->belongsTo(Form::class);
    }

    public function response()
    {
        return $this->belongsTo(FormResponse::class, 'response_id');
    }
}
