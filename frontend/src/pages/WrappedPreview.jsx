import { useState } from 'react'
import WrappedModal from '../components/WrappedModal'
import { getSampleData, SAMPLE_STATES, stateFromUrl } from './wrappedSampleData'

// Hidden test route: renders WrappedModal with hardcoded sample data, bypassing
// ALL trigger logic (auth, final-status gate, localStorage, RPC). Reachable
// only by typing /wrapped-preview?state=<variant>. Not linked anywhere.
export default function WrappedPreview() {
  const state = stateFromUrl()
  const [open, setOpen] = useState(true)
  const data = getSampleData(state)

  return (
    <div style={{ minHeight: '100dvh', background: '#05201a' }}>
      {open ? (
        <WrappedModal data={data} onClose={() => setOpen(false)} />
      ) : (
        <div style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          color: '#f4f7f5',
          fontFamily: "'DM Sans', sans-serif",
        }}>
          <div style={{ opacity: 0.7 }}>preview closed — state: <strong>{state}</strong></div>
          <button
            onClick={() => setOpen(true)}
            style={{
              background: '#52b788', color: '#052018', border: 'none',
              borderRadius: 999, padding: '12px 28px', fontWeight: 700,
              fontFamily: "'Syne', sans-serif", fontSize: 15,
            }}
          >
            reopen
          </button>
          <div style={{ opacity: 0.5, fontSize: 13, marginTop: 8 }}>
            states: {SAMPLE_STATES.map(s => (
              <a key={s} href={`?state=${s}`} style={{ color: '#52b788', marginRight: 10 }}>{s}</a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
