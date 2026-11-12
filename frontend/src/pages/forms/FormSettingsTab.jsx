import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { useFormStore } from '../../store/formStore'
import { useEditor } from '../../layouts/FormEditorLayout'
import { newKey, shortLabel } from '../../utils/formStructure'
import { stableStringify } from '../../utils/ops'
import { limitForcesLogin, FORCED_LOGIN_HINT } from '../../utils/respondentAccess'

const LIMIT_METHODS = [
  { value: 'device', label: 'Mã thiết bị ẩn danh', hint: 'Lưu trong trình duyệt; người cố tình vẫn lách được bằng tab ẩn danh hoặc trình duyệt khác.' },
  { value: 'email', label: 'Email', hint: 'Lấy từ một câu Email trong biểu mẫu.' },
  { value: 'phone', label: 'Số điện thoại', hint: 'Lấy từ một câu Số điện thoại (di động Việt Nam 10 chữ số).' },
  { value: 'account', label: 'Tài khoản đăng nhập', hint: 'Tự bật "Yêu cầu đăng nhập".' },
]

const IDENTITY_FIELDS = {
  email: { type: 'email', label: 'Email (chỉ dùng để tránh trả lời trùng)' },
  phone: { type: 'phone', label: 'Số điện thoại (chỉ dùng để tránh trả lời trùng)' },
}

const DEFAULT_LIMIT = {
  enabled: false,
  methods: ['device'],
  field_keys: { email: null, phone: null },
  match: 'any',
  max_per_person: 1,
  on_limit: 'block',
  message: 'Bạn đã trả lời biểu mẫu này. Xin cảm ơn!',
}

function limitError(limit, fields) {
  if (!limit.enabled) return null
  const methods = limit.methods || []
  if (!methods.length) return 'Chọn ít nhất một căn cứ nhận diện người trả lời.'
  for (const method of ['email', 'phone']) {
    if (!methods.includes(method)) continue
    const key = limit.field_keys?.[method]
    if (!key || !fields.some((f) => f.key === key && f.type === IDENTITY_FIELDS[method].type)) {
      return `Chọn câu hỏi ${method === 'email' ? 'Email' : 'Số điện thoại'} dùng làm căn cứ.`
    }
  }
  return null
}

function normalizeLimit(limit) {
  const methods = limit.methods || []
  return {
    ...limit,
    field_keys: Object.fromEntries(Object.entries(limit.field_keys || {}).map(([m, k]) => [m, methods.includes(m) ? k : null])),
    max_per_person: Math.max(1, parseInt(limit.max_per_person, 10) || 1),
  }
}

const TEXT_DELAY = 1500
const limitFrom = (form) => {
  const saved = form?.respondent_limit && !Array.isArray(form.respondent_limit) ? form.respondent_limit : {}
  return { ...DEFAULT_LIMIT, ...saved, field_keys: { ...DEFAULT_LIMIT.field_keys, ...(saved.field_keys || {}) } }
}

