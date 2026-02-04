import React from 'react'

export const Modal: React.FC<{
  title: string
  onClose: () => void
  children: React.ReactNode
}> = ({ title, onClose, children }) => {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
