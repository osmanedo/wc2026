import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import './AIBrief.css'

export default function AIBrief({ matchId, onClose }) {
  const [brief, setBrief] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchBrief() {
      setLoading(true)
      const { data, error } = await supabase
        .from('ai_briefs')
        .select('pre_match_brief, generated_at')
        .eq('match_id', matchId)
        .single()

      if (error) {
        setError('No brief available for this match yet.')
      } else {
        setBrief(data)
      }
      setLoading(false)
    }

    fetchBrief()
  }, [matchId])

  return (
    <div className="ai-brief-overlay" onClick={onClose}>
      <div className="ai-brief-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ai-brief-header">
          <span className="ai-brief-title">AI Brief</span>
          <button className="ai-brief-close" onClick={onClose}>✕</button>
        </div>

        <div className="ai-brief-body">
          {loading && <p className="ai-brief-loading">Loading brief...</p>}
          {error && <p className="ai-brief-error">{error}</p>}
          {brief && (
            <>
              <p className="ai-brief-text">{brief.pre_match_brief.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')}</p>
              <p className="ai-brief-timestamp">
                Generated {new Date(brief.generated_at).toLocaleDateString(undefined, {
                  day: 'numeric', month: 'short', year: 'numeric'
                })}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}