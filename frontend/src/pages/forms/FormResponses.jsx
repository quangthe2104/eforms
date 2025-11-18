import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { formAPI, responseAPI, exportAPI } from '../../services/api'
import toast from 'react-hot-toast'
import { ArrowLeft, Download, Trash2, Eye, Calendar } from 'lucide-react'
import { format } from 'date-fns'

export default function FormResponses() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(null)
  const [responses, setResponses] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    try {
      const [formRes, responsesRes] = await Promise.all([
        formAPI.getOne(id),
        responseAPI.getAll(id)
      ])
      setForm(formRes.data)
      setResponses(responsesRes.data.data || responsesRes.data)
    } catch (error) {
      toast.error('Không thể tải phản hồi')
      navigate('/forms')
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
      toast.success('Đã xóa phản hồi')
    } catch (error) {
      toast.error('Không thể xóa phản hồi')
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/forms')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{form?.title}</h1>
            <p className="text-sm text-gray-600">{responses.length} phản hồi</p>
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting || responses.length === 0}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Download className="w-5 h-5" />
          <span>{exporting ? 'Đang xuất...' : 'Xuất ra Excel'}</span>
        </button>
      </div>

      {/* Responses Table */}
      {responses.length === 0 ? (
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
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => navigate(`/forms/${id}/responses/${response.id}`)}
                          className="text-primary-600 hover:text-primary-900"
                          title="Xem"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(response.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Xóa"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

