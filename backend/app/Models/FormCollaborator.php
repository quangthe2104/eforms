<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FormCollaborator extends Model
{
    protected $fillable = [
        'form_id',
        'user_id',
        'role',
        'added_by',
    ];

    public function form()
    {
        return $this->belongsTo(Form::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
