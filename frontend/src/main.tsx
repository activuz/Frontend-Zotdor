import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerServiceWorker } from './features/notifications/push'

// Push notifications, the cached app shell and the offline page (public/sw.js, FR-20).
registerServiceWorker()

// A shell cached before a deploy may ask for a chunk the new deploy no longer has. Reloading
// once picks up the fresh index.html the service worker has fetched meanwhile.
window.addEventListener('vite:preloadError', (event) => {
  if (sessionStorage.getItem('zotdor-chunk-reload')) return
  sessionStorage.setItem('zotdor-chunk-reload', '1')
  event.preventDefault()
  window.location.reload()
})
window.addEventListener('load', () => {
  window.setTimeout(() => sessionStorage.removeItem('zotdor-chunk-reload'), 30_000)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
