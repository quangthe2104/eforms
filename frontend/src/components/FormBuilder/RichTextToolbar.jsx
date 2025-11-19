import { Bold, Italic, Underline, Link2, Eraser, List, ListOrdered } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

export default function RichTextToolbar({ onFormat, theme, editorRef, onShowDialog }) {
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkText, setLinkText] = useState('')
  const [savedSelection, setSavedSelection] = useState(null)
  const toolbarRef = useRef(null)

  const cancelLink = (e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setShowLinkInput(false)
    setLinkUrl('')
    setLinkText('')
    setSavedSelection(null)
  }

  // Notify parent when dialog state changes
  useEffect(() => {
    if (onShowDialog) {
      onShowDialog(showLinkInput)
    }
  }, [showLinkInput, onShowDialog])

  // Close dialog when clicking outside
  useEffect(() => {
    if (!showLinkInput) return

    const handleClickOutside = (e) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
        // Only close if not clicking on the editor
        if (editorRef?.current && !editorRef.current.contains(e.target)) {
          cancelLink()
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showLinkInput, editorRef])

  const handleBold = (e) => {
    e.preventDefault()
    e.stopPropagation()
    onFormat('bold')
  }
  
  const handleItalic = (e) => {
    e.preventDefault()
    e.stopPropagation()
    onFormat('italic')
  }
  
  const handleUnderline = (e) => {
    e.preventDefault()
    e.stopPropagation()
    onFormat('underline')
  }
  
  const handleClear = (e) => {
    e.preventDefault()
    e.stopPropagation()
    onFormat('removeFormat')
  }
  
  const handleOrderedList = (e) => {
    e.preventDefault()
    e.stopPropagation()
    onFormat('insertOrderedList')
  }
  
  const handleUnorderedList = (e) => {
    e.preventDefault()
    e.stopPropagation()
    onFormat('insertUnorderedList')
  }
  
  const saveSelection = () => {
    const selection = window.getSelection()
    if (selection.rangeCount > 0) {
      return selection.getRangeAt(0)
    }
    return null
  }

  const restoreSelection = (range) => {
    if (range) {
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }

  const handleLink = (e) => {
    const selection = window.getSelection()
    const selectedText = selection.toString().trim()
    
    if (selectedText) {
      // Save the selection before anything else happens
      const range = saveSelection()
      setSavedSelection(range)
      setLinkText(selectedText)
      setShowLinkInput(true)
    } else {
      alert('Vui lòng chọn text để thêm link')
    }
  }

  const insertLink = (e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    if (linkUrl && savedSelection) {
      // Restore the selection first
      if (editorRef?.current) {
        editorRef.current.focus()
      }
      
      restoreSelection(savedSelection)
      
      // Validate URL
      let finalUrl = linkUrl
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'https://' + finalUrl
      }
      
      // Small delay to ensure focus and selection are set
      setTimeout(() => {
        onFormat('createLink', finalUrl)
        
        // Clean up
        setShowLinkInput(false)
        setLinkUrl('')
        setLinkText('')
        setSavedSelection(null)
      }, 10)
    }
  }

  const buttonStyle = {
    borderColor: theme?.primary_color || '#4285F4'
  }

  return (
    <div className="relative" ref={toolbarRef}>
      <div className="flex items-center gap-1 p-1 bg-gray-50 rounded-lg border border-gray-200 mb-2">
        <button
          type="button"
          onMouseDown={handleBold}
          className="p-1.5 hover:bg-white rounded transition-colors"
          title="In đậm (Ctrl+B)"
        >
          <Bold className="w-4 h-4 text-gray-700" />
        </button>
        
        <button
          type="button"
          onMouseDown={handleItalic}
          className="p-1.5 hover:bg-white rounded transition-colors"
          title="In nghiêng (Ctrl+I)"
        >
          <Italic className="w-4 h-4 text-gray-700" />
        </button>
        
        <button
          type="button"
          onMouseDown={handleUnderline}
          className="p-1.5 hover:bg-white rounded transition-colors"
          title="Gạch chân (Ctrl+U)"
        >
          <Underline className="w-4 h-4 text-gray-700" />
        </button>
        
        <div className="w-px h-5 bg-gray-300 mx-1"></div>
        
        <button
          type="button"
          onMouseDown={handleOrderedList}
          className="p-1.5 hover:bg-white rounded transition-colors"
          title="Danh sách có số"
        >
          <ListOrdered className="w-4 h-4 text-gray-700" />
        </button>
        
        <button
          type="button"
          onMouseDown={handleUnorderedList}
          className="p-1.5 hover:bg-white rounded transition-colors"
          title="Danh sách gạch đầu dòng"
        >
          <List className="w-4 h-4 text-gray-700" />
        </button>
        
        <div className="w-px h-5 bg-gray-300 mx-1"></div>
        
        <button
          type="button"
          onClick={handleLink}
          className="p-1.5 hover:bg-white rounded transition-colors"
          title="Chèn liên kết"
        >
          <Link2 className="w-4 h-4 text-gray-700" />
        </button>
        
        <button
          type="button"
          onMouseDown={handleClear}
          className="p-1.5 hover:bg-white rounded transition-colors"
          title="Xóa định dạng"
        >
          <Eraser className="w-4 h-4 text-gray-700" />
        </button>
      </div>

      {/* Link Dialog */}
      {showLinkInput && (
        <div 
          className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-3 min-w-[300px]"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-600 block mb-1">Text</label>
              <input
                type="text"
                value={linkText}
                readOnly
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-50"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">URL</label>
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    insertLink(e)
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    cancelLink(e)
                  }
                }}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={cancelLink}
                className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={insertLink}
                className="px-3 py-1 text-sm text-white rounded"
                style={{ backgroundColor: theme?.primary_color || '#4285F4' }}
              >
                Chèn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

