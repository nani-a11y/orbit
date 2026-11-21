import React from "react";
import {
  BookOpen,
  Database,
  Info,
  Moon,
  Server,
  ShieldCheck,
  Sliders,
  Sun,
} from "lucide-react";
import {
  Button,
  FormField,
  InsetSurface,
  Panel,
  SectionHeader,
  Select,
  StatusIndicator,
  StatusNotice,
} from "../components/ui/primitives";
import { useToast } from "../components/ui/Toast";
import { formatBytes } from "../lib/utils";
import type { HealthStatus, SolverType, ThemeMode } from "../types/orbit";

interface SettingsPageProps {
  health: HealthStatus | null;
  theme: ThemeMode;
  defaultSolver: SolverType;
  defaultPrecision: number;
  onChangeTheme: (next: ThemeMode) => void;
  onChangeDefaults: (next: { solver: SolverType; precision: number }) => void;
  onOpenDocumentation: () => void;
}

export function SettingsPage({
  health,
  theme,
  defaultSolver,
  defaultPrecision,
  onChangeTheme,
  onChangeDefaults,
  onOpenDocumentation,
}: SettingsPageProps) {
  const { notify } = useToast();

  const handleThemeSelect = (next: ThemeMode) => {
    if (next === theme) return;
    onChangeTheme(next);
    notify({
      tone: "info",
      title: `Switched to ${next === "dark" ? "Dark" : "Light"} theme`,
      description: "Interface tokens and chart palettes updated.",
    });
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Settings"
        subtitle="Configure visual appearance, numerical defaults, and inspect runtime engine, Gemini server boundary, and local SQLite storage."
        action={
          <Button variant="secondary" onClick={onOpenDocumentation}>
            <BookOpen className="w-4 h-4" aria-hidden="true" />
            Open Documentation
          </Button>
        }
      />

      {/* Appearance & Visualization Preferences */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel className="p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--orbit-border-subtle)]">
            <Sliders className="w-4 h-4 text-[var(--orbit-primary)]" aria-hidden="true" />
            <h2 className="text-base font-semibold text-[var(--orbit-text-primary)]">
              Appearance &amp; Theme
            </h2>
          </div>

          <p className="text-sm text-[var(--orbit-text-secondary)] leading-relaxed">
            ORBIT opens in an editorial obsidian black workspace with crisp white accents and
            includes a calibrated gallery white theme with carbon ink contrast.
          </p>

          <div
            role="radiogroup"
            aria-label="Interface theme"
            className="grid grid-cols-2 gap-3 pt-1"
          >
            <button
              type="button"
              role="radio"
              aria-checked={theme === "dark"}
              onClick={() => handleThemeSelect("dark")}
              className={`min-h-[56px] px-4 py-3 rounded-[var(--orbit-radius-md)] border text-left flex items-center gap-3 cursor-pointer transition-colors ${
                theme === "dark"
                  ? "bg-[var(--orbit-selected-surface)] border-[var(--orbit-primary)] text-[var(--orbit-text-primary)]"
                  : "bg-[var(--orbit-surface-inset)] border-[var(--orbit-border)] text-[var(--orbit-text-secondary)] hover:text-[var(--orbit-text-primary)]"
              }`}
            >
              <Moon className="w-4 h-4 shrink-0 text-[var(--orbit-text-primary)]" aria-hidden="true" />
              <div>
                <div className="text-sm font-semibold">Obsidian Black</div>
                <div className="text-xs text-[var(--orbit-text-muted)]">Default monochrome editorial</div>
              </div>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={theme === "light"}
              onClick={() => handleThemeSelect("light")}
              className={`min-h-[56px] px-4 py-3 rounded-[var(--orbit-radius-md)] border text-left flex items-center gap-3 cursor-pointer transition-colors ${
                theme === "light"
                  ? "bg-[var(--orbit-selected-surface)] border-[var(--orbit-primary)] text-[var(--orbit-text-primary)]"
                  : "bg-[var(--orbit-surface-inset)] border-[var(--orbit-border)] text-[var(--orbit-text-secondary)] hover:text-[var(--orbit-text-primary)]"
              }`}
            >
              <Sun className="w-4 h-4 shrink-0 text-[var(--orbit-text-primary)]" aria-hidden="true" />
              <div>
                <div className="text-sm font-semibold">Gallery White</div>
                <div className="text-xs text-[var(--orbit-text-muted)]">Daylight carbon contrast</div>
              </div>
            </button>
          </div>
        </Panel>

        <Panel className="p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--orbit-border-subtle)]">
            <Server className="w-4 h-4 text-[var(--orbit-secondary)]" aria-hidden="true" />
            <h2 className="text-base font-semibold text-[var(--orbit-text-primary)]">
              Simulation &amp; Display Defaults
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              id="default-solver"
              label="Default Numerical Solver"
              hint="Applied when creating new models."
            >
              <Select
                id="default-solver"
                value={defaultSolver}
                onChange={(e) => {
                  const nextSolver = e.target.value as SolverType;
                  onChangeDefaults({ solver: nextSolver, precision: defaultPrecision });
                  notify({
                    tone: "success",
                    title: "Default solver updated",
                    description: `New models will default to ${nextSolver.toUpperCase()}.`,
                  });
                }}
                className="w-full"
              >
                <option value="rk4">RK4 (4th-order Runge-Kutta)</option>
                <option value="euler">Forward Euler (1st-order)</option>
              </Select>
            </FormField>

            <FormField
              id="default-precision"
              label="Numeric Decimal Precision"
              hint="Formatting used in tables and metrics."
            >
              <Select
                id="default-precision"
                value={defaultPrecision}
                onChange={(e) => {
                  const nextPrecision = Number(e.target.value);
                  onChangeDefaults({ solver: defaultSolver, precision: nextPrecision });
                  notify({
                    tone: "success",
                    title: "Display precision updated",
                    description: `Numeric values will render with ${nextPrecision} decimal places.`,
                  });
                }}
                className="w-full"
              >
                <option value={1}>1 decimal place</option>
                <option value={2}>2 decimal places</option>
                <option value={3}>3 decimal places</option>
                <option value={4}>4 decimal places</option>
              </Select>
            </FormField>
          </div>
        </Panel>
      </div>

      {/* Runtime Environment & Storage Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panel className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--orbit-border-subtle)]">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-[var(--orbit-primary)]" aria-hidden="true" />
              <h2 className="text-base font-semibold text-[var(--orbit-text-primary)]">
                Python Engine
              </h2>
            </div>
            <StatusIndicator
              tone={health?.python_engine.available ? "success" : "danger"}
              label={health?.python_engine.available ? "Available" : "Unavailable"}
            />
          </div>
          <dl className="space-y-2 text-sm font-mono tabular-nums">
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--orbit-text-secondary)]">Runtime</dt>
              <dd className="text-[var(--orbit-text-primary)]">
                Python {health?.python_engine.python_version ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--orbit-text-secondary)]">Schema</dt>
              <dd className="text-[var(--orbit-text-primary)]">
                v{health?.python_engine.schema_version ?? "1.0.0"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--orbit-text-secondary)]">Solvers</dt>
              <dd className="text-[var(--orbit-text-primary)]">
                {health?.python_engine.solvers.join(", ").toUpperCase() || "EULER, RK4"}
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--orbit-border-subtle)]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[var(--orbit-secondary)]" aria-hidden="true" />
              <h2 className="text-base font-semibold text-[var(--orbit-text-primary)]">
                Gemini AI Boundary
              </h2>
            </div>
            <StatusIndicator
              tone={health?.gemini.configured ? "success" : "warning"}
              label={health?.gemini.configured ? "Configured" : "Offline Only"}
            />
          </div>
          <dl className="space-y-2 text-sm font-mono">
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--orbit-text-secondary)]">Model</dt>
              <dd className="text-[var(--orbit-text-primary)]">
                {health?.gemini.model ?? "gemini-4-hydrogen"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--orbit-text-secondary)]">Credential Scope</dt>
              <dd className="text-[var(--orbit-text-primary)]">Server env only</dd>
            </div>
          </dl>
          <p className="text-xs text-[var(--orbit-text-secondary)] leading-relaxed">
            API keys are configured strictly through the server environment (
            <code className="font-mono">GEMINI_API_KEY</code>) and never requested or exposed in the
            browser. Mathematical execution always runs offline in Python.
          </p>
        </Panel>

        <Panel className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--orbit-border-subtle)]">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[var(--orbit-success)]" aria-hidden="true" />
              <h2 className="text-base font-semibold text-[var(--orbit-text-primary)]">
                Local SQLite Storage
              </h2>
            </div>
            <StatusIndicator tone="success" label="WAL Active" />
          </div>
          <dl className="space-y-2 text-sm font-mono tabular-nums">
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--orbit-text-secondary)]">Engine</dt>
              <dd className="text-[var(--orbit-text-primary)]">
                {health?.database.engine ?? "SQLite 3"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--orbit-text-secondary)]">Database Path</dt>
              <dd className="text-[var(--orbit-text-primary)] truncate">
                {health?.database.path ?? "data/orbit.sqlite"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--orbit-text-secondary)]">File Size</dt>
              <dd className="text-[var(--orbit-text-primary)]">
                {health ? formatBytes(health.database.size_bytes) : "—"}
              </dd>
            </div>
          </dl>
        </Panel>
      </div>

      {/* Application Information */}
      <Panel className="p-5 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-[var(--orbit-border-subtle)]">
          <Info className="w-4 h-4 text-[var(--orbit-primary)]" aria-hidden="true" />
          <h2 className="text-base font-semibold text-[var(--orbit-text-primary)]">
            Application Information
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <InsetSurface className="p-4">
            <div className="text-xs font-mono text-[var(--orbit-text-muted)]">Platform</div>
            <div className="font-semibold text-[var(--orbit-text-primary)] mt-1">ORBIT v1.0.0</div>
            <p className="text-xs text-[var(--orbit-text-secondary)] mt-1">
              Open-ended Reasoning &amp; Behavior Intelligence for Simulation and Testing
            </p>
          </InsetSurface>
          <InsetSurface className="p-4">
            <div className="text-xs font-mono text-[var(--orbit-text-muted)]">Architecture</div>
            <div className="font-semibold text-[var(--orbit-text-primary)] mt-1">
              React + Express + Python 3.11
            </div>
            <p className="text-xs text-[var(--orbit-text-secondary)] mt-1">
              AST-allowlisted equation sandbox with deterministic Euler &amp; RK4 solvers
            </p>
          </InsetSurface>
          <InsetSurface className="p-4">
            <div className="text-xs font-mono text-[var(--orbit-text-muted)]">Accessibility</div>
            <div className="font-semibold text-[var(--orbit-text-primary)] mt-1">
              WCAG 2.2 AA Token System
            </div>
            <p className="text-xs text-[var(--orbit-text-secondary)] mt-1">
              44&times;44px interactive targets, 16px body scale, reduced-motion support
            </p>
          </InsetSurface>
        </div>

        <StatusNotice
          tone="info"
          message="ORBIT is designed for exploratory computational modeling, research, and education. Simulation outputs depend strictly on user-approved equations and parameter assumptions."
        />
      </Panel>
    </div>
  );
}
