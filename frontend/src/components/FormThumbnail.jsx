import { FileText } from 'lucide-react'

export default function FormThumbnail({ form }) {
  const thumbnailUrl = form.thumbnail_url || form.thumbnail
  if (thumbnailUrl) {
    return (
      <div 
        className="w-full h-full relative bg-gray-100 overflow-hidden" 
        style={{ aspectRatio: '16/9' }}
      >
        <img 
          src={thumbnailUrl} 
          alt={form.title}
          style={{ 
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'top center',
            display: 'block'
          }}
          onError={(e) => {
            e.target.style.display = 'none'
            const parent = e.target.parentElement
            if (parent) {
              parent.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gray-100" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; aspect-ratio: 16/9;"><svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>'
            }
          }}
        />
      </div>
    )
  }

  // Render mini preview của form
  const fields = form.fields || []
  const hasFields = fields.length > 0

  return (
    <div className="w-full bg-gradient-to-br from-blue-50 to-white overflow-hidden relative" style={{ aspectRatio: '16/9' }}>
      {/* Form Header Preview */}
      <div className="p-3 bg-primary-600 text-white">
        <div className="h-2 bg-white/30 rounded w-3/4 mb-1"></div>
        <div className="h-1.5 bg-white/20 rounded w-1/2"></div>
      </div>

      {/* Form Content Preview */}
      <div className="p-3 space-y-2">
        {hasFields ? (
          <>
            {fields.slice(0, 3).map((field, index) => (
              <div key={index} className="bg-white rounded border border-gray-200 p-2 shadow-sm">
                <div className="h-1.5 bg-gray-300 rounded w-2/3 mb-1.5"></div>
                {field.type === 'text' || field.type === 'email' || field.type === 'number' ? (
                  <div className="h-1 bg-gray-100 rounded w-full"></div>
                ) : field.type === 'textarea' ? (
                  <>
                    <div className="h-1 bg-gray-100 rounded w-full mb-0.5"></div>
                    <div className="h-1 bg-gray-100 rounded w-full mb-0.5"></div>
                    <div className="h-1 bg-gray-100 rounded w-3/4"></div>
                  </>
                ) : field.type === 'radio' || field.type === 'checkbox' ? (
                  <div className="space-y-1">
                    <div className="flex items-center space-x-1">
                      <div className="w-1.5 h-1.5 rounded-full border border-gray-300"></div>
                      <div className="h-1 bg-gray-100 rounded w-1/4"></div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-1.5 h-1.5 rounded-full border border-gray-300"></div>
                      <div className="h-1 bg-gray-100 rounded w-1/3"></div>
                    </div>
                  </div>
                ) : field.type === 'select' ? (
                  <div className="h-1.5 bg-gray-100 rounded w-full border border-gray-200"></div>
                ) : (
                  <div className="h-1 bg-gray-100 rounded w-full"></div>
                )}
              </div>
            ))}
            {fields.length > 3 && (
              <div className="text-center">
                <div className="inline-block h-1 bg-gray-200 rounded w-8"></div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-20">
            <FileText className="w-8 h-8 text-gray-300" />
          </div>
        )}
      </div>

      {/* Overlay on hover */}
      <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-5 transition-opacity pointer-events-none"></div>
    </div>
  )
}

