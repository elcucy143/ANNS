import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

window.dataLayer = window.dataLayer || []
window.gtag = function gtag() { window.dataLayer.push(arguments) }
window.gtag('js', new Date())
window.gtag('config', 'G-430T1WWG2Q')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
