import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { formAPI, responseAPI } from '../../services/api'
import toast from 'react-hot-toast'
import { ArrowLeft, Calendar, User, Globe } from 'lucide-react'
import { format } from 'date-fns'

const getFieldTypeName = (type) => {
  const typeNames = {
    short_text: 'Văn Bản Ngắn',
    long_text: 'Văn Bản Dài',
    email: 'Email',
    number: 'Số',
    phone: 'Số Điện Thoại',
    url: 'Liên Kết',
    date: 'Ngày Tháng',
    time: 'Thời Gian',
    datetime: 'Ngày & Thời Gian',
    dropdown: 'Danh Sách Thả Xuống',
    radio: 'Lựa Chọn Duy Nhất',
    checkbox: 'Hộp Kiểm',
    multiple_choice_grid: 'Lưới Lựa Chọn Duy Nhất',
    checkbox_grid: 'Lưới Hộp Kiểm',
    file_upload: 'Tải Lên Tệp',
    rating: 'Đánh Giá',
    scale: 'Thang Điểm',
    section: 'Tiêu Đề Phần',
  }
  return typeNames[type] || type
}

export default function ResponseDetail() {
  const { id, responseId } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(null)
  const [response, setResponse] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [id, responseId])

  const fetchData = async () => {
    try {
      const [formRes, responseRes] = await Promise.all([
        formAPI.getOne(id),
        responseAPI.getOne(id, responseId)
      ])
      setForm(formRes.data)
      setResponse(responseRes.data)
    } catch (error) {
      toast.error('Không thể tải chi tiết phản hồi')
      navigate(`/forms/${id}/responses`)
    } finally {
      setLoading(false)
    }
  }

  const renderAnswer = (field, answer) => {
    if (!answer || !answer.value) {
      return <span className="text-gray-400 italic">Không có câu trả lời</span>
    }

    // Parse value if it's a string
    let parsedValue = answer.value
    if (typeof answer.value === 'string') {
      try {
        parsedValue = JSON.parse(answer.value)
      } catch (e) {
        // Keep as string if not valid JSON
        parsedValue = answer.value
      }
    }

    switch (field.type) {
      case 'multiple_choice_grid':
      case 'checkbox_grid':
        if (typeof parsedValue === 'object' && !Array.isArray(parsedValue)) {
          return (
            <div className="space-y-3">
              {Object.entries(parsedValue).map(([row, value]) => (
                <div key={row} className="border-l-4 border-primary-500 pl-4 py-2 bg-white">
                  <div className="font-semibold text-gray-900 mb-1">{row}</div>
                  <div className="text-gray-700">
                    {Array.isArray(value) ? (
                      <div className="flex flex-wrap gap-2">
                        {value.map((item, idx) => (
                          <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary-100 text-primary-800">
                            {item}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary-100 text-primary-800">
                        {value}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        }
        return <span className="text-gray-900">{JSON.stringify(parsedValue)}</span>

      case 'checkbox':
        if (Array.isArray(parsedValue)) {
          return (
            <div className="space-y-2">
              {parsedValue.map((item, idx) => (
                <div key={idx} className="flex items-center space-x-3 p-2 bg-white rounded-lg">
                  <div className="w-5 h-5 bg-primary-600 rounded flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-gray-900">{item}</span>
                </div>
              ))}
            </div>
          )
        }
        return <span className="text-gray-900">{parsedValue}</span>

      case 'radio':
      case 'dropdown':
        return (
          <span className="inline-flex items-center px-4 py-2 rounded-lg text-sm bg-primary-100 text-primary-800 font-medium">
            {parsedValue}
          </span>
        )

      case 'file_upload':
        return (
          <a
            href={parsedValue}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Xem tệp đã tải lên</span>
          </a>
        )

      case 'long_text':
        return <div className="text-gray-900 whitespace-pre-wrap leading-relaxed">{parsedValue}</div>

      default:
        return <span className="text-gray-900">{parsedValue}</span>
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
      <div className="flex items-center space-x-4 mb-6">
        <button
          onClick={() => navigate(`/forms/${id}/responses`)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chi Tiết Phản Hồi</h1>
          <p className="text-sm text-gray-600">{form?.title}</p>
        </div>
      </div>

      {/* Response Info Card */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Thông Tin Phản Hồi</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Thời gian gửi</p>
              <p className="font-medium text-gray-900">
                {format(new Date(response?.submitted_at), 'dd/MM/yyyy HH:mm:ss')}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Người gửi</p>
              <p className="font-medium text-gray-900">
                {response?.user?.name || response?.user?.email || 'Ẩn danh'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Globe className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Địa chỉ IP</p>
              <p className="font-medium text-gray-900">
                {response?.ip_address || 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-lg font-bold text-purple-600">#{response?.id}</span>
            </div>
            <div>
              <p className="text-sm text-gray-600">Mã phản hồi</p>
              <p className="font-medium text-gray-900">
                Response ID: {response?.id}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Answers */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Câu Trả Lời</h2>
        <div className="space-y-8">
          {form?.fields
            ?.filter(field => !['section', 'description', 'image', 'video'].includes(field.type))
            ?.map((field, index) => {
            const answer = response?.answers?.find(a => a.field_id === field.id)
            
            return (
              <div key={field.id} className="border-b border-gray-200 pb-8 last:border-b-0 last:pb-0">
                <div className="mb-4">
                  <div className="flex items-start space-x-3">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-semibold text-sm flex-shrink-0">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {field.label}
                        {field.is_required && <span className="text-red-500 ml-1">*</span>}
                      </h3>
                      {field.help_text && (
                        <p className="text-sm text-gray-600 mt-1">{field.help_text}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        Loại: <span className="font-medium">{getFieldTypeName(field.type)}</span>
                      </p>
                    </div>
                  </div>
                </div>
                <div className="ml-11 p-5 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 shadow-sm">
                  {renderAnswer(field, answer)}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

