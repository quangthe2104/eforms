import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { formAPI } from '../../services/api'
import toast from 'react-hot-toast'
import { CheckCircle, Loader, ArrowLeft, X } from 'lucide-react'

export default function FormPreview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState({})
  const [currentPage, setCurrentPage] = useState(0)

  useEffect(() => {
    fetchForm()
  }, [id])

  const fetchForm = async () => {
    try {
      const response = await formAPI.getOne(id)
      setForm(response.data)
    } catch (error) {
      toast.error('Không thể tải biểu mẫu')
      navigate('/forms')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswerChange = (fieldId, value) => {
    setAnswers(prev => ({ ...prev, [fieldId]: value }))
  }

  // Split fields into pages based on section breaks
  const splitFieldsIntoPages = (fields) => {
    const pages = []
    let currentPageFields = []
    
    fields.forEach((field) => {
      if (field.type === 'section') {
        // Push current page if it has fields
        if (currentPageFields.length > 0) {
          pages.push(currentPageFields)
        }
        // Start new page with the section as first field
        currentPageFields = [field]
      } else {
        currentPageFields.push(field)
      }
    })
    
    // Push last page
    if (currentPageFields.length > 0) {
      pages.push(currentPageFields)
    }
    
    return pages.length > 0 ? pages : [[]]
  }

  const pages = form?.fields ? splitFieldsIntoPages(form.fields) : [[]]
  const totalPages = pages.length
  const currentPageFields = pages[currentPage] || []

  const handleNextPage = (e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handlePreviousPage = (e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // This is preview mode, just show a success message
    toast.success('Đây là chế độ xem trước. Form không được gửi thực sự.')
  }

  const renderField = (field) => {
    const value = answers[field.id] || ''

    switch (field.type) {
      case 'short_text':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleAnswerChange(field.id, e.target.value)}
            placeholder={field.placeholder || 'Câu trả lời của bạn'}
            className="input"
            disabled
          />
        )
      
      case 'long_text':
        return (
          <textarea
            value={value}
            onChange={(e) => handleAnswerChange(field.id, e.target.value)}
            placeholder={field.placeholder || 'Câu trả lời của bạn'}
            className="input"
            rows="4"
            disabled
          />
        )
      
      case 'email':
        return (
          <input
            type="email"
            value={value}
            onChange={(e) => handleAnswerChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className="input"
            disabled
          />
        )
      
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleAnswerChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className="input"
            disabled
          />
        )
      
      case 'phone':
        return (
          <input
            type="tel"
            value={value}
            onChange={(e) => handleAnswerChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className="input"
            disabled
          />
        )
      
      case 'url':
        return (
          <input
            type="url"
            value={value}
            onChange={(e) => handleAnswerChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className="input"
            disabled
          />
        )
      
      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleAnswerChange(field.id, e.target.value)}
            className="input"
            disabled
          />
        )
      
      case 'time':
        return (
          <input
            type="time"
            value={value}
            onChange={(e) => handleAnswerChange(field.id, e.target.value)}
            className="input"
            disabled
          />
        )
      
      case 'datetime':
        return (
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => handleAnswerChange(field.id, e.target.value)}
            className="input"
            disabled
          />
        )
      
      case 'dropdown':
        return (
          <select
            value={value}
            onChange={(e) => handleAnswerChange(field.id, e.target.value)}
            className="input"
            disabled
          >
            <option value="">Chọn một tùy chọn</option>
            {field.options?.map((option, idx) => (
              <option key={idx} value={option}>{option}</option>
            ))}
          </select>
        )
      
      case 'radio':
        return (
          <div className="space-y-2">
            {field.options?.map((option, idx) => (
              <label key={idx} className="flex items-center space-x-2 cursor-not-allowed opacity-60">
                <input
                  type="radio"
                  name={`field-${field.id}`}
                  value={option}
                  checked={value === option}
                  onChange={(e) => handleAnswerChange(field.id, e.target.value)}
                  disabled
                  className="w-4 h-4 text-primary-600"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        )
      
      case 'checkbox':
        const checkboxValues = Array.isArray(value) ? value : []
        return (
          <div className="space-y-2">
            {field.options?.map((option, idx) => (
              <label key={idx} className="flex items-center space-x-2 cursor-not-allowed opacity-60">
                <input
                  type="checkbox"
                  value={option}
                  checked={checkboxValues.includes(option)}
                  disabled
                  className="w-4 h-4 text-primary-600"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        )
      
      case 'file_upload':
        return (
          <input
            type="file"
            disabled
            className="input cursor-not-allowed opacity-60"
          />
        )
      
      case 'rating':
        const rating = parseInt(value) || 0
        return (
          <div className="flex space-x-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                disabled
                className={`text-3xl transition-colors cursor-not-allowed ${
                  star <= rating ? 'text-yellow-400' : 'text-gray-300'
                }`}
              >
                ★
              </button>
            ))}
          </div>
        )
      
      case 'section':
        return (
          <div className="border-b border-gray-200 pb-2 -mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{field.label}</h3>
            {field.description && (
              <div 
                className="text-sm text-gray-600 mt-1"
                dangerouslySetInnerHTML={{ __html: field.description }}
              />
            )}
          </div>
        )
      
      case 'description':
        return (
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{field.label}</h3>
            {field.description && (
              <div 
                className="text-sm text-gray-600 mt-1"
                dangerouslySetInnerHTML={{ __html: field.description }}
              />
            )}
          </div>
        )
      
      case 'image':
        return field.image_url ? (
          <div className="w-full">
            <img 
              src={field.image_url} 
              alt={field.label || 'Image'}
              className="max-w-full h-auto rounded"
              style={{ maxHeight: '400px' }}
            />
          </div>
        ) : null
      
      case 'video':
        return field.video_url ? (
          <div className="w-full aspect-video">
            <iframe
              src={field.video_url.replace('watch?v=', 'embed/')}
              title={field.label || 'Video'}
              className="w-full h-full rounded"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : null
      
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (!form) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Form Not Found</h2>
          <p className="text-gray-600">This form is not available.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        .eforms-header-content a,
        .text-gray-700 a,
        .text-gray-600 a,
        .text-sm a {
          color: ${form.primary_color || '#4285F4'} !important;
          text-decoration: underline !important;
          cursor: pointer;
        }
        .eforms-header-content a:hover,
        .text-gray-700 a:hover,
        .text-gray-600 a:hover,
        .text-sm a:hover {
          opacity: 0.8;
        }
        .eforms-header-content ol,
        .text-gray-700 ol,
        .text-gray-600 ol,
        .text-sm ol {
          list-style-type: decimal;
          padding-left: 2em;
          margin: 0.5em 0;
        }
        .eforms-header-content ul,
        .text-gray-700 ul,
        .text-gray-600 ul,
        .text-sm ul {
          list-style-type: disc;
          padding-left: 2em;
          margin: 0.5em 0;
        }
        .eforms-header-content li,
        .text-gray-700 li,
        .text-gray-600 li,
        .text-sm li {
          margin: 0.25em 0;
        }
      `}</style>
      
      {/* Preview Header */}
      <div className="bg-yellow-50 border-b border-yellow-200 py-3 px-4 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-yellow-800">Chế độ xem trước</span>
          </div>
          <button
            onClick={() => navigate(`/forms/${id}/edit`)}
            className="flex items-center space-x-2 px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 rounded-lg border border-gray-300 transition-colors"
          >
            <X className="w-4 h-4" />
            <span className="text-sm">Đóng</span>
          </button>
        </div>
      </div>

      <div 
        className="min-h-screen py-8 px-4"
        style={{ 
          backgroundColor: form.background_color || '#f9fafb',
          fontFamily: form.font_family || 'system-ui, -apple-system, sans-serif'
        }}
      >
        <div className="max-w-2xl mx-auto space-y-4">
        {/* Header Image (if exists) */}
        {form.header_image && (
          <div className="w-full rounded-lg overflow-hidden">
            <img 
              src={form.header_image} 
              alt="Header" 
              className="w-full h-40 object-cover"
            />
          </div>
        )}
        
        {/* Header Card */}
        <div className="eforms-header">
          <div 
            className="eforms-header-top"
            style={{
              background: form.primary_color 
                ? `linear-gradient(to right, ${form.primary_color}, ${form.primary_color}, ${form.secondary_color || form.primary_color})` 
                : 'linear-gradient(to right, #4285F4, #3b82f6, #60a5fa)'
            }}
          ></div>
          
          <div className="eforms-header-content">
            <h1 
              className="text-3xl font-normal mb-2"
              style={{
                fontSize: form.header_font_size || '32px',
                color: form.primary_color || '#111827',
                fontFamily: form.font_family || 'inherit'
              }}
            >
              {form.title}
            </h1>
            {form.description && (
              <div 
                className="text-gray-700"
                style={{
                  fontSize: form.text_font_size || '14px',
                  fontFamily: form.font_family || 'inherit'
                }}
                dangerouslySetInnerHTML={{ __html: form.description }}
              />
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Page Progress Indicator */}
          {totalPages > 1 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Trang {currentPage + 1} / {totalPages}
                </span>
                <span className="text-xs text-gray-500">
                  {Math.round(((currentPage + 1) / totalPages) * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${((currentPage + 1) / totalPages) * 100}%`,
                    backgroundColor: form.primary_color || '#4285F4'
                  }}
                ></div>
              </div>
            </div>
          )}

          {/* Current page fields */}
          {currentPageFields.map((field) => (
            <div key={field.id} className="bg-white rounded-lg border border-gray-200 p-6 transition-all duration-200 hover:shadow-md">
              {!['section', 'description', 'image', 'video'].includes(field.type) ? (
                <div className="space-y-3">
                  <label 
                    className="block font-bold text-gray-900"
                    style={{
                      fontSize: form.question_font_size || '16px',
                      color: form.primary_color || '#111827',
                      fontFamily: form.font_family || 'inherit'
                    }}
                  >
                    {field.label}
                    {field.is_required && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </label>
                  {field.help_text && (
                    <p 
                      className="text-gray-500"
                      style={{
                        fontSize: form.text_font_size || '14px',
                        fontFamily: form.font_family || 'inherit'
                      }}
                    >
                      {field.help_text}
                    </p>
                  )}
                  <div className="mt-4">
                    {renderField(field)}
                  </div>
                </div>
              ) : (
                <div>
                  {renderField(field)}
                </div>
              )}
            </div>
          ))}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {currentPage > 0 && (
                <button
                  type="button"
                  onClick={handlePreviousPage}
                  className="px-6 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  Trước
                </button>
              )}
            </div>
            <div className="flex items-center space-x-3">
              {currentPage < totalPages - 1 ? (
                <button
                  type="button"
                  onClick={handleNextPage}
                  className="px-6 py-2 text-white rounded transition-colors"
                  style={{
                    backgroundColor: form.primary_color || '#4285F4'
                  }}
                >
                  Tiếp theo
                </button>
              ) : (
                <button
                  type="submit"
                  className="px-6 py-2 text-white rounded transition-colors"
                  style={{
                    backgroundColor: form.primary_color || '#4285F4'
                  }}
                >
                  Gửi (Xem trước)
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="text-center mt-4 text-sm text-gray-500">
          Powered by eForms
        </div>
        </div>
      </div>
    </>
  )
}

