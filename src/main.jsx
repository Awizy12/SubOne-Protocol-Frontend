import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

import { AppKit } from '@circle-fin/app-kit'

// Initialize the Circle AppKit Engine
const kit = new AppKit({
  apiKey: 'TEST_CLIENT_KEY:66737f59d4f5daeb47ae566d1a791116:5ce39959b99372c173f1a90b30f1ca5f' // <-- Replace this with your actual Circle Developer Client Key
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)