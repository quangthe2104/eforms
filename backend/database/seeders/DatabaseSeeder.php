<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Form;
use App\Models\FormField;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Create admin user
        $admin = User::create([
            'name' => 'Admin User',
            'email' => 'admin@eforms.test',
            'password' => Hash::make('password'),
            'role' => 'admin',
        ]);

        // Create regular user
        $user = User::create([
            'name' => 'Test User',
            'email' => 'user@eforms.test',
            'password' => Hash::make('password'),
            'role' => 'user',
        ]);

        // Create sample form
        $form = Form::create([
            'user_id' => $user->id,
            'title' => 'Contact Form',
            'description' => 'A simple contact form example',
            'status' => 'published',
            'is_public' => true,
            'accept_responses' => true,
        ]);

        // Create sample fields
        FormField::create([
            'form_id' => $form->id,
            'type' => 'short_text',
            'label' => 'Full Name',
            'placeholder' => 'Enter your full name',
            'is_required' => true,
            'order' => 1,
        ]);

        FormField::create([
            'form_id' => $form->id,
            'type' => 'email',
            'label' => 'Email Address',
            'placeholder' => 'your@email.com',
            'is_required' => true,
            'order' => 2,
        ]);

        FormField::create([
            'form_id' => $form->id,
            'type' => 'phone',
            'label' => 'Phone Number',
            'placeholder' => '+84',
            'is_required' => false,
            'order' => 3,
        ]);

        FormField::create([
            'form_id' => $form->id,
            'type' => 'dropdown',
            'label' => 'How did you hear about us?',
            'options' => [
                'Google Search',
                'Social Media',
                'Friend Referral',
                'Advertisement',
                'Other',
            ],
            'is_required' => false,
            'order' => 4,
        ]);

        FormField::create([
            'form_id' => $form->id,
            'type' => 'long_text',
            'label' => 'Message',
            'placeholder' => 'Enter your message here...',
            'is_required' => true,
            'order' => 5,
        ]);

        $this->command->info('Database seeded successfully!');
        $this->command->info('Admin: admin@eforms.test / password');
        $this->command->info('User: user@eforms.test / password');
    }
}

