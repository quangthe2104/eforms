import html2canvas from 'html2canvas'
import api from '../services/api'

/**
 * Capture a thumbnail of the form preview and upload to server
 * @param {Object} formData - The form data to render (should include theme colors)
 * @param {number} formId - The form ID
 * @returns {Promise<string|null>} - Thumbnail URL or null
 */
export async function captureFormThumbnail(formData, formId) {
  try {
    // Get theme colors from formData or use defaults
    const primaryColor = formData.primary_color || '#4285F4'
    const secondaryColor = formData.secondary_color || '#C6DAFC'
    const backgroundColor = formData.background_color || '#f9fafb'
    const fontFamily = formData.font_family || 'system-ui, -apple-system, sans-serif'
    const headerFontSize = formData.header_font_size || '32px'
    const questionFontSize = formData.question_font_size || '16px'
    const textFontSize = formData.text_font_size || '14px'
    
    const width = 1600
    const height = 900
    
    const container = document.createElement('div')
    container.style.cssText = `
      position: fixed;
      top: -9999px;
      left: -9999px;
      width: ${width}px;
      height: ${height}px;
      background: ${backgroundColor};
      padding: 32px 16px;
      font-family: ${fontFamily};
      overflow: hidden;
    `
    
    container.innerHTML = `
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        .eforms-container {
          max-width: 672px;
          margin: 0 auto;
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          gap: 16px;
        }
        .eforms-header {
          background: white;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          overflow: hidden;
        }
        .eforms-header-top {
          height: 4px;
          background: linear-gradient(to right, ${primaryColor}, ${primaryColor}, ${secondaryColor});
        }
        .eforms-header-content {
          padding: 24px;
        }
        .eforms-header-content h1 {
          font-size: ${headerFontSize};
          font-weight: normal;
          margin-bottom: 8px;
          color: ${primaryColor || '#111827'};
          font-family: ${fontFamily};
        }
        .eforms-header-content .text-gray-700 {
          color: #374151;
          font-size: ${textFontSize};
          font-family: ${fontFamily};
        }
        .eforms-field {
          background: white;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          padding: 24px;
          transition: all 0.2s;
        }
        .eforms-field-label {
          display: block;
          font-weight: bold;
          color: ${primaryColor || '#111827'};
          font-size: ${questionFontSize};
          font-family: ${fontFamily};
          margin-bottom: 12px;
        }
        .eforms-field-required {
          color: #ef4444;
          margin-left: 4px;
        }
        .eforms-input {
          width: 100%;
          border-bottom: 2px solid #d1d5db;
          padding: 8px 0;
          color: #9ca3af;
          font-size: ${textFontSize};
          font-family: ${fontFamily};
          background: transparent;
          border-top: none;
          border-left: none;
          border-right: none;
        }
        .eforms-textarea {
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 12px;
          min-height: 80px;
          color: #9ca3af;
          background: white;
          font-size: ${textFontSize};
          font-family: ${fontFamily};
        }
        .eforms-radio,
        .eforms-checkbox {
          display: flex;
          align-items: center;
          margin: 8px 0;
        }
        .eforms-radio input,
        .eforms-checkbox input {
          width: 16px;
          height: 16px;
          margin-right: 8px;
          accent-color: ${primaryColor};
        }
        .eforms-radio span,
        .eforms-checkbox span {
          color: #374151;
          font-size: ${textFontSize};
          font-family: ${fontFamily};
        }
        .eforms-section {
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 8px;
          margin-bottom: 16px;
        }
        .eforms-section h3 {
          font-size: 18px;
          font-weight: 600;
          color: #111827;
          font-family: ${fontFamily};
        }
        .eforms-section div {
          font-size: ${textFontSize};
          color: #4b5563;
          margin-top: 4px;
          font-family: ${fontFamily};
        }
        .eforms-image {
          width: 100%;
          max-height: 200px;
          object-fit: contain;
          border-radius: 6px;
        }
        a {
          color: ${primaryColor} !important;
          text-decoration: underline !important;
        }
        ol {
          list-style-type: decimal;
          padding-left: 2em;
          margin: 0.5em 0;
        }
        ul {
          list-style-type: disc;
          padding-left: 2em;
          margin: 0.5em 0;
        }
        li {
          margin: 0.25em 0;
        }
      </style>
      <div class="eforms-container">
        ${formData.header_image ? `
          <div style="width: 100%; border-radius: 8px; overflow: hidden;">
            <img src="${formData.header_image}" alt="Header" style="width: 100%; height: 160px; object-fit: cover;" />
          </div>
        ` : ''}
        
        <!-- Header Card -->
        <div class="eforms-header">
          <div class="eforms-header-top"></div>
          <div class="eforms-header-content">
            <h1>${escapeHtml(formData.title || 'Biểu mẫu không có tiêu đề')}</h1>
            ${formData.description ? `<div class="text-gray-700">${formData.description}</div>` : ''}
          </div>
        </div>
        
        <!-- Fields -->
        ${renderFields(formData.fields || [], primaryColor, questionFontSize, textFontSize, fontFamily)}
      </div>
    `
    
    document.body.appendChild(container)
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const canvas = await html2canvas(container, {
      backgroundColor: backgroundColor,
      scale: 1,
      logging: false,
      width: width,
      height: height,
      useCORS: true,
      allowTaint: false,
      windowWidth: width,
      windowHeight: height,
    })
    
    document.body.removeChild(container)
    
    const base64Image = canvas.toDataURL('image/jpeg', 0.85)
    
    if (formId) {
      try {
        const response = await api.post(`/forms/${formId}/thumbnail`, {
          thumbnail: base64Image
        })
        return response.data.thumbnail
      } catch (error) {
        console.error('Error uploading thumbnail:', error)
        return null
      }
    }
    
    return base64Image
  } catch (error) {
    console.error('Error capturing form thumbnail:', error)
    return null
  }
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function renderFields(fields, primaryColor, questionFontSize, textFontSize, fontFamily) {
  if (!fields || fields.length === 0) {
    return '<div class="eforms-field"><p style="color: #9CA3AF; text-align: center; padding: 40px 0;">Chưa có trường nào</p></div>'
  }
  
  const fieldsToShow = []
  const maxFields = 5
  
  for (const field of fields) {
    if (field.type === 'section' && fieldsToShow.length > 0) break
    if (fieldsToShow.length >= maxFields) break
    fieldsToShow.push(field)
  }
  
  return fieldsToShow.map((field) => {
    const isRequired = field.is_required ? '<span class="eforms-field-required">*</span>' : ''
    const showLabel = !['section', 'description', 'image', 'video'].includes(field.type)
    let fieldHtml = '<div class="eforms-field">'
    
    if (showLabel) {
      fieldHtml += `<label class="eforms-field-label">${escapeHtml(field.label || 'Câu hỏi')} ${isRequired}</label>`
    }
    
    switch (field.type) {
      case 'text':
      case 'email':
      case 'number':
      case 'phone':
      case 'url':
        fieldHtml += '<div class="eforms-input">Câu trả lời của bạn</div>'
        break
        
      case 'textarea':
      case 'long_text':
        fieldHtml += '<div class="eforms-textarea">Câu trả lời của bạn...</div>'
        break
        
      case 'radio':
      case 'short_text':
        if (field.options && field.options.length > 0) {
          field.options.slice(0, 4).forEach(option => {
            fieldHtml += `
              <div class="eforms-radio">
                <input type="radio" />
                <span>${escapeHtml(option)}</span>
              </div>
            `
          })
        }
        break
        
      case 'checkbox':
        if (field.options && field.options.length > 0) {
          field.options.slice(0, 4).forEach(option => {
            fieldHtml += `
              <div class="eforms-checkbox">
                <input type="checkbox" />
                <span>${escapeHtml(option)}</span>
              </div>
            `
          })
        }
        break
        
      case 'dropdown':
      case 'select':
        fieldHtml += '<div class="eforms-input" style="border: 1px solid #d1d5db; border-radius: 6px; padding: 10px 12px;">Chọn một tùy chọn</div>'
        break
        
      case 'date':
        fieldHtml += '<div class="eforms-input" style="border: 1px solid #d1d5db; border-radius: 6px; padding: 10px 12px;">dd/mm/yyyy</div>'
        break
        
      case 'file_upload':
      case 'file':
        fieldHtml += '<div style="border: 2px dashed #d1d5db; border-radius: 6px; padding: 20px; text-align: center; color: #9ca3af;">Tải lên tệp</div>'
        break
        
      case 'section':
        fieldHtml = `<div class="eforms-section">
          <h3>${escapeHtml(field.label || 'Phần')}</h3>
          ${field.description ? `<div>${field.description}</div>` : ''}
        </div>`
        break
        
      case 'description':
        fieldHtml = `<div>
          <h3 style="font-size: 18px; font-weight: 600; color: #111827; font-family: ${fontFamily}; margin-bottom: 8px;">
            ${escapeHtml(field.label || '')}
          </h3>
          ${field.description ? `<div style="font-size: ${textFontSize}; color: #4b5563; font-family: ${fontFamily};">${field.description}</div>` : ''}
        </div>`
        break
        
      case 'image':
        if (field.image_url) {
          fieldHtml += `<img src="${field.image_url}" alt="${escapeHtml(field.label || 'Image')}" class="eforms-image" />`
        }
        break
        
      case 'video':
        break
        
      default:
        fieldHtml += '<div style="color: #9CA3AF; font-style: italic;">Trường này chưa được hỗ trợ preview</div>'
    }
    
    if (field.type !== 'section' && field.type !== 'description') {
      fieldHtml += '</div>'
    }
    
    return fieldHtml
  }).join('')
}
