/** Collaborator roles (plan §4.8), strongest first. */
export const ROLES = ['owner', 'editor', 'viewer']

export const ROLE_LABELS = { owner: 'Chủ sở hữu', editor: 'Người chỉnh sửa', viewer: 'Người xem' }

/** Owners manage everyone; editors manage editors and viewers; viewers manage nobody (except leaving). */
export const canShare = (role) => role === 'owner' || role === 'editor'
export const canManageOwners = (role) => role === 'owner'
