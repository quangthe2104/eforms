import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { responseAPI, exportAPI } from '../../services/api'
import { useFormStore } from '../../store/formStore'
import { useEditor } from '../../layouts/FormEditorLayout'
import { normalizeFields } from '../../utils/formStructure'
import { assignmentSummary } from '../../utils/responseView'
import toast from 'react-hot-toast'
import { Trash2, Eye, Calendar, FileSpreadsheet } from 'lucide-react'
import { format } from 'date-fns'
import FormSummary from '../../components/FormSummary'

/** "Câu trả lời" tab; the form itself comes from FormEditorLayout. */
export default function FormResponses() {
  const { id, form, readOnly } = useEditor()
  const navigate = useNavigate()
  const [responses, setResponses] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [activeTab, setActiveTab] = useState('summary') // 'summary' or 'individual'

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    try {
      const responsesRes = await responseAPI.getAll(id)
      setResponses(responsesRes.data.data || responsesRes.data)
    } catch (error) {
      toast.error('Không thể tải phản hồi')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const response = await exportAPI.exportResponses(id)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `bieu-mau-${id}-phan-hoi.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success('Đã xuất thành công')
    } catch (error) {
      toast.error('Không thể xuất phản hồi')
    } finally {
      setExporting(false)
    }
  }

  const handleDelete = async (responseId) => {
    if (!confirm('Bạn có chắc chắn muốn xóa phản hồi này?')) return

    try {
      await responseAPI.delete(id, responseId)
      setResponses(responses.filter(r => r.id !== responseId))
      const latest = useFormStore.getState().currentForm
      useFormStore.getState().patchForm({ responses: (latest?.responses || []).filter((r) => r.id !== responseId) })
      toast.success('Đã xóa phản hồi')
    } catch (error) {
      toast.error('Không thể xóa phản hồi')
    }
  }

  const fields = useMemo(() => normalizeFields(form?.fields || []), [form])
  const hasBlocks = fields.some((f) => f.type === 'random_section')

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{responses.length} câu trả lời</h1>

        <button
          onClick={handleExport}
          disabled={exporting || responses.length === 0}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium text-white transition-colors whitespace-nowrap"
          style={{
            backgroundColor: exporting || responses.length === 0 ? '#9ca3af' : '#217346',
            opacity: exporting || responses.length === 0 ? 0.6 : 1,
            cursor: exporting || responses.length === 0 ? 'not-allowed' : 'pointer'
          }}
          onMouseEnter={(e) => {
            if (!exporting && responses.length > 0) {
              e.target.style.backgroundColor = '#1a5d38'
            }
          }}
          onMouseLeave={(e) => {
            if (!exporting && responses.length > 0) {
              e.target.style.backgroundColor = '#217346'
            }
          }}
        >
          <FileSpreadsheet className="w-5 h-5" />
          <span>{exporting ? 'Đang xuất...' : 'Tải file Excel'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('summary')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'summary'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Tóm tắt
          </button>
          <button
            onClick={() => setActiveTab('individual')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'individual'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Cá nhân
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'summary' ? (
        <FormSummary formId={id} />
      ) : (
        /* Responses Table */
        responses.length === 0 ? (
          <div className="card text-center py-12">
            <div className="text-gray-400 mb-4">
              <Calendar className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có phản hồi</h3>
            <p className="text-gray-600">
              Chia sẻ biểu mẫu của bạn để bắt đầu thu thập phản hồi
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Thời gian gửi
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Người dùng
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Địa chỉ IP
                    </th>
                    {hasBlocks && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phiên bản
                      </th>
                    )}
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {responses.map((response) => (
                    <tr key={response.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        #{response.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {format(new Date(response.submitted_at), 'MMM dd, yyyy HH:mm')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {response.user?.email || 'Ẩn danh'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {response.ip_address}
                      </td>
                      {hasBlocks && (
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {assignmentSummary(fields, response).map((a) => (
                            <div key={a.key} title={a.label}>{a.titles.join(', ')}</div>
                          ))}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => navigate(`/forms/${id}/responses/${response.id}`)}
                            className="text-primary-600 hover:text-primary-900"
                            title="Xem"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          {!readOnly && (
                            <button
                              onClick={() => handleDelete(response.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Xóa"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  )
}

