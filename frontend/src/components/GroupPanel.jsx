import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function GroupPanel({ user, onClose }) {
  const [mode, setMode] = useState('join') // 'join' or 'create'
  const [groupName, setGroupName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [message, setMessage] = useState('')

  const handleCreate = async () => {
    // 1. Generate a random 6-character code
    // 2. Insert into groups table
    // 3. Insert into group_members (creator auto-joins)
    // 4. Show the code to the user
  }

  const handleJoin = async () => {
    // 1. Look up the group by code
    // 2. Insert into group_members
    // 3. Show success message
  }

  return (
    <div>
      {/* Toggle between join and create */}
      {/* Form for whichever mode is active */}
      {/* Message display */}
      {/* Close button */}
    </div>
  )
}