/** "Cài đặt" tab. Autosaved outside undo history: toggles at once, text/number after 1.5 s. */
export default function FormSettingsTab() {
  const { form, updateSettings, readOnly } = useEditor()
  const fields = useFormStore((s) => s.fields)
  const insertFields = useFormStore((s) => s.insertFields)
  // The limit stays local while incomplete (e.g. Email chosen but no question yet) and is saved once valid.
  const [limit, setLimit] = useState(() => limitFrom(form))
  const savedLimit = form?.respondent_limit
  useEffect(() => {
    setLimit((prev) => (stableStringify(normalizeLimit(prev)) === stableStringify(normalizeLimit(limitFrom(form))) ? prev : limitFrom(form)))
  }, [stableStringify(savedLimit)])

  const settings = {
    is_public: form?.is_public ?? true,
    show_progress_bar: form?.show_progress_bar ?? false,
    shuffle_questions: form?.shuffle_questions ?? false,
    limit_responses: form?.limit_responses ?? false,
    max_responses: form?.max_responses ?? 100,
    require_login: form?.require_login ?? false,
    custom_thank_you_message: form?.custom_thank_you_message ?? '',
  }
  const toggle = (key) => (e) => updateSettings({ [key]: e.target.checked }, { delay: 0 })
  const setText = (patch) => updateSettings(patch, { delay: TEXT_DELAY })

  const methods = limit.methods || []
  const usesAccount = limitForcesLogin(limit)
  const candidates = (type) => fields.filter((f) => f.type === type && !f.random_group_key)

  const updateLimit = (patch, delay = 0) => {
    const next = { ...limit, ...patch }
    setLimit(next)
    if (limitError(next, useFormStore.getState().fields)) return
    const normalized = normalizeLimit(next)
    updateSettings({
      respondent_limit: normalized,
      ...(normalized.enabled && normalized.methods.includes('account') ? { require_login: true } : {}),
    }, { delay })
  }

  const toggleMethod = (method, checked) => {
    const nextMethods = checked ? [...methods, method] : methods.filter((m) => m !== method)
    const patch = { methods: nextMethods }
    if (checked && IDENTITY_FIELDS[method] && !limit.field_keys?.[method]) {
      const options = candidates(IDENTITY_FIELDS[method].type)
      if (options.length === 1) patch.field_keys = { ...limit.field_keys, [method]: options[0].key }
    }
    updateLimit(patch)
  }

  const addIdentityField = (method) => {
    const key = newKey()
    // Right after the first page break when the form opens with one, so it stays on page 1.
    const at = fields[0]?.type === 'section' ? 1 : 0
    insertFields(at, [{ ...IDENTITY_FIELDS[method], key, is_required: true, placeholder: '', help_text: '' }])
    updateLimit({ field_keys: { ...limit.field_keys, [method]: key } })
    toast.success('Đã thêm câu hỏi vào trang đầu.')
  }

  const pendingLimitError = limitError(limit, fields)

  return (
    <div className="max-w-3xl mx-auto" data-settings-tab>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-gray-900">Cài đặt</h2>
          {readOnly && (
            <span className="px-2 py-0.5 rounded border border-gray-300 text-xs font-medium text-gray-600 whitespace-nowrap">Chỉ xem</span>
          )}
        </div>
        {readOnly && (
          <p data-readonly-note className="px-6 pt-4 text-sm text-gray-600">
            Bạn có quyền xem nên không thay đổi được cài đặt. Chủ sở hữu hoặc người chỉnh sửa có thể đổi vai trò của bạn trong mục Chia sẻ.
          </p>
        )}

        <fieldset disabled={readOnly} className="p-6 space-y-6 min-w-0">
          {/* Public Access */}
          <div>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.is_public}
                onChange={toggle('is_public')}
                className="w-5 h-5 text-primary-600 rounded"
              />
              <div>
                <div className="font-medium text-gray-900">Biểu Mẫu Công Khai</div>
                <div className="text-sm text-gray-600">Bất kỳ ai có liên kết đều có thể truy cập</div>
              </div>
            </label>
          </div>

          {/* Progress Bar */}
          <div>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.show_progress_bar}
                onChange={toggle('show_progress_bar')}
                className="w-5 h-5 text-primary-600 rounded"
              />
              <div>
                <div className="font-medium text-gray-900">Hiển Thị Thanh Tiến Trình</div>
                <div className="text-sm text-gray-600">Hiển thị tiến trình hoàn thành cho người trả lời</div>
              </div>
            </label>
          </div>

          {/* Shuffle Questions */}
          <div>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.shuffle_questions}
                onChange={toggle('shuffle_questions')}
                className="w-5 h-5 text-primary-600 rounded"
              />
              <div>
                <div className="font-medium text-gray-900">Xáo Trộn Câu Hỏi</div>
                <div className="text-sm text-gray-600">Ngẫu nhiên hóa thứ tự câu hỏi cho mỗi người trả lời</div>
              </div>
            </label>
          </div>

          {/* Require Login */}
          <div>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                data-setting="require_login"
                checked={settings.require_login || usesAccount}
                disabled={usesAccount}
                onChange={toggle('require_login')}
                className="w-5 h-5 text-primary-600 rounded"
              />
              <div>
                <div className="font-medium text-gray-900">Yêu Cầu Đăng Nhập</div>
                <div className="text-sm text-gray-600">
                  {usesAccount ? FORCED_LOGIN_HINT : 'Chỉ người dùng đã đăng nhập mới có thể gửi'}
                </div>
              </div>
            </label>
          </div>

          {/* Limit Responses */}
          <div>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.limit_responses}
                onChange={toggle('limit_responses')}
                className="w-5 h-5 text-primary-600 rounded"
              />
              <div>
                <div className="font-medium text-gray-900">Giới Hạn Phản Hồi</div>
                <div className="text-sm text-gray-600">Đặt số lượng phản hồi tối đa</div>
              </div>
            </label>
            {settings.limit_responses && (
              <div className="mt-3 ml-8">
                <label className="form-label">Số Phản Hồi Tối Đa</label>
                <input
                  type="number"
                  value={settings.max_responses}
                  onChange={(e) => setText({ max_responses: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  className="input"
                  min="1"
                />
              </div>
            )}
          </div>

          {/* Limit per respondent */}
          <div>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!!limit.enabled}
                onChange={(e) => updateLimit({ enabled: e.target.checked })}
                className="w-5 h-5 text-primary-600 rounded"
              />
              <div>
                <div className="font-medium text-gray-900">Giới Hạn Mỗi Người Trả Lời</div>
                <div className="text-sm text-gray-600">Nhận diện người đã trả lời để chặn trả lời trùng (độc lập với giới hạn tổng số phản hồi)</div>
              </div>
            </label>

            {limit.enabled && (
              <div className="mt-3 ml-8 space-y-4">
                <div>
                  <div className="form-label">Căn cứ nhận diện</div>
                  <div className="space-y-2">
                    {LIMIT_METHODS.map((m) => {
                      const checked = methods.includes(m.value)
                      const identity = IDENTITY_FIELDS[m.value]
                      const options = identity ? candidates(identity.type) : []
                      const selectedKey = limit.field_keys?.[m.value] || ''
                      const selected = options.find((f) => f.key === selectedKey)
                      return (
                        <div key={m.value}>
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={checked}
                              onChange={(e) => toggleMethod(m.value, e.target.checked)}
                            />
                            <span>
                              <span className="text-sm font-medium text-gray-900">{m.label}</span>
                              <span className="block text-xs text-gray-500">{m.hint}</span>
                            </span>
                          </label>
                          {checked && identity && (
                            <div className="ml-6 mt-1 space-y-1">
                              {options.length > 0 && (
                                <select
                                  className="input py-1 text-sm"
                                  value={selectedKey}
                                  onChange={(e) => updateLimit({ field_keys: { ...limit.field_keys, [m.value]: e.target.value || null } })}
                                >
                                  <option value="">Chọn câu hỏi…</option>
                                  {options.map((f) => (
                                    <option key={f.key} value={f.key}>{shortLabel(f)}</option>
                                  ))}
                                </select>
                              )}
                              {options.length === 0 && (
                                <button
                                  type="button"
                                  onClick={() => addIdentityField(m.value)}
                                  className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
                                >
                                  <Plus className="w-4 h-4" /> Thêm câu {m.label} vào trang đầu
                                </button>
                              )}
                              {selected && !selected.is_required && (
                                <p className="text-xs text-amber-600">
                                  Câu này không bắt buộc: người trả lời để trống thì căn cứ này được bỏ qua.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {methods.length > 1 && (
                  <div>
                    <div className="form-label">Khi có nhiều căn cứ</div>
                    <select className="input" value={limit.match} onChange={(e) => updateLimit({ match: e.target.value })}>
                      <option value="any">Chặn khi trùng bất kỳ căn cứ nào</option>
                      <option value="all">Chỉ chặn khi trùng tất cả căn cứ</option>
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <label className="form-label mb-0">Số lần mỗi người được trả lời</label>
                  <input
                    type="number"
                    min="1"
                    className="input w-24"
                    value={limit.max_per_person}
                    onChange={(e) => updateLimit({ max_per_person: e.target.value }, TEXT_DELAY)}
                  />
                </div>

                <div>
                  <div className="form-label">Khi đã đủ số lần</div>
                  <div className="space-y-2">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="radio" className="mt-1" checked={limit.on_limit === 'block'} onChange={() => updateLimit({ on_limit: 'block' })} />
                      <span className="text-sm text-gray-900">Chặn và hiện thông báo</span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="radio" className="mt-1" checked={limit.on_limit === 'edit'} onChange={() => updateLimit({ on_limit: 'edit' })} />
                      <span>
                        <span className="text-sm text-gray-900">Cho sửa câu trả lời gần nhất</span>
                        <span className="block text-xs text-gray-500">
                          Khớp theo thiết bị/tài khoản thì nạp lại câu trả lời cũ để sửa. Khớp theo email/điện thoại thì người trả lời
                          điền lại từ đầu và bản mới thay bản cũ (không hiện câu trả lời cũ để bảo vệ dữ liệu).
                        </span>
                      </span>
                    </label>
                  </div>
                </div>

                {limit.on_limit === 'block' && (
                  <div>
                    <label className="form-label">Nội dung thông báo khi bị chặn</label>
                    <textarea
                      className="input"
                      rows="2"
                      value={limit.message || ''}
                      onChange={(e) => updateLimit({ message: e.target.value }, TEXT_DELAY)}
                      placeholder={DEFAULT_LIMIT.message}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Custom Thank You Message */}
          <div>
            <label className="form-label">Thông Báo Cảm Ơn Tùy Chỉnh</label>
            <textarea
              value={settings.custom_thank_you_message}
              onChange={(e) => setText({ custom_thank_you_message: e.target.value })}
              className="input"
              rows="4"
              placeholder="Cảm ơn bạn đã gửi phản hồi!"
            />
          </div>
        </fieldset>

        {!readOnly && pendingLimitError && (
          <div data-limit-error className="border-t border-gray-200 px-6 py-3 text-sm text-amber-700">
            {pendingLimitError} Giới hạn mỗi người trả lời sẽ được lưu khi chọn đủ.
          </div>
        )}
      </div>
    </div>
  )
}

