import React, { useState, useCallback } from 'react';
import { uuid } from '../lib/format.js';

/* =========================================================================
   TOAST CONTEXT
   ========================================================================= */
export const ToastContext = React.createContext(null);
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type) => {
    const id = uuid();
    setToasts(t => [...t, { id, message, type }]);
    if (type === 'success') {
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
    }
  }, []);
  const dismiss = (id) => setToasts(t => t.filter(x => x.id !== id));
  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] space-y-2 no-print">
        {toasts.map(t => (
          <div key={t.id} className={`min-w-[280px] max-w-sm rounded-lg shadow-lg px-4 py-3 flex items-start gap-3 text-sm text-white ${t.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="opacity-80 hover:opacity-100">✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export function useToast() { return React.useContext(ToastContext); }
