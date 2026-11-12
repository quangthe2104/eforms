<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\FormField;
use App\Models\FormInvitation;
use App\Models\FormResponse;
use App\Models\User;
use App\Services\Forms\FormSharing;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Permission table (plan 4.8) for owner / editor / viewer / no access on every form endpoint.
 */
class FormPermissionTest extends TestCase
{
    use RefreshDatabase;

    private const ALL = ['owner', 'editor', 'viewer'];
    private const EDIT = ['owner', 'editor'];
    private const OWNER = ['owner'];

    /** name => allowed roles; the request itself is built in request(). */
    private const ENDPOINTS = [
        'form.show' => self::ALL,
        'form.update' => self::EDIT,
        'form.publish' => self::EDIT,
        'form.delete' => self::OWNER,
        'form.duplicate' => self::ALL,
        'form.statistics' => self::ALL,
        'form.thumbnail' => self::EDIT,
        'field.store' => self::EDIT,
        'field.update' => self::EDIT,
        'field.destroy' => self::EDIT,
        'field.reorder' => self::EDIT,
        'field.bulk' => self::EDIT,
        'responses.index' => self::ALL,
        'responses.summary' => self::ALL,
        'responses.show' => self::ALL,
        'responses.destroy' => self::EDIT,
        'export.all' => self::ALL,
        'export.single' => self::ALL,
        'collab.index' => self::ALL,
        'collab.add' => self::EDIT,
        'collab.add_owner' => self::OWNER,
        'collab.invite' => self::EDIT,
        'collab.invite_owner' => self::OWNER,
        'collab.change_role' => self::EDIT,
        'collab.promote_owner' => self::OWNER,
        'collab.demote_owner' => self::OWNER,
        'collab.remove' => self::EDIT,
        'collab.remove_owner' => self::OWNER,
        'invitation.resend' => self::EDIT,
        'invitation.link' => self::EDIT,
        'invitation.cancel' => self::EDIT,
        'users.search_for_form' => self::EDIT,
    ];

