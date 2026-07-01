import { useState, useEffect } from 'react'
import './LeaderboardFixNotice.css'

const STORAGE_KEY = 'leaderboard_fix_notice_seen_v1'

export default function LeaderboardFixNotice() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true)
    } catch {
      // localStorage unavailable (private mode etc.) — just don't show
    }
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // ignore write failure
    }
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="lfn-overlay" onClick={dismiss}>
      <div className="lfn-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="lfn-heading">leaderboard fix applied</h3>
        <p className="lfn-body">
          knockout advancement bonuses were not being included in leaderboard
          totals. this has now been corrected, so your total may increase.
          apologies for any inconvenience.
        </p>
        <button className="lfn-button" onClick={dismiss}>got it</button>
      </div>
    </div>
  )
}
