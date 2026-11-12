<?php

namespace App\Policies;

use App\Models\Form;
use App\Models\User;

/**
 * Permission table (docs/EDITOR-HEADER-PLAN.md, 4.8):
 *  view            – questions, settings, responses, export, duplicate: every role
 *  update          – questions, theme, settings, publish/close: owner, editor
 *  manageResponses – delete responses: owner, editor
 *  share           – invite/remove/change editors and viewers: owner, editor
 *  manageOwners    – add/remove/demote owners: owner
 *  delete          – delete the form: owner
 */
class FormPolicy
{
    public function view(User $user, Form $form): bool
    {
        return $form->roleFor($user) !== null;
    }

    public function update(User $user, Form $form): bool
    {
        return $this->canEdit($user, $form);
    }

    public function manageResponses(User $user, Form $form): bool
    {
        return $this->canEdit($user, $form);
    }

    public function share(User $user, Form $form): bool
    {
        return $this->canEdit($user, $form);
    }

    public function manageOwners(User $user, Form $form): bool
    {
        return $form->roleFor($user) === Form::ROLE_OWNER;
    }

    public function delete(User $user, Form $form): bool
    {
        return $form->roleFor($user) === Form::ROLE_OWNER;
    }

    private function canEdit(User $user, Form $form): bool
    {
        return in_array($form->roleFor($user), [Form::ROLE_OWNER, Form::ROLE_EDITOR], true);
    }
}
