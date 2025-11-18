import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { responseAPI } from '../services/api'
import toast from 'react-hot-toast'
import { CheckCircle, Loader } from 'lucide-react'

export default function PublicForm() {
  const { slug } = useParams()
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [answers, setAnswers] = useState({})

  useEffect(() => {
    fetchForm()
  }, [slug])

  const fetchForm = async () => {
    try {
      const response = await responseAPI.getPublicForm(slug)
      setForm(response.data)
    } catch (error) {
      toast.error('Không tìm thấy biểu mẫu hoặc biểu mẫu không khả dụng')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate required fields
    const missingFields = form.fields.filter(
      field => field.is_required && !answers[field.id]
    )
    
    if (missingFields.length > 0) {
      toast.error('Vui lòng điền tất cả các trường bắt buộc')
      return
    }

    setSubmitting(true)
    try {
      await responseAPI.submitForm(slug, { answers })
      setSubmitted(true)
      toast.success('Đã gửi biểu mẫu thành công!')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể gửi biểu mẫu')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAnswerChange = (fieldId, value) => {
    setAnswers(prev => ({ ...prev, [fieldId]: value }))
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
            required={field.is_required}
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
            required={field.is_required}
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
            required={field.is_required}
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
            required={field.is_required}
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
            required={field.is_required}
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
            required={field.is_required}
          />
        )
      
      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleAnswerChange(field.id, e.target.value)}
            className="input"
            required={field.is_required}
          />
        )
      
      case 'time':
        return (
          <input
            type="time"
            value={value}
            onChange={(e) => handleAnswerChange(field.id, e.target.value)}
            className="input"
            required={field.is_required}
          />
        )
      
      case 'datetime':
        return (
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => handleAnswerChange(field.id, e.target.value)}
            className="input"
            required={field.is_required}
          />
        )
      
      case 'dropdown':
        return (
          <select
            value={value}
            onChange={(e) => handleAnswerChange(field.id, e.target.value)}
            className="input"
            required={field.is_required}
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
              <label key={idx} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name={`field-${field.id}`}
                  value={option}
                  checked={value === option}
                  onChange={(e) => handleAnswerChange(field.id, e.target.value)}
                  required={field.is_required}
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
              <label key={idx} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  value={option}
                  checked={checkboxValues.includes(option)}
                  onChange={(e) => {
                    const newValues = e.target.checked
                      ? [...checkboxValues, option]
                      : checkboxValues.filter(v => v !== option)
                    handleAnswerChange(field.id, newValues)
                  }}
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
            onChange={(e) => handleAnswerChange(field.id, e.target.files[0])}
            className="input"
            required={field.is_required}
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
                onClick={() => handleAnswerChange(field.id, star)}
                className={`text-3xl transition-colors ${
                  star <= rating ? 'text-yellow-400' : 'text-gray-300'
                }`}
              >
                ★
              </button>
            ))}
          </div>
        )
      
      case 'multiple_choice_grid':
        const gridRadioValues = value || {}
        return field.rows && field.columns ? (
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
                {field.rows.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    <td className="border border-gray-300 px-3 py-2 text-sm text-gray-700">
                      {row}
                    </td>
                    {field.columns.map((column, colIdx) => (
                      <td key={colIdx} className="border border-gray-300 px-3 py-2 text-center">
                        <input
                          type="radio"
                          name={`grid-${field.id}-row-${rowIdx}`}
                          value={column}
                          checked={gridRadioValues[row] === column}
                          onChange={() => {
                            const newValues = { ...gridRadioValues, [row]: column }
                            handleAnswerChange(field.id, newValues)
                          }}
                          required={field.is_required && rowIdx === 0}
                          className="w-4 h-4"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null
      
      case 'checkbox_grid':
        const gridCheckboxValues = value || {}
        return field.rows && field.columns ? (
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
                {field.rows.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    <td className="border border-gray-300 px-3 py-2 text-sm text-gray-700">
                      {row}
                    </td>
                    {field.columns.map((column, colIdx) => (
                      <td key={colIdx} className="border border-gray-300 px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          value={column}
                          checked={gridCheckboxValues[row]?.includes(column) || false}
                          onChange={(e) => {
                            const rowValues = gridCheckboxValues[row] || []
                            const newRowValues = e.target.checked
                              ? [...rowValues, column]
                              : rowValues.filter(v => v !== column)
                            const newValues = { ...gridCheckboxValues, [row]: newRowValues }
                            handleAnswerChange(field.id, newValues)
                          }}
                          className="w-4 h-4"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null
      
      case 'scale':
        return (
          <div className="space-y-2">
            <input
              type="range"
              min="1"
              max="10"
              value={value || 5}
              onChange={(e) => handleAnswerChange(field.id, e.target.value)}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-gray-600">
              <span>1</span>
              <span className="font-semibold">{value || 5}</span>
              <span>10</span>
            </div>
          </div>
        )
      
      case 'section':
        return (
          <div className="border-b border-gray-200 pb-2 -mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{field.label}</h3>
            {field.help_text && (
              <p className="text-sm text-gray-600 mt-1">{field.help_text}</p>
            )}
          </div>
        )
      
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
          <p className="text-gray-600">This form is not available or has been closed.</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Cảm ơn bạn!</h2>
          <p className="text-gray-600">
            {form.custom_thank_you_message || 'Phản hồi của bạn đã được ghi nhận.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-primary-600 text-white p-8">
            <h1 className="text-3xl font-bold mb-2">{form.title}</h1>
            {form.description && (
              <p className="text-primary-100">{form.description}</p>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8">
            <div className="space-y-6">
              {form.fields?.map((field) => (
                <div key={field.id} className="space-y-2">
                  {field.type !== 'section' && (
                    <>
                      <label className="form-label">
                        {field.label}
                        {field.is_required && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </label>
                      {field.help_text && (
                        <p className="text-sm text-gray-500">{field.help_text}</p>
                      )}
                    </>
                  )}
                  {renderField(field)}
                </div>
              ))}
            </div>

            <div className="mt-8">
              <button
                type="submit"
                disabled={submitting}
                className="w-full btn btn-primary flex items-center justify-center space-x-2"
              >
                {submitting ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    <span>Đang gửi...</span>
                  </>
                ) : (
                  <span>Gửi</span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-4 text-sm text-gray-500">
          Powered by eForms
        </div>
      </div>
    </div>
  )
}

