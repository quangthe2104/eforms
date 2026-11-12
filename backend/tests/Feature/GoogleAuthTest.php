<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Auth\FakeGoogleTokenVerifier;
use App\Services\Auth\GoogleTokenVerifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class GoogleAuthTest extends TestCase
{
    use RefreshDatabase;

    private function fakeGoogle(array $payload = []): array
    {
        $payload = array_merge([
            'sub' => 'google-sub-1',
            'email' => 'new@example.com',
            'email_verified' => true,
            'name' => 'Người Dùng Google',
            'picture' => 'https://lh3.googleusercontent.com/a/photo',
        ], $payload);

        $this->mock(GoogleTokenVerifier::class)->shouldReceive('verify')->with('id-token')->andReturn($payload);

        return $payload;
    }

    private function googleLogin()
    {
        return $this->postJson('/api/auth/google', ['credential' => 'id-token']);
    }

    private function passwordUser(string $email, array $attributes = []): User
    {
        return User::create(array_merge([
            'name' => 'Có Mật Khẩu',
            'email' => $email,
            'password' => Hash::make('secret123'),
        ], $attributes));
    }

    public function test_new_email_creates_passwordless_verified_user_and_returns_token(): void
    {
        $this->fakeGoogle();

        $res = $this->googleLogin()->assertOk()
            ->assertJsonStructure(['message', 'token', 'user' => ['id', 'name', 'email', 'role', 'avatar', 'email_verified_at', 'has_password', 'has_google']])
            ->assertJsonPath('user.email', 'new@example.com')
            ->assertJsonPath('user.name', 'Người Dùng Google')
            ->assertJsonPath('user.role', 'user')
            ->assertJsonPath('user.avatar', 'https://lh3.googleusercontent.com/a/photo')
            ->assertJsonPath('user.has_password', false)
            ->assertJsonPath('user.has_google', true)
            ->assertJsonMissingPath('user.google_id')
            ->assertJsonMissingPath('user.password');

        $user = User::where('email', 'new@example.com')->firstOrFail();
        $this->assertNull($user->password);
        $this->assertSame('google-sub-1', $user->google_id);
        $this->assertNotNull($user->email_verified_at);

        $this->withToken($res->json('token'))->getJson('/api/me')->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.has_password', false)
            ->assertJsonPath('user.has_google', true);
        $this->withToken($res->json('token'))->putJson('/api/profile', ['name' => 'Tên Mới'])->assertOk()
            ->assertJsonPath('user.has_google', true);
    }

    public function test_existing_password_user_with_same_email_is_linked(): void
    {
        $existing = $this->passwordUser('Linked@Example.com');
        $this->fakeGoogle(['email' => 'linked@example.com']);

        $this->googleLogin()->assertOk()
            ->assertJsonPath('user.id', $existing->id)
            ->assertJsonPath('user.has_password', true)
            ->assertJsonPath('user.has_google', true);

        $this->assertSame(1, User::count());
        $existing->refresh();
        $this->assertSame('google-sub-1', $existing->google_id);
        $this->assertNotNull($existing->email_verified_at);
        $this->assertSame('https://lh3.googleusercontent.com/a/photo', $existing->avatar);
        $this->assertTrue(Hash::check('secret123', $existing->password));
    }

    public function test_second_login_with_same_sub_returns_same_user_even_after_email_change(): void
    {
        $this->fakeGoogle();
        $id = $this->googleLogin()->assertOk()->json('user.id');

        User::find($id)->update(['email' => 'changed@example.com']);

        $this->googleLogin()->assertOk()->assertJsonPath('user.id', $id);
        $this->assertSame(1, User::count());
    }

    public function test_unverified_google_email_is_rejected(): void
    {
        $this->passwordUser('new@example.com');
        $this->fakeGoogle(['email_verified' => false]);

        $this->googleLogin()->assertStatus(422)->assertJsonValidationErrors('credential');
        $this->assertNull(User::first()->google_id);
    }

    public function test_invalid_token_is_rejected(): void
    {
        $this->mock(GoogleTokenVerifier::class)->shouldReceive('verify')
            ->andThrow(ValidationException::withMessages(['credential' => ['Token sai']]));

        $this->googleLogin()->assertStatus(422)->assertJsonValidationErrors('credential');
        $this->postJson('/api/auth/google', [])->assertStatus(422)->assertJsonValidationErrors('credential');
        $this->assertSame(0, User::count());
    }

    public function test_email_already_linked_to_another_google_account_is_rejected(): void
    {
        $existing = $this->passwordUser('new@example.com', ['google_id' => 'other-sub']);
        $this->fakeGoogle();

        $this->googleLogin()->assertStatus(422)->assertJsonValidationErrors('credential');
        $this->assertSame('other-sub', $existing->fresh()->google_id);
        $this->assertSame(1, User::count());
    }

    public function test_real_verifier_refuses_when_client_id_is_missing(): void
    {
        config(['services.google.client_id' => null]);

        $this->googleLogin()->assertStatus(422)->assertJsonValidationErrors('credential');
    }

    public function test_fake_verifier_is_not_bound_outside_local(): void
    {
        $this->assertNotInstanceOf(FakeGoogleTokenVerifier::class, app(GoogleTokenVerifier::class));
    }

    public function test_fake_verifier_token_formats(): void
    {
        $fake = new FakeGoogleTokenVerifier();

        $this->assertSame([
            'sub' => 'fake-' . md5('a.b@example.com'),
            'email' => 'a.b@example.com',
            'email_verified' => true,
            'name' => 'a.b',
            'picture' => null,
        ], $fake->verify('fake:a.b@example.com'));
        $this->assertFalse($fake->verify('fake-unverified:a.b@example.com')['email_verified']);

        $this->expectException(ValidationException::class);
        $fake->verify('fake:not-an-email');
    }

    public function test_password_login_for_google_only_user_returns_clear_error(): void
    {
        User::create(['name' => 'G', 'email' => 'g@example.com', 'google_id' => 'sub-g']);

        $this->postJson('/api/login', ['email' => 'g@example.com', 'password' => 'whatever'])
            ->assertStatus(422)->assertJsonValidationErrors('email');
    }

    public function test_google_only_user_can_set_password_without_current_password(): void
    {
        $user = User::create(['name' => 'G', 'email' => 'g@example.com', 'google_id' => 'sub-g']);

        $this->actingAs($user)->postJson('/api/change-password', ['password' => 'newpass123', 'password_confirmation' => 'newpass123'])
            ->assertOk();
        $this->assertTrue(Hash::check('newpass123', $user->fresh()->password));

        $this->postJson('/api/login', ['email' => 'g@example.com', 'password' => 'newpass123'])->assertOk()
            ->assertJsonPath('user.has_password', true)
            ->assertJsonPath('user.has_google', true)
            ->assertJsonMissingPath('user.google_id');
    }

    public function test_change_password_still_requires_current_password_when_one_is_set(): void
    {
        $user = $this->passwordUser('p@example.com');

        $this->actingAs($user)->postJson('/api/change-password', ['password' => 'newpass123', 'password_confirmation' => 'newpass123'])
            ->assertStatus(422)->assertJsonValidationErrors('current_password');
        $this->actingAs($user)->postJson('/api/change-password', ['current_password' => 'wrong', 'password' => 'newpass123', 'password_confirmation' => 'newpass123'])
            ->assertStatus(422)->assertJsonValidationErrors('current_password');
    }
}
