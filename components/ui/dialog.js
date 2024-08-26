import React from 'react';
import ReactDOM from 'react-dom';

export function Dialog({ open, onOpenChange, children }) {
  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6 overflow-auto">
        {children}
      </div>
    </div>,
    document.body
  );


}
export function DialogContent({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}




export function DialogFooter({ children }) {
  return <div className="border-t p-4 flex justify-end gap-2">
    {children}
  </div>;
}

export function DialogTitle({ children, className = "" }) {
  return <h3 className={`text-lg font-medium ${className}`}>{children}</h3>;
}



export function DialogHeader({ children, color = "text-gray-800" }) {
  return (
    <div className="border-b p-4">
      <h2 className={`text-xl font-semibold ${color}`}>{children}</h2>
    </div>
  );

  
}

