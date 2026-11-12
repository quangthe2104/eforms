<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ResponseIdentity extends Model
{
    protected $fillable = [
        'form_id',
        'response_id',
        'method',
        'value_hash',
    ];

    public function response()
    {
        return $this->belongsTo(FormResponse::class, 'response_id');
    }
}
