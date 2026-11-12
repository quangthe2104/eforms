<?php

namespace Tests;

use App\Models\Form;
use App\Models\FormField;
use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /** RefreshDatabase wipes whatever database is configured, so refuse anything but in-memory SQLite. */
    protected function setUpTraits()
    {
        if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== ':memory:') {
            throw new \RuntimeException('Tests must run on in-memory SQLite (is a config cache active? run `php artisan config:clear`).');
        }

        return parent::setUpTraits();
    }

    protected function makeUser(): User
    {
        return User::create([
            'name' => 'Owner',
            'email' => uniqid('u', true) . '@example.com',
            'password' => bcrypt('secret'),
        ]);
    }

    protected function makeForm(array $attributes = []): Form
    {
        $form = Form::create(array_merge([
            'user_id' => $this->makeUser()->id,
            'title' => 'Survey',
            'status' => 'published',
            'is_public' => true,
            'accept_responses' => true,
        ], $attributes));

        return $form->fresh();
    }

    protected function addField(Form $form, string $type, array $attributes = []): FormField
    {
        return FormField::create(array_merge([
            'form_id' => $form->id,
            'type' => $type,
            'label' => ucfirst($type),
            'order' => FormField::where('form_id', $form->id)->count(),
        ], $attributes));
    }

    protected function submit(Form $form, array $answers, array $extra = [])
    {
        return $this->postJson("/api/forms/public/{$form->slug}/submit", array_merge(['answers' => $answers], $extra));
    }
}
