import QuestionInput, { choiceHint } from './QuestionInput'
import { NON_ANSWER_TYPES } from '../../utils/formStructure'
import { variantInfo } from '../../utils/formRuntime'

const cardClass = 'bg-white rounded-lg border border-gray-200 p-6 transition-all duration-200 hover:shadow-md'

function Html({ html, className, style }) {
  return html ? <div className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} /> : null
}

/** Block heading: full on the variant's first page, a reminder of the variant on later pages. */
function BlockBanner({ header, variant, full, theme }) {
  const info = variantInfo(header, variant)
  const color = theme.primary_color || '#4285F4'
  return (
    <div className={`${cardClass} eforms-block-banner`} style={{ borderTop: `4px solid ${color}` }}>
      {header.label && <h3 className="text-lg font-semibold text-gray-900">{header.label}</h3>}
      {full && <Html html={header.description} className="text-sm text-gray-600 mt-1" />}
      {info.title && (
        <p className="mt-3 text-gray-900" style={{ fontSize: theme.question_font_size || '16px' }}>
          {info.label}: <strong data-variant-title>{info.title}</strong>
        </p>
      )}
      {full && <Html html={info.description} className="text-sm text-gray-600 mt-1" />}
    </div>
  )
}

/**
 * Renders one page of evaluated instances (see utils/formRuntime.js paginate).
 * `headers` maps block keys to their random_section field, for the reminder on later pages.
 */
export default function FormPageView({ page, headers, answers, errors, onChange, theme }) {
  const items = page.items.filter((i) => i.visible && i.field.type !== 'random_section')
  const opensVariant = page.items.some((i) => i.field.type === 'random_section')
  const header = page.group ? headers[page.group] : null

  return (
    <>
      {header && page.variant && <BlockBanner header={header} variant={page.variant} full={opensVariant} theme={theme} />}
      {items.map((inst) => (
        <QuestionCard
          key={inst.answerKey}
          inst={inst}
          value={answers[inst.answerKey]}
          error={errors[inst.answerKey]}
          onChange={(v) => onChange(inst.answerKey, v)}
          theme={theme}
        />
      ))}
    </>
  )
}

function QuestionCard({ inst, value, error, onChange, theme }) {
  const { field } = inst

  if (NON_ANSWER_TYPES.includes(field.type)) {
    return (
      <div className={cardClass}>
        <StaticContent field={field} />
      </div>
    )
  }

  const hint = choiceHint(field)
  return (
    <div
      className={`${cardClass} ${error ? 'border-red-400 ring-1 ring-red-200' : ''}`}
      data-answer-key={inst.answerKey}
      data-error={error ? 'true' : undefined}
    >
      <div className="space-y-3">
        <div
          className="block font-bold text-gray-900"
          style={{
            fontSize: theme.question_font_size || '16px',
            fontFamily: theme.font_family || 'inherit',
          }}
        >
          {field.label}
          {field.is_required && <span className="text-red-500 ml-1">*</span>}
        </div>
        {field.help_text && (
          <p className="text-gray-500 whitespace-pre-line" style={{ fontSize: theme.text_font_size || '14px', fontFamily: theme.font_family || 'inherit' }}>
            {field.help_text}
          </p>
        )}
        {hint && <p className="text-sm italic text-gray-500">{hint}</p>}
        <div className="mt-4">
          <QuestionInput field={field} name={inst.answerKey} value={value} onChange={onChange} error={error} piped={inst.piped} />
        </div>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      </div>
    </div>
  )
}

function StaticContent({ field }) {
  switch (field.type) {
    case 'section':
      return (
        <div className="border-b border-gray-200 pb-2 -mb-2">
          <h3 className="text-lg font-semibold text-gray-900">{field.label}</h3>
          <Html html={field.description} className="text-sm text-gray-600 mt-1" />
        </div>
      )
    case 'description':
      return (
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{field.label}</h3>
          <Html html={field.description} className="text-sm text-gray-600 mt-1" />
        </div>
      )
    case 'image':
      return field.image_url ? (
        <img src={field.image_url} alt={field.label || 'Image'} className="max-w-full h-auto rounded" style={{ maxHeight: '400px' }} />
      ) : null
    case 'video':
      return field.video_url ? (
        <div className="w-full aspect-video">
          <iframe
            src={field.video_url.replace('watch?v=', 'embed/')}
            title={field.label || 'Video'}
            className="w-full h-full rounded"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : null
    default:
      return null
  }
}
