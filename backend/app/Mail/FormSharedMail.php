<?php

namespace App\Mail;

use App\Models\Form;
use App\Models\User;
use App\Services\Forms\FormSharing;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class FormSharedMail extends Mailable
{
    public function __construct(
        public Form $form,
        public string $role,
        public User $sharedBy,
        public ?string $note,
        public string $url,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "{$this->sharedBy->name} đã chia sẻ biểu mẫu \"{$this->form->title}\" với bạn",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.form-shared',
            with: [
                'sharedByName' => $this->sharedBy->name,
                'formTitle' => $this->form->title,
                'roleLabel' => FormSharing::roleLabel($this->role),
                'note' => $this->note,
                'url' => $this->url,
            ],
        );
    }
}
