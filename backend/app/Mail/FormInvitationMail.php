<?php

namespace App\Mail;

use App\Models\FormInvitation;
use App\Services\Forms\FormSharing;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class FormInvitationMail extends Mailable
{
    public function __construct(
        public FormInvitation $invitation,
        public string $url,
    ) {
    }

    public function envelope(): Envelope
    {
        $inviter = $this->invitation->inviter?->name ?? 'Một người dùng';

        return new Envelope(
            subject: "{$inviter} mời bạn cộng tác trên biểu mẫu \"{$this->invitation->form->title}\"",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.form-invitation',
            with: [
                'inviterName' => $this->invitation->inviter?->name ?? 'Một người dùng',
                'formTitle' => $this->invitation->form->title,
                'roleLabel' => FormSharing::roleLabel($this->invitation->role),
                'note' => $this->invitation->message,
                'url' => $this->url,
                'expiresAt' => $this->invitation->expires_at->format('d/m/Y H:i'),
            ],
        );
    }
}
