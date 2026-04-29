import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import './LeaguePanel.css'

const APP_URL = 'https://wc2026fantasy.app'

export default function LeaguePanel({ user, onClose, initialJoinCode }) {
  // If there's a pending join code, default to join mode with it pre-filled
  const [mode, setMode] = useState(initialJoinCode ? 'join' : 'join')
  const [leagueName, setLeagueName] = useState('')
  const [joinCode, setJoinCode] = useState(initialJoinCode ?? '')
  const [message, setMessage] = useState('')
  const [createdCode, setCreatedCode] = useState(null)
  const [copied, setCopied] = useState(false)

  // If a deep link code was passed in, prompt the user immediately
  useEffect(() => {
    if (initialJoinCode) {
      setJoinCode(initialJoinCode)
      setMode('join')
    }
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

  const handleJoin = async () => {
    const { data: league, error } = await supabase
      .from("groups").select("*")
      .eq("code", joinCode.toUpperCase())
      .single()

    if (error || !league) { setMessage("League not found — check the code"); return }

    const { error: joinError } = await supabase
      .from("group_members")
      .insert({ group_id: league.id, user_id: user.id })

    if (joinError) { setMessage("You may already be in this league"); return }

    sessionStorage.removeItem('pendingJoinCode')
    setMessage(`Joined "${league.name}" successfully!`)
  }

  const shareLink = createdCode ? `${APP_URL}/?join=${createdCode}` : ''
  const shareText = `Join my WC2026 Fantasy League! ⚽🏆\n${shareLink}`

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText })
      } catch (err) {
        // User cancelled the share sheet — that's fine
      }
    } else {
      handleCopy()
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // If a league was just created, show the share card instead of the form
  if (createdCode) {
    return (
      <div className="league-panel">
        <h3 className="panel-title">League Created! 🎉</h3>
        <p className="panel-message" style={{ marginBottom: 12 }}>
          Share this link with your mates — they'll be added automatically:
        </p>
        <div className="share-card">
          <div className="share-link">{shareLink}</div>
          <div className="share-buttons">
            <button className="panel-submit-btn" onClick={handleShare}>
              {navigator.share ? '🔗 Share' : '📋 Copy Invite'}
            </button>
            {navigator.share && (
              <button className="panel-close-btn" onClick={handleCopy} style={{ marginTop: 0 }}>
                {copied ? '✓ Copied!' : '📋 Copy'}
              </button>
            )}
          </div>
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
            placeholder="League name (e.g. Dad's Crew)"
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
          <button className="panel-submit-btn" onClick={handleJoin}>
            Join League
          </button>
        </>
      )}

      {message && <p className="panel-message">{message}</p>}
      <button className="panel-close-btn" onClick={onClose}>Cancel</button>
    </div>
  )
}
