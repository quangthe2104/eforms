<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One applied batch of editor operations; `revision` is the form revision it produced.
 */
class FormChange extends Model
{
    const UPDATED_AT = null;

    protected $fillable = ['form_id', 'revision', 'user_id', 'client_id', 'ops'];

    protected $casts = [
        'ops' => 'array',
        'revision' => 'integer',
    ];
}
