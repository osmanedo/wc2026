import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import './GroupPanel.css'

const APP_URL = 'https://wc2026fantasy.app'

export default function GroupPanel({ user, onClose, initialJoinCode }) {
  // If there's a pending join code, default to join mode with it pre-filled
  const [mode, setMode] = useState(initialJoinCode ? 'join' : 'join')
  const [groupName, setGroupName] = useState('')
  const [joinCode, setJoinCode] = useState(initialJoinCode ?? '')
  const [message, setMessage] = useState('')
  const [createdCode, setCreatedCode] = useState(null)   // NEW — tracks the share card state
  const [copied, setCopied] = useState(false)             // NEW — for copy feedback

  // NEW — if a deep link code was passed in, prompt the user immediately
  useEffect(() => {
    if (initialJoinCode) {
      setJoinCode(initialJoinCode)
      setMode('join')
    }
  }, [initialJoinCode])

  const handleCreate = async () => {
    if (!groupName.trim()) {
      setMessage("Group name cannot be blank")
      return
    }

    const { data: existing } = await supabase
      .from("groups")
      .select("id")
      .ilike("name", groupName.trim())
      .limit(1)

    if (existing?.length > 0) {
      setMessage("A group with that name already exists")
      return
    }

    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    const { data: group, error: groupError } = await supabase
      .from("groups")
      .insert({ name: groupName.trim(), code: code, created_by: user.id })
      .select()
      .single()

    if (groupError) { setMessage("Error creating group"); return }

    await supabase.from("group_members").insert({ group_id: group.id, user_id: user.id })
    
    // NEW — instead of a plain message, show the share card
    setCreatedCode(code)
    setMessage('')
  }

  const handleJoin = async () => {
    const { data: group, error } = await supabase
      .from("groups").select("*")
      .eq("code", joinCode.toUpperCase())
      .single()

    if (error || !group) { setMessage("Group not found — check the code"); return }

    const { error: joinError } = await supabase
      .from("group_members")
      .insert({ group_id: group.id, user_id: user.id })

    if (joinError) { setMessage("You may already be in this group"); return }

    // NEW — clear the stashed code after a successful join
    sessionStorage.removeItem('pendingJoinCode')
    setMessage(`Joined "${group.name}" successfully!`)
  }

  // NEW — share helpers
  const shareLink = createdCode ? `${APP_URL}/?join=${createdCode}` : ''
  const shareText = `Join my WC2026 tipping group! ⚽🏆\n${shareLink}`

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

  // NEW — if a group was just created, show the share card instead of the form
  if (createdCode) {
    return (
      <div className="group-panel">
        <h3 className="panel-title">Group Created! 🎉</h3>
        <p className="panel-message" style={{ marginBottom: 12 }}>
          Share this link with your mates — they'll be added automatically:
        </p>
        <div className="share-card">
          <div className="share-link">{shareLink}</div>
          <div className="share-buttons">
            <button className="panel-submit-btn" onClick={handleShare}>
              {navigator.share ? '📤 Share' : '📋 Copy Invite'}
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
    <div className="group-panel">
      <h3 className="panel-title">
        {mode === 'create' ? 'Create a Group' : 'Join a Group'}
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
            placeholder="Group name (e.g. Dad's Crew)"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
          <button className="panel-submit-btn" onClick={handleCreate}>
            Create Group
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
            Join Group
          </button>
        </>
      )}

      {message && <p className="panel-message">{message}</p>}
      <button className="panel-close-btn" onClick={onClose}>Cancel</button>
    </div>
  )
}