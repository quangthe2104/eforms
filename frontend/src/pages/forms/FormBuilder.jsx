import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { formAPI, fieldAPI } from '../../services/api'
import { useFormStore } from '../../store/formStore'
import toast from 'react-hot-toast'
import { Save, Eye, ArrowLeft, Settings, ExternalLink } from 'lucide-react'
import FormSettings from '../../components/FormSettings'
import FieldList from '../../components/FieldList'
import FieldEditor from '../../components/FieldEditor'
import FormPreview from '../../components/FormPreview'

export default function FormBuilder() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentForm, setCurrentForm, fields, isDirty, markAsSaved, resetForm } = useFormStore()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [selectedFieldIndex, setSelectedFieldIndex] = useState(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'draft',
  })

  useEffect(() => {
    if (id) {
      fetchForm()
    } else {
      setLoading(false)
    }

    return () => {
      resetForm()
    }
  }, [id])

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

    setSaving(true)
    try {
      let form = currentForm

      // Create or update form
      if (id) {
        const response = await formAPI.update(id, formData)
        form = response.data.form
      } else {
        const response = await formAPI.create(formData)
        form = response.data.form
        navigate(`/forms/${form.id}/edit`, { replace: true })
      }

      // Update fields
      if (isDirty && fields.length > 0) {
        const response = await fieldAPI.bulkUpdate(form.id, { fields })
        // Reload form with updated fields
        const updatedForm = { ...form, fields: response.data.fields }
        setCurrentForm(updatedForm)
      } else {
        setCurrentForm(form)
      }

      markAsSaved()
      toast.success('Đã lưu biểu mẫu thành công')
    } catch (error) {
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
      await formAPI.update(currentForm.id, { status: 'published' })
      setFormData(prev => ({ ...prev, status: 'published' }))
      toast.success('Đã xuất bản biểu mẫu thành công')
    } catch (error) {
      toast.error('Không thể xuất bản biểu mẫu')
    }
  }

  const handleShare = () => {
    if (!currentForm?.slug) {
      toast.error('Vui lòng lưu biểu mẫu trước')
      return
    }

    if (formData.status !== 'published') {
      toast.error('Vui lòng xuất bản biểu mẫu trước khi chia sẻ')
      return
    }

    const link = `${window.location.origin}/f/${currentForm.slug}`
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link)
        .then(() => toast.success('Đã sao chép liên kết biểu mẫu!'))
        .catch(() => toast.error('Không thể sao chép liên kết'))
    } else {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = link
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      toast.success('Đã sao chép liên kết biểu mẫu!')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 -mx-4 -mt-8 px-4 py-4 mb-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/forms')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {id ? 'Sửa Biểu Mẫu' : 'Tạo Biểu Mẫu'}
              </h1>
              <p className="text-sm text-gray-600">
                {formData.status === 'published' ? 'Đã xuất bản' : 'Nháp'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSettings(true)}
              className="btn btn-secondary flex items-center space-x-2"
            >
              <Settings className="w-5 h-5" />
              <span className="hidden sm:inline">Cài đặt</span>
            </button>
            <button
              onClick={() => setShowPreview(true)}
              className="btn btn-secondary flex items-center space-x-2"
            >
              <Eye className="w-5 h-5" />
              <span className="hidden sm:inline">Xem trước</span>
            </button>
            {formData.status === 'published' && currentForm?.slug && (
              <button
                onClick={handleShare}
                className="btn btn-secondary flex items-center space-x-2"
              >
                <ExternalLink className="w-5 h-5" />
                <span className="hidden sm:inline">Chia sẻ</span>
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary flex items-center space-x-2"
            >
              <Save className="w-5 h-5" />
              <span>{saving ? 'Đang lưu...' : 'Lưu'}</span>
            </button>
            {formData.status === 'draft' && currentForm?.id && (
              <button
                onClick={handlePublish}
                className="btn bg-green-600 text-white hover:bg-green-700"
              >
                Xuất bản
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Form Builder */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Form Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="space-y-4">
              <div>
                <label className="form-label">Tiêu Đề Biểu Mẫu *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="input text-xl font-semibold"
                  placeholder="Biểu mẫu chưa có tiêu đề"
                />
              </div>
              <div>
                <label className="form-label">Mô Tả</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="input"
                  rows="3"
                  placeholder="Thêm mô tả cho biểu mẫu của bạn..."
                />
              </div>
            </div>
          </div>

          {/* Fields */}
          <FieldList onFieldSelect={setSelectedFieldIndex} />
        </div>

        {/* Right: Field Editor */}
        <div className="lg:col-span-1">
          <FieldEditor 
            selectedIndex={selectedFieldIndex}
            onClose={() => setSelectedFieldIndex(null)}
          />
        </div>
      </div>

      {/* Modals */}
      {showSettings && (
        <FormSettings
          form={currentForm}
          onClose={() => setShowSettings(false)}
          onSave={(settings) => {
            setFormData(prev => ({ ...prev, ...settings }))
            setShowSettings(false)
          }}
        />
      )}

      {showPreview && (
        <FormPreview
          form={{ ...formData, fields }}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}

