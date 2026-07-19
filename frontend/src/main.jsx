import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from "@vercel/analytics/react"
import './index.css'
import App from './App.jsx'
import WrappedPreview from './pages/WrappedPreview.jsx'
import WrappedSharePreview from './pages/WrappedSharePreview.jsx'

// Hidden, unlinked test routes for previewing Wrapped panel/share states that
// depend on the final's outcome. The app has no router, so dispatch on
// pathname here. Strictly additive — App's production trigger logic is
// untouched and these paths are reachable only by typing the URL.
const path = window.location.pathname
const root =
  path === '/wrapped-preview' ? <WrappedPreview />
  : path === '/wrapped-share-preview' ? <WrappedSharePreview />
  : (
    <>
      <App />
      <Analytics />
    </>
  )

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {root}
  </StrictMode>,
)

// Register service worker for PWA offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failed — app still works online
    })
  })
}
