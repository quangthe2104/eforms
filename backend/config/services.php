<?php

return [

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        // Accepts `fake:<email>` ID tokens for E2E tests; only honoured when APP_ENV=local.
        'fake_verifier' => env('GOOGLE_FAKE_VERIFIER', false),
    ],

];
