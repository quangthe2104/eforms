<?php

namespace App\Providers;

use App\Services\Auth\FakeGoogleTokenVerifier;
use App\Services\Auth\GoogleTokenVerifier;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Schema;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        if ($this->app->environment('local') && config('services.google.fake_verifier') === true) {
            $this->app->bind(GoogleTokenVerifier::class, FakeGoogleTokenVerifier::class);
        }
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Fix for MySQL key length error
        Schema::defaultStringLength(191);
    }
}

