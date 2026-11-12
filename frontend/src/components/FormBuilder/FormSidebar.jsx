import { Plus, Image, Video, SeparatorHorizontal, Palette, Shuffle } from 'lucide-react'
import { useFormStore } from '../../store/formStore'
import { useEditor } from '../../layouts/FormEditorLayout'
import { newKey, newVariantKey } from '../../utils/formStructure'
import Tooltip from '../editor/Tooltip'

function SidebarButton({ label, onClick, className = '', children }) {
  return (
    <Tooltip label={label}>
      <button type="button" aria-label={label} onClick={onClick} className={`eforms-sidebar-btn ${className}`}>
        {children}
      </button>
    </Tooltip>
  )
}

export default function FormSidebar({ onInsert }) {
  const { fields } = useFormStore()
  const { openTheme } = useEditor()

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

  const handleThemeClick = () => openTheme()

  return (
    <div className="eforms-sidebar">
      <div className="eforms-sidebar-content">
        <SidebarButton label="Thêm câu hỏi" onClick={handleAddQuestion}>
          <Plus className="w-6 h-6" />
        </SidebarButton>

        <div className="eforms-sidebar-divider"></div>

        <SidebarButton label="Thêm tiêu đề và mô tả" onClick={handleAddDescription} className="eforms-sidebar-text-btn">
          <span className="text-lg font-bold">T</span>
        </SidebarButton>

        <SidebarButton label="Thêm ảnh" onClick={handleAddImage}>
          <Image className="w-5 h-5" />
        </SidebarButton>

        <SidebarButton label="Thêm video" onClick={handleAddVideo}>
          <Video className="w-5 h-5" />
        </SidebarButton>

        <div className="eforms-sidebar-divider"></div>

        <SidebarButton label="Thêm phần" onClick={handleAddSection}>
          <SeparatorHorizontal className="w-5 h-5" />
        </SidebarButton>

        <SidebarButton label="Thêm phần ngẫu nhiên" onClick={handleAddRandomSection}>
          <Shuffle className="w-5 h-5" />
        </SidebarButton>

        <div className="eforms-sidebar-divider"></div>

        <SidebarButton label="Chỉnh sửa giao diện" onClick={handleThemeClick}>
          <Palette className="w-5 h-5" />
        </SidebarButton>
      </div>
    </div>
  )
}
