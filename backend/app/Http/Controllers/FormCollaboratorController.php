<?php

namespace App\Http\Controllers;

use App\Models\Form;
use App\Models\FormCollaborator;
use App\Models\FormInvitation;
use App\Models\User;
use App\Services\Forms\FormSharing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Sharing: people with access and pending invitations of one form.
 */
class FormCollaboratorController extends Controller
{
    private const ORDER = [Form::ROLE_OWNER => 0, Form::ROLE_EDITOR => 1, Form::ROLE_VIEWER => 2];

    public function __construct(private FormSharing $sharing)
    {
    }

    /**
     * GET /forms/{form}/collaborators
     */
    public function index(Request $request, Form $form)
    {
        $this->authorize('view', $form);
        $me = $request->user();

        $collaborators = $form->collaborators()
            ->get(['users.id', 'users.name', 'users.email'])
            ->sortBy(fn (User $user) => [self::ORDER[$user->pivot->role], mb_strtolower($user->name)])
            ->values()
            ->map(fn (User $user) => $this->collaboratorPayload($user, $user->pivot->role, $me));

        // Invitee emails are only shown to people who can manage sharing.
        $invitations = $me->can('share', $form)
            ? $form->invitations()->pending()->with('inviter:id,name')->latest()->get()->map(fn ($inv) => $this->invitationPayload($inv))
            : collect();

        return response()->json([
            'my_role' => $form->roleFor($me),
            'collaborators' => $collaborators,
            'invitations' => $invitations,
            'mail_enabled' => FormSharing::mailEnabled(),
        ]);
    }

    /**
     * POST /forms/{form}/collaborators
     * An existing account gets access right away; an unknown email gets an invitation link.
     */
    public function store(Request $request, Form $form)
    {
        $this->authorize('share', $form);

        $data = $request->validate([
            'user_id' => 'required_without:email|nullable|integer|exists:users,id',
            'email' => 'required_without:user_id|nullable|string|email|max:191',
            'role' => 'required|in:' . implode(',', Form::ROLES),
            'notify' => 'sometimes|boolean',
            'message' => 'nullable|string|max:1000',
        ]);

        if ($data['role'] === Form::ROLE_OWNER) {
            $this->authorize('manageOwners', $form);
        }

        $me = $request->user();
        $notify = $request->boolean('notify', true);
        $message = $data['message'] ?? null;
        $email = isset($data['email']) ? mb_strtolower(trim($data['email'])) : null;
        $user = isset($data['user_id'])
            ? User::find($data['user_id'])
            : User::whereRaw('LOWER(email) = ?', [$email])->first();

        if ($user) {
            if ($form->roleFor($user) !== null) {
                return response()->json([
                    'message' => 'Người này đã có quyền truy cập biểu mẫu.',
                    'errors' => ['email' => ['Người này đã có quyền truy cập biểu mẫu.']],
                ], 422);
            }

            $this->sharing->addCollaborator($form, $user, $data['role'], $me);
            $form->invitations()->pending()->where('email', mb_strtolower($user->email))->delete();
            $sent = $notify && $this->sharing->sendShared($form, $user, $data['role'], $me, $message);

            return response()->json([
                'message' => 'Đã thêm người cộng tác.',
                'type' => 'collaborator',
                'collaborator' => $this->collaboratorPayload($user, $data['role'], $me),
                'email_sent' => $sent,
                'mail_enabled' => FormSharing::mailEnabled(),
            ], 201);
        }

        [$invitation, $token] = $this->sharing->invite($form, $email, $data['role'], $me, $message);
        $sent = $notify && $this->sharing->sendInvitation($invitation, $token);

        return response()->json([
            'message' => 'Đã tạo lời mời.',
            'type' => 'invitation',
            'invitation' => $this->invitationPayload($invitation->load('inviter:id,name')),
            'invite_url' => FormSharing::inviteUrl($token),
            'email_sent' => $sent,
            'mail_enabled' => FormSharing::mailEnabled(),
        ], 201);
    }

