/**
 * Respondent access ("Quyền truy cập chung" in the share dialog, "Yêu cầu đăng nhập" in the Settings tab).
 * Both write `require_login` through the store's updateSettings, so autosave and live sync treat them alike.
 */

/** "Tài khoản đăng nhập" as a respondent-limit method forces require_login (the server forces it too). */
export const limitForcesLogin = (limit) => !!limit?.enabled && !Array.isArray(limit) && (limit.methods || []).includes('account')

export const FORCED_LOGIN_HINT = 'Đang bật vì "Giới hạn mỗi người trả lời" dùng căn cứ Tài khoản đăng nhập'

/** Effective value shown to the user. */
export const requiresLogin = (form) => !!form?.require_login || limitForcesLogin(form?.respondent_limit)
