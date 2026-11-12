<?php

namespace Tests;

use App\Models\Form;
use App\Models\FormField;
use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
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
