import React from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const variants = {
    primary:
      "bg-[var(--orbit-primary)] text-[var(--orbit-on-primary)] font-semibold hover:bg-[var(--orbit-primary-hover)] active:bg-[var(--orbit-primary-active)] border border-transparent",
    secondary:
      "bg-[var(--orbit-surface-elevated)] text-[var(--orbit-text-primary)] font-medium hover:bg-[var(--orbit-active-surface)] border border-[var(--orbit-border)]",
    outline:
      "bg-transparent text-[var(--orbit-text-primary)] font-medium hover:bg-[var(--orbit-hover-surface)] border border-[var(--orbit-border)]",
    ghost:
      "bg-transparent text-[var(--orbit-text-secondary)] font-medium hover:text-[var(--orbit-text-primary)] hover:bg-[var(--orbit-hover-surface)] border border-transparent",
    danger:
      "bg-[var(--orbit-danger-tint)] text-[var(--orbit-danger)] font-medium hover:bg-[var(--orbit-danger)] hover:text-[var(--orbit-on-primary)] border border-[var(--orbit-danger)]/40",
  };

  // All interactive buttons enforce >= 44px touch target height (WCAG 2.2 AA)
  const sizes = {
    sm: "min-h-[44px] px-3.5 text-sm gap-2",
    md: "min-h-[44px] px-4 text-sm gap-2",
    lg: "min-h-[48px] px-5 text-base gap-2.5",
  };

  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--orbit-radius-md)] transition-colors duration-[var(--orbit-duration-fast)] whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: "ghost" | "secondary" | "danger";
}

export function IconButton({
  label,
  variant = "ghost",
  className,
  children,
  ...props
}: IconButtonProps) {
  const variants = {
    ghost:
      "text-[var(--orbit-text-secondary)] hover:text-[var(--orbit-text-primary)] hover:bg-[var(--orbit-hover-surface)] border border-transparent",
    secondary:
      "bg-[var(--orbit-surface-elevated)] text-[var(--orbit-text-primary)] hover:bg-[var(--orbit-active-surface)] border border-[var(--orbit-border)]",
    danger:
      "text-[var(--orbit-danger)] hover:bg-[var(--orbit-danger-tint)] border border-transparent",
  };

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-[var(--orbit-radius-md)] transition-colors duration-[var(--orbit-duration-fast)] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed shrink-0",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full min-h-[44px] rounded-[var(--orbit-radius-md)] bg-[var(--orbit-surface-inset)] border border-[var(--orbit-border)] px-3.5 text-base text-[var(--orbit-text-primary)] placeholder:text-[var(--orbit-text-muted)] hover:border-[var(--orbit-text-muted)] focus:border-[var(--orbit-primary)] transition-colors duration-[var(--orbit-duration-fast)]",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-[var(--orbit-radius-md)] bg-[var(--orbit-surface-inset)] border border-[var(--orbit-border)] p-3.5 text-base leading-relaxed text-[var(--orbit-text-primary)] placeholder:text-[var(--orbit-text-muted)] hover:border-[var(--orbit-text-muted)] focus:border-[var(--orbit-primary)] transition-colors duration-[var(--orbit-duration-fast)]",
        className
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "min-h-[44px] rounded-[var(--orbit-radius-md)] bg-[var(--orbit-surface-inset)] border border-[var(--orbit-border)] px-3 text-sm text-[var(--orbit-text-primary)] hover:border-[var(--orbit-text-muted)] focus:border-[var(--orbit-primary)] transition-colors duration-[var(--orbit-duration-fast)]",
        className
      )}
      {...props}
    />
  );
}

export function FormField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-[var(--orbit-text-primary)]"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-[var(--orbit-danger)] flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="text-sm text-[var(--orbit-text-secondary)]">{hint}</p>
      ) : null}
    </div>
  );
}

export function Panel({
  className,
  elevated = false,
  children,
}: {
  className?: string;
  elevated?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--orbit-radius-lg)] border border-[var(--orbit-border-subtle)]",
        elevated ? "bg-[var(--orbit-surface-elevated)]" : "bg-[var(--orbit-surface)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function InsetSurface({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--orbit-radius-md)] bg-[var(--orbit-surface-inset)] border border-[var(--orbit-border-subtle)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-[var(--orbit-border-subtle)]">
      <div className="min-w-0">
        <h1 className="text-[1.5rem] font-semibold text-[var(--orbit-text-primary)] tracking-tight">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-base text-[var(--orbit-text-secondary)] mt-1.5 prose-measure">
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0 flex flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function StatusIndicator({
  tone,
  label,
}: {
  tone: "success" | "warning" | "danger" | "info" | "neutral";
  label: string;
}) {
  const config = {
    success: { icon: CheckCircle2, color: "text-[var(--orbit-success)]" },
    warning: { icon: AlertTriangle, color: "text-[var(--orbit-warning)]" },
    danger: { icon: AlertCircle, color: "text-[var(--orbit-danger)]" },
    info: { icon: Info, color: "text-[var(--orbit-series-2)]" },
    neutral: { icon: Info, color: "text-[var(--orbit-text-secondary)]" },
  }[tone];
  const Icon = config.icon;

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", config.color)}>
      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function StatusNotice({
  tone = "info",
  title,
  message,
  action,
}: {
  tone?: "info" | "warning" | "error" | "success";
  title?: string;
  message: string;
  action?: React.ReactNode;
}) {
  const styles = {
    info: "bg-[var(--orbit-primary-tint)] border-[var(--orbit-primary)]/35",
    warning: "bg-[var(--orbit-warning-tint)] border-[var(--orbit-warning)]/35",
    error: "bg-[var(--orbit-danger-tint)] border-[var(--orbit-danger)]/40",
    success: "bg-[var(--orbit-success-tint)] border-[var(--orbit-success)]/35",
  };
  const iconTone = {
    info: "text-[var(--orbit-primary)]",
    warning: "text-[var(--orbit-warning)]",
    error: "text-[var(--orbit-danger)]",
    success: "text-[var(--orbit-success)]",
  };
  const Icon =
    tone === "error"
      ? AlertCircle
      : tone === "warning"
      ? AlertTriangle
      : tone === "success"
      ? CheckCircle2
      : Info;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-[var(--orbit-radius-md)] border p-4 flex flex-wrap items-start gap-3",
        styles[tone]
      )}
    >
      <Icon className={cn("w-5 h-5 mt-0.5 shrink-0", iconTone[tone])} aria-hidden="true" />
      <div className="flex-1 min-w-[200px]">
        {title ? (
          <div className="text-sm font-semibold text-[var(--orbit-text-primary)] mb-0.5">
            {title}
          </div>
        ) : null}
        <p className="text-sm text-[var(--orbit-text-secondary)] leading-relaxed">{message}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  nextStep,
  action,
}: {
  title: string;
  description: string;
  nextStep?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--orbit-radius-lg)] border border-dashed border-[var(--orbit-border)] bg-[var(--orbit-surface)] px-6 py-10 text-center">
      <h3 className="text-lg font-semibold text-[var(--orbit-text-primary)]">{title}</h3>
      <p className="text-base text-[var(--orbit-text-secondary)] mt-2 max-w-[52ch] mx-auto">
        {description}
      </p>
      {nextStep ? (
        <p className="text-sm text-[var(--orbit-text-muted)] mt-1 max-w-[52ch] mx-auto">
          {nextStep}
        </p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function LoadingState({
  title = "Computing",
  description = "Processing request with the ORBIT backend...",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-[var(--orbit-radius-lg)] border border-[var(--orbit-border-subtle)] bg-[var(--orbit-surface)] px-6 py-10 flex flex-col items-center text-center gap-3"
    >
      <Loader2 className="w-6 h-6 animate-spin text-[var(--orbit-primary)]" aria-hidden="true" />
      <div>
        <div className="text-base font-semibold text-[var(--orbit-text-primary)]">{title}</div>
        <p className="text-sm text-[var(--orbit-text-secondary)] mt-1">{description}</p>
      </div>
    </div>
  );
}

export function ErrorState({
  title = "Unable to load data",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <StatusNotice
      tone="error"
      title={title}
      message={message}
      action={
        onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Retry
          </Button>
        ) : undefined
      }
    />
  );
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
}: {
  items: Array<{ id: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap items-center gap-1 p-1 rounded-[var(--orbit-radius-md)] bg-[var(--orbit-surface-inset)] border border-[var(--orbit-border-subtle)]"
    >
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(item.id)}
            className={cn(
              "min-h-[44px] px-3.5 rounded-[var(--orbit-radius-sm)] text-sm font-medium transition-colors duration-[var(--orbit-duration-fast)] whitespace-nowrap cursor-pointer",
              selected
                ? "bg-[var(--orbit-surface-elevated)] text-[var(--orbit-text-primary)] border border-[var(--orbit-border)] shadow-[var(--orbit-shadow-sm)]"
                : "text-[var(--orbit-text-secondary)] hover:text-[var(--orbit-text-primary)] hover:bg-[var(--orbit-hover-surface)] border border-transparent"
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
