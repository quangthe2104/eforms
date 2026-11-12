<?php

namespace App\Http\Controllers;

use App\Models\Form;
use App\Models\User;
use Illuminate\Http\Request;

class UserController extends Controller
{
    private const SEARCH_LIMIT = 8;

    /**
     * GET /users/search?q=&form_id=
     * Suggestions for the share dialog: id, name and email only; excludes yourself and,
     * when form_id is given, everyone who already has access to that form.
     */
    public function search(Request $request)
    {
        $data = $request->validate([
            'q' => 'required|string|min:3|max:100',
            'form_id' => 'nullable|integer',
        ]);

        $exclude = [$request->user()->id];
        if (!empty($data['form_id'])) {
            $form = Form::findOrFail($data['form_id']);
            $this->authorize('share', $form);
            $exclude = array_merge($exclude, $form->collaboratorRecords()->pluck('user_id')->all());
        }

        $term = '%' . addcslashes(trim($data['q']), '%_\\') . '%';
        $users = User::query()
            ->select(['id', 'name', 'email'])
            ->whereNotIn('id', $exclude)
            ->where(fn ($q) => $q->where('name', 'like', $term)->orWhere('email', 'like', $term))
            ->orderBy('name')
            ->limit(self::SEARCH_LIMIT)
            ->get();

        return response()->json(['users' => $users]);
    }
}