    /**
     * PATCH /forms/{form}/collaborators/{user}
     */
    public function update(Request $request, Form $form, User $user)
    {
        $this->authorize('share', $form);

        $data = $request->validate([
            'role' => 'required|in:' . implode(',', Form::ROLES),
        ]);

        $record = $this->record($form, $user);
        if ($record->role === Form::ROLE_OWNER || $data['role'] === Form::ROLE_OWNER) {
            $this->authorize('manageOwners', $form);
        }

        if ($record->role === Form::ROLE_OWNER && $data['role'] !== Form::ROLE_OWNER && $form->ownerCount() <= 1) {
            return $this->lastOwner();
        }

        $record->update(['role' => $data['role']]);
        $form->forgetRoles();

        return response()->json([
            'message' => 'Đã đổi vai trò.',
            'collaborator' => $this->collaboratorPayload($user, $record->role, $request->user()),
        ]);
    }

    /**
     * DELETE /forms/{form}/collaborators/{user}
     * Removing yourself (leaving) is allowed for every role except the last owner.
     */
    public function destroy(Request $request, Form $form, User $user)
    {
        $leaving = $user->is($request->user());
        if (!$leaving) {
            $this->authorize('share', $form);
        }

        $record = $this->record($form, $user);
        if (!$leaving && $record->role === Form::ROLE_OWNER) {
            $this->authorize('manageOwners', $form);
        }

        if ($record->role === Form::ROLE_OWNER && $form->ownerCount() <= 1) {
            return $this->lastOwner();
        }

        $record->delete();
        $form->forgetRoles();

        return response()->json([
            'message' => $leaving ? 'Bạn đã rời khỏi biểu mẫu.' : 'Đã gỡ quyền truy cập.',
        ]);
    }

    /**
     * POST /forms/{form}/invitations/{invitation}/resend
     * Issues a new link (the old one stops working), extends 7 days and emails it when mail is configured.
     */
    public function resend(Request $request, Form $form, FormInvitation $invitation)
    {
        return $this->renew($form, $invitation, true);
    }

    /**
     * POST /forms/{form}/invitations/{invitation}/link
     * "Copy invite link": only the hash is stored, so a new link is issued (the old one stops working).
     */
    public function link(Request $request, Form $form, FormInvitation $invitation)
    {
        return $this->renew($form, $invitation, false);
    }

    /**
     * DELETE /forms/{form}/invitations/{invitation}
     */
    public function cancel(Request $request, Form $form, FormInvitation $invitation)
    {
        $this->authorizeInvitation($form, $invitation);

        $invitation->delete();

        return response()->json(['message' => 'Đã hủy lời mời.']);
    }

    private function renew(Form $form, FormInvitation $invitation, bool $send): JsonResponse
    {
        $this->authorizeInvitation($form, $invitation);

        $token = $this->sharing->renew($invitation);
        $sent = $send && $this->sharing->sendInvitation($invitation, $token);

        return response()->json([
            'message' => $sent ? 'Đã gửi lại lời mời.' : 'Đã tạo đường liên kết mời mới.',
            'invitation' => $this->invitationPayload($invitation->load('inviter:id,name')),
            'invite_url' => FormSharing::inviteUrl($token),
            'email_sent' => $sent,
            'mail_enabled' => FormSharing::mailEnabled(),
        ]);
    }

    private function authorizeInvitation(Form $form, FormInvitation $invitation): void
    {
        $this->authorize('share', $form);
        abort_if((int) $invitation->form_id !== (int) $form->id || $invitation->accepted_at !== null, 404);
        if ($invitation->role === Form::ROLE_OWNER) {
            $this->authorize('manageOwners', $form);
        }
    }

    private function record(Form $form, User $user): FormCollaborator
    {
        return FormCollaborator::where('form_id', $form->id)->where('user_id', $user->id)->firstOrFail();
    }

    private function lastOwner(): JsonResponse
    {
        return response()->json([
            'message' => 'Biểu mẫu phải còn ít nhất một chủ sở hữu.',
            'errors' => ['role' => ['Biểu mẫu phải còn ít nhất một chủ sở hữu.']],
        ], 422);
    }

    private function collaboratorPayload(User $user, string $role, User $me): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $role,
            'is_me' => $user->id === $me->id,
        ];
    }

    private function invitationPayload(FormInvitation $invitation): array
    {
        return [
            'id' => $invitation->id,
            'email' => $invitation->email,
            'role' => $invitation->role,
            'message' => $invitation->message,
            'expires_at' => $invitation->expires_at->toIso8601String(),
            'expired' => $invitation->isExpired(),
            'invited_by' => $invitation->inviter?->only(['id', 'name']),
            'created_at' => $invitation->created_at?->toIso8601String(),
        ];
    }
}