    private Form $form;
    private FormField $field;
    private FormResponse $response;
    private FormInvitation $invitation;
    /** @var array<string, User> */
    private array $users = [];

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['owner', 'owner2', 'editor', 'viewer', 'viewer2', 'stranger', 'newbie'] as $name) {
            $this->users[$name] = User::create([
                'name' => ucfirst($name) . ' Person',
                'email' => "{$name}@example.com",
                'password' => bcrypt('secret'),
            ]);
        }

        $this->form = $this->makeForm(['user_id' => $this->users['owner']->id]);
        $sharing = new FormSharing();
        $sharing->addCollaborator($this->form, $this->users['owner2'], 'owner', $this->users['owner']);
        $sharing->addCollaborator($this->form, $this->users['editor'], 'editor', $this->users['owner']);
        $sharing->addCollaborator($this->form, $this->users['viewer'], 'viewer', $this->users['owner']);
        $sharing->addCollaborator($this->form, $this->users['viewer2'], 'viewer', $this->users['owner']);

        $this->field = $this->addField($this->form, 'short_text', ['label' => 'Họ tên']);
        $this->submit($this->form, [$this->field->id => 'An'])->assertCreated();
        $this->response = FormResponse::firstOrFail();

        [$this->invitation] = $sharing->invite($this->form, 'pending@example.com', 'viewer', $this->users['owner'], null);
    }

    public static function cases(): iterable
    {
        foreach (self::ENDPOINTS as $endpoint => $allowed) {
            foreach (['owner', 'editor', 'viewer', 'stranger'] as $role) {
                yield "{$endpoint} as {$role}" => [$endpoint, $role, in_array($role, $allowed, true)];
            }
        }
    }

    #[DataProvider('cases')]
    public function test_permission_table(string $endpoint, string $role, bool $allowed): void
    {
        [$method, $uri, $payload, $okStatus] = $this->request($endpoint);

        $result = $this->actingAs($this->users[$role])->json($method, $uri, $payload);

        if ($allowed) {
            $this->assertSame($okStatus, $result->getStatusCode(), "{$endpoint} as {$role}: " . $result->getContent());
        } else {
            $this->assertSame(403, $result->getStatusCode(), "{$endpoint} as {$role} should be forbidden");
        }
    }

    public function test_viewer_sees_read_only_role_and_no_pending_invitations(): void
    {
        $this->actingAs($this->users['viewer'])->getJson("/api/forms/{$this->form->id}")
            ->assertOk()->assertJsonPath('my_role', 'viewer');

        $this->actingAs($this->users['viewer'])->getJson("/api/forms/{$this->form->id}/collaborators")
            ->assertOk()->assertJsonCount(5, 'collaborators')->assertJsonCount(0, 'invitations');

        $this->actingAs($this->users['editor'])->getJson("/api/forms/{$this->form->id}/collaborators")
            ->assertOk()->assertJsonCount(1, 'invitations')
            ->assertJsonPath('collaborators.0.role', 'owner')
            ->assertJsonPath('my_role', 'editor');
    }

    /** @return array{0: string, 1: string, 2: array, 3: int} */
    private function request(string $endpoint): array
    {
        $f = "/api/forms/{$this->form->id}";
        $id = fn (string $name) => $this->users[$name]->id;

        return match ($endpoint) {
            'form.show' => ['GET', $f, [], 200],
            'form.update' => ['PUT', $f, ['title' => 'Đổi tên'], 200],
            'form.publish' => ['PUT', $f, ['status' => 'closed'], 200],
            'form.delete' => ['DELETE', $f, [], 200],
            'form.duplicate' => ['POST', "{$f}/duplicate", [], 201],
            'form.statistics' => ['GET', "{$f}/statistics", [], 200],
            // Authorization runs before validation, so an empty body proves access without writing a file.
            'form.thumbnail' => ['POST', "{$f}/thumbnail", [], 422],
            'field.store' => ['POST', "{$f}/fields", ['type' => 'short_text', 'label' => 'Q2'], 201],
            'field.update' => ['PUT', "{$f}/fields/{$this->field->id}", ['label' => 'Tên'], 200],
            'field.destroy' => ['DELETE', "{$f}/fields/{$this->field->id}", [], 200],
            'field.reorder' => ['POST', "{$f}/fields/reorder", ['fields' => [['id' => $this->field->id, 'order' => 0]]], 200],
            'field.bulk' => ['POST', "{$f}/fields/bulk-update", ['fields' => [[
                'id' => $this->field->id, 'key' => $this->field->key, 'type' => 'short_text', 'label' => 'Họ tên', 'order' => 0,
            ]]], 200],
            'responses.index' => ['GET', "{$f}/responses", [], 200],
            'responses.summary' => ['GET', "{$f}/responses/summary", [], 200],
            'responses.show' => ['GET', "{$f}/responses/{$this->response->id}", [], 200],
            'responses.destroy' => ['DELETE', "{$f}/responses/{$this->response->id}", [], 200],
            'export.all' => ['GET', "{$f}/export", [], 200],
            'export.single' => ['GET', "{$f}/responses/{$this->response->id}/export", [], 200],
            'collab.index' => ['GET', "{$f}/collaborators", [], 200],
            'collab.add' => ['POST', "{$f}/collaborators", ['user_id' => $id('newbie'), 'role' => 'viewer'], 201],
            'collab.add_owner' => ['POST', "{$f}/collaborators", ['user_id' => $id('newbie'), 'role' => 'owner'], 201],
            'collab.invite' => ['POST', "{$f}/collaborators", ['email' => 'someone@new.test', 'role' => 'editor'], 201],
            'collab.invite_owner' => ['POST', "{$f}/collaborators", ['email' => 'someone@new.test', 'role' => 'owner'], 201],
            'collab.change_role' => ['PATCH', "{$f}/collaborators/{$id('viewer2')}", ['role' => 'editor'], 200],
            'collab.promote_owner' => ['PATCH', "{$f}/collaborators/{$id('viewer2')}", ['role' => 'owner'], 200],
            'collab.demote_owner' => ['PATCH', "{$f}/collaborators/{$id('owner2')}", ['role' => 'editor'], 200],
            'collab.remove' => ['DELETE', "{$f}/collaborators/{$id('viewer2')}", [], 200],
            'collab.remove_owner' => ['DELETE', "{$f}/collaborators/{$id('owner2')}", [], 200],
            'invitation.resend' => ['POST', "{$f}/invitations/{$this->invitation->id}/resend", [], 200],
            'invitation.link' => ['POST', "{$f}/invitations/{$this->invitation->id}/link", [], 200],
            'invitation.cancel' => ['DELETE', "{$f}/invitations/{$this->invitation->id}", [], 200],
            'users.search_for_form' => ['GET', "/api/users/search?q=Newbie&form_id={$this->form->id}", [], 200],
        };
    }
}
