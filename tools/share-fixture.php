<?php
// Fixtures for tools/e2e-share.mjs. Prints JSON.
//   php tools/share-fixture.php user <email> <name> <password>   create/update a user with a known password → {id,name,email}
//   php tools/share-fixture.php delete-user <email>              delete the user (tokens, collaborator rows) → {deleted}
//   php tools/share-fixture.php expire-invitation <id>           move expires_at into the past → {ok}
require __DIR__ . '/../backend/vendor/autoload.php';
$app = require __DIR__ . '/../backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\FormInvitation;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

$cmd = $argv[1] ?? '';
switch ($cmd) {
    case 'user':
        $user = User::firstOrNew(['email' => $argv[2]]);
        $user->name = $argv[3] ?? 'E2E User';
        $user->password = Hash::make($argv[4] ?? 'password123');
        $user->save();
        echo json_encode($user->only(['id', 'name', 'email'])), PHP_EOL;
        break;
    case 'delete-user':
        $user = User::where('email', $argv[2])->first();
        if ($user) {
            $user->tokens()->delete();
            DB::table('form_collaborators')->where('user_id', $user->id)->delete();
            DB::table('form_presence')->where('user_id', $user->id)->delete();
            $user->delete();
        }
        echo json_encode(['deleted' => (bool) $user]), PHP_EOL;
        break;
    case 'expire-invitation':
        $ok = FormInvitation::whereKey((int) $argv[2])->update(['expires_at' => now()->subDay()]);
        echo json_encode(['ok' => (bool) $ok]), PHP_EOL;
        break;
    default:
        fwrite(STDERR, "unknown command\n");
        exit(1);
}
