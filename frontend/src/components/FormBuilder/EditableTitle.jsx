import { useState, useRef, useEffect } from 'react'
import RichTextEditor from './RichTextEditor'

export default function EditableTitle({ title, description, onChange, theme, className = '' }) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [editingDescription, setEditingDescription] = useState(false)
  const [localTitle, setLocalTitle] = useState(title || '')
  const [localDescription, setLocalDescription] = useState(description || '')
  const titleRef = useRef(null)
  const descriptionRef = useRef(null)

  useEffect(() => {
    setLocalTitle(title || '')
  }, [title])

  useEffect(() => {
    setLocalDescription(description || '')
  }, [description])

  useEffect(() => {
    if (editingTitle && titleRef.current) {
      titleRef.current.focus()
      titleRef.current.select()
    }
  }, [editingTitle])

  useEffect(() => {
    if (editingDescription && descriptionRef.current) {
      descriptionRef.current.focus()
      descriptionRef.current.select()
    }
  }, [editingDescription])

  const handleTitleBlur = () => {
    setEditingTitle(false)
    if (onChange) {
      onChange({ title: localTitle, description: localDescription })
    }
  }

  const handleDescriptionBlur = () => {
    setEditingDescription(false)
    if (onChange) {
      onChange({ title: localTitle, description: localDescription })
    }
  }

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleTitleBlur()
    }
  }

  return (
    <>
      <style>{`
        .eforms-description a {
          color: ${theme?.primary_color || '#4285F4'} !important;
          text-decoration: underline !important;
          cursor: pointer;
        }
        .eforms-description a:hover {
          opacity: 0.8;
        }
        .eforms-description ol {
          list-style-type: decimal;
          padding-left: 2em;
          margin: 0.5em 0;
        }
        .eforms-description ul {
          list-style-type: disc;
          padding-left: 2em;
          margin: 0.5em 0;
        }
        .eforms-description li {
          margin: 0.25em 0;
        }
      `}</style>
      <div className={`eforms-header ${className}`}>
        <div 
          className="eforms-header-top" 
          style={{ 
            background: `linear-gradient(to right, ${theme?.primary_color || '#2563eb'}, ${theme?.primary_color || '#3b82f6'}, ${theme?.secondary_color || '#60a5fa'})`,
          }}
        ></div>
        <div className="eforms-header-content">
        {editingTitle ? (
          <div className="eforms-input-wrapper">
            <input
              ref={titleRef}
              type="text"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              onFocus={(e) => e.target.select()}
              className="eforms-title-input"
              placeholder="Mẫu không có tiêu đề"
              style={{
                color: theme?.primary_color,
                fontSize: theme?.header_font_size,
              }}
            />
          </div>
        ) : (
          <h1
            className="eforms-title"
            onClick={() => setEditingTitle(true)}
            style={{
              color: theme?.primary_color,
              fontSize: theme?.header_font_size,
            }}
          >
            {localTitle || 'Mẫu không có tiêu đề'}
          </h1>
        )}

        {editingDescription ? (
          <div className="eforms-input-wrapper">
            <RichTextEditor
              value={localDescription}
              onChange={(html) => setLocalDescription(html)}
              placeholder="Mô tả biểu mẫu"
              className="eforms-description-input"
              theme={theme}
              isMultiline={true}
              onBlur={handleDescriptionBlur}
              onFocus={(e) => {
                if (e.target.textContent) {
                  const range = document.createRange()
                  const sel = window.getSelection()
                  range.selectNodeContents(e.target)
                  sel.removeAllRanges()
                  sel.addRange(range)
                }
              }}
            />
          </div>
        ) : (
          <div
            className="eforms-description"
            onClick={() => setEditingDescription(true)}
            style={{
              fontSize: theme?.text_font_size,
              cursor: 'pointer'
            }}
            dangerouslySetInnerHTML={{ __html: localDescription || 'Mô tả biểu mẫu' }}
          />
        )}
        </div>
      </div>
    </>
  )
}

