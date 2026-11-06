import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

const ToastContext = createContext<(text: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState<string | null>(null);
  const show = useCallback((t: string) => {
    setText(t);
    setTimeout(() => setText(null), 2200);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {text && <div className="toast" role="status">{text}</div>}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
