import { supabase } from '../lib/supabase'

export default function Auth() {
  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    })
  }

  return (
    <button onClick={handleLogin}>
      Sign in with Google
    </button>
  )
}