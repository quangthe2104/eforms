import { Plus, Image, Video, SeparatorHorizontal, Palette, Shuffle } from 'lucide-react'
import { useFormStore } from '../../store/formStore'
import { useFormBuilder } from '../../contexts/FormBuilderContext'
import toast from 'react-hot-toast'
import { newKey, newVariantKey } from '../../utils/formStructure'

export default function FormSidebar({ onInsert }) {
  const { fields } = useFormStore()
  const { formBuilderActions } = useFormBuilder()

  const handleAddQuestion = () => {
    // Mặc định thêm field Trắc nghiệm (radio)
    onInsert([{
      type: 'radio',
      label: `Câu hỏi ${fields.length + 1}`,
      placeholder: '',
      help_text: '',
      options: ['Tùy chọn 1'],
      is_required: false,
    }])
  }

  const handleAddDescription = () => {
    onInsert([{
      type: 'description',
      label: 'Tiêu đề',
      description: 'Mô tả',
      is_required: false,
    }])
  }

  const handleAddImage = () => {
    onInsert([{
      type: 'image',
      label: 'Ảnh',
      image_url: '',
      is_required: false,
    }])
  }

  const handleAddVideo = () => {
    onInsert([{
      type: 'video',
      label: 'Video',
      video_url: '',
      is_required: false,
    }])
  }

  const handleAddSection = () => {
    // Thêm phần (section break) để phân trang
    onInsert([{
      type: 'section',
      label: 'Phần chưa có tiêu đề',
      description: '',
      is_required: false,
    }])
  }

  const handleAddRandomSection = () => {
    const key = newKey()
    onInsert([
      {
        key,
        type: 'random_section',
        label: 'Phần ngẫu nhiên',
        description: '',
        is_required: false,
        settings: {
          mode: 'same',
          pick_count: 1,
          variants: [
            { key: newVariantKey(), title: 'Phiên bản 1', description: '' },
            { key: newVariantKey(), title: 'Phiên bản 2', description: '' },
          ],
          filter: null,
        },
      },
      {
        type: 'radio',
        label: 'Câu hỏi',
        placeholder: '',
        help_text: '',
        options: ['Tùy chọn 1'],
        is_required: false,
        random_group_key: key,
        variant_key: null,
      },
    ], { isBlock: true })
  }

  const handleThemeClick = () => {
    if (formBuilderActions?.currentForm?.id) {
      formBuilderActions.setShowTheme(true)
    } else {
      toast('Vui lòng lưu biểu mẫu trước khi chỉnh sửa giao diện')
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

        <button 
          onClick={handleAddRandomSection}
          className="eforms-sidebar-btn"
          title="Thêm phần ngẫu nhiên"
        >
          <Shuffle className="w-5 h-5" />
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
