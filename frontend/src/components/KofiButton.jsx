import { useState } from 'react'
import './KofiButton.css'

export default function KofiButton({ username }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button className="kofi-btn" onClick={() => setOpen(true)}>
        🍺 Shout the Dev a Beer
      </button>

      {open && (
        <div className="kofi-overlay" onClick={() => setOpen(false)}>
          <div className="kofi-modal" onClick={(e) => e.stopPropagation()}>
            <button className="kofi-close" onClick={() => setOpen(false)}>✕</button>
            <iframe
              src={`https://ko-fi.com/${username}/?hidefeed=true&widget=true&embed=true`}
              title="Support on Ko-fi"
              className="kofi-iframe"
            />
          </div>
        </div>
      )}
    </>
  )
}