<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FormInvitation extends Model
{
    public const TTL_DAYS = 7;

    protected $fillable = [
        'form_id',
        'email',
        'role',
        'token_hash',
        'invited_by',
        'message',
        'expires_at',
        'accepted_at',
        'accepted_by',
    ];

    protected $hidden = [
        'token_hash',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'accepted_at' => 'datetime',
    ];

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    public static function findByToken(string $token): ?self
    {
        return static::where('token_hash', static::hashToken($token))->first();
    }

    public function form()
    {
        return $this->belongsTo(Form::class);
    }

    public function inviter()
    {
        return $this->belongsTo(User::class, 'invited_by');
    }

    public function scopePending($query)
    {
        return $query->whereNull('accepted_at');
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    /** 'ok', 'used' or 'expired'. */
    public function state(): string
    {
        if ($this->accepted_at) {
            return 'used';
        }

        return $this->isExpired() ? 'expired' : 'ok';
    }
}
