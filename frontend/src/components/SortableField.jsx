import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, Edit } from 'lucide-react'
import { useFormStore } from '../store/formStore'
import { fieldAPI } from '../services/api'
import toast from 'react-hot-toast'
import { useState } from 'react'

export default function SortableField({ field, index, onEdit }) {
  const { removeField, currentForm } = useFormStore()
  const [deleting, setDeleting] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: index })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleDelete = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa trường này?')) {
      return
    }

    setDeleting(true)
    try {
      // If field has ID, delete from database
      if (field.id && currentForm?.id) {
        await fieldAPI.delete(currentForm.id, field.id)
        toast.success('Đã xóa trường thành công')
      }
      
      // Remove from state
      removeField(index)
    } catch (error) {
      toast.error('Không thể xóa trường')
      console.error('Delete error:', error)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="card hover:shadow-md transition-shadow"
    >
      <div className="flex items-start space-x-3">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-1 p-1 cursor-grab active:cursor-grabbing hover:bg-gray-100 rounded"
        >
          <GripVertical className="w-5 h-5 text-gray-400" />
        </button>

        {/* Field Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h4 className="font-medium text-gray-900">{field.label}</h4>
              {field.help_text && (
                <p className="text-sm text-gray-600 mt-1">{field.help_text}</p>
              )}
            </div>
                   <div className="flex items-center space-x-2 ml-2">
                     {field.is_required && (
                       <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                         Bắt buộc
                       </span>
                     )}
                     <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                       {field.type.replace('_', ' ')}
                     </span>
                   </div>
          </div>

          {/* Field Preview */}
          <div className="mt-3">
            {(field.type === 'short_text' || field.type === 'email' || field.type === 'phone' || field.type === 'url' || field.type === 'number') && (
              <input
                type="text"
                placeholder={field.placeholder || 'Câu trả lời của bạn'}
                className="input"
                disabled
              />
            )}
            {field.type === 'long_text' && (
              <textarea
                placeholder={field.placeholder || 'Câu trả lời của bạn'}
                className="input"
                rows="3"
                disabled
              />
            )}
            {field.type === 'date' && (
              <input type="date" className="input" disabled />
            )}
            {(field.type === 'dropdown' || field.type === 'radio' || field.type === 'checkbox') && field.options && (
              <div className="space-y-2">
                {field.options.map((option, i) => (
                  <div key={i} className="flex items-center space-x-2">
                    <input
                      type={field.type === 'checkbox' ? 'checkbox' : 'radio'}
                      disabled
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">{option}</span>
                  </div>
                ))}
              </div>
            )}
            {field.type === 'file_upload' && (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center text-gray-500">
                Nhấp để tải lên hoặc kéo thả
              </div>
            )}
            {field.type === 'rating' && (
              <div className="flex space-x-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} className="text-2xl text-gray-300">⭐</span>
                ))}
              </div>
            )}
            {(field.type === 'multiple_choice_grid' || field.type === 'checkbox_grid') && field.rows && field.columns && (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border border-gray-300 bg-gray-50 px-3 py-2 text-left text-sm font-medium text-gray-700"></th>
                      {field.columns.map((column, i) => (
                        <th key={i} className="border border-gray-300 bg-gray-50 px-3 py-2 text-center text-sm font-medium text-gray-700">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {field.rows.map((row, i) => (
                      <tr key={i}>
                        <td className="border border-gray-300 px-3 py-2 text-sm text-gray-700">
                          {row}
                        </td>
                        {field.columns.map((_, j) => (
                          <td key={j} className="border border-gray-300 px-3 py-2 text-center">
                            <input
                              type={field.type === 'checkbox_grid' ? 'checkbox' : 'radio'}
                              disabled
                              className="w-4 h-4"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onEdit && onEdit(index)}
            className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            title="Chỉnh sửa trường"
          >
            <Edit className="w-5 h-5" />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            title="Xóa trường"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

