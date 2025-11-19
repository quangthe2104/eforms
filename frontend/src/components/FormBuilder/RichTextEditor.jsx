import { useRef, useEffect, useState } from 'react'
import RichTextToolbar from './RichTextToolbar'

export default function RichTextEditor({ 
  value, 
  onChange, 
  placeholder, 
  className,
  theme,
  onFocus,
  onBlur,
  onMouseEnter,
  onMouseLeave,
  isMultiline = false
}) {
  const editorRef = useRef(null)
  const [isFocused, setIsFocused] = useState(false)
  const [hasDialog, setHasDialog] = useState(false)
  const [showToolbar, setShowToolbar] = useState(false)

  useEffect(() => {
    if (editorRef.current && !isFocused) {
      const currentValue = editorRef.current.innerHTML
      const newValue = value || ''
      if (currentValue !== newValue) {
        editorRef.current.innerHTML = newValue
      }
    }
  }, [value, isFocused])

  // Show toolbar only when focus or dialog is open
  useEffect(() => {
    setShowToolbar(isFocused || hasDialog)
  }, [isFocused, hasDialog])

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  const handleFormat = (command, cmdValue = null) => {
    // Ensure editor is focused
    if (editorRef.current) {
      editorRef.current.focus()
      
      // Small delay to ensure focus is set
      setTimeout(() => {
        try {
          const success = document.execCommand(command, false, cmdValue)
          console.log(`Command ${command} executed:`, success)
          
          // Trigger input event to save changes
          if (editorRef.current) {
            handleInput()
          }
        } catch (error) {
          console.error('execCommand error:', error)
        }
      }, 10)
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
  }

  const handleKeyDown = (e) => {
    // Prevent new lines in single-line mode
    if (!isMultiline && e.key === 'Enter') {
      e.preventDefault()
    }
    
    // Handle keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch(e.key.toLowerCase()) {
        case 'b':
          e.preventDefault()
          handleFormat('bold')
          break
        case 'i':
          e.preventDefault()
          handleFormat('italic')
          break
        case 'u':
          e.preventDefault()
          handleFormat('underline')
          break
      }
    }
  }

  const handleEditorFocus = (e) => {
    setIsFocused(true)
    if (onFocus) onFocus(e)
  }

  const handleEditorBlur = (e) => {
    // Check if the blur is caused by clicking on the toolbar
    const relatedTarget = e.relatedTarget
    const currentTarget = e.currentTarget
    
    // If clicking within the toolbar or link dialog, don't trigger blur
    if (relatedTarget && currentTarget.parentElement?.contains(relatedTarget)) {
      return
    }
    
    // Small delay to check if we're clicking on toolbar buttons
    setTimeout(() => {
      setIsFocused(false)
      if (onBlur) onBlur(e)
    }, 100)
  }

  return (
    <div 
      className="relative" 
      onClick={(e) => e.stopPropagation()}
    >
      {showToolbar && (
        <RichTextToolbar 
          onFormat={handleFormat} 
          theme={theme}
          editorRef={editorRef}
          onShowDialog={setHasDialog}
        />
      )}
      
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onFocus={handleEditorFocus}
        onBlur={handleEditorBlur}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={className}
        data-placeholder={placeholder}
        style={{
          minHeight: isMultiline ? '60px' : '32px',
          maxHeight: isMultiline ? '200px' : '32px',
          overflowY: 'auto',
          wordWrap: 'break-word',
          whiteSpace: isMultiline ? 'pre-wrap' : 'nowrap'
        }}
      />
      
      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        [contenteditable] {
          outline: none;
        }
        [contenteditable] a {
          color: ${theme?.primary_color || '#4285F4'} !important;
          text-decoration: underline !important;
          cursor: pointer;
        }
        [contenteditable] a:hover {
          text-decoration: underline !important;
          opacity: 0.8;
        }
        [contenteditable] b, [contenteditable] strong {
          font-weight: bold;
        }
        [contenteditable] i, [contenteditable] em {
          font-style: italic;
        }
        [contenteditable] u {
          text-decoration: underline;
        }
        [contenteditable] ol {
          list-style-type: decimal;
          padding-left: 2em;
          margin: 0.5em 0;
        }
        [contenteditable] ul {
          list-style-type: disc;
          padding-left: 2em;
          margin: 0.5em 0;
        }
        [contenteditable] li {
          margin: 0.25em 0;
        }
      `}</style>
    </div>
  )
}

