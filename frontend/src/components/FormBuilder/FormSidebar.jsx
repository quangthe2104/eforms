import { Plus, Image, Video, SeparatorHorizontal, Palette } from 'lucide-react'
import { useFormStore } from '../../store/formStore'
import { useFormBuilder } from '../../contexts/FormBuilderContext'
import toast from 'react-hot-toast'

export default function FormSidebar() {
  const { addField, fields } = useFormStore()
  const { formBuilderActions } = useFormBuilder()

  const handleAddQuestion = () => {
    // Mặc định thêm field Trắc nghiệm (radio)
    const newField = {
      type: 'radio',
      label: `Câu hỏi ${fields.length + 1}`,
      placeholder: '',
      help_text: '',
      options: ['Tùy chọn 1'],
      is_required: false,
    }
    addField(newField)

    // Scroll to bottom after adding
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    }, 100)
  }

  const handleAddDescription = () => {
    // Thêm field mô tả/tiêu đề con
    const newField = {
      type: 'description',
      label: 'Tiêu đề',
      description: 'Mô tả',
      is_required: false,
    }
    addField(newField)

    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    }, 100)
  }

  const handleAddImage = () => {
    // Thêm field ảnh
    const newField = {
      type: 'image',
      label: 'Ảnh',
      image_url: '',
      is_required: false,
    }
    addField(newField)

    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    }, 100)
  }

  const handleAddVideo = () => {
    // Thêm field video
    const newField = {
      type: 'video',
      label: 'Video',
      video_url: '',
      is_required: false,
    }
    addField(newField)

    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    }, 100)
  }

  const handleAddSection = () => {
    // Thêm phần (section break) để phân trang
    const newField = {
      type: 'section',
      label: 'Phần chưa có tiêu đề',
      description: '',
      is_required: false,
    }
    addField(newField)

    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    }, 100)
  }

  const handleThemeClick = () => {
    if (formBuilderActions?.currentForm?.id) {
      formBuilderActions.setShowTheme(true)
    } else {
      toast.info('Vui lòng lưu biểu mẫu trước khi chỉnh sửa giao diện')
    }
  }

  return (
    <div className="eforms-sidebar">
      <div className="eforms-sidebar-content">
        <button 
          onClick={handleAddQuestion}
          className="eforms-sidebar-btn"
          title="Thêm câu hỏi"
        >
          <Plus className="w-6 h-6" />
        </button>

        <div className="eforms-sidebar-divider"></div>

        <button 
          onClick={handleAddDescription}
          className="eforms-sidebar-btn eforms-sidebar-text-btn"
          title="Thêm tiêu đề và mô tả"
        >
          <span className="text-lg font-bold">T</span>
        </button>

        <button 
          onClick={handleAddImage}
          className="eforms-sidebar-btn"
          title="Thêm ảnh"
        >
          <Image className="w-5 h-5" />
        </button>

        <button 
          onClick={handleAddVideo}
          className="eforms-sidebar-btn"
          title="Thêm video"
        >
          <Video className="w-5 h-5" />
        </button>

        <div className="eforms-sidebar-divider"></div>

        <button 
          onClick={handleAddSection}
          className="eforms-sidebar-btn"
          title="Thêm phần"
        >
          <SeparatorHorizontal className="w-5 h-5" />
        </button>

        <div className="eforms-sidebar-divider"></div>

        <button 
          onClick={handleThemeClick}
          className="eforms-sidebar-btn"
          title="Chỉnh sửa giao diện"
        >
          <Palette className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

