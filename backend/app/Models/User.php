<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'google_id',
        'avatar',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'google_id',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
    ];

    /**
     * Get the forms for the user.
     */
    public function forms()
    {
        return $this->hasMany(Form::class);
    }

    /**
     * Every form the user can access through form_collaborators (own and shared), with pivot `role`.
     */
    public function sharedForms()
    {
        return $this->belongsToMany(Form::class, 'form_collaborators')
            ->withPivot(['role', 'added_by'])
            ->withTimestamps();
    }

    /**
     * Adds `has_password` / `has_google` for the signed-in user's own JSON. Not a global $appends: other
     * endpoints serialize partially selected users of other people, where these flags would be wrong or leak.
     */
    public function withAuthFlags(): static
    {
        return $this->append(['has_password', 'has_google']);
    }

    public function getHasPasswordAttribute(): bool
    {
        return $this->password !== null;
    }

    public function getHasGoogleAttribute(): bool
    {
        return $this->google_id !== null;
    }

    /**
     * Check if user is admin
     */
    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }
}

