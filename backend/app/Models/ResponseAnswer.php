<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ResponseAnswer extends Model
{
    use HasFactory;

    protected $fillable = [
        'response_id',
        'field_id',
        'value',
        'file_path',
    ];

    protected $casts = [
        'value' => 'json',
    ];

    /**
     * Get the response that owns the answer.
     */
    public function response()
    {
        return $this->belongsTo(FormResponse::class, 'response_id');
    }

    /**
     * Get the field that owns the answer.
     */
    public function field()
    {
        return $this->belongsTo(FormField::class, 'field_id');
    }
}

