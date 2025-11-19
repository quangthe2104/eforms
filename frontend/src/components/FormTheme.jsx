import { useState, useEffect, useRef } from 'react'
import { X, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { HexColorPicker } from 'react-colorful'

const THEME_COLORS = [
  { name: 'Red', primary: '#DB4437', secondary: '#F4C7C3' },
  { name: 'Purple', primary: '#673AB7', secondary: '#D1C4E9' },
  { name: 'Indigo', primary: '#3F51B5', secondary: '#C5CAE9' },
  { name: 'Blue', primary: '#4285F4', secondary: '#C6DAFC' },
  { name: 'Cyan', primary: '#00BCD4', secondary: '#B2EBF2' },
  { name: 'Teal', primary: '#009688', secondary: '#B2DFDB' },
  { name: 'Orange', primary: '#FF9800', secondary: '#FFE0B2' },
  { name: 'Amber', primary: '#FFC107', secondary: '#FFECB3' },
  { name: 'Green', primary: '#0F9D58', secondary: '#C8E6C9' },
  { name: 'Lime', primary: '#8BC34A', secondary: '#DCEDC8' },
  { name: 'Grey', primary: '#607D8B', secondary: '#CFD8DC' },
  { name: 'Blue Grey', primary: '#455A64', secondary: '#B0BEC5' },
]

const BACKGROUND_COLORS = [
  { name: 'Xám nhạt (Mặc định)', color: '#f9fafb' },
  { name: 'Trắng', color: '#FFFFFF' },
  { name: 'Tím nhạt', color: '#E8DAEF' },
  { name: 'Xanh dương nhạt', color: '#D6EAF8' },
  { name: 'Xám sáng', color: '#ECF0F1' },
]

const FONTS = [
  { name: 'Mặc định', value: 'system-ui, -apple-system, sans-serif' },
  { name: 'Roboto', value: 'Roboto, sans-serif' },
  { name: 'Open Sans', value: '"Open Sans", sans-serif' },
  { name: 'Lato', value: 'Lato, sans-serif' },
  { name: 'Montserrat', value: 'Montserrat, sans-serif' },
  { name: 'Arial', value: 'Arial, sans-serif' },
  { name: 'Times New Roman', value: '"Times New Roman", serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
]

const FONT_SIZES = {
  header: [
    { label: 'Nhỏ', value: '24px' },
    { label: 'Trung bình', value: '32px' },
    { label: 'Lớn', value: '40px' },
  ],
  question: [
    { label: 'Nhỏ', value: '14px' },
    { label: 'Trung bình', value: '16px' },
    { label: 'Lớn', value: '18px' },
  ],
  text: [
    { label: 'Nhỏ', value: '12px' },
    { label: 'Trung bình', value: '14px' },
    { label: 'Lớn', value: '16px' },
  ],
}

export default function FormTheme({ theme, onClose, onPreview }) {
  const sidebarRef = useRef(null)
  const [isClosing, setIsClosing] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  
  // Initialize settings from theme only once
  const [settings, setSettings] = useState({
    primary_color: theme?.primary_color || '#4285F4',
    secondary_color: theme?.secondary_color || '#C6DAFC',
    background_color: theme?.background_color || '#f9fafb',
    header_image: theme?.header_image || '',
    font_family: theme?.font_family || 'system-ui, -apple-system, sans-serif',
    header_font_size: theme?.header_font_size || '32px',
    question_font_size: theme?.question_font_size || '16px',
    text_font_size: theme?.text_font_size || '14px',
  })

  const [uploadingImage, setUploadingImage] = useState(false)
  const [showCustomColorPicker, setShowCustomColorPicker] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    color: true,
    image: false,
    font: false,
    size: false,
  })

  // Trigger opening animation
  useEffect(() => {
    // Small delay to ensure the component is mounted before animation
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 10)
    return () => clearTimeout(timer)
  }, [])

  // Apply theme changes immediately to parent (only when settings change)
  useEffect(() => {
    if (onPreview) {
      onPreview(settings)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings])

  // Click outside to close sidebar
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        handleClose()
      }
    }

    // Add event listener after a small delay to avoid closing immediately
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Handle close with animation
  const handleClose = () => {
    setIsVisible(false)
    setIsClosing(true)
    setTimeout(() => {
      onClose()
    }, 300) // Match animation duration
  }

  // Generate complementary background colors based on primary color
  const generateBackgroundColors = (primaryColor) => {
    // Convert hex to RGB
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null
    }

    // Convert RGB to hex
    const rgbToHex = (r, g, b) => {
      return '#' + [r, g, b].map(x => {
        const hex = Math.round(x).toString(16)
        return hex.length === 1 ? '0' + hex : hex
      }).join('')
    }

    const rgb = hexToRgb(primaryColor)
    if (!rgb) return BACKGROUND_COLORS

    // Generate lighter shades of the primary color
    const lighten = (percent) => {
      return {
        r: rgb.r + (255 - rgb.r) * percent,
        g: rgb.g + (255 - rgb.g) * percent,
        b: rgb.b + (255 - rgb.b) * percent
      }
    }

    return [
      { name: 'Nhạt', color: rgbToHex(lighten(0.85).r, lighten(0.85).g, lighten(0.85).b) },
      { name: 'Rất nhạt', color: rgbToHex(lighten(0.95).r, lighten(0.95).g, lighten(0.95).b) },
      { name: 'Trắng', color: '#FFFFFF' },
      { name: 'Xám nhạt (Mặc định)', color: '#f9fafb' },
    ]
  }

  const handleColorSelect = (color) => {
    const newSettings = {
      ...settings,
      primary_color: color.primary,
      secondary_color: color.secondary,
    }
    
    // Auto-select background color based on priority: Nhạt (85%) > Rất nhạt (95%) > Trắng > Xám
    const bgColors = generateBackgroundColors(color.primary)
    // Priority order: index 0 (Nhạt 85%) > 1 (Rất nhạt 95%) > 2 (Trắng) > 3 (Xám)
    newSettings.background_color = bgColors[0]?.color || bgColors[1]?.color || bgColors[2]?.color || bgColors[3]?.color
    
    setSettings(newSettings)
  }

  const handleCustomColorChange = (e) => {
    const primaryColor = e.target.value
    // Auto-generate secondary color (lighter version)
    const rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(primaryColor)
    let secondaryColor = primaryColor
    if (rgb) {
      const r = parseInt(rgb[1], 16)
      const g = parseInt(rgb[2], 16)
      const b = parseInt(rgb[3], 16)
      // Lighten by 60%
      const lr = Math.round(r + (255 - r) * 0.6)
      const lg = Math.round(g + (255 - g) * 0.6)
      const lb = Math.round(b + (255 - b) * 0.6)
      secondaryColor = '#' + [lr, lg, lb].map(x => {
        const hex = x.toString(16)
        return hex.length === 1 ? '0' + hex : hex
      }).join('')
    }
    
    // Auto-select background color
    const bgColors = generateBackgroundColors(primaryColor)
    const backgroundColor = bgColors[0]?.color || bgColors[1]?.color || bgColors[2]?.color || bgColors[3]?.color
    
    setSettings({
      ...settings,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      background_color: backgroundColor,
    })
  }

  // Get dynamic background colors based on primary color
  const dynamicBackgroundColors = generateBackgroundColors(settings.primary_color)

  const toggleSection = (section) => {
    setExpandedSections({
      ...expandedSections,
      [section]: !expandedSections[section],
    })
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước ảnh tối đa 5MB')
      return
    }

    setUploadingImage(true)
    try {
      const reader = new FileReader()
      reader.onloadend = () => {
        setSettings({ ...settings, header_image: reader.result })
        setUploadingImage(false)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      toast.error('Không thể tải ảnh lên')
      setUploadingImage(false)
    }
  }

  const handleRemoveImage = () => {
    setSettings({ ...settings, header_image: '' })
  }


  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className={`fixed inset-0 bg-black transition-opacity duration-300 z-30 ${
          isVisible && !isClosing ? 'opacity-20' : 'opacity-0'
        }`}
        onClick={handleClose}
      />
      
      {/* Sidebar */}
      <div 
        ref={sidebarRef} 
        className={`fixed top-16 right-0 h-[calc(100vh-4rem)] w-80 bg-white border-l border-gray-200 shadow-2xl z-40 flex flex-col transform transition-transform duration-300 ease-in-out ${
          isVisible && !isClosing ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Giao Diện</h2>
            <p className="text-xs text-gray-500 mt-0.5">Thay đổi sẽ được lưu khi bấm "Lưu"</p>
          </div>
          <button onClick={handleClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="p-4 space-y-4">
          {/* Color Theme Section */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => toggleSection('color')}
              className="w-full flex items-center justify-between px-2 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            >
              <span>Màu Chủ Đề</span>
              {expandedSections.color ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {expandedSections.color && (
              <div className="px-2 pb-4 space-y-3">
                <div className="grid grid-cols-6 gap-2">
                  {THEME_COLORS.map((color) => (
                    <button
                      key={color.name}
                      onClick={() => handleColorSelect(color)}
                      className={`relative w-10 h-10 rounded-full transition-transform hover:scale-110 ${
                        settings.primary_color === color.primary ? 'ring-2 ring-offset-1 ring-gray-900' : ''
                      }`}
                      style={{ backgroundColor: color.primary }}
                      title={color.name}
                    >
                      {settings.primary_color === color.primary && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                  
                  {/* Custom Color Button with Plus Icon */}
                  <div className="relative">
                    <button
                      onClick={() => setShowCustomColorPicker(!showCustomColorPicker)}
                      className="w-10 h-10 rounded-full border-2 border-dashed border-gray-400 hover:border-gray-600 transition-all flex items-center justify-center hover:scale-110"
                      title="Tự chọn màu"
                    >
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                    
                    {/* Custom Color Picker Dropdown */}
                    {showCustomColorPicker && (
                      <div className="absolute top-12 left-0 z-20 bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-56">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-semibold text-gray-700">
                            Chọn màu
                          </label>
                          <button 
                            onClick={() => setShowCustomColorPicker(false)}
                            className="p-0.5 hover:bg-gray-100 rounded"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        
                        {/* Color Picker */}
                        <div className="space-y-2.5">
                          <HexColorPicker 
                            color={settings.primary_color} 
                            onChange={(color) => handleCustomColorChange({ target: { value: color } })}
                            style={{ width: '100%', height: '150px' }}
                          />
                          
                          {/* Hex Input */}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Mã màu Hex
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={settings.primary_color}
                                onChange={(e) => {
                                  const value = e.target.value
                                  // Allow typing and validate
                                  if (value.match(/^#[0-9A-Fa-f]{0,6}$/)) {
                                    if (value.length === 7) {
                                      handleCustomColorChange(e)
                                    } else if (value.length < 7) {
                                      // Allow partial input
                                      setSettings({ ...settings, primary_color: value })
                                    }
                                  }
                                }}
                                onBlur={(e) => {
                                  // Ensure valid hex on blur
                                  if (!/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                                    setSettings({ ...settings, primary_color: '#4285F4' })
                                  }
                                }}
                                placeholder="#4285F4"
                                maxLength={7}
                                className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono uppercase text-center"
                              />
                              <div
                                className="w-9 h-8 rounded border-2 border-gray-300 flex-shrink-0"
                                style={{ backgroundColor: settings.primary_color }}
                                title={settings.primary_color}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Background Color */}
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Màu Nền (tự động theo màu chủ đề)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {dynamicBackgroundColors.map((bg) => (
                      <button
                        key={bg.name}
                        onClick={() => setSettings({ ...settings, background_color: bg.color })}
                        className={`relative w-full h-10 rounded border-2 transition-all ${
                          settings.background_color === bg.color
                            ? 'border-gray-900 ring-1 ring-offset-1 ring-gray-900'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                        style={{ backgroundColor: bg.color }}
                        title={bg.name}
                      >
                        {settings.background_color === bg.color && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <svg className="w-4 h-4 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Header Image Section */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => toggleSection('image')}
              className="w-full flex items-center justify-between px-2 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            >
              <span>Hình Ảnh Đầu Trang</span>
              {expandedSections.image ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {expandedSections.image && (
              <div className="px-2 pb-4">
                {settings.header_image ? (
                  <div className="relative">
                    <img
                      src={settings.header_image}
                      alt="Header"
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <button
                      onClick={handleRemoveImage}
                      className="absolute top-1 right-1 p-1 bg-white rounded shadow-lg hover:bg-gray-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-xs text-gray-600 mb-1">Click để tải ảnh</span>
                      <span className="text-xs text-gray-400">Max 5MB</span>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                    />
                  </label>
                )}
              </div>
            )}
          </div>

          {/* Font Section */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => toggleSection('font')}
              className="w-full flex items-center justify-between px-2 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            >
              <span>Font Chữ</span>
              {expandedSections.font ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {expandedSections.font && (
              <div className="px-2 pb-4">
                <select
                  value={settings.font_family}
                  onChange={(e) => setSettings({ ...settings, font_family: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {FONTS.map((font) => (
                    <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                      {font.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Font Size Section */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => toggleSection('size')}
              className="w-full flex items-center justify-between px-2 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            >
              <span>Cỡ Chữ</span>
              {expandedSections.size ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {expandedSections.size && (
              <div className="px-2 pb-4 space-y-4">
                {/* Header Font Size */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Đầu Trang
                  </label>
                  <div className="space-y-1.5">
                    {FONT_SIZES.header.map((size) => (
                      <label key={size.value} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="header_size"
                          value={size.value}
                          checked={settings.header_font_size === size.value}
                          onChange={(e) => setSettings({ ...settings, header_font_size: e.target.value })}
                          className="w-3.5 h-3.5 text-primary-600"
                        />
                        <span className="text-xs text-gray-700">{size.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Question Font Size */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Câu Hỏi
                  </label>
                  <div className="space-y-1.5">
                    {FONT_SIZES.question.map((size) => (
                      <label key={size.value} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="question_size"
                          value={size.value}
                          checked={settings.question_font_size === size.value}
                          onChange={(e) => setSettings({ ...settings, question_font_size: e.target.value })}
                          className="w-3.5 h-3.5 text-primary-600"
                        />
                        <span className="text-xs text-gray-700">{size.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Text Font Size */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Văn Bản
                  </label>
                  <div className="space-y-1.5">
                    {FONT_SIZES.text.map((size) => (
                      <label key={size.value} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="text_size"
                          value={size.value}
                          checked={settings.text_font_size === size.value}
                          onChange={(e) => setSettings({ ...settings, text_font_size: e.target.value })}
                          className="w-3.5 h-3.5 text-primary-600"
                        />
                        <span className="text-xs text-gray-700">{size.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </>
  )
}

