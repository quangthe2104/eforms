<?php

namespace App\Http\Controllers;

use App\Models\FormInvitation;
use App\Models\User;
use App\Services\Auth\GoogleTokenVerifier;
use App\Services\Forms\FormSharing;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Register a new user; with `invite_token` the email must match the invitation,
     * which is accepted right away (`form_id` is returned).
     */
    public function register(Request $request, FormSharing $sharing)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'invite_token' => 'nullable|string|max:255',
        ]);

        $invitation = null;
        if ($request->filled('invite_token')) {
            $invitation = FormInvitation::findByToken($request->invite_token);
            if (!$invitation || !$invitation->form || $invitation->state() !== 'ok') {
                throw ValidationException::withMessages([
                    'invite_token' => ['Lời mời không hợp lệ hoặc đã hết hạn. Hãy nhờ người mời gửi lại lời mời.'],
                ]);
            }
            if (mb_strtolower(trim($request->email)) !== mb_strtolower($invitation->email)) {
                throw ValidationException::withMessages([
                    'email' => ["Email phải trùng với email được mời ({$invitation->email})."],
                ]);
            }
        }

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'role' => 'user',
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        $data = [
            'message' => 'User registered successfully',
            'user' => $user->withAuthFlags(),
            'token' => $token,
        ];

        if ($invitation) {
            $role = $sharing->accept($invitation, $user);
            $data['form_id'] = $role !== null ? $invitation->form_id : null;
            $data['form_role'] = $role;
        }

        return response()->json($data, 201);
    }

    /**
     * Login user
     */
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        if ($user && $user->password === null) {
            throw ValidationException::withMessages([
                'email' => ['Tài khoản này đăng nhập bằng Google. Hãy dùng nút "Đăng nhập bằng Google" hoặc đặt mật khẩu trong Hồ sơ.'],
            ]);
        }

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Login successful',
            'user' => $user->withAuthFlags(),
            'token' => $token,
        ]);
    }

    /**
     * Sign in with a Google ID token: find the user by Google `sub`, else link the account with the same
     * (verified) email, else create one without a password.
     */
    public function google(Request $request, GoogleTokenVerifier $verifier)
    {
        $request->validate([
            'credential' => 'required|string|max:4096',
        ]);

        $google = $verifier->verify($request->credential);

        if ($google['email_verified'] !== true) {
            throw ValidationException::withMessages([
                'credential' => ['Email Google chưa được xác minh.'],
            ]);
        }

        $user = User::where('google_id', $google['sub'])->first();

        if (!$user) {
            $user = User::whereRaw('LOWER(email) = ?', [mb_strtolower($google['email'])])->first();

            if ($user) {
                if ($user->google_id !== null) {
                    throw ValidationException::withMessages([
                        'credential' => ['Email này đã được liên kết với một tài khoản Google khác.'],
                    ]);
                }

                $user->google_id = $google['sub'];
                $user->email_verified_at ??= now();
                $user->avatar ??= $google['picture'];
                $user->save();
            } else {
                $user = new User([
                    'name' => mb_substr($google['name'] ?: strstr($google['email'], '@', true), 0, 255),
                    'email' => $google['email'],
                    'google_id' => $google['sub'],
                    'avatar' => $google['picture'],
                    'role' => 'user',
                ]);
                $user->email_verified_at = now();
                $user->save();
                $user->refresh();
            }
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Login successful',
            'user' => $user->withAuthFlags(),
            'token' => $token,
        ]);
    }

    /**
     * Logout user
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logged out successfully',
        ]);
    }

    /**
     * Get authenticated user
     */
    public function me(Request $request)
    {
        return response()->json([
            'user' => $request->user()->withAuthFlags(),
        ]);
    }

    /**
     * Update user profile
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|string|email|max:255|unique:users,email,' . $user->id,
        ]);

        $user->update($request->only(['name', 'email']));

        return response()->json([
            'message' => 'Profile updated successfully',
            'user' => $user->withAuthFlags(),
        ]);
    }

    /**
     * Change password
     */
    public function changePassword(Request $request)
    {
        $user = $request->user();
        $hasPassword = $user->password !== null;

        $request->validate([
            'current_password' => $hasPassword ? 'required' : 'nullable',
            'password' => 'required|string|min:8|confirmed',
        ]);

        if ($hasPassword && !Hash::check($request->current_password, $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['The provided password is incorrect.'],
            ]);
        }

        $user->update([
            'password' => Hash::make($request->password),
        ]);

        return response()->json([
            'message' => 'Password changed successfully',
        ]);
    }
}

