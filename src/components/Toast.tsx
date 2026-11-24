import React, { createContext, useContext, useState } from 'react';

interface ToastContextType {
  showToast: (msg: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [msg, setMsg] = useState<string | null>(null);

  const showToast = (text: string) => {
    setMsg(text);
    setTimeout(() => {
      setMsg(null);
    }, 2500);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {msg && (
        <div className="fixed left-1/2 bottom-6 -translate-x-1/2 bg-ink text-bg px-4 py-2.5 rounded-[10px] font-semibold text-sm z-50 shadow-lg animate-fade-in">
          {msg}
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
