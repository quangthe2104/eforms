import { X } from 'lucide-react'

export default function FormPreview({ form, onClose }) {
  const renderField = (field) => {
    switch (field.type) {
      case 'short_text':
      case 'email':
      case 'url':
      case 'phone':
        return (
          <input
            type={field.type === 'short_text' ? 'text' : field.type}
            placeholder={field.placeholder}
            className="input"
            disabled
          />
        )
      
      case 'long_text':
        return (
          <textarea
            placeholder={field.placeholder}
            className="input"
            rows="4"
            disabled
          />
        )
      
      case 'number':
        return (
          <input
            type="number"
            placeholder={field.placeholder}
            className="input"
            disabled
          />
        )
      
      case 'date':
        return <input type="date" className="input" disabled />
      
      case 'time':
        return <input type="time" className="input" disabled />
      
      case 'datetime':
        return <input type="datetime-local" className="input" disabled />
      
      case 'dropdown':
        return (
          <select className="input" disabled>
            <option>Select an option</option>
            {field.options?.map((option, idx) => (
              <option key={idx}>{option}</option>
            ))}
          </select>
        )
      
      case 'radio':
        return (
          <div className="space-y-2">
            {field.options?.map((option, idx) => (
              <label key={idx} className="flex items-center space-x-2">
                <input type="radio" name={field.id} disabled />
                <span>{option}</span>
              </label>
            ))}
          </div>
        )
      
      case 'checkbox':
        return (
          <div className="space-y-2">
            {field.options?.map((option, idx) => (
              <label key={idx} className="flex items-center space-x-2">
                <input type="checkbox" disabled />
                <span>{option}</span>
              </label>
            ))}
          </div>
        )
      
      case 'file_upload':
        return (
          <input type="file" className="input" disabled />
        )
      
      case 'rating':
        return (
          <div className="flex space-x-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} className="text-2xl text-gray-300" disabled>
                ★
              </button>
            ))}
          </div>
        )
      
      case 'multiple_choice_grid':
      case 'checkbox_grid':
        return field.rows && field.columns ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr>
                  <th className="border border-gray-300 bg-gray-50 px-3 py-2 text-left text-sm font-medium text-gray-700"></th>
                  {field.columns.map((column, i) => (
                    <th key={i} className="border border-gray-300 bg-gray-50 px-3 py-2 text-center text-sm font-medium text-gray-700">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {field.rows.map((row, i) => (
                  <tr key={i}>
                    <td className="border border-gray-300 px-3 py-2 text-sm text-gray-700">
                      {row}
                    </td>
                    {field.columns.map((_, j) => (
                      <td key={j} className="border border-gray-300 px-3 py-2 text-center">
                        <input
                          type={field.type === 'checkbox_grid' ? 'checkbox' : 'radio'}
                          disabled
                          className="w-4 h-4"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null
      
      case 'scale':
        return (
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">1</span>
            <input type="range" min="1" max="10" className="flex-1" disabled />
            <span className="text-sm text-gray-600">10</span>
          </div>
        )
      
      case 'section':
        return (
          <div className="border-b border-gray-200 pb-2">
            <h3 className="text-lg font-semibold text-gray-900">{field.label}</h3>
            {field.help_text && (
              <p className="text-sm text-gray-600 mt-1">{field.help_text}</p>
            )}
          </div>
        )
      
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Form Preview</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="max-w-xl mx-auto">
            {/* Form Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {form.title || 'Untitled Form'}
              </h1>
              {form.description && (
                <p className="text-gray-600">{form.description}</p>
              )}
            </div>

            {/* Fields */}
            <div className="space-y-6">
              {form.fields?.length > 0 ? (
                form.fields.map((field) => (
                  <div key={field.id || field.order} className="space-y-2">
                    {field.type !== 'section' && (
                      <>
                        <label className="form-label">
                          {field.label}
                          {field.is_required && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </label>
                        {field.help_text && (
                          <p className="text-sm text-gray-500">{field.help_text}</p>
                        )}
                      </>
                    )}
                    {renderField(field)}
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <p>No fields added yet</p>
                </div>
              )}
            </div>

            {/* Submit Button */}
            {form.fields?.length > 0 && (
              <div className="mt-8">
                <button className="btn btn-primary w-full" disabled>
                  Submit
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

