import React, { createContext, useCallback, useContext, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastTone = "success" | "error" | "info";

interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  notify: (toast: Omit<ToastItem, "id">) => void;
}

const ToastContext = createContext<ToastContextValue>({
  notify: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-4 right-4 z-[var(--orbit-z-toast)] flex flex-col gap-2 w-full max-w-sm pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((item) => {
          const Icon =
            item.tone === "success"
              ? CheckCircle2
              : item.tone === "error"
              ? AlertCircle
              : Info;
          const color =
            item.tone === "success"
              ? "text-[var(--orbit-success)]"
              : item.tone === "error"
              ? "text-[var(--orbit-danger)]"
              : "text-[var(--orbit-primary)]";

          return (
            <div
              key={item.id}
              role="status"
              className="pointer-events-auto rounded-[var(--orbit-radius-md)] bg-[var(--orbit-surface-elevated)] border border-[var(--orbit-border)] shadow-[var(--orbit-shadow-md)] p-3.5 flex items-start gap-3"
            >
              <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${color}`} aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[var(--orbit-text-primary)]">
                  {item.title}
                </div>
                {item.description ? (
                  <div className="text-sm text-[var(--orbit-text-secondary)] mt-0.5">
                    {item.description}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="p-1.5 text-[var(--orbit-text-secondary)] hover:text-[var(--orbit-text-primary)] rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
