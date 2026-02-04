import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './ui/App'
import { RunProvider } from './run/store'
import './ui/styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RunProvider>
      <App />
    </RunProvider>
  </React.StrictMode>
)
