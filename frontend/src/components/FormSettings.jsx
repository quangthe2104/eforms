import { useState } from 'react'
import { X } from 'lucide-react'

export default function FormSettings({ form, onClose, onSave }) {
  const [settings, setSettings] = useState({
    is_public: form?.is_public ?? true,
    accept_responses: form?.accept_responses ?? true,
    show_progress_bar: form?.show_progress_bar ?? false,
    shuffle_questions: form?.shuffle_questions ?? false,
    limit_responses: form?.limit_responses ?? false,
    max_responses: form?.max_responses ?? 100,
    require_login: form?.require_login ?? false,
    custom_thank_you_message: form?.custom_thank_you_message ?? '',
  })

  const handleSave = () => {
    onSave(settings)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Cài Đặt Biểu Mẫu</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Public Access */}
          <div>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.is_public}
                onChange={(e) => setSettings({ ...settings, is_public: e.target.checked })}
                className="w-5 h-5 text-primary-600 rounded"
              />
              <div>
                <div className="font-medium text-gray-900">Biểu Mẫu Công Khai</div>
                <div className="text-sm text-gray-600">Bất kỳ ai có liên kết đều có thể truy cập</div>
              </div>
            </label>
          </div>

          {/* Accept Responses */}
          <div>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.accept_responses}
                onChange={(e) => setSettings({ ...settings, accept_responses: e.target.checked })}
                className="w-5 h-5 text-primary-600 rounded"
              />
              <div>
                <div className="font-medium text-gray-900">Chấp Nhận Phản Hồi</div>
                <div className="text-sm text-gray-600">Cho phép mọi người gửi phản hồi</div>
              </div>
            </label>
          </div>

          {/* Progress Bar */}
          <div>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.show_progress_bar}
                onChange={(e) => setSettings({ ...settings, show_progress_bar: e.target.checked })}
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
                onChange={(e) => setSettings({ ...settings, shuffle_questions: e.target.checked })}
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
                checked={settings.require_login}
                onChange={(e) => setSettings({ ...settings, require_login: e.target.checked })}
                className="w-5 h-5 text-primary-600 rounded"
              />
              <div>
                <div className="font-medium text-gray-900">Yêu Cầu Đăng Nhập</div>
                <div className="text-sm text-gray-600">Chỉ người dùng đã đăng nhập mới có thể gửi</div>
              </div>
            </label>
          </div>

          {/* Limit Responses */}
          <div>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.limit_responses}
                onChange={(e) => setSettings({ ...settings, limit_responses: e.target.checked })}
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
                  onChange={(e) => setSettings({ ...settings, max_responses: parseInt(e.target.value) })}
                  className="input"
                  min="1"
                />
              </div>
            )}
          </div>

          {/* Custom Thank You Message */}
          <div>
            <label className="form-label">Thông Báo Cảm Ơn Tùy Chỉnh</label>
            <textarea
              value={settings.custom_thank_you_message}
              onChange={(e) => setSettings({ ...settings, custom_thank_you_message: e.target.value })}
              className="input"
              rows="4"
              placeholder="Cảm ơn bạn đã gửi phản hồi!"
            />
          </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
          <button onClick={onClose} className="btn btn-secondary">
            Hủy
          </button>
          <button onClick={handleSave} className="btn btn-primary">
            Lưu Cài Đặt
          </button>
        </div>
      </div>
    </div>
  )
}

