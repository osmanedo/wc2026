import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import './AIBrief.css'

export default function AIBrief({ matchId, isFinished, onClose }) {
  const [brief, setBrief] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchBrief() {
      setLoading(true)
      const { data, error } = await supabase
        .from('ai_briefs')
        .select('pre_match_brief, post_match_summary, generated_at')
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

  // Show post-match summary if match is finished and summary exists
  const displayText = brief && isFinished && brief.post_match_summary
    ? brief.post_match_summary
    : brief?.pre_match_brief

  const label = brief && isFinished && brief.post_match_summary
    ? 'Post-Match Summary'
    : 'Pre-Match Brief'

  return (
    <div className="ai-brief-overlay" onClick={onClose}>
      <div className="ai-brief-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ai-brief-header">
          <span className="ai-brief-title"> {label}</span>
          <button className="ai-brief-close" onClick={onClose}>✕</button>
        </div>

        <div className="ai-brief-body">
          {loading && <p className="ai-brief-loading">Loading brief...</p>}
          {error && <p className="ai-brief-error">{error}</p>}
          {brief && (
            <>
              <p className="ai-brief-text">{displayText}</p>

              {/* If finished, also show the original pre-match brief below */}
              {isFinished && brief.post_match_summary && brief.pre_match_brief && (
                <div className="ai-brief-divider">
                  <span className="ai-brief-sublabel">Pre-Match Brief</span>
                  <p className="ai-brief-text ai-brief-secondary">{brief.pre_match_brief}</p>
                </div>
              )}

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