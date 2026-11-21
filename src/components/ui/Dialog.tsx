import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button, IconButton } from "./primitives";

/**
 * Custom hook implementing WCAG 2.2 AA compliant keyboard focus trapping
 * and previous focus restoration for modal dialogs and slide-over drawers.
 */
function useDialogFocusTrap(open: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    // Capture the active element that opened the dialog
    triggerElementRef.current = document.activeElement as HTMLElement | null;

    const getFocusableElements = (): HTMLElement[] => {
      if (!containerRef.current) return [];
      const selector =
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      return Array.from(containerRef.current.querySelectorAll<HTMLElement>(selector)).filter(
        (el) => el.offsetParent !== null || el.getClientRects().length > 0
      );
    };

    // Place initial focus on the first interactive element or container
    const frameId = requestAnimationFrame(() => {
      const focusable = getFocusableElements();
      if (focusable.length > 0) {
        focusable[0].focus();
      } else if (containerRef.current) {
        containerRef.current.focus();
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        const focusable = getFocusableElements();
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (
            document.activeElement === first ||
            !containerRef.current?.contains(document.activeElement)
          ) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (
            document.activeElement === last ||
            !containerRef.current?.contains(document.activeElement)
          ) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("keydown", handleKeyDown);
      // Restore focus to original trigger element upon close
      if (triggerElementRef.current && typeof triggerElementRef.current.focus === "function") {
        triggerElementRef.current.focus();
      }
    };
  }, [open, onClose]);

  return containerRef;
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: DialogProps) {
  const containerRef = useDialogFocusTrap(open, onClose);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[var(--orbit-z-modal)] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="orbit-dialog-title"
    >
      <div
        className="fixed inset-0 bg-[var(--orbit-backdrop)]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={containerRef}
        tabIndex={-1}
        className="relative w-full max-w-lg rounded-[var(--orbit-radius-lg)] bg-[var(--orbit-surface)] border border-[var(--orbit-border)] shadow-[var(--orbit-shadow-lg)] overflow-hidden focus:outline-none"
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[var(--orbit-border-subtle)]">
          <div>
            <h2
              id="orbit-dialog-title"
              className="text-lg font-semibold text-[var(--orbit-text-primary)]"
            >
              {title}
            </h2>
            {description ? (
              <p className="text-sm text-[var(--orbit-text-secondary)] mt-1">{description}</p>
            ) : null}
          </div>
          <IconButton label="Close dialog" onClick={onClose}>
            <X className="w-5 h-5" />
          </IconButton>
        </div>

        <div className="p-5">{children}</div>

        {footer ? (
          <div className="px-5 py-4 border-t border-[var(--orbit-border-subtle)] bg-[var(--orbit-surface-inset)] flex flex-wrap items-center justify-end gap-2">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-base text-[var(--orbit-text-secondary)] leading-relaxed">{description}</p>
    </Dialog>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  side = "left",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: "left" | "right";
  children: React.ReactNode;
}) {
  const containerRef = useDialogFocusTrap(open, onClose);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[var(--orbit-z-drawer)] flex"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {side === "right" ? (
        <div
          className="flex-1 bg-[var(--orbit-backdrop)]"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}
      <div
        ref={containerRef}
        tabIndex={-1}
        className="w-72 max-w-[85vw] bg-[var(--orbit-surface)] border-r border-[var(--orbit-border)] shadow-[var(--orbit-shadow-lg)] flex flex-col h-full focus:outline-none"
      >
        <div className="h-[var(--orbit-header-height)] px-4 flex items-center justify-between border-b border-[var(--orbit-border-subtle)]">
          <span className="text-base font-semibold text-[var(--orbit-text-primary)]">{title}</span>
          <IconButton label="Close panel" onClick={onClose}>
            <X className="w-5 h-5" />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto p-3">{children}</div>
      </div>
      {side === "left" ? (
        <div
          className="flex-1 bg-[var(--orbit-backdrop)]"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}
