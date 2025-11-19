import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { formAPI, fieldAPI } from '../../services/api'
import { useFormStore } from '../../store/formStore'
import { useFormBuilder } from '../../contexts/FormBuilderContext'
import toast from 'react-hot-toast'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import EditableTitle from './EditableTitle'
import FormQuestion from './FormQuestion'
import FormSidebar from './FormSidebar'
import FormPreview from '../FormPreview'
import FormSettings from '../FormSettings'
import FormTheme from '../FormTheme'
import { captureFormThumbnail } from '../../utils/captureFormThumbnail'

export default function FormBuilder() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentForm, setCurrentForm, fields, reorderFields, isDirty, markAsSaved, resetForm } = useFormStore()
  const { setFormBuilderActions } = useFormBuilder()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showTheme, setShowTheme] = useState(false)
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(null)
  // Use localStorage to persist preview theme
  const [previewTheme, setPreviewTheme] = useState(() => {
    if (typeof window !== 'undefined' && id) {
      const saved = localStorage.getItem(`previewTheme_${id}`)
      return saved ? JSON.parse(saved) : null
    }
    return null
  })
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'draft',
  })

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  useEffect(() => {
    if (id) {
      fetchForm()
    } else {
      setLoading(false)
    }

    return () => {
      resetForm()
      setFormBuilderActions(null)
    }
  }, [id])

  // Register form builder actions to context
  useEffect(() => {
    setFormBuilderActions({
      formData,
      currentForm,
      saving,
      handleSave,
      handlePublish,
      setShowPreview,
      setShowSettings,
      setShowTheme,
      copyFormLink,
    })

    return () => {
      setFormBuilderActions(null)
    }
  }, [formData, currentForm, saving])

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
  }, [])

  const fetchForm = async () => {
    try {
      const response = await formAPI.getOne(id)
      const form = response.data
      setCurrentForm(form)
      setFormData({
        title: form.title,
        description: form.description || '',
        status: form.status,
      })
    } catch (error) {
      toast.error('Failed to load form')
      navigate('/forms')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error('Vui lòng nhập tiêu đề biểu mẫu')
      return
    }

    if (saving) {
      return
    }

    setSaving(true)
    try {
      // Get FRESH state from store at save time
      const { fields: currentFields, isDirty: currentIsDirty } = useFormStore.getState()
      
      let form = currentForm

      // Prepare theme data - Read from localStorage to avoid race condition
      let savedPreviewTheme = null
      if (id && typeof window !== 'undefined') {
        const saved = localStorage.getItem(`previewTheme_${id}`)
        if (saved) {
          try {
            savedPreviewTheme = JSON.parse(saved)
          } catch (e) {
            console.error('Failed to parse preview theme:', e)
          }
        }
      }
      
      const currentTheme = savedPreviewTheme || previewTheme || currentForm
      
      const themeData = {
        primary_color: currentTheme?.primary_color,
        secondary_color: currentTheme?.secondary_color,
        background_color: currentTheme?.background_color,
        header_image: currentTheme?.header_image,
        font_family: currentTheme?.font_family,
        header_font_size: currentTheme?.header_font_size,
        question_font_size: currentTheme?.question_font_size,
        text_font_size: currentTheme?.text_font_size,
      }

      // Prepare complete data (use formData for title/description, but keep other fields from currentForm)
      const dataToSave = {
        title: formData.title,
        description: formData.description,
        status: currentForm?.status || formData.status,
        settings: currentForm?.settings || {},
        ...themeData,
      }

      // Create or update form (include theme data)
      if (id) {
        const response = await formAPI.update(id, dataToSave)
        // Merge response first, then override with themeData to ensure theme is preserved
        form = response.data.form
        // Explicitly set theme fields from themeData
        Object.keys(themeData).forEach(key => {
          if (themeData[key] !== undefined) {
            form[key] = themeData[key]
          }
        })
      } else {
        const response = await formAPI.create(dataToSave)
        form = response.data.form
        // Explicitly set theme fields from themeData
        Object.keys(themeData).forEach(key => {
          if (themeData[key] !== undefined) {
            form[key] = themeData[key]
          }
        })
        navigate(`/forms/${form.id}/edit`, { replace: true })
      }

      // Update fields if dirty - use FRESH state
      let savedFields = []
      if (currentIsDirty) {
        // Always save when dirty, even if fields array is empty (deletion case)
        const response = await fieldAPI.bulkUpdate(form.id, { fields: currentFields })
        savedFields = response.data.fields
      } else if (currentForm?.fields) {
        // If no changes, use existing fields
        savedFields = currentForm.fields
      }
      
      // Build complete form object with fields and theme
      const completeForm = {
        ...form,
        fields: savedFields,
        ...themeData, // Ensure theme data is included
      }
      
      // Clear preview BEFORE updating currentForm so the new form data includes theme
      if (savedPreviewTheme || previewTheme) {
        setPreviewTheme(null)
        // Remove from localStorage
        if (id) {
          localStorage.removeItem(`previewTheme_${id}`)
        }
      }
      
      // Update form state with fields and theme - this will sync to store
      setCurrentForm(completeForm)
      markAsSaved()

      toast.success('Đã lưu biểu mẫu thành công')

      setTimeout(async () => {
        try {
          if (!completeForm?.id) return
          
          await captureFormThumbnail({
            title: formData.title,
            description: formData.description,
            fields: savedFields,
            primary_color: completeForm.primary_color,
            secondary_color: completeForm.secondary_color,
            background_color: completeForm.background_color,
            header_image: completeForm.header_image,
            font_family: completeForm.font_family,
            header_font_size: completeForm.header_font_size,
            question_font_size: completeForm.question_font_size,
            text_font_size: completeForm.text_font_size,
          }, completeForm.id)
        } catch (error) {
          console.error('Error capturing thumbnail:', error)
        }
      }, 500)
    } catch (error) {
      console.error('Error saving form:', error)
      toast.error('Không thể lưu biểu mẫu')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!currentForm?.id) {
      toast.error('Vui lòng lưu biểu mẫu trước')
      return
    }

    try {
      await captureFormThumbnail({
        title: formData.title,
        description: formData.description,
        fields: currentForm.fields || [],
        primary_color: currentForm.primary_color,
        secondary_color: currentForm.secondary_color,
        background_color: currentForm.background_color,
        header_image: currentForm.header_image,
        font_family: currentForm.font_family,
        header_font_size: currentForm.header_font_size,
        question_font_size: currentForm.question_font_size,
        text_font_size: currentForm.text_font_size,
      }, currentForm.id)
      
      const updateData = { 
        status: 'published',
        primary_color: currentForm.primary_color,
        secondary_color: currentForm.secondary_color,
        background_color: currentForm.background_color,
        header_image: currentForm.header_image,
        font_family: currentForm.font_family,
        header_font_size: currentForm.header_font_size,
        question_font_size: currentForm.question_font_size,
        text_font_size: currentForm.text_font_size,
      }
      
      await formAPI.update(currentForm.id, updateData)
      setFormData(prev => ({ ...prev, status: 'published' }))
      toast.success('Đã xuất bản biểu mẫu thành công')
    } catch (error) {
      toast.error('Không thể xuất bản biểu mẫu')
    }
  }

  const copyFormLink = (slug) => {
    const link = `${window.location.origin}/f/${slug}`
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link)
        .then(() => toast.success('Đã sao chép liên kết biểu mẫu!'))
        .catch(() => toast.error('Không thể sao chép liên kết'))
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = link
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      toast.success('Đã sao chép liên kết biểu mẫu!')
    }
  }

  const handleSaveSettings = async (settings) => {
    if (!currentForm?.id) {
      toast.error('Vui lòng lưu biểu mẫu trước')
      return
    }

    try {
      // Preserve theme when saving settings
      const updateData = {
        ...settings,
        primary_color: currentForm.primary_color,
        secondary_color: currentForm.secondary_color,
        background_color: currentForm.background_color,
        header_image: currentForm.header_image,
        font_family: currentForm.font_family,
        header_font_size: currentForm.header_font_size,
        question_font_size: currentForm.question_font_size,
        text_font_size: currentForm.text_font_size,
      }
      await formAPI.update(currentForm.id, updateData)
      setCurrentForm({ ...currentForm, ...settings })
      toast.success('Đã lưu cài đặt biểu mẫu')
      setShowSettings(false)
    } catch (error) {
      toast.error('Không thể lưu cài đặt')
    }
  }

  const handlePreviewTheme = useCallback((theme) => {
    // Apply theme immediately for preview
    setPreviewTheme(theme)
    // Save to localStorage
    if (id) {
      localStorage.setItem(`previewTheme_${id}`, JSON.stringify(theme))
    }
  }, [id])

  const handleCloseTheme = () => {
    // Don't reset preview - keep changes temporarily
    setShowTheme(false)
  }

  // Get current theme (preview or saved)
  const currentTheme = previewTheme || {
    primary_color: currentForm?.primary_color || '#4285F4',
    secondary_color: currentForm?.secondary_color || '#C6DAFC',
    background_color: currentForm?.background_color || '#f9fafb',
    header_image: currentForm?.header_image || '',
    font_family: currentForm?.font_family || 'system-ui, -apple-system, sans-serif',
    header_font_size: currentForm?.header_font_size || '32px',
    question_font_size: currentForm?.question_font_size || '16px',
    text_font_size: currentForm?.text_font_size || '14px',
  }

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

    if (active.id !== over.id) {
      const oldIndex = fields.findIndex((f, i) => i === active.id)
      const newIndex = fields.findIndex((f, i) => i === over.id)
      reorderFields(arrayMove(fields, oldIndex, newIndex))
    }
  }

  const handleTitleChange = (data) => {
    setFormData(prev => ({
      ...prev,
      title: data.title,
      description: data.description,
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div 
      className="min-h-screen"
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
        <div className="eforms-main">
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
              title={formData.title}
              description={formData.description}
              onChange={handleTitleChange}
              theme={currentTheme}
            />

            {/* Questions */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={fields.map((_, i) => i)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <FormQuestion
                      key={index}
                      field={field}
                      index={index}
                      isActive={activeQuestionIndex === index}
                      onClick={() => setActiveQuestionIndex(index)}
                      theme={currentTheme}
                    />
                  ))}
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
                    Nhấp vào các biểu tượng bên cạnh để thêm nội dung
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <FormSidebar />
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <FormPreview
          form={{ ...formData, fields }}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <FormSettings
          form={currentForm}
          onClose={() => setShowSettings(false)}
          onSave={handleSaveSettings}
        />
      )}

      {/* Theme Sidebar */}
      {showTheme && (
        <FormTheme
          theme={currentTheme}
          onClose={handleCloseTheme}
          onPreview={handlePreviewTheme}
        />
      )}
    </div>
  )
}

