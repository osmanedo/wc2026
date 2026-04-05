import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function GroupPanel({ user, onClose }) {
  const [mode, setMode] = useState('join')
  const [groupName, setGroupName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [message, setMessage] = useState('')

  const handleCreate = async () => {
    // Generate random 6-character code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()

    // Insert the group
    const { data: group, error: groupError } = await supabase
      .from("groups")
      .insert({ name: groupName, code: code, created_by: user.id })
      .select()
      .single()

    if (groupError) {
      setMessage("Error creating group: " + groupError.message)
      return
    }

    // Auto-join creator to the group
    const { error: memberError } = await supabase
      .from("group_members")
      .insert({ group_id: group.id, user_id: user.id })

    if (memberError) {
      setMessage("Error joining group: " + memberError.message)
      return
    }

    setMessage(`Group created! Share this code with friends: ${code}`)
  }

  const handleJoin = async () => {
    // Find group by code
    const { data: group, error: findError } = await supabase
      .from("groups")
      .select("*")
      .eq("code", joinCode.toUpperCase())
      .single()

    if (findError || !group) {
      setMessage("Group not found — check the code and try again")
      return
    }

    // Join the group
    const { error: joinError } = await supabase
      .from("group_members")
      .insert({ group_id: group.id, user_id: user.id })

    if (joinError) {
      setMessage("Error joining — you may already be in this group")
      return
    }

    setMessage(`Joined "${group.name}" successfully!`)
  }

  return (
    <div>
      {/* Toggle */}
      <div>
        <button onClick={() => setMode('join')}>Join a Group</button>
        <button onClick={() => setMode('create')}>Create a Group</button>
      </div>

      {/* Create mode */}
      {mode === 'create' && (
        <div>
          <input
            type="text"
            placeholder="Group name (e.g. Dad's Work Crew)"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
          <button onClick={handleCreate}>Create Group</button>
        </div>
      )}

      {/* Join mode */}
      {mode === 'join' && (
        <div>
          <input
            type="text"
            placeholder="Enter join code (e.g. DAD2026)"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
          />
          <button onClick={handleJoin}>Join Group</button>
        </div>
      )}

      {/* Message */}
      {message && <p>{message}</p>}

      {/* Close */}
      <button onClick={onClose}>Close</button>
    </div>
  )
}