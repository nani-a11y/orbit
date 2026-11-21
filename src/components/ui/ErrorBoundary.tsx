import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Copy, Check, RefreshCw, Home, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "./primitives";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error("[ORBIT Uncaught Runtime Error]:", error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleReset = (): void => {
    try {
      localStorage.removeItem("orbit_prefs");
    } catch {
      // Ignore storage errors
    }
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      showDetails: false,
    });
    window.location.href = "/";
  };

  handleCopyDiagnostics = async (): Promise<void> => {
    const { error, errorInfo } = this.state;
    const diagnostics = {
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      errorName: error?.name ?? "Error",
      errorMessage: error?.message ?? "Unknown error",
      stack: error?.stack ?? "",
      componentStack: errorInfo?.componentStack ?? "",
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    } catch {
      // Clipboard fallback
      const textArea = document.createElement("textarea");
      textArea.value = JSON.stringify(diagnostics, null, 2);
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    }
  };

  toggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, errorInfo, copied, showDetails } = this.state;

    return (
      <div
        role="alert"
        aria-live="assertive"
        className="min-h-screen bg-[var(--orbit-background)] text-[var(--orbit-text-primary)] flex items-center justify-center p-4 sm:p-8"
      >
        <div className="w-full max-w-2xl rounded-[var(--orbit-radius-lg)] bg-[var(--orbit-surface)] border border-[var(--orbit-border)] shadow-[var(--orbit-shadow-lg)] p-6 sm:p-8 space-y-6">
          <div className="flex items-start gap-4 pb-5 border-b border-[var(--orbit-border-subtle)]">
            <div className="p-3 rounded-[var(--orbit-radius-md)] bg-[var(--orbit-danger-tint)] text-[var(--orbit-danger)] shrink-0">
              <AlertTriangle className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="space-y-1 min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-[var(--orbit-text-primary)]">
                Application Runtime Error
              </h1>
              <p className="text-sm text-[var(--orbit-text-secondary)] leading-relaxed">
                ORBIT encountered an unexpected client runtime exception. Your simulation models
                persisted in SQLite remain safe.
              </p>
            </div>
          </div>

          <div className="rounded-[var(--orbit-radius-md)] bg-[var(--orbit-surface-inset)] border border-[var(--orbit-border-subtle)] p-4 space-y-2">
            <div className="text-xs uppercase tracking-wider font-semibold text-[var(--orbit-text-muted)]">
              Exception Message
            </div>
            <p className="font-mono text-sm text-[var(--orbit-danger)] break-words">
              {error?.name || "Error"}: {error?.message || "An unknown rendering error occurred."}
            </p>
          </div>

          {/* Recovery Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button variant="primary" onClick={this.handleReload}>
              <RefreshCw className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Reload Workspace</span>
            </Button>

            <Button variant="secondary" onClick={this.handleReset}>
              <Home className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Reset &amp; Return Home</span>
            </Button>

            <Button variant="outline" onClick={this.handleCopyDiagnostics}>
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-[var(--orbit-success)] shrink-0" aria-hidden="true" />
                  <span>Diagnostics Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Copy Diagnostic Report</span>
                </>
              )}
            </Button>
          </div>

          {/* Collapsible Technical Diagnostics */}
          <div className="pt-2 border-t border-[var(--orbit-border-subtle)]">
            <button
              type="button"
              onClick={this.toggleDetails}
              className="min-h-[44px] flex items-center gap-2 text-xs font-mono text-[var(--orbit-text-secondary)] hover:text-[var(--orbit-text-primary)] cursor-pointer"
              aria-expanded={showDetails}
            >
              {showDetails ? (
                <ChevronDown className="w-4 h-4 shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 shrink-0" />
              )}
              <span>{showDetails ? "Hide Stack Trace" : "Show Technical Stack Trace"}</span>
            </button>

            {showDetails && (
              <div className="mt-3 rounded-[var(--orbit-radius-md)] bg-[var(--orbit-surface-inset)] border border-[var(--orbit-border-subtle)] p-4 overflow-x-auto text-xs font-mono text-[var(--orbit-text-muted)] space-y-3 max-h-64">
                {error?.stack && (
                  <div>
                    <div className="text-[var(--orbit-text-secondary)] font-semibold mb-1">
                      Call Stack:
                    </div>
                    <pre className="whitespace-pre-wrap">{error.stack}</pre>
                  </div>
                )}
                {errorInfo?.componentStack && (
                  <div>
                    <div className="text-[var(--orbit-text-secondary)] font-semibold mb-1">
                      Component Stack:
                    </div>
                    <pre className="whitespace-pre-wrap">{errorInfo.componentStack}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}
