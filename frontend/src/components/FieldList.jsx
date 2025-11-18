import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useFormStore } from '../store/formStore'
import SortableField from './SortableField'
import { Plus } from 'lucide-react'

const FIELD_TYPES = [
  { type: 'short_text', label: 'Văn Bản Ngắn', icon: '📝' },
  { type: 'long_text', label: 'Văn Bản Dài', icon: '📄' },
  { type: 'email', label: 'Email', icon: '📧' },
  { type: 'number', label: 'Số', icon: '🔢' },
  { type: 'phone', label: 'Số Điện Thoại', icon: '📱' },
  { type: 'url', label: 'Liên Kết', icon: '🔗' },
  { type: 'date', label: 'Ngày Tháng', icon: '📅' },
  { type: 'dropdown', label: 'Danh Sách Thả Xuống', icon: '📋' },
  { type: 'radio', label: 'Lựa Chọn Duy Nhất', icon: '⚪' },
  { type: 'checkbox', label: 'Hộp Kiểm', icon: '☑️' },
  { type: 'multiple_choice_grid', label: 'Lưới Lựa Chọn Duy Nhất', icon: '📊' },
  { type: 'checkbox_grid', label: 'Lưới Hộp Kiểm', icon: '☑️' },
  { type: 'file_upload', label: 'Tải Lên Tệp', icon: '📎' },
  { type: 'rating', label: 'Đánh Giá', icon: '⭐' },
]

export default function FieldList({ onFieldSelect }) {
  const { fields, addField, reorderFields } = useFormStore()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event) => {
    const { active, over } = event

    if (active.id !== over.id) {
      const oldIndex = fields.findIndex((f, i) => i === active.id)
      const newIndex = fields.findIndex((f, i) => i === over.id)
      reorderFields(arrayMove(fields, oldIndex, newIndex))
    }
  }

  const handleAddField = (type) => {
    const isGridType = type === 'multiple_choice_grid' || type === 'checkbox_grid'
    
    const newField = {
      type,
      label: `${FIELD_TYPES.find(f => f.type === type)?.label || 'Field'}`,
      placeholder: '',
      help_text: '',
      options: type === 'dropdown' || type === 'radio' || type === 'checkbox' ? ['Option 1', 'Option 2'] : null,
      rows: isGridType ? ['Row 1', 'Row 2'] : null,
      columns: isGridType ? ['Column 1', 'Column 2', 'Column 3'] : null,
      is_required: false,
    }
    addField(newField)
  }

  return (
    <div className="space-y-4">
      {/* Add Field Buttons */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Thêm Trường</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {FIELD_TYPES.map((fieldType) => (
            <button
              key={fieldType.type}
              onClick={() => handleAddField(fieldType.type)}
              className="p-3 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors text-left"
            >
              <div className="text-2xl mb-1">{fieldType.icon}</div>
              <div className="text-xs font-medium text-gray-700">{fieldType.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Fields List */}
      {fields.length === 0 ? (
        <div className="card text-center py-12">
          <Plus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">Chưa có trường nào. Thêm trường đầu tiên ở trên.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={fields.map((_, i) => i)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {fields.map((field, index) => (
                <SortableField 
                  key={index} 
                  field={field} 
                  index={index}
                  onEdit={onFieldSelect}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

