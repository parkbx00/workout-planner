import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.tsx'
import { ensureSeeded } from './db/seed.ts'
import { requestPersistentStorage } from './lib/saveFile.ts'
import './index.css'

// Live queries re-render the UI when the seed lands, so there's no need to block the first paint on it.
void ensureSeeded()
// iOS can evict a web app's data; ask it not to. Backups are still the real safety net.
void requestPersistentStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
