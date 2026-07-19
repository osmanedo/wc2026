import WrappedShareCard from '../components/WrappedShareCard'
import { getSampleData, SAMPLE_STATES, stateFromUrl } from './wrappedSampleData'

// Hidden test route: renders WrappedShareCard at its native 1080×1920 size
// in-viewport (not off-screen) so share-card variants can be eyeballed without
// triggering the modal. Reachable only via /wrapped-share-preview?state=<v>.
export default function WrappedSharePreview() {
  const state = stateFromUrl()
  const data = getSampleData(state)

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#111',
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16,
    }}>
      <div style={{
        color: '#f4f7f5',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 14,
        opacity: 0.7,
      }}>
        share-card preview — state: <strong>{state}</strong> ·{' '}
        {SAMPLE_STATES.map(s => (
          <a key={s} href={`?state=${s}`} style={{ color: '#52b788', marginRight: 8 }}>{s}</a>
        ))}
      </div>
      {/* Native size, no ref needed — just eyeballing the layout. */}
      <WrappedShareCard data={data} />
    </div>
  )
}
