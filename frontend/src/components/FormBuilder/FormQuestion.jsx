import { useState, useRef, useEffect } from 'react'
import { GripVertical, Copy, Trash2, MoreVertical, Image, Type, AlignLeft, Mail, Hash, Phone, Link2, Calendar, ChevronDown, Circle, CheckSquare, Upload, Star, Grid3x3, Menu } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { useFormStore } from '../../store/formStore'
import RichTextEditor from './RichTextEditor'

const FIELD_TYPE_LABELS = {
  short_text: 'Văn bản ngắn',
  long_text: 'Văn bản dài',
  email: 'Email',
  number: 'Số',
  phone: 'Số điện thoại',
  url: 'Liên kết',
  date: 'Ngày tháng',
  dropdown: 'Danh sách thả xuống',
  radio: 'Trắc nghiệm',
  checkbox: 'Hộp kiểm',
  multiple_choice_grid: 'Lưới trắc nghiệm',
  checkbox_grid: 'Lưới hộp kiểm',
  file_upload: 'Tải lên tệp',
  rating: 'Đánh giá',
  description: 'Tiêu đề và mô tả',
  image: 'Ảnh',
  video: 'Video',
  section: 'Phân trang',
}

const FIELD_TYPE_GROUPS = [
  {
    title: 'Lựa chọn',
    types: [
      { type: 'radio', label: 'Trắc nghiệm', icon: Circle },
      { type: 'checkbox', label: 'Hộp kiểm', icon: CheckSquare },
      { type: 'dropdown', label: 'Danh sách thả xuống', icon: ChevronDown },
    ]
  },
  {
    title: 'Văn bản',
    types: [
      { type: 'short_text', label: 'Văn bản ngắn', icon: Type },
      { type: 'long_text', label: 'Văn bản dài', icon: AlignLeft },
    ]
  },
  {
    title: 'Đặc biệt',
    types: [
      { type: 'email', label: 'Email', icon: Mail },
      { type: 'number', label: 'Số', icon: Hash },
      { type: 'phone', label: 'Số điện thoại', icon: Phone },
      { type: 'url', label: 'Liên kết', icon: Link2 },
      { type: 'date', label: 'Ngày tháng', icon: Calendar },
    ]
  },
  {
    title: 'Nâng cao',
    types: [
      { type: 'file_upload', label: 'Tải lên tệp', icon: Upload },
      { type: 'rating', label: 'Đánh giá', icon: Star },
      { type: 'multiple_choice_grid', label: 'Lưới trắc nghiệm', icon: Grid3x3 },
      { type: 'checkbox_grid', label: 'Lưới hộp kiểm', icon: Menu },
    ]
  },
]

// Helper function to get icon for field type
const getFieldTypeIcon = (type) => {
  for (const group of FIELD_TYPE_GROUPS) {
    const found = group.types.find(t => t.type === type)
    if (found) return found.icon
  }
  return Circle // Default icon
}

