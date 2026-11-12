<?php

namespace App\Http\Controllers;

use App\Models\FormInvitation;
use App\Models\User;
use App\Services\Forms\FormSharing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Invite link pages: /invite/{token} on the frontend.
 */
class InvitationController extends Controller
{
    public function __construct(private FormSharing $sharing)
    {
    }

    /**
     * GET /invitations/{token} (public)
     */
    public function show(string $token)
    {
        $invitation = FormInvitation::findByToken($token);
        if ($error = self::unusable($invitation)) {
            return $error;
        }

        return response()->json([
            'email' => $invitation->email,
            'role' => $invitation->role,
            'expires_at' => $invitation->expires_at->toIso8601String(),
            'form' => ['id' => $invitation->form->id, 'title' => $invitation->form->title],
            'inviter' => $invitation->inviter ? ['name' => $invitation->inviter->name] : null,
            'has_account' => User::whereRaw('LOWER(email) = ?', [$invitation->email])->exists(),
        ]);
    }

    /**
     * POST /invitations/{token}/accept — the signed-in account must use the invited email.
     */
    public function accept(Request $request, string $token)
    {
        $invitation = FormInvitation::findByToken($token);
        if ($error = self::unusable($invitation)) {
            return $error;
        }

        $user = $request->user();
        if (mb_strtolower($user->email) !== mb_strtolower($invitation->email)) {
            return response()->json([
                'reason' => 'wrong_email',
                'email' => $invitation->email,
                'message' => "Lời mời này gửi tới {$invitation->email}. Hãy đăng nhập đúng tài khoản.",
            ], 403);
        }

        $role = $this->sharing->accept($invitation, $user);
        if ($role === null) {
            return self::unusable($invitation->fresh());
        }

        return response()->json([
            'message' => 'Đã nhận lời mời.',
            'form_id' => $invitation->form_id,
            'role' => $role,
        ]);
    }

    /**
     * 404 `invalid` (unknown / cancelled / form deleted), 410 `used` or `expired`; null when usable.
     */
    public static function unusable(?FormInvitation $invitation): ?JsonResponse
    {
        if (!$invitation || !$invitation->form) {
            return response()->json([
                'reason' => 'invalid',
                'message' => 'Lời mời không hợp lệ hoặc đã bị hủy. Hãy nhờ người mời gửi lại lời mời.',
            ], 404);
        }

        return match ($invitation->state()) {
            'used' => response()->json([
                'reason' => 'used',
                'message' => 'Lời mời này đã được sử dụng.',
            ], 410),
            'expired' => response()->json([
                'reason' => 'expired',
                'message' => 'Lời mời đã hết hạn. Hãy nhờ người mời gửi lại lời mời.',
            ], 410),
            default => null,
        };
    }
}
