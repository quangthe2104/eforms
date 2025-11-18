<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Form extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'title',
        'description',
        'slug',
        'settings',
        'status',
        'is_public',
        'accept_responses',
        'show_progress_bar',
        'shuffle_questions',
        'limit_responses',
        'max_responses',
        'require_login',
        'custom_thank_you_message',
    ];

    protected $casts = [
        'settings' => 'array',
        'is_public' => 'boolean',
        'accept_responses' => 'boolean',
        'show_progress_bar' => 'boolean',
        'shuffle_questions' => 'boolean',
        'limit_responses' => 'boolean',
        'require_login' => 'boolean',
        'max_responses' => 'integer',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($form) {
            if (empty($form->slug)) {
                $form->slug = Str::slug($form->title) . '-' . Str::random(8);
            }
        });
    }

    /**
     * Get the user that owns the form.
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the fields for the form.
     */
    public function fields()
    {
        return $this->hasMany(FormField::class)->orderBy('order');
    }

    /**
     * Get the responses for the form.
     */
    public function responses()
    {
        return $this->hasMany(FormResponse::class);
    }

    /**
     * Check if form can accept responses
     */
    public function canAcceptResponses(): bool
    {
        if (!$this->accept_responses || $this->status !== 'published') {
            return false;
        }

        if ($this->limit_responses && $this->responses()->count() >= $this->max_responses) {
            return false;
        }

        return true;
    }
}

