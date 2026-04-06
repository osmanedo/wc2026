import { useState } from 'react'
import { supabase } from '../lib/supabase'
import './GroupPanel.css'

export default function GroupPanel({ user, onClose }) {
  const [mode, setMode] = useState('join')
  const [groupName, setGroupName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [message, setMessage] = useState('')

  const handleCreate = async () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    const { data: group, error: groupError } = await supabase
      .from("groups")
      .insert({ name: groupName, code: code, created_by: user.id })
      .select()
      .single()

    if (groupError) { setMessage("Error creating group"); return }

    await supabase.from("group_members").insert({ group_id: group.id, user_id: user.id })
    setMessage(`Group created! Share this code: ${code}`)
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
    setMessage(`Joined "${group.name}" successfully!`)
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