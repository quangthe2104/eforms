import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { formAPI } from '../../services/api'

/** `/forms/create`: creates a draft on the server right away so the editor always has an id. */
export default function CreateForm() {
  const navigate = useNavigate()
  const started = useRef(false)

  useEffect(() => {
    // StrictMode runs effects twice in development; one draft only.
    if (started.current) return
    started.current = true
    formAPI.create({ title: 'Biểu mẫu không có tiêu đề' })
      .then((res) => navigate(`/forms/${res.data.form.id}/edit`, { replace: true }))
      .catch(() => {
        toast.error('Không thể tạo biểu mẫu')
        navigate('/forms', { replace: true })
      })
  }, [])

  return (
    <div className="flex items-center justify-center h-64">
      <div className="spinner"></div>
    </div>
  )
}
