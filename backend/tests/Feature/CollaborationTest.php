<?php

namespace Tests\Feature;

use App\Mail\FormInvitationMail;
use App\Mail\FormSharedMail;
use App\Models\Form;
use App\Models\FormCollaborator;
use App\Models\FormInvitation;
use App\Models\User;
use App\Services\Forms\FormSharing;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class CollaborationTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private Form $form;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = $this->namedUser('Chủ Form', 'owner@example.com');
        $this->form = $this->makeForm(['user_id' => $this->owner->id, 'title' => 'Khảo sát']);
    }

    // --- roles, ownership ---------------------------------------------------

    public function test_creator_becomes_owner_and_form_json_has_my_role(): void
    {
        $id = $this->actingAs($this->owner)->postJson('/api/forms', ['title' => 'Mới'])
            ->assertCreated()->assertJsonPath('form.my_role', 'owner')->json('form.id');

        $this->assertDatabaseHas('form_collaborators', ['form_id' => $id, 'user_id' => $this->owner->id, 'role' => 'owner']);
        $this->actingAs($this->owner)->putJson("/api/forms/{$id}", ['title' => 'Đổi'])->assertJsonPath('form.my_role', 'owner');
    }

    public function test_index_lists_own_and_shared_forms_with_role_and_owner(): void
    {
        $other = $this->namedUser('Người khác', 'other@example.com');
        $shared = $this->makeForm(['user_id' => $other->id, 'title' => 'Được chia sẻ']);
        $this->share($shared, $this->owner, 'editor');
        $this->makeForm(['user_id' => $other->id, 'title' => 'Không liên quan']);

        $all = collect($this->actingAs($this->owner)->getJson('/api/forms')->assertOk()->json('data'))->keyBy('title');
        $this->assertEqualsCanonicalizing(['Được chia sẻ', 'Khảo sát'], $all->keys()->all());
        $this->assertSame('owner', $all['Khảo sát']['my_role']);
        $this->assertSame('editor', $all['Được chia sẻ']['my_role']);
        $this->assertSame(['id' => $other->id, 'name' => 'Người khác', 'email' => 'other@example.com'], $all['Được chia sẻ']['owner']);
        $this->assertSame(2, $all['Được chia sẻ']['collaborators_count']);
        $this->assertArrayNotHasKey('collaborators', $all['Được chia sẻ']);

        $this->assertSame(['Khảo sát'], array_column($this->actingAs($this->owner)->getJson('/api/forms?filter=mine')->json('data'), 'title'));
        $this->assertSame(['Được chia sẻ'], array_column($this->actingAs($this->owner)->getJson('/api/forms?filter=shared')->json('data'), 'title'));
    }

    public function test_last_owner_cannot_be_demoted_or_removed(): void
    {
        $url = "/api/forms/{$this->form->id}/collaborators/{$this->owner->id}";
        $this->actingAs($this->owner)->patchJson($url, ['role' => 'editor'])->assertStatus(422);
        $this->actingAs($this->owner)->deleteJson($url)->assertStatus(422);

        $second = $this->namedUser('Đồng sở hữu', 'co@example.com');
        $this->share($this->form, $second, 'owner');

        $this->actingAs($second)->patchJson($url, ['role' => 'editor'])->assertOk()->assertJsonPath('collaborator.role', 'editor');
        $this->actingAs($second)->deleteJson("/api/forms/{$this->form->id}/collaborators/{$second->id}")->assertStatus(422);
        $this->assertSame(1, $this->form->ownerCount());
    }

    public function test_any_role_can_leave_but_loses_access(): void
    {
        foreach (['viewer', 'editor'] as $role) {
            $user = $this->namedUser(ucfirst($role), "{$role}@example.com");
            $this->share($this->form, $user, $role);

            $this->actingAs($user)->deleteJson("/api/forms/{$this->form->id}/collaborators/{$user->id}")
                ->assertOk()->assertJsonPath('message', 'Bạn đã rời khỏi biểu mẫu.');
            $this->actingAs($user)->getJson("/api/forms/{$this->form->id}")->assertForbidden();
        }

        $co = $this->namedUser('Co', 'co@example.com');
        $this->share($this->form, $co, 'owner');
        $this->actingAs($this->owner)->deleteJson("/api/forms/{$this->form->id}/collaborators/{$this->owner->id}")->assertOk();
        $this->assertSame('owner', $this->form->fresh()->roleFor($co));
    }

    public function test_editor_cannot_remove_or_demote_owner_but_manages_viewers(): void
    {
        $editor = $this->namedUser('Editor', 'editor@example.com');
        $viewer = $this->namedUser('Viewer', 'viewer@example.com');
        $this->share($this->form, $editor, 'editor');
        $this->share($this->form, $viewer, 'viewer');

        $this->actingAs($editor)->deleteJson("/api/forms/{$this->form->id}/collaborators/{$this->owner->id}")->assertForbidden();
        $this->actingAs($editor)->patchJson("/api/forms/{$this->form->id}/collaborators/{$viewer->id}", ['role' => 'owner'])->assertForbidden();
        $this->actingAs($editor)->patchJson("/api/forms/{$this->form->id}/collaborators/{$viewer->id}", ['role' => 'editor'])->assertOk();
        $this->actingAs($editor)->patchJson("/api/forms/{$this->form->id}/collaborators/999999", ['role' => 'editor'])->assertNotFound();
    }

    public function test_duplicate_belongs_to_whoever_duplicates(): void
    {
        $viewer = $this->namedUser('Viewer', 'viewer@example.com');
        $this->share($this->form, $viewer, 'viewer');

        $copy = $this->actingAs($viewer)->postJson("/api/forms/{$this->form->id}/duplicate")
            ->assertCreated()->assertJsonPath('form.my_role', 'owner')->json('form');

        $this->assertSame($viewer->id, $copy['user_id']);
        $this->assertNull(Form::find($copy['id'])->roleFor($this->owner));
    }

    // --- adding people ------------------------------------------------------

    public function test_existing_account_is_added_directly_without_invitation(): void
    {
        $user = $this->namedUser('Bình', 'binh@example.com');

        $this->actingAs($this->owner)->postJson("/api/forms/{$this->form->id}/collaborators", ['email' => 'BINH@example.com', 'role' => 'editor'])
            ->assertCreated()
            ->assertJsonPath('type', 'collaborator')
            ->assertJsonPath('collaborator.id', $user->id)
            ->assertJsonPath('collaborator.role', 'editor')
            ->assertJsonPath('email_sent', false)
            ->assertJsonPath('mail_enabled', false);

        $this->assertSame(0, FormInvitation::count());
        $this->actingAs($this->owner)->postJson("/api/forms/{$this->form->id}/collaborators", ['user_id' => $user->id, 'role' => 'viewer'])
            ->assertStatus(422);
    }

    public function test_notification_email_only_when_smtp_configured_and_requested(): void
    {
        Mail::fake();
        config(['mail.default' => 'smtp']);
        $a = $this->namedUser('A', 'a@example.com');
        $b = $this->namedUser('B', 'b@example.com');

        $this->actingAs($this->owner)->postJson("/api/forms/{$this->form->id}/collaborators", ['user_id' => $a->id, 'role' => 'viewer', 'message' => 'Xem giúp'])
            ->assertJsonPath('email_sent', true)->assertJsonPath('mail_enabled', true);
        $this->actingAs($this->owner)->postJson("/api/forms/{$this->form->id}/collaborators", ['user_id' => $b->id, 'role' => 'viewer', 'notify' => false])
            ->assertJsonPath('email_sent', false);

        Mail::assertSent(FormSharedMail::class, fn ($mail) => $mail->hasTo('a@example.com') && $mail->note === 'Xem giúp');
        Mail::assertSent(FormSharedMail::class, 1);
    }

    public function test_invitation_stores_only_token_hash_and_returns_link_once(): void
    {
        Mail::fake();

        $res = $this->actingAs($this->owner)->postJson("/api/forms/{$this->form->id}/collaborators", ['email' => 'New@Example.com', 'role' => 'editor'])
            ->assertCreated()
            ->assertJsonPath('type', 'invitation')
            ->assertJsonPath('invitation.email', 'new@example.com')
            ->assertJsonPath('invitation.role', 'editor')
            ->assertJsonPath('email_sent', false)
            ->assertJsonPath('mail_enabled', false)
            ->assertJsonMissingPath('invitation.token_hash');

        $token = $this->tokenFrom($res->json('invite_url'));
        $this->assertGreaterThanOrEqual(40, strlen($token));
        $this->assertStringStartsWith(rtrim(config('app.frontend_url'), '/') . '/invite/', $res->json('invite_url'));

        $row = FormInvitation::firstOrFail();
        $this->assertSame(hash('sha256', $token), $row->token_hash);
        $this->assertTrue($row->expires_at->between(now()->addDays(7)->subMinute(), now()->addDays(7)->addMinute()));
        Mail::assertNothingSent();

        // Inviting the same email again replaces the pending invitation.
        $this->actingAs($this->owner)->postJson("/api/forms/{$this->form->id}/collaborators", ['email' => 'new@example.com', 'role' => 'viewer'])->assertCreated();
        $this->assertSame(1, FormInvitation::count());
        $this->getJson("/api/invitations/{$token}")->assertNotFound();
    }

    public function test_invitation_email_sent_when_smtp_configured(): void
    {
        Mail::fake();
        config(['mail.default' => 'smtp']);

        $url = $this->actingAs($this->owner)->postJson("/api/forms/{$this->form->id}/collaborators", ['email' => 'new@example.com', 'role' => 'viewer'])
            ->assertJsonPath('email_sent', true)->json('invite_url');

        Mail::assertSent(FormInvitationMail::class, fn ($mail) => $mail->hasTo('new@example.com') && $mail->url === $url);

        $html = (new FormInvitationMail(FormInvitation::firstOrFail(), $url))->render();
        $this->assertStringContainsString($url, $html);
        $this->assertStringContainsString('Người xem', $html);
    }

    // --- invite link --------------------------------------------------------

    public function test_invitation_info_and_accept_once(): void
    {
        $token = $this->invite('lan@example.com', 'editor');
        $lan = $this->namedUser('Lan', 'Lan@Example.com');

        $this->getJson("/api/invitations/{$token}")->assertOk()
            ->assertJsonPath('email', 'lan@example.com')
            ->assertJsonPath('role', 'editor')
            ->assertJsonPath('form.title', 'Khảo sát')
            ->assertJsonPath('inviter.name', 'Chủ Form')
            ->assertJsonPath('has_account', true);

        $this->actingAs($lan)->postJson("/api/invitations/{$token}/accept")
            ->assertOk()->assertJsonPath('form_id', $this->form->id)->assertJsonPath('role', 'editor');
        $this->assertSame('editor', $this->form->fresh()->roleFor($lan));

        $this->actingAs($lan)->postJson("/api/invitations/{$token}/accept")->assertStatus(410)->assertJsonPath('reason', 'used');
        $this->getJson("/api/invitations/{$token}")->assertStatus(410)->assertJsonPath('reason', 'used');
    }

    public function test_wrong_email_expired_and_unknown_tokens_are_rejected(): void
    {
        $token = $this->invite('lan@example.com', 'viewer');
        $other = $this->namedUser('Khác', 'khac@example.com');

        $this->actingAs($other)->postJson("/api/invitations/{$token}/accept")
            ->assertForbidden()->assertJsonPath('reason', 'wrong_email')->assertJsonPath('email', 'lan@example.com');
        $this->assertNull($this->form->fresh()->roleFor($other));

        FormInvitation::query()->update(['expires_at' => now()->subMinute()]);
        $this->getJson("/api/invitations/{$token}")->assertStatus(410)->assertJsonPath('reason', 'expired');
        $lan = $this->namedUser('Lan', 'lan@example.com');
        $this->actingAs($lan)->postJson("/api/invitations/{$token}/accept")->assertStatus(410)->assertJsonPath('reason', 'expired');

        $this->getJson('/api/invitations/' . str_repeat('x', 48))->assertNotFound()->assertJsonPath('reason', 'invalid');
    }

    public function test_accepting_keeps_the_higher_existing_role(): void
    {
        $lan = $this->namedUser('Lan', 'lan@example.com');
        $token = $this->invite('lan@example.com', 'viewer');
        $this->share($this->form, $lan, 'editor');

        $this->actingAs($lan)->postJson("/api/invitations/{$token}/accept")->assertOk()->assertJsonPath('role', 'editor');
    }

    public function test_resend_and_copy_link_issue_a_new_token(): void
    {
        $old = $this->invite('lan@example.com', 'viewer');
        $invitation = FormInvitation::firstOrFail();
        FormInvitation::query()->update(['expires_at' => now()->addDay()]);

        $res = $this->actingAs($this->owner)->postJson("/api/forms/{$this->form->id}/invitations/{$invitation->id}/link")
            ->assertOk()->assertJsonPath('email_sent', false);
        $new = $this->tokenFrom($res->json('invite_url'));

        $this->assertNotSame($old, $new);
        $this->getJson("/api/invitations/{$old}")->assertNotFound();
        $this->getJson("/api/invitations/{$new}")->assertOk();
        $this->assertTrue($invitation->fresh()->expires_at->greaterThan(now()->addDays(6)));

        Mail::fake();
        config(['mail.default' => 'smtp']);
        $this->actingAs($this->owner)->postJson("/api/forms/{$this->form->id}/invitations/{$invitation->id}/resend")
            ->assertOk()->assertJsonPath('email_sent', true);
        Mail::assertSent(FormInvitationMail::class, 1);

        $this->actingAs($this->owner)->deleteJson("/api/forms/{$this->form->id}/invitations/{$invitation->id}")->assertOk();
        $this->assertSame(0, FormInvitation::count());
    }

    public function test_invitation_of_another_form_is_not_found(): void
    {
        $this->invite('lan@example.com', 'viewer');
        $invitation = FormInvitation::firstOrFail();
        $mine = $this->makeForm(['user_id' => $this->owner->id]);

        $this->actingAs($this->owner)->postJson("/api/forms/{$mine->id}/invitations/{$invitation->id}/link")->assertNotFound();
    }

    // --- register with invitation --------------------------------------------

    public function test_register_with_invite_token_joins_the_form(): void
    {
        $token = $this->invite('moi@example.com', 'editor');

        $this->postJson('/api/register', $this->registration('Moi@example.com', $token))
            ->assertCreated()
            ->assertJsonPath('form_id', $this->form->id)
            ->assertJsonPath('form_role', 'editor');

        $user = User::where('email', 'Moi@example.com')->firstOrFail();
        $this->assertSame('editor', $this->form->fresh()->roleFor($user));
        $this->assertNotNull(FormInvitation::firstOrFail()->accepted_at);
    }

    public function test_register_rejects_other_email_and_expired_invitation(): void
    {
        $token = $this->invite('moi@example.com', 'viewer');

        $this->postJson('/api/register', $this->registration('khac@example.com', $token))
            ->assertStatus(422)->assertJsonValidationErrors(['email']);

        FormInvitation::query()->update(['expires_at' => now()->subMinute()]);
        $this->postJson('/api/register', $this->registration('moi@example.com', $token))
            ->assertStatus(422)->assertJsonValidationErrors(['invite_token']);

        $this->assertSame(0, User::whereIn('email', ['khac@example.com', 'moi@example.com'])->count());

        $this->postJson('/api/register', $this->registration('thuong@example.com', null))
            ->assertCreated()->assertJsonMissingPath('form_id');
    }

    // --- user search -------------------------------------------------------

    public function test_user_search_rules(): void
    {
        for ($i = 1; $i <= 10; $i++) {
            $this->namedUser("Nguyễn Văn {$i}", "nguyen{$i}@example.com");
        }
        $member = User::where('email', 'nguyen1@example.com')->first();
        $this->share($this->form, $member, 'viewer');

        $this->actingAs($this->owner)->getJson('/api/users/search?q=ng')->assertStatus(422);

        $users = $this->actingAs($this->owner)->getJson('/api/users/search?q=nguyen')->assertOk()->json('users');
        $this->assertCount(8, $users);
        $this->assertSame(['id', 'name', 'email'], array_keys($users[0]));

        $ids = array_column($this->actingAs($this->owner)->getJson("/api/users/search?q=example&form_id={$this->form->id}")->json('users'), 'id');
        $this->assertNotContains($member->id, $ids);
        $this->assertNotContains($this->owner->id, $ids);

        $this->assertCount(1, $this->actingAs($this->owner)->getJson('/api/users/search?q=Văn 10')->json('users'));
        $this->actingAs($member)->getJson("/api/users/search?q=nguyen&form_id={$this->form->id}")->assertForbidden();
    }

    public function test_user_search_is_throttled(): void
    {
        for ($i = 0; $i < 60; $i++) {
            $this->actingAs($this->owner)->getJson('/api/users/search?q=abc')->assertOk();
        }
        $this->actingAs($this->owner)->getJson('/api/users/search?q=abc')->assertStatus(429);
    }

    // --- closed form -------------------------------------------------------

    public function test_closed_form_shows_clear_message_instead_of_404(): void
    {
        $field = $this->addField($this->form, 'short_text');
        $this->form->update(['status' => 'closed']);

        $this->getJson("/api/forms/public/{$this->form->slug}")->assertOk()
            ->assertJsonPath('closed', true)
            ->assertJsonPath('accepting', false)
            ->assertJsonPath('message', 'Biểu mẫu không còn nhận câu trả lời.')
            ->assertJsonPath('title', 'Khảo sát')
            ->assertJsonCount(0, 'fields');

        $this->submit($this->form, [$field->id => 'x'])->assertForbidden()
            ->assertJsonPath('message', 'Biểu mẫu không còn nhận câu trả lời.');
        $this->postJson("/api/forms/public/{$this->form->slug}/assign")->assertForbidden()->assertJsonPath('closed', true);

        $this->form->update(['status' => 'draft']);
        $this->getJson("/api/forms/public/{$this->form->slug}")->assertNotFound();
    }

    // --- helpers -----------------------------------------------------------

    private function namedUser(string $name, string $email): User
    {
        return User::create(['name' => $name, 'email' => $email, 'password' => bcrypt('secret')]);
    }

    private function share(Form $form, User $user, string $role): void
    {
        FormCollaborator::create(['form_id' => $form->id, 'user_id' => $user->id, 'role' => $role]);
    }

    private function invite(string $email, string $role): string
    {
        [, $token] = (new FormSharing())->invite($this->form, $email, $role, $this->owner, null);

        return $token;
    }

    private function tokenFrom(string $url): string
    {
        return substr($url, strrpos($url, '/') + 1);
    }

    private function registration(string $email, ?string $token): array
    {
        return array_filter([
            'name' => 'Người mới',
            'email' => $email,
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'invite_token' => $token,
        ]);
    }
}
