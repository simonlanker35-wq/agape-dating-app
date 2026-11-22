import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { isNative } from './utils/native'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// The store apps ship their files inside the app; the offline worker is only for the website
if ("serviceWorker" in navigator && !isNative) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
