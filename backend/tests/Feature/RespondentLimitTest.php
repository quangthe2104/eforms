<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\FormField;
use App\Models\FormResponse;
use App\Models\ResponseAnswer;
use App\Services\Forms\DeviceId;
use App\Services\Forms\RespondentLimiter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RespondentLimitTest extends TestCase
{
    use RefreshDatabase;

    private Form $form;
    private FormField $email;
    private FormField $phone;
    private FormField $note;

    private function buildForm(array $limit, array $emailSettings = []): void
    {
        $this->form = $this->makeForm();
        $this->email = $this->addField($this->form, 'email', ['settings' => $emailSettings]);
        $this->phone = $this->addField($this->form, 'phone');
        $this->note = $this->addField($this->form, 'short_text');

        $this->form->update(['respondent_limit' => array_merge([
            'enabled' => true,
            'methods' => ['email'],
            'field_keys' => ['email' => $this->email->key, 'phone' => $this->phone->key],
            'match' => 'any',
            'max_per_person' => 1,
            'on_limit' => 'block',
            'message' => 'Đã tham gia rồi',
        ], $limit)]);
    }

    private function send(?string $email, ?string $phone = null, string $note = 'x', array $extra = [])
    {
        return $this->submit($this->form, array_filter([
            $this->email->id => $email,
            $this->phone->id => $phone,
            $this->note->id => $note,
        ], fn ($v) => $v !== null), $extra);
    }

    public function test_normalization(): void
    {
        $this->assertSame('a.b@x.vn', RespondentLimiter::normalizeEmail(' A.B@X.vn '));
        $this->assertSame('0912345678', RespondentLimiter::normalizePhone('+84 912 345 678'));
        $this->assertSame('0912345678', RespondentLimiter::normalizePhone('84912345678'));
        $this->assertSame('0912345678', RespondentLimiter::normalizePhone('0912.345-678'));
        $this->assertFalse(RespondentLimiter::isValidPhone('0212345678'));
    }

    public function test_blocks_duplicate_email_after_normalization(): void
    {
        $this->buildForm([]);
        $this->send('user@mail.vn')->assertCreated();
        $this->send(' USER@mail.vn')->assertStatus(409)->assertJson(['status' => 'limit_reached', 'message' => 'Đã tham gia rồi']);
        $this->send('other@mail.vn')->assertCreated();
        $this->send(null)->assertCreated();
        $this->assertSame(3, FormResponse::count());
    }

    public function test_match_any_vs_all(): void
    {
        $this->buildForm(['methods' => ['email', 'phone'], 'match' => 'any']);
        $this->send('a@x.vn', '0912345678')->assertCreated();
        $this->send('b@x.vn', '0912345678')->assertStatus(409);

        $this->buildForm(['methods' => ['email', 'phone'], 'match' => 'all']);
        $this->send('a@x.vn', '0912345678')->assertCreated();
        $this->send('b@x.vn', '0912345678')->assertCreated();
        $this->send('a@x.vn', '0912345678')->assertStatus(409);
        // Blank phone: only the email is compared.
        $this->send('a@x.vn')->assertStatus(409);
    }

    public function test_max_per_person(): void
    {
        $this->buildForm(['max_per_person' => 2]);
        $this->send('a@x.vn')->assertCreated();
        $this->send('a@x.vn')->assertCreated();
        $this->send('a@x.vn')->assertStatus(409);
    }

    public function test_edit_mode_by_email_replaces_without_exposing_answers(): void
    {
        $this->buildForm(['on_limit' => 'edit']);
        $first = $this->send('a@x.vn', null, 'cũ')->assertCreated();

        $this->postJson("/api/forms/public/{$this->form->slug}/check-identity", ['values' => ['email' => 'A@x.vn']])
            ->assertOk()->assertJson(['status' => 'will_replace'])->assertJsonMissing(['cũ']);

        $second = $this->send('a@x.vn', null, 'mới')->assertCreated()->assertJson(['edited' => true]);
        $this->assertSame($first->json('response_id'), $second->json('response_id'));
        $this->assertSame(1, FormResponse::count());
        $this->assertSame('mới', ResponseAnswer::where('field_id', $this->note->id)->value('value'));
    }

    public function test_device_limit_blocks_on_open_and_edit_mode_reloads_answers(): void
    {
        $this->buildForm(['methods' => ['device']]);
        $device = DeviceId::issue();

        $this->getJson("/api/forms/public/{$this->form->slug}?device_id={$device}")->assertJsonPath('limit_status.status', 'ok');
        $this->send(null, null, 'hello', ['device_id' => $device])->assertCreated();
        $this->getJson("/api/forms/public/{$this->form->slug}?device_id={$device}")
            ->assertJsonPath('limit_status.status', 'limit_reached')
            ->assertJsonPath('limit_status.message', 'Đã tham gia rồi');
        $this->send(null, null, 'again', ['device_id' => $device])->assertStatus(409);

        $this->form->update(['respondent_limit' => array_merge($this->form->respondent_limit, ['on_limit' => 'edit'])]);
        $open = $this->getJson("/api/forms/public/{$this->form->slug}?device_id={$device}")
            ->assertJsonPath('limit_status.status', 'editing')
            ->assertJsonPath("limit_status.answers.{$this->note->id}", 'hello');

        $this->send(null, null, 'edited', ['device_id' => $device, 'token' => $open->json('limit_status.token')])
            ->assertCreated()->assertJson(['edited' => true]);
        $this->assertSame(1, FormResponse::count());
    }

    public function test_forged_device_id_is_ignored(): void
    {
        $this->buildForm(['methods' => ['device']]);
        $res = $this->getJson("/api/forms/public/{$this->form->slug}?device_id=not-valid")->assertOk();
        $this->assertTrue(DeviceId::isValid($res->json('device_id')));
    }

    public function test_hash_only_email_is_not_stored_or_exposed(): void
    {
        $this->buildForm([], ['store_hash_only' => true]);
        $this->send('secret@x.vn')->assertCreated();

        $this->assertNull(ResponseAnswer::where('field_id', $this->email->id)->value('value'));
        $this->assertDatabaseHas('response_identities', ['method' => 'email']);
        $this->assertStringNotContainsString('secret@x.vn', json_encode(\DB::table('response_identities')->get()));
        $this->send('secret@x.vn')->assertStatus(409);
    }

    public function test_account_method_forces_login(): void
    {
        $form = $this->makeForm();
        $owner = $form->user;
        $this->actingAs($owner)->putJson("/api/forms/{$form->id}", [
            'respondent_limit' => ['enabled' => true, 'methods' => ['account']],
        ])->assertOk();
        $this->assertTrue($form->fresh()->require_login);
    }
}
