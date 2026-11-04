import React from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './styles.css'
import App from './App'

try {
  document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark'
} catch { /* storage blocked */ }

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
