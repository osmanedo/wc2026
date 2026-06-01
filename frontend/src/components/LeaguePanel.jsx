import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import './LeaguePanel.css'

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const CopyIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
)

const ShareIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
    <polyline points="16 6 12 2 8 6"/>
    <line x1="12" y1="2" x2="12" y2="15"/>
  </svg>
)

const APP_URL = 'https://wc2026fantasy.app'

export default function LeaguePanel({ user, onClose, initialJoinCode }) {
  // If there's a pending join code, default to join mode with it pre-filled
  const [mode, setMode] = useState(initialJoinCode ? 'join' : 'join')
  const [leagueName, setLeagueName] = useState('')
  const [joinCode, setJoinCode] = useState(initialJoinCode ?? '')
  const [message, setMessage] = useState('')
  const [createdCode, setCreatedCode] = useState(null)
  const [copied, setCopied] = useState(false)
  const [joining, setJoining] = useState(Boolean(initialJoinCode))
  const autoJoinedRef = useRef(false)

  // If a deep link code was passed in, auto-join immediately
  useEffect(() => {
    if (!initialJoinCode || autoJoinedRef.current) return
    autoJoinedRef.current = true
    setJoinCode(initialJoinCode)
    setMode('join')
    handleJoin(initialJoinCode, { autoClose: true })
  }, [initialJoinCode])

  const handleCreate = async () => {
    if (!leagueName.trim()) {
      setMessage("League name cannot be blank")
      return
    }

    const { data: existing } = await supabase
      .from("groups")
      .select("id")
      .ilike("name", leagueName.trim())
      .limit(1)

    if (existing?.length > 0) {
      setMessage("A league with that name already exists")
      return
    }

    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    const { data: league, error: leagueError } = await supabase
      .from("groups")
      .insert({ name: leagueName.trim(), code: code, created_by: user.id })
      .select()
      .single()

    if (leagueError) { setMessage("Error creating league"); return }

    await supabase.from("group_members").insert({ group_id: league.id, user_id: user.id })

    setCreatedCode(code)
    setMessage('')
  }

  const handleJoin = async (codeOverride, opts = {}) => {
    const code = (codeOverride ?? joinCode).toUpperCase()
    const { data: league, error } = await supabase
      .from("groups").select("*")
      .eq("code", code)
      .single()

    if (error || !league) {
      setMessage("League not found — check the code")
      sessionStorage.removeItem('pendingJoinCode')
      setJoining(false)
      return
    }

    const { error: joinError } = await supabase
      .from("group_members")
      .insert({ group_id: league.id, user_id: user.id })

    if (joinError) {
      setMessage("You may already be in this league")
      sessionStorage.removeItem('pendingJoinCode')
      setJoining(false)
      return
    }

    sessionStorage.removeItem('pendingJoinCode')
    setMessage(`Joined "${league.name}" successfully!`)
    setJoining(false)
    if (opts.autoClose) {
      setTimeout(() => onClose?.(), 1500)
    }
  }

  const shareLink = createdCode ? `${APP_URL}/?join=${createdCode}` : ''
  const shareText = `Join my WC2026 Fantasy League!\n${shareLink}`

  const handleShare = async () => {
    try {
      await navigator.share({ text: shareText })
    } catch (err) {
      // User cancelled the share sheet — that's fine
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // If we're auto-joining via a deep link, show a minimal status state
  if (joining) {
    return (
      <div className="league-panel">
        <h3 className="panel-title">Joining league…</h3>
        <p className="panel-message">Adding you to <strong>{(initialJoinCode ?? joinCode).toUpperCase()}</strong></p>
        {message && <p className="panel-message">{message}</p>}
      </div>
    )
  }

  // If a league was just created, show the share card instead of the form
  if (createdCode) {
    return (
      <div className="league-panel">
        <div className="success-badge"><CheckIcon /> League Created</div>
        <h3 className="panel-title">Invite your mates</h3>
        <p className="panel-message">
          Share this link — they'll be added automatically:
        </p>
        <div className="share-card">
          <div className="share-input-row">
            <input className="share-input-field" readOnly value={shareLink} />
            <button className="copy-icon-btn" onClick={handleCopyLink} title={copied ? 'Copied!' : 'Copy link'}>
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          </div>
          {navigator.share && (
            <button className="panel-submit-btn share-native-btn" onClick={handleShare}>
              <ShareIcon /> Share with mates
            </button>
          )}
        </div>
        <button className="panel-close-btn" onClick={onClose}>Done</button>
      </div>
    )
  }

  return (
    <div className="league-panel">
      <h3 className="panel-title">
        {mode === 'create' ? 'Create a League' : 'Join a League'}
      </h3>

      <div className="mode-toggle">
        <button
          className={`mode-btn ${mode === 'join' ? 'active' : ''}`}
          onClick={() => setMode('join')}>
          Join
        </button>
        <button
          className={`mode-btn ${mode === 'create' ? 'active' : ''}`}
          onClick={() => setMode('create')}>
          Create
        </button>
      </div>

      {mode === 'create' && (
        <>
          <input
            className="panel-input"
            type="text"
            placeholder="League name (e.g. Yum Yum FC)"
            value={leagueName}
            onChange={(e) => setLeagueName(e.target.value)}
          />
          <button className="panel-submit-btn" onClick={handleCreate}>
            Create League
          </button>
        </>
      )}

      {mode === 'join' && (
        <>
          <input
            className="panel-input"
            type="text"
            placeholder="Enter join code (e.g. ABC123)"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
          />
          <button className="panel-submit-btn" onClick={() => handleJoin()}>
            Join League
          </button>
        </>
      )}

      {message && <p className="panel-message">{message}</p>}
      <button className="panel-close-btn" onClick={onClose}>Cancel</button>
    </div>
  )
}