export default function FormQuestion({ field, index, isActive, onClick, theme }) {
  const { updateField, removeField, duplicateField } = useFormStore()
  const [editData, setEditData] = useState({ ...field })
  const [showTypeDropdown, setShowTypeDropdown] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState(false)
  const [editingOptionIndex, setEditingOptionIndex] = useState(null)
  const dropdownRef = useRef(null)
  const questionInputRef = useRef(null)
  const optionInputRefs = useRef([])
  const gridRowInputRefs = useRef([])
  const gridColumnInputRefs = useRef([])

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: index })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  useEffect(() => {
    setEditData({ ...field })
  }, [field])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowTypeDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleUpdate = (updates) => {
    const newData = { ...editData, ...updates }
    setEditData(newData)
    updateField(index, newData)
  }

  const handleAddOption = () => {
    const options = editData.options || []
    handleUpdate({ options: [...options, `Tùy chọn ${options.length + 1}`] })
  }

  const handleUpdateOption = (optIndex, value) => {
    const options = [...(editData.options || [])]
    options[optIndex] = value
    handleUpdate({ options })
  }

  const handleRemoveOption = (optIndex) => {
    const options = editData.options.filter((_, i) => i !== optIndex)
    handleUpdate({ options })
  }

  const handleOptionDragEnd = (event) => {
    const { active, over } = event
    if (active.id !== over.id) {
      const oldIndex = active.id
      const newIndex = over.id
      const newOptions = arrayMove(editData.options || [], oldIndex, newIndex)
      handleUpdate({ options: newOptions })
    }
  }

  const handleOptionKeyDown = (e, optIndex) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const nextIndex = optIndex + 1
      if (nextIndex < editData.options.length) {
        setEditingOptionIndex(nextIndex)
        setTimeout(() => {
          const nextInput = optionInputRefs.current[nextIndex]
          if (nextInput) {
            nextInput.focus()
            nextInput.select()
          }
        }, 0)
      } else {
        // Nếu là option cuối cùng, thêm option mới
        handleAddOption()
        setTimeout(() => {
          setEditingOptionIndex(nextIndex)
          setTimeout(() => {
            const newInput = optionInputRefs.current[nextIndex]
            if (newInput) {
              newInput.focus()
              newInput.select()
            }
          }, 0)
        }, 0)
      }
    }
  }

  const handleAddRow = () => {
    const rows = editData.rows || []
    handleUpdate({ rows: [...rows, `Hàng ${rows.length + 1}`] })
  }

  const handleUpdateRow = (rowIndex, value) => {
    const rows = [...(editData.rows || [])]
    rows[rowIndex] = value
    handleUpdate({ rows })
  }

  const handleRemoveRow = (rowIndex) => {
    const rows = editData.rows.filter((_, i) => i !== rowIndex)
    handleUpdate({ rows })
  }

  const handleAddColumn = () => {
    const columns = editData.columns || []
    handleUpdate({ columns: [...columns, `Cột ${columns.length + 1}`] })
  }

  const handleUpdateColumn = (colIndex, value) => {
    const columns = [...(editData.columns || [])]
    columns[colIndex] = value
    handleUpdate({ columns })
  }

  const handleRemoveColumn = (colIndex) => {
    const columns = editData.columns.filter((_, i) => i !== colIndex)
    handleUpdate({ columns })
  }

  const handleGridRowKeyDown = (e, rowIndex) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const nextIndex = rowIndex + 1
      if (nextIndex < editData.rows.length) {
        setTimeout(() => {
          const nextInput = gridRowInputRefs.current[nextIndex]
          if (nextInput) {
            nextInput.focus()
            nextInput.select()
          }
        }, 0)
      } else {
        // Nếu là row cuối cùng, thêm row mới
        handleAddRow()
        setTimeout(() => {
          setTimeout(() => {
            const newInput = gridRowInputRefs.current[nextIndex]
            if (newInput) {
              newInput.focus()
              newInput.select()
            }
          }, 0)
        }, 0)
      }
    }
  }

  const handleGridColumnKeyDown = (e, colIndex) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const nextIndex = colIndex + 1
      if (nextIndex < editData.columns.length) {
        setTimeout(() => {
          const nextInput = gridColumnInputRefs.current[nextIndex]
          if (nextInput) {
            nextInput.focus()
            nextInput.select()
          }
        }, 0)
      } else {
        // Nếu là column cuối cùng, thêm column mới
        handleAddColumn()
        setTimeout(() => {
          setTimeout(() => {
            const newInput = gridColumnInputRefs.current[nextIndex]
            if (newInput) {
              newInput.focus()
              newInput.select()
            }
          }, 0)
        }, 0)
      }
    }
  }

  const handleDuplicate = () => {
    duplicateField(index)
  }

  const handleDelete = () => {
    if (confirm('Bạn có chắc chắn muốn xóa câu hỏi này?')) {
      removeField(index)
    }
  }

  const handleTypeChange = (newType) => {
    const isGridType = newType === 'multiple_choice_grid' || newType === 'checkbox_grid'
    const needsOptions = ['dropdown', 'radio', 'checkbox'].includes(newType)
    
    const updates = { type: newType }
    
    if (needsOptions && !editData.options) {
      updates.options = ['Tùy chọn 1']
    }
    
    if (isGridType) {
      if (!editData.rows) updates.rows = ['Hàng 1']
      if (!editData.columns) updates.columns = ['Cột 1']
    }
    
    handleUpdate(updates)
    setShowTypeDropdown(false)
  }

  const needsOptions = ['dropdown', 'radio', 'checkbox'].includes(editData.type)
  const isGrid = editData.type === 'multiple_choice_grid' || editData.type === 'checkbox_grid'

  // Drag & Drop sensors for grid rows/columns
  const gridSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  )

  const handleRowDragEnd = (event) => {
    const { active, over } = event
    if (active.id !== over.id) {
      const oldIndex = active.id
      const newIndex = over.id
      const newRows = arrayMove(editData.rows || [], oldIndex, newIndex)
      handleUpdate({ rows: newRows })
    }
  }

  const handleColumnDragEnd = (event) => {
    const { active, over } = event
    if (active.id !== over.id) {
      const oldIndex = active.id
      const newIndex = over.id
      const newColumns = arrayMove(editData.columns || [], oldIndex, newIndex)
      handleUpdate({ columns: newColumns })
    }
  }

  // Special field types that don't need standard header/footer
  const isSpecialType = ['section', 'description', 'image', 'video'].includes(editData.type)

  return (
    <>
      <style>{`
        .text-sm.text-gray-600 a {
          color: ${theme?.primary_color || '#4285F4'} !important;
          text-decoration: underline !important;
          cursor: pointer;
        }
        .text-sm.text-gray-600 a:hover {
          opacity: 0.8;
        }
        .text-sm.text-gray-600 ol {
          list-style-type: decimal;
          padding-left: 2em;
          margin: 0.5em 0;
        }
        .text-sm.text-gray-600 ul {
          list-style-type: disc;
          padding-left: 2em;
          margin: 0.5em 0;
        }
        .text-sm.text-gray-600 li {
          margin: 0.25em 0;
        }
      `}</style>
      <div
        ref={setNodeRef}
        style={style}
        onClick={onClick}
        className={`eforms-question ${isActive ? 'active' : ''}`}
      >
      {/* Question Header */}
      {!isSpecialType && (
        <div className="eforms-question-header">
          {editingQuestion && isActive ? (
            <div className="eforms-input-wrapper" style={{ flex: 1, marginBottom: 0 }}>
              <input
                ref={questionInputRef}
                type="text"
                value={editData.label}
                onChange={(e) => handleUpdate({ label: e.target.value })}
                onBlur={() => setEditingQuestion(false)}
                onFocus={(e) => {
                  e.stopPropagation()
                  e.target.select()
                }}
                className="eforms-question-input"
                placeholder="Câu hỏi"
                style={{
                  color: theme?.primary_color,
                  fontSize: theme?.question_font_size,
                }}
              />
            </div>
          ) : (
            <div
              className="eforms-question-input"
              onClick={(e) => {
                if (isActive) {
                  e.stopPropagation()
                  setEditingQuestion(true)
                  setTimeout(() => questionInputRef.current?.focus(), 0)
                }
              }}
              style={{
                color: theme?.primary_color,
                fontSize: theme?.question_font_size,
              }}
            >
              {editData.label || 'Câu hỏi'}
            </div>
          )}
          
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowTypeDropdown(!showTypeDropdown)
              
              // Calculate position for fixed dropdown
              if (!showTypeDropdown) {
                const rect = e.currentTarget.getBoundingClientRect()
                setTimeout(() => {
                  const dropdown = document.querySelector('.eforms-type-dropdown')
                  if (dropdown) {
                    const dropdownHeight = dropdown.offsetHeight
                    const viewportHeight = window.innerHeight
                    
                    // Ưu tiên hiển thị phía dưới button
                    let top = rect.bottom + 4
                    
                    // Nếu không đủ chỗ phía dưới, hiển thị phía trên
                    if (top + dropdownHeight > viewportHeight - 10) {
                      top = Math.max(10, rect.top - dropdownHeight - 4)
                    }
                    
                    // Đảm bảo không vượt quá viewport
                    top = Math.max(10, Math.min(top, viewportHeight - dropdownHeight - 10))
                    
                    dropdown.style.top = `${top}px`
                    dropdown.style.left = `${rect.left}px`
                  }
                }, 0)
              }
            }}
            className="eforms-type-selector"
          >
            {(() => {
              const Icon = getFieldTypeIcon(editData.type)
              return (
                <>
                  <Icon className="w-4 h-4" />
                  <span className="flex-1 text-left">{FIELD_TYPE_LABELS[editData.type] || editData.type}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              )
            })()}
          </button>

          {showTypeDropdown && (
            <div className="eforms-type-dropdown">
              {FIELD_TYPE_GROUPS.map((group, groupIndex) => (
                <div key={groupIndex}>
                  {groupIndex > 0 && <div className="eforms-type-divider" />}
                  <div className="eforms-type-group">
                    <div className="eforms-type-group-title">{group.title}</div>
                    {group.types.map((ft) => {
                      const Icon = ft.icon
                      return (
                        <button
                          key={ft.type}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleTypeChange(ft.type)
                          }}
                          className={`eforms-type-option ${editData.type === ft.type ? 'active' : ''}`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{ft.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      )}

      {/* Question Body */}
      <div className="eforms-question-body">
        {/* Text fields */}
        {(editData.type === 'short_text' || editData.type === 'email' || editData.type === 'phone' || editData.type === 'url' || editData.type === 'number') && (
          <div className="eforms-input-wrapper" style={{ marginBottom: 0 }}>
            <input
              type="text"
              placeholder={editData.placeholder || 'Câu trả lời văn bản ngắn'}
              className="eforms-answer-preview"
              disabled={!isActive}
              onFocus={(e) => e.target.select()}
            />
          </div>
        )}

        {editData.type === 'long_text' && (
          <div className="eforms-input-wrapper" style={{ marginBottom: 0 }}>
            <textarea
              placeholder={editData.placeholder || 'Câu trả lời văn bản dài'}
              className="eforms-answer-preview"
              rows="3"
              disabled={!isActive}
              onFocus={(e) => e.target.select()}
            />
          </div>
        )}

        {editData.type === 'date' && (
          <div className="eforms-input-wrapper" style={{ marginBottom: 0 }}>
            <input 
              type="date" 
              className="eforms-answer-preview" 
              disabled={!isActive}
              onFocus={(e) => e.target.select()}
            />
          </div>
        )}

        {/* Options-based fields */}
        {needsOptions && (
          <div className="space-y-2">
            <DndContext
              sensors={gridSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleOptionDragEnd}
            >
              <SortableContext
                items={(editData.options || []).map((_, i) => i)}
                strategy={verticalListSortingStrategy}
              >
                {(editData.options || []).map((option, optIndex) => (
                  <SortableOption
                    key={optIndex}
                    id={optIndex}
                    option={option}
                    optIndex={optIndex}
                    isActive={isActive}
                    isEditing={editingOptionIndex === optIndex}
                    fieldType={editData.type}
                    canRemove={editData.options.length > 1}
                    onStartEdit={() => setEditingOptionIndex(optIndex)}
                    onUpdate={(value) => handleUpdateOption(optIndex, value)}
                    onRemove={() => handleRemoveOption(optIndex)}
                    onBlur={() => setEditingOptionIndex(null)}
                    onKeyDown={(e) => handleOptionKeyDown(e, optIndex)}
                    inputRef={(el) => (optionInputRefs.current[optIndex] = el)}
                  />
                ))}
              </SortableContext>
            </DndContext>
            
            {isActive && (
              <div className="eforms-option">
                <input
                  type={editData.type === 'checkbox' ? 'checkbox' : 'radio'}
                  disabled
                  className="eforms-option-radio"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleAddOption()
                  }}
                  className="eforms-add-option"
                >
                  Thêm tùy chọn
                </button>
              </div>
            )}
          </div>
        )}

        {/* Grid fields */}
        {isGrid && (
          <div className="eforms-grid">
            {isActive ? (
              <>
                <div className="grid grid-cols-2 gap-6">
                  {/* Hàng */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-3 block">Hàng</label>
                    <DndContext
                      sensors={gridSensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleRowDragEnd}
                    >
                      <SortableContext
                        items={(editData.rows || []).map((_, i) => i)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {(editData.rows || []).map((row, rowIndex) => (
                            <SortableGridRow
                              key={rowIndex}
                              id={rowIndex}
                              value={row}
                              onUpdate={(value) => handleUpdateRow(rowIndex, value)}
                              onRemove={() => handleRemoveRow(rowIndex)}
                              canRemove={editData.rows.length > 1}
                              placeholder={`Hàng ${rowIndex + 1}`}
                              onKeyDown={(e) => handleGridRowKeyDown(e, rowIndex)}
                              inputRef={(el) => (gridRowInputRefs.current[rowIndex] = el)}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAddRow()
                      }}
                      className="text-sm text-primary-600 hover:text-primary-700 mt-2"
                    >
                      + Thêm hàng
                    </button>
                  </div>

                  {/* Cột */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-3 block">Cột</label>
                    <DndContext
                      sensors={gridSensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleColumnDragEnd}
                    >
                      <SortableContext
                        items={(editData.columns || []).map((_, i) => i)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {(editData.columns || []).map((column, colIndex) => (
                            <SortableGridColumn
                              key={colIndex}
                              id={colIndex}
                              value={column}
                              onUpdate={(value) => handleUpdateColumn(colIndex, value)}
                              onRemove={() => handleRemoveColumn(colIndex)}
                              canRemove={editData.columns.length > 1}
                              placeholder={`Cột ${colIndex + 1}`}
                              isCheckbox={editData.type === 'checkbox_grid'}
                              onKeyDown={(e) => handleGridColumnKeyDown(e, colIndex)}
                              inputRef={(el) => (gridColumnInputRefs.current[colIndex] = el)}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAddColumn()
                      }}
                      className="text-sm text-primary-600 hover:text-primary-700 mt-2"
                    >
                      + Thêm cột
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse border border-gray-300 rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-gray-50 border-b-2 border-gray-300">
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 min-w-[120px]"></th>
                      {(editData.columns || []).map((column, i) => (
                        <th 
                          key={i} 
                          className="px-4 py-3 text-center text-sm font-medium text-gray-700 min-w-[100px]"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {(editData.rows || []).map((row, i) => (
                      <tr 
                        key={i} 
                        className={`${i < editData.rows.length - 1 ? 'border-b border-gray-200' : ''} hover:bg-gray-50 transition-colors`}
                      >
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">{row}</td>
                        {(editData.columns || []).map((_, j) => (
                          <td 
                            key={j} 
                            className="px-4 py-3 text-center"
                          >
                            <div className="flex justify-center items-center">
                              <input
                                type={editData.type === 'checkbox_grid' ? 'checkbox' : 'radio'}
                                disabled
                                className="w-4 h-4 cursor-not-allowed"
                              />
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {editData.type === 'file_upload' && (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-500">
            Tải lên tệp
          </div>
        )}

        {editData.type === 'rating' && (
          <div className="flex space-x-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <span key={star} className="text-2xl text-gray-300 cursor-pointer hover:text-yellow-400">⭐</span>
            ))}
          </div>
        )}

        {/* Description/Title field */}
        {editData.type === 'description' && (
          <div className="space-y-3">
            {isActive ? (
              <>
                <input
                  type="text"
                  value={editData.label}
                  onChange={(e) => handleUpdate({ label: e.target.value })}
                  onFocus={(e) => {
                    e.stopPropagation()
                    e.target.select()
                  }}
                  onMouseEnter={(e) => {
                    if (document.activeElement !== e.target) {
                      e.target.style.borderBottom = '2px solid #d1d5db'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (document.activeElement !== e.target) {
                      e.target.style.borderBottom = '2px solid transparent'
                    }
                  }}
                  className="w-full text-lg font-medium text-gray-900 px-3 py-2 outline-none bg-transparent transition-all"
                  style={{
                    border: 'none',
                    borderBottom: '2px solid transparent'
                  }}
                  onFocusCapture={(e) => {
                    e.target.style.borderBottom = `2px solid ${theme?.primary_color || '#4285F4'}`
                  }}
                  onBlurCapture={(e) => {
                    e.target.style.borderBottom = '2px solid transparent'
                  }}
                  placeholder="Tiêu đề"
                />
                <div className="mt-2">
                  <RichTextEditor
                    value={editData.description || ''}
                    onChange={(html) => handleUpdate({ description: html })}
                    placeholder="Mô tả (tùy chọn)"
                    className="w-full text-sm text-gray-600 px-3 py-2 outline-none bg-transparent resize-none transition-all"
                    theme={theme}
                    isMultiline={true}
                    onFocus={(e) => e.stopPropagation()}
                  />
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium text-gray-900">{editData.label}</h3>
                {editData.description && (
                  <div 
                    className="text-sm text-gray-600"
                    dangerouslySetInnerHTML={{ __html: editData.description }}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* Image field */}
        {editData.type === 'image' && (
          <div className="space-y-3">
            {isActive ? (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">URL Ảnh</label>
                <input
                  type="url"
                  value={editData.image_url || ''}
                  onChange={(e) => handleUpdate({ image_url: e.target.value })}
                  onFocus={(e) => e.stopPropagation()}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="https://example.com/image.jpg"
                />
                {editData.image_url && (
                  <img 
                    src={editData.image_url} 
                    alt="Preview" 
                    className="max-w-full h-auto rounded border border-gray-200"
                    onError={(e) => {
                      e.target.style.display = 'none'
                    }}
                  />
                )}
              </div>
            ) : (
              <>
                {editData.image_url ? (
                  <img 
                    src={editData.image_url} 
                    alt={editData.label} 
                    className="max-w-full h-auto rounded border border-gray-200"
                  />
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Chưa có ảnh
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Video field */}
        {editData.type === 'video' && (
          <div className="space-y-3">
            {isActive ? (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">URL Video YouTube</label>
                <input
                  type="url"
                  value={editData.video_url || ''}
                  onChange={(e) => handleUpdate({ video_url: e.target.value })}
                  onFocus={(e) => e.stopPropagation()}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="https://www.youtube.com/watch?v=..."
                />
                {editData.video_url && (
                  <div className="aspect-video">
                    <iframe
                      src={editData.video_url.replace('watch?v=', 'embed/')}
                      className="w-full h-full rounded border border-gray-200"
                      allowFullScreen
                    />
                  </div>
                )}
              </div>
            ) : (
              <>
                {editData.video_url ? (
                  <div className="aspect-video">
                    <iframe
                      src={editData.video_url.replace('watch?v=', 'embed/')}
                      className="w-full h-full rounded border border-gray-200"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Chưa có video
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Section Break field */}
        {editData.type === 'section' && (
          <div className="space-y-3 -mx-6 -my-6 px-6 py-6">
            {/* Gradient border indicator at top of box */}
            <div 
              className="h-1.5 rounded-t-lg -mx-6 -mt-6 mb-6"
              style={{
                background: theme?.primary_color 
                  ? `linear-gradient(to right, ${theme.primary_color}, ${theme.secondary_color || theme.primary_color})` 
                  : 'linear-gradient(to right, #4285F4, #60a5fa)'
              }}
            ></div>
            
            {isActive ? (
              <>
                <input
                  type="text"
                  value={editData.label}
                  onChange={(e) => handleUpdate({ label: e.target.value })}
                  onFocus={(e) => {
                    e.stopPropagation()
                    e.target.select()
                  }}
                  onMouseEnter={(e) => {
                    if (document.activeElement !== e.target) {
                      e.target.style.borderBottom = '2px solid #d1d5db'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (document.activeElement !== e.target) {
                      e.target.style.borderBottom = '2px solid transparent'
                    }
                  }}
                  className="w-full text-xl font-medium text-gray-900 px-3 py-2 outline-none bg-transparent transition-all"
                  style={{
                    border: 'none',
                    borderBottom: '2px solid transparent'
                  }}
                  onFocusCapture={(e) => {
                    e.target.style.borderBottom = `2px solid ${theme?.primary_color || '#4285F4'}`
                  }}
                  onBlurCapture={(e) => {
                    e.target.style.borderBottom = '2px solid transparent'
                  }}
                  placeholder="Phần chưa có tiêu đề"
                />
                <div className="mt-2">
                  <RichTextEditor
                    value={editData.description || ''}
                    onChange={(html) => handleUpdate({ description: html })}
                    placeholder="Mô tả phần (tùy chọn)"
                    className="w-full text-sm text-gray-600 px-3 py-2 outline-none bg-transparent resize-none transition-all"
                    theme={theme}
                    isMultiline={true}
                    onFocus={(e) => e.stopPropagation()}
                  />
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-medium text-gray-900 px-3 py-2">{editData.label}</h2>
                {editData.description && (
                  <div 
                    className="text-sm text-gray-600 px-3 py-1"
                    dangerouslySetInnerHTML={{ __html: editData.description }}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Question Footer (only when active and not special type) */}
      {isActive && (
        <div className="eforms-question-footer">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                {...attributes}
                {...listeners}
                className="eforms-action-btn"
                title="Di chuyển"
              >
                <GripVertical className="w-5 h-5" />
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDuplicate()
                }}
                className="eforms-action-btn"
                title="Nhân bản"
              >
                <Copy className="w-5 h-5" />
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete()
                }}
                className="eforms-action-btn text-red-600 hover:bg-red-50"
                title="Xóa"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            {!isSpecialType ? (
              <div className="flex items-center space-x-4">
                <div className="h-6 w-px bg-gray-300"></div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <span className="text-sm text-gray-700">Bắt buộc</span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={editData.is_required}
                      onChange={(e) => handleUpdate({ is_required: e.target.checked })}
                      className="sr-only"
                    />
                    <div className={`eforms-toggle ${editData.is_required ? 'active' : ''}`}>
                      <div className="eforms-toggle-slider"></div>
                    </div>
                  </div>
                </label>
              </div>
            ) : editData.type === 'section' ? (
              <p className="text-sm text-gray-500 italic">
                Phân trang - Người dùng sẽ chuyển sang trang mới
              </p>
            ) : null}
          </div>
        </div>
      )}
      </div>
    </>
  )
}

// Sortable Option Component
function SortableOption({ 
  id, 
  option, 
  optIndex, 
  isActive, 
  isEditing, 
  fieldType, 
  canRemove, 
  onStartEdit, 
  onUpdate, 
  onRemove, 
  onBlur, 
  onKeyDown,
  inputRef 
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="eforms-option">
      {isActive ? (
        <>
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <input
            type={fieldType === 'checkbox' ? 'checkbox' : 'radio'}
            disabled
            className="eforms-option-radio"
          />
          {isEditing ? (
            <div className="eforms-input-wrapper" style={{ flex: 1, marginBottom: 0 }}>
              <input
                ref={inputRef}
                type="text"
                value={option}
                onChange={(e) => onUpdate(e.target.value)}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
                onFocus={(e) => {
                  e.stopPropagation()
                  e.target.select()
                }}
                className="eforms-option-input"
                placeholder={`Tùy chọn ${optIndex + 1}`}
                autoFocus
              />
            </div>
          ) : (
            <div
              className="eforms-option-input cursor-text"
              onClick={(e) => {
                e.stopPropagation()
                onStartEdit()
              }}
            >
              {option || `Tùy chọn ${optIndex + 1}`}
            </div>
          )}
          {canRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
              className="eforms-option-remove"
            >
              ×
            </button>
          )}
        </>
      ) : (
        <>
          <input
            type={fieldType === 'checkbox' ? 'checkbox' : 'radio'}
            disabled
            className="eforms-option-radio"
          />
          <span className="text-gray-700">{option}</span>
        </>
      )}
    </div>
  )
}

// Sortable Grid Row Component
function SortableGridRow({ id, value, onUpdate, onRemove, canRemove, placeholder, onKeyDown, inputRef }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center space-x-2">
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="eforms-input-wrapper" style={{ flex: 1, marginBottom: 0 }}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onUpdate(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={(e) => {
            e.stopPropagation()
            e.target.select()
          }}
          className="eforms-option-input"
          placeholder={placeholder}
        />
      </div>
      {canRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="eforms-option-remove"
        >
          ×
        </button>
      )}
    </div>
  )
}

// Sortable Grid Column Component
function SortableGridColumn({ id, value, onUpdate, onRemove, canRemove, placeholder, isCheckbox, onKeyDown, inputRef }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="eforms-option">
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      {isCheckbox ? (
        <input
          type="checkbox"
          disabled
          className="eforms-option-radio"
        />
      ) : (
        <input
          type="radio"
          disabled
          className="eforms-option-radio"
        />
      )}
      <div className="eforms-input-wrapper" style={{ flex: 1, marginBottom: 0 }}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onUpdate(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={(e) => {
            e.stopPropagation()
            e.target.select()
          }}
          className="eforms-option-input"
          placeholder={placeholder}
        />
      </div>
      {canRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="eforms-option-remove"
        >
          ×
        </button>
      )}
    </div>
  )
}

