import { useState, useEffect } from 'react'
import { useFormStore } from '../../store/formStore'
import { useEditor } from '../../layouts/FormEditorLayout'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import EditableTitle from './EditableTitle'
import FormQuestion from './FormQuestion'
import FormSidebar from './FormSidebar'
import RandomSectionCard, { BlockFooter } from './RandomSectionCard'
import {
  moveField, insertionPoint, isHiddenInBuilder, currentVariant, isDifferentMode, findHeader,
  blockEnd,
} from '../../utils/formStructure'

/** "Câu hỏi" tab. Form data, saving and the theme live in FormEditorLayout. */
export default function FormBuilder() {
  const { currentForm, fields, reorderFields, insertFields, title, description, setMeta } = useFormStore()
  const { theme: currentTheme, showTheme, readOnly, activeQuestionIndex, setActiveQuestionIndex } = useEditor()
  const [activeTabs, setActiveTabs] = useState({})
  const hasResponses = (currentForm?.responses?.length || 0) > 0

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      const questionElements = document.querySelectorAll('.eforms-question')
      let clickedInside = false
      
      questionElements.forEach((el) => {
        if (el.contains(event.target)) {
          clickedInside = true
        }
      })

      const sidebar = document.querySelector('.eforms-sidebar')
      if (sidebar && sidebar.contains(event.target)) {
        clickedInside = true
      }

      if (!clickedInside) {
        setActiveQuestionIndex(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [setActiveQuestionIndex])

  // Apply theme CSS variables and body background
  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    
    root.style.setProperty('--theme-primary', currentTheme.primary_color)
    root.style.setProperty('--theme-secondary', currentTheme.secondary_color)
    root.style.setProperty('--theme-bg', currentTheme.background_color)
    
    // Apply background color to body
    const originalBodyBg = body.style.backgroundColor
    body.style.backgroundColor = currentTheme.background_color
    
    return () => {
      root.style.removeProperty('--theme-primary')
      root.style.removeProperty('--theme-secondary')
      root.style.removeProperty('--theme-bg')
      body.style.backgroundColor = originalBodyBg
    }
  }, [currentTheme])

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const next = moveField(fields, active.id, over.id, activeTabs)
    if (next !== fields) {
      reorderFields(next)
      setActiveQuestionIndex(next.findIndex((f) => f.key === active.id))
    }
  }

  const focusNewField = (at, key) => {
    setActiveQuestionIndex(at)
    setTimeout(() => {
      document.querySelector(`[data-field-key="${key}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  /** Inserts after the active item; plain items join the active item's random section. */
  const insertItems = (items, { isBlock = false } = {}) => {
    const current = useFormStore.getState().fields
    const { at, groupKey, variantKey } = insertionPoint(current, activeQuestionIndex, activeTabs, { isBlock })
    const prepared = isBlock ? items : items.map((item) => ({ ...item, random_group_key: groupKey, variant_key: variantKey }))
    insertFields(at, prepared)
    focusNewField(at, useFormStore.getState().fields[at]?.key)
  }

  const addToBlock = (header, type) => {
    const current = useFormStore.getState().fields
    const at = blockEnd(current, current.findIndex((f) => f.key === header.key)) + 1
    const base = type === 'section'
      ? { type: 'section', label: 'Trang tiếp theo của phần', description: '' }
      : { type: 'radio', label: 'Câu hỏi', options: ['Tùy chọn 1'], placeholder: '', help_text: '' }
    insertFields(at, [{
      ...base,
      is_required: false,
      random_group_key: header.key,
      variant_key: isDifferentMode(header) ? currentVariant(header, activeTabs) : null,
    }])
    focusNewField(at, useFormStore.getState().fields[at]?.key)
  }

  const visibleKeys = fields.filter((f) => !isHiddenInBuilder(f, fields, activeTabs)).map((f) => f.key)

  const handleTitleChange = (data) => {
    if (data.title !== title || data.description !== description) {
      setMeta({ title: data.title, description: data.description })
    }
  }

  return (
    <div 
      className="min-h-screen pb-24 md:pb-0"
      style={{
        backgroundColor: currentTheme.background_color,
        fontFamily: currentTheme.font_family,
      }}
    >

      {/* Main Content */}
      <div 
        className="eforms-content"
        style={{ 
          maxWidth: showTheme ? '850px' : '900px',
          transition: 'max-width 0.3s ease',
        }}
      >
        {/* Viewers get the questions read-only (full read-only polish: phase 7). */}
        <div className="eforms-main" {...(readOnly ? { inert: '', 'data-readonly': '' } : {})}>
          <div className="eforms-container">
            {/* Header Image */}
            {currentTheme.header_image && (
              <div className="eforms-header-card bg-white rounded-lg shadow-sm overflow-hidden mb-6">
                <img
                  src={currentTheme.header_image}
                  alt="Form Header"
                  className="w-full h-48 object-cover"
                />
              </div>
            )}

            {/* Header Card */}
            <EditableTitle
              title={title}
              description={description}
              onChange={handleTitleChange}
              theme={currentTheme}
            />

            {/* Questions */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={visibleKeys} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {fields.map((field, index) => {
                    const groupKey = field.type === 'random_section' ? field.key : field.random_group_key
                    const header = groupKey ? findHeader(fields, groupKey) : null
                    const closesBlock = header && fields[index + 1]?.random_group_key !== groupKey
                    const hidden = isHiddenInBuilder(field, fields, activeTabs)

                    let card = null
                    if (!hidden && field.type === 'random_section') {
                      card = (
                        <RandomSectionCard
                          field={field}
                          index={index}
                          isActive={activeQuestionIndex === index}
                          onClick={() => setActiveQuestionIndex(index)}
                          theme={currentTheme}
                          activeVariant={currentVariant(field, activeTabs)}
                          onSelectVariant={(variantKey) => setActiveTabs((tabs) => ({ ...tabs, [field.key]: variantKey }))}
                          hasResponses={hasResponses}
                        />
                      )
                    } else if (!hidden) {
                      const question = (
                        <FormQuestion
                          field={field}
                          index={index}
                          isActive={activeQuestionIndex === index}
                          onClick={() => setActiveQuestionIndex(index)}
                          theme={currentTheme}
                        />
                      )
                      card = header ? (
                        <div className="eforms-block-member" style={{ borderColor: currentTheme.primary_color }}>
                          {isDifferentMode(header) && !field.variant_key && (
                            <div className="eforms-chip mb-1">Dùng chung cho mọi phiên bản</div>
                          )}
                          {question}
                        </div>
                      ) : question
                    }

                    return (
                      <div key={field.key} data-field-key={field.key} className={hidden && !closesBlock ? 'hidden' : undefined}>
                        {card}
                        {closesBlock && (
                          <div className={card ? 'mt-3' : undefined}>
                            <BlockFooter
                              header={header}
                              theme={currentTheme}
                              onAddQuestion={() => addToBlock(header, 'question')}
                              onAddPageBreak={() => addToBlock(header, 'section')}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </SortableContext>
            </DndContext>

            {/* Empty State */}
            {fields.length === 0 && (
              <div className="eforms-empty">
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📝</div>
                  <h3 className="text-xl font-medium text-gray-900 mb-2">
                    Bắt đầu tạo biểu mẫu
                  </h3>
                  <p className="text-gray-600">
                    {readOnly ? 'Biểu mẫu chưa có câu hỏi' : 'Nhấp vào các biểu tượng bên cạnh để thêm nội dung'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        {!readOnly && <FormSidebar onInsert={insertItems} />}
      </div>
    </div>
  )
}
