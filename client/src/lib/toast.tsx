import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

export type ToastTone = 'info' | 'success' | 'warn' | 'error';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  push: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      seq.current += 1;
      const id = seq.current;
      setItems((current) => [...current.slice(-3), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 5200 : 3600);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`toast toast--${item.tone}`}
            onClick={() => dismiss(item.id)}
            title="Dismiss"
          >
            <span className="toast__dot" aria-hidden="true" />
            <span>{item.message}</span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
