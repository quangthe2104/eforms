<?php

namespace App\Services\Forms;

use App\Mail\FormInvitationMail;
use App\Mail\FormSharedMail;
use App\Models\Form;
use App\Models\FormCollaborator;
use App\Models\FormInvitation;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * Collaborators and invitations. Invitation tokens are shown once (in the API response / email);
 * only their sha256 hash is stored, so "copy link" on a pending invitation issues a new token.
 */
class FormSharing
{
    private const RANK = [Form::ROLE_VIEWER => 1, Form::ROLE_EDITOR => 2, Form::ROLE_OWNER => 3];

    public static function mailEnabled(): bool
    {
        return !in_array(config('mail.default'), ['log', 'array'], true);
    }

    public static function inviteUrl(string $token): string
    {
        return rtrim((string) config('app.frontend_url'), '/') . '/invite/' . $token;
    }

    public static function formUrl(Form $form): string
    {
        return rtrim((string) config('app.frontend_url'), '/') . '/forms/' . $form->id . '/edit';
    }

    public function addCollaborator(Form $form, User $user, string $role, ?User $addedBy): FormCollaborator
    {
        $collaborator = FormCollaborator::create([
            'form_id' => $form->id,
            'user_id' => $user->id,
            'role' => $role,
            'added_by' => $addedBy?->id,
        ]);
        $form->forgetRoles();

        return $collaborator;
    }

    /**
     * Creates (or replaces) the pending invitation for this email. Returns [invitation, plain token].
     *
     * @return array{0: FormInvitation, 1: string}
     */
    public function invite(Form $form, string $email, string $role, User $inviter, ?string $message): array
    {
        $email = mb_strtolower(trim($email));
        $token = $this->newToken();
        $invitation = FormInvitation::where('form_id', $form->id)
            ->pending()
            ->where('email', $email)
            ->first() ?? new FormInvitation(['form_id' => $form->id, 'email' => $email]);

        $invitation->fill([
            'role' => $role,
            'token_hash' => FormInvitation::hashToken($token),
            'invited_by' => $inviter->id,
            'message' => $message,
            'expires_at' => now()->addDays(FormInvitation::TTL_DAYS),
        ])->save();

        return [$invitation, $token];
    }

    /** New token + 7 more days; the previous link stops working. */
    public function renew(FormInvitation $invitation): string
    {
        $token = $this->newToken();
        $invitation->update([
            'token_hash' => FormInvitation::hashToken($token),
            'expires_at' => now()->addDays(FormInvitation::TTL_DAYS),
        ]);

        return $token;
    }

    /**
     * Single use: the row is locked so two concurrent accepts cannot both succeed.
     * An existing collaborator keeps the higher of the two roles.
     */
    public function accept(FormInvitation $invitation, User $user): ?string
    {
        return DB::transaction(function () use ($invitation, $user) {
            $locked = FormInvitation::whereKey($invitation->id)->lockForUpdate()->first();
            if (!$locked || $locked->state() !== 'ok') {
                return null;
            }

            $existing = FormCollaborator::where('form_id', $locked->form_id)->where('user_id', $user->id)->first();
            if (!$existing) {
                FormCollaborator::create([
                    'form_id' => $locked->form_id,
                    'user_id' => $user->id,
                    'role' => $locked->role,
                    'added_by' => $locked->invited_by,
                ]);
                $role = $locked->role;
            } elseif (self::RANK[$locked->role] > self::RANK[$existing->role]) {
                $existing->update(['role' => $locked->role]);
                $role = $locked->role;
            } else {
                $role = $existing->role;
            }

            $locked->update(['accepted_at' => now(), 'accepted_by' => $user->id]);
            $invitation->setRawAttributes($locked->getAttributes(), true);

            return $role;
        });
    }

    /** Returns whether the email was handed to the mailer. */
    public function sendInvitation(FormInvitation $invitation, string $token): bool
    {
        return $this->send($invitation->email, new FormInvitationMail($invitation, self::inviteUrl($token)));
    }

    public function sendShared(Form $form, User $user, string $role, User $by, ?string $message): bool
    {
        return $this->send($user->email, new FormSharedMail($form, $role, $by, $message, self::formUrl($form)));
    }

    public static function roleLabel(string $role): string
    {
        return match ($role) {
            Form::ROLE_OWNER => 'Chủ sở hữu',
            Form::ROLE_EDITOR => 'Người chỉnh sửa',
            default => 'Người xem',
        };
    }

    private function send(string $to, $mailable): bool
    {
        if (!self::mailEnabled()) {
            return false;
        }

        try {
            Mail::to($to)->send($mailable);

            return true;
        } catch (\Throwable $e) {
            Log::warning('Sharing email failed: ' . $e->getMessage());

            return false;
        }
    }

    private function newToken(): string
    {
        return Str::random(48);
    }
}
