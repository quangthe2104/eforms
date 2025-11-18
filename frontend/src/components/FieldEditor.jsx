import { useState, useEffect } from 'react'
import { useFormStore } from '../store/formStore'
import { X, Plus, Trash2 } from 'lucide-react'

export default function FieldEditor({ selectedIndex, onClose }) {
  const { fields, updateField } = useFormStore()
  const [editData, setEditData] = useState(null)

  useEffect(() => {
    if (selectedIndex !== null && fields[selectedIndex]) {
      setEditData({ ...fields[selectedIndex] })
    } else {
      setEditData(null)
    }
  }, [selectedIndex, fields])

  const handleSave = () => {
    if (selectedIndex !== null && editData) {
      updateField(selectedIndex, editData)
      onClose && onClose()
    }
  }

  const handleAddOption = () => {
    if (editData) {
      setEditData({
        ...editData,
        options: [...(editData.options || []), `Option ${(editData.options?.length || 0) + 1}`]
      })
    }
  }

  const handleUpdateOption = (index, value) => {
    if (editData) {
      const newOptions = [...(editData.options || [])]
      newOptions[index] = value
      setEditData({ ...editData, options: newOptions })
    }
  }

  const handleRemoveOption = (index) => {
    if (editData) {
      const newOptions = editData.options.filter((_, i) => i !== index)
      setEditData({ ...editData, options: newOptions })
    }
  }

  // Grid field handlers
  const handleAddRow = () => {
    if (editData) {
      setEditData({
        ...editData,
        rows: [...(editData.rows || []), `Row ${(editData.rows?.length || 0) + 1}`]
      })
    }
  }

  const handleUpdateRow = (index, value) => {
    if (editData) {
      const newRows = [...(editData.rows || [])]
      newRows[index] = value
      setEditData({ ...editData, rows: newRows })
    }
  }

  const handleRemoveRow = (index) => {
    if (editData) {
      const newRows = editData.rows.filter((_, i) => i !== index)
      setEditData({ ...editData, rows: newRows })
    }
  }

  const handleAddColumn = () => {
    if (editData) {
      setEditData({
        ...editData,
        columns: [...(editData.columns || []), `Column ${(editData.columns?.length || 0) + 1}`]
      })
    }
  }

  const handleUpdateColumn = (index, value) => {
    if (editData) {
      const newColumns = [...(editData.columns || [])]
      newColumns[index] = value
      setEditData({ ...editData, columns: newColumns })
    }
  }

  const handleRemoveColumn = (index) => {
    if (editData) {
      const newColumns = editData.columns.filter((_, i) => i !== index)
      setEditData({ ...editData, columns: newColumns })
    }
  }

  if (selectedIndex === null) {
    return (
      <div className="card sticky top-4">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✏️</span>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Chỉnh Sửa Trường</h3>
          <p className="text-sm text-gray-600">
            Nhấp vào một trường để chỉnh sửa thuộc tính
          </p>
        </div>
      </div>
    )
  }

  if (!editData) return null

  const needsOptions = ['dropdown', 'radio', 'checkbox'].includes(editData.type)
  const isGrid = editData.type === 'multiple_choice_grid' || editData.type === 'checkbox_grid'

  return (
    <div className="card sticky top-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-gray-900">Chỉnh Sửa Trường</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Label */}
        <div>
          <label className="form-label">Nhãn *</label>
          <input
            type="text"
            value={editData.label}
            onChange={(e) => setEditData({ ...editData, label: e.target.value })}
            className="input"
            placeholder="Nhãn trường"
          />
        </div>

        {/* Placeholder */}
        {!needsOptions && editData.type !== 'file_upload' && editData.type !== 'rating' && (
          <div>
            <label className="form-label">Placeholder</label>
            <input
              type="text"
              value={editData.placeholder || ''}
              onChange={(e) => setEditData({ ...editData, placeholder: e.target.value })}
              className="input"
              placeholder="Văn bản placeholder"
            />
          </div>
        )}

        {/* Help Text */}
        <div>
          <label className="form-label">Văn Bản Hướng Dẫn</label>
          <textarea
            value={editData.help_text || ''}
            onChange={(e) => setEditData({ ...editData, help_text: e.target.value })}
            className="input"
            rows="2"
            placeholder="Hướng dẫn bổ sung"
          />
        </div>

        {/* Options for dropdown, radio, checkbox */}
        {needsOptions && (
          <div>
            <label className="form-label">Tùy Chọn</label>
            <div className="space-y-2">
              {(editData.options || []).map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => handleUpdateOption(index, e.target.value)}
                    className="input flex-1"
                    placeholder={`Tùy chọn ${index + 1}`}
                  />
                  <button
                    onClick={() => handleRemoveOption(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={handleAddOption}
                className="w-full btn btn-secondary text-sm flex items-center justify-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Tùy Chọn</span>
              </button>
            </div>
          </div>
        )}

        {/* Grid Rows and Columns */}
        {isGrid && (
          <>
            {/* Rows */}
            <div>
              <label className="form-label">Hàng (Câu Hỏi)</label>
              <div className="space-y-2">
                {(editData.rows || []).map((row, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={row}
                      onChange={(e) => handleUpdateRow(index, e.target.value)}
                      className="input flex-1"
                      placeholder={`Hàng ${index + 1}`}
                    />
                    <button
                      onClick={() => handleRemoveRow(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={handleAddRow}
                  className="w-full btn btn-secondary text-sm flex items-center justify-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm Hàng</span>
                </button>
              </div>
            </div>

            {/* Columns */}
            <div>
              <label className="form-label">Cột (Tùy Chọn)</label>
              <div className="space-y-2">
                {(editData.columns || []).map((column, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={column}
                      onChange={(e) => handleUpdateColumn(index, e.target.value)}
                      className="input flex-1"
                      placeholder={`Cột ${index + 1}`}
                    />
                    <button
                      onClick={() => handleRemoveColumn(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={handleAddColumn}
                  className="w-full btn btn-secondary text-sm flex items-center justify-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm Cột</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Required */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="required"
            checked={editData.is_required}
            onChange={(e) => setEditData({ ...editData, is_required: e.target.checked })}
            className="w-4 h-4 text-primary-600 rounded"
          />
          <label htmlFor="required" className="text-sm font-medium text-gray-700 cursor-pointer">
            Trường bắt buộc
          </label>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          className="w-full btn btn-primary"
        >
          Lưu Thay Đổi
        </button>
      </div>
    </div>
  )
}

// Add click handler to fields
export function useFieldSelection() {
  const { fields } = useFormStore()
  const [selectedIndex, setSelectedIndex] = useState(null)

  return { selectedIndex, setSelectedIndex }
}

