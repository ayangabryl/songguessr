import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { loadNootAsset } from './lib/noot/asset'
import App from './App.tsx'

// Decode the shared rig while React prepares solo, wardrobe or the table.
void loadNootAsset().catch(() => { /* Each stage provides its own retry UI. */ })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
