import { useEffect } from 'react'

/** Applies the form theme to the page (CSS variables used by inputs, page background). */
export function useFormTheme(form) {
  useEffect(() => {
    if (!form) return
    const root = document.documentElement.style
    if (form.primary_color) root.setProperty('--theme-primary', form.primary_color)
    if (form.secondary_color) root.setProperty('--theme-secondary', form.secondary_color)
    if (form.background_color) {
      root.setProperty('--theme-bg', form.background_color)
      document.body.style.backgroundColor = form.background_color
    }
    return () => {
      root.removeProperty('--theme-primary')
      root.removeProperty('--theme-secondary')
      root.removeProperty('--theme-bg')
      document.body.style.backgroundColor = ''
    }
  }, [form])
}

/** Page background, rich-text link/list styles, header image and title card. */
export function FormFrame({ form, showDescription, children }) {
  const color = form.primary_color || '#4285F4'
  return (
    <>
      <style>{`
        .eforms-header-content a, .text-gray-700 a, .text-gray-600 a, .text-sm a {
          color: ${color} !important; text-decoration: underline !important; cursor: pointer;
        }
        .eforms-header-content a:hover, .text-gray-700 a:hover, .text-gray-600 a:hover, .text-sm a:hover { opacity: 0.8; }
        .eforms-header-content ol, .text-gray-700 ol, .text-gray-600 ol, .text-sm ol { list-style-type: decimal; padding-left: 2em; margin: 0.5em 0; }
        .eforms-header-content ul, .text-gray-700 ul, .text-gray-600 ul, .text-sm ul { list-style-type: disc; padding-left: 2em; margin: 0.5em 0; }
        .eforms-header-content li, .text-gray-700 li, .text-gray-600 li, .text-sm li { margin: 0.25em 0; }
      `}</style>
      <div
        className="min-h-screen py-8 px-4"
        style={{ backgroundColor: form.background_color || '#f9fafb', fontFamily: form.font_family || 'system-ui, -apple-system, sans-serif' }}
      >
        <div className="max-w-2xl mx-auto space-y-4">
          {form.header_image && (
            <div className="w-full rounded-lg overflow-hidden">
              <img src={form.header_image} alt="Header" className="w-full h-40 object-cover" />
            </div>
          )}

          <div className="eforms-header">
            <div
              className="eforms-header-top"
              style={{
                background: form.primary_color
                  ? `linear-gradient(to right, ${form.primary_color}, ${form.primary_color}, ${form.secondary_color || form.primary_color})`
                  : 'linear-gradient(to right, #4285F4, #3b82f6, #60a5fa)',
              }}
            ></div>
            <div className="eforms-header-content">
              <h1
                className="text-3xl font-bold text-gray-900 mb-2"
                style={{ fontSize: form.header_font_size || '32px', fontFamily: form.font_family || 'inherit' }}
              >
                {form.title}
              </h1>
              {form.description && showDescription && (
                <div
                  className="text-gray-800"
                  style={{ fontSize: form.text_font_size || '14px', fontFamily: form.font_family || 'inherit' }}
                  dangerouslySetInnerHTML={{ __html: form.description }}
                />
              )}
            </div>
          </div>

          {children}

          <div className="text-center mt-4 text-sm text-gray-500">Powered by eForms</div>
        </div>
      </div>
    </>
  )
}

export function PageProgress({ position, total, color }) {
  if (total <= 1) return null
  const at = Math.max(position, 1)
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-6 py-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium" style={{ color }}>
          Trang {at} / {total}
        </span>
        <div className="flex-1 mx-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${(at / total) * 100}%`, backgroundColor: color }}></div>
          </div>
        </div>
      </div>
    </div>
  )
}
