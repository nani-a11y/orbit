import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Cpu,
  FlaskConical,
  GitBranch,
  Moon,
  Play,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Button,
  IconButton,
  InsetSurface,
  Panel,
  StatusIndicator,
} from "../components/ui/primitives";
import { formatMetricValue } from "../lib/utils";
import { orbitApi } from "../services/api";
import type { AppView, OrbitModelSpec, SimulationResult, ThemeMode } from "../types/orbit";

interface LandingPageProps {
  models: OrbitModelSpec[];
  theme: ThemeMode;
  onToggleTheme: () => void;
  onNavigate: (view: AppView) => void;
  onOpenModelInWorkspace: (modelId: string) => void;
}

export function LandingPage({
  models,
  theme,
  onToggleTheme,
  onNavigate,
  onOpenModelInWorkspace,
}: LandingPageProps) {
  const [powerStations, setPowerStations] = useState(3);
  const [waterReservoirs, setWaterReservoirs] = useState(2);
  const [previewResult, setPreviewResult] = useState<SimulationResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const runLivePreview = async (plants: number, reservoirs: number) => {
    setLoadingPreview(true);
    setPreviewError(null);
    try {
      const { result } = await orbitApi.runSimulation({
        model_id: "urban-ecosystem-baseline",
        parameter_overrides: {
          power_stations: plants,
          water_reservoirs: reservoirs,
        },
        sync: true,
      });
      if (result) setPreviewResult(result);
    } catch (err) {
      setPreviewError(
        err instanceof Error ? err.message : "Could not execute the Python demonstration model."
      );
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    runLivePreview(3, 2);
  }, []);

  const chartData = previewResult
    ? previewResult.times.map((t, i) => ({
        time: t,
        population: Math.round(previewResult.series.population?.[i] ?? 0),
        electricity_balance: Number((previewResult.series.electricity_balance?.[i] ?? 0).toFixed(2)),
      }))
    : [];

  const exampleModels = models.filter((m) => m.is_example).slice(0, 3);

  return (
    <div className="min-h-screen bg-[var(--orbit-background)] text-[var(--orbit-text-primary)]">
      {/* 3-Zone Top Bar */}
      <header className="sticky top-0 z-[var(--orbit-z-sticky)] bg-[var(--orbit-background)]/95 backdrop-blur-sm border-b border-[var(--orbit-border-subtle)]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="text-lg font-bold tracking-tight text-[var(--orbit-text-primary)] whitespace-nowrap shrink-0"
          >
            ORBIT
          </a>

          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-[var(--orbit-text-secondary)]"
          >
            <a
              href="#workflow"
              className="hover:text-[var(--orbit-text-primary)] transition-colors whitespace-nowrap shrink-0"
            >
              Workflow
            </a>
            <a
              href="#scenarios"
              className="hover:text-[var(--orbit-text-primary)] transition-colors whitespace-nowrap shrink-0"
            >
              Scenarios
            </a>
            <a
              href="#architecture"
              className="hover:text-[var(--orbit-text-primary)] transition-colors whitespace-nowrap shrink-0"
            >
              Architecture
            </a>
            <button
              type="button"
              onClick={() => onNavigate("documentation")}
              className="hover:text-[var(--orbit-text-primary)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Documentation
            </button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <IconButton
              variant="secondary"
              label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              onClick={onToggleTheme}
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </IconButton>
            <Button onClick={() => onNavigate("dashboard")}>
              Get Started
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Product Introduction + Functional Preview */}
        <section className="max-w-7xl mx-auto px-6 py-14 lg:py-18">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-5 flex flex-col justify-between gap-8">
              <div>
                <p className="text-xs font-mono tracking-wide text-[var(--orbit-text-secondary)] mb-3">
                  Open-ended Reasoning &amp; Behavior Intelligence for Simulation and Testing
                </p>
                <h1 className="text-3xl sm:text-[2.5rem] font-semibold tracking-tight text-[var(--orbit-text-primary)] leading-[1.12]">
                  Imagine it. Simulate it. Understand what happens.
                </h1>
                <p className="text-base text-[var(--orbit-text-secondary)] mt-4 leading-relaxed prose-measure">
                  ORBIT translates natural-language system descriptions into structured,
                  AST-validated mathematical models executed by a deterministic Python engine.
                  Inspect equations, vary parameters, compare scenarios, and analyze computed
                  evidence without mixing AI assumptions into calculations.
                </p>

                <div className="flex flex-wrap items-center gap-3 mt-7">
                  <Button size="lg" onClick={() => onNavigate("builder")}>
                    New Simulation
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={() => onOpenModelInWorkspace("urban-ecosystem-baseline")}
                  >
                    <Play className="w-4 h-4 text-[var(--orbit-secondary)]" aria-hidden="true" />
                    Open Sample Workspace
                  </Button>
                </div>
              </div>

              <div className="pt-6 border-t border-[var(--orbit-border-subtle)] grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="font-mono font-semibold text-[var(--orbit-text-primary)]">
                    Python 3.11
                  </div>
                  <div className="text-[var(--orbit-text-secondary)] mt-0.5">
                    Euler &amp; RK4 solvers
                  </div>
                </div>
                <div>
                  <div className="font-mono font-semibold text-[var(--orbit-text-primary)]">
                    AST Allowlist
                  </div>
                  <div className="text-[var(--orbit-text-secondary)] mt-0.5">
                    No arbitrary exec
                  </div>
                </div>
                <div>
                  <div className="font-mono font-semibold text-[var(--orbit-text-primary)]">
                    Offline Core
                  </div>
                  <div className="text-[var(--orbit-text-secondary)] mt-0.5">
                    Runs without AI key
                  </div>
                </div>
              </div>
            </div>

            {/* Functional Live Preview Panel */}
            <Panel className="lg:col-span-7 p-5 flex flex-col justify-between gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[var(--orbit-border-subtle)]">
                <div>
                  <div className="text-base font-semibold text-[var(--orbit-text-primary)]">
                    Interactive Sample: Urban Ecosystem (20 Years)
                  </div>
                  <div className="text-sm text-[var(--orbit-text-secondary)] mt-0.5">
                    Illustrative demonstration model computed live by Python RK4
                    {previewResult
                      ? ` · ${previewResult.steps} points · ${previewResult.execution_ms} ms`
                      : ""}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpenModelInWorkspace("urban-ecosystem-baseline")}
                >
                  Inspect Full Model
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InsetSurface className="p-3.5">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <label
                      htmlFor="landing-power-stations"
                      className="font-medium text-[var(--orbit-text-primary)]"
                    >
                      Power Stations
                    </label>
                    <span className="font-mono tabular-nums text-[var(--orbit-secondary)]">
                      {powerStations} plants ({powerStations * 18} MW)
                    </span>
                  </div>
                  <input
                    id="landing-power-stations"
                    type="range"
                    min={1}
                    max={6}
                    step={1}
                    value={powerStations}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPowerStations(val);
                      runLivePreview(val, waterReservoirs);
                    }}
                    className="w-full accent-[var(--orbit-primary)] cursor-pointer h-6"
                  />
                </InsetSurface>

                <InsetSurface className="p-3.5">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <label
                      htmlFor="landing-water-reservoirs"
                      className="font-medium text-[var(--orbit-text-primary)]"
                    >
                      Water Reservoirs
                    </label>
                    <span className="font-mono tabular-nums text-[var(--orbit-text-primary)]">
                      {waterReservoirs} ({((waterReservoirs * 520000) / 1e6).toFixed(2)}M m³/yr)
                    </span>
                  </div>
                  <input
                    id="landing-water-reservoirs"
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={waterReservoirs}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setWaterReservoirs(val);
                      runLivePreview(powerStations, val);
                    }}
                    className="w-full accent-[var(--orbit-primary)] cursor-pointer h-6"
                  />
                </InsetSurface>
              </div>

              <div className="h-60">
                {previewError ? (
                  <div className="h-full flex items-center justify-center text-sm text-[var(--orbit-danger)]">
                    {previewError}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
                      <CartesianGrid stroke="var(--orbit-chart-grid)" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="time"
                        stroke="var(--orbit-chart-axis)"
                        tick={{ fontSize: 12, fontFamily: "JetBrains Mono" }}
                        tickFormatter={(v) => `Y${v}`}
                      />
                      <YAxis
                        yAxisId="pop"
                        stroke="var(--orbit-series-1)"
                        tick={{ fontSize: 12, fontFamily: "JetBrains Mono" }}
                        width={56}
                      />
                      <YAxis
                        yAxisId="mw"
                        orientation="right"
                        stroke="var(--orbit-series-2)"
                        tick={{ fontSize: 12, fontFamily: "JetBrains Mono" }}
                        width={48}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--orbit-surface-elevated)",
                          border: "1px solid var(--orbit-border)",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontFamily: "JetBrains Mono",
                          color: "var(--orbit-text-primary)",
                        }}
                      />
                      <ReferenceLine
                        yAxisId="mw"
                        y={0}
                        stroke="var(--orbit-danger)"
                        strokeDasharray="4 4"
                      />
                      <Line
                        yAxisId="pop"
                        type="monotone"
                        dataKey="population"
                        name="Population (residents)"
                        stroke="var(--orbit-series-1)"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        yAxisId="mw"
                        type="monotone"
                        dataKey="electricity_balance"
                        name="Grid Balance (MW)"
                        stroke="var(--orbit-series-2)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[var(--orbit-border-subtle)]">
                <div>
                  <div className="text-sm text-[var(--orbit-text-secondary)]">Year 20 Population</div>
                  <div className="text-lg font-mono font-semibold tabular-nums mt-0.5">
                    {loadingPreview
                      ? "Computing..."
                      : formatMetricValue(previewResult?.metrics.population?.final, 0)}
                    <span className="text-xs font-normal text-[var(--orbit-text-secondary)] ml-1">
                      residents
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-[var(--orbit-text-secondary)]">Final Grid Margin</div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-lg font-mono font-semibold tabular-nums">
                      {loadingPreview
                        ? "..."
                        : `${formatMetricValue(previewResult?.metrics.electricity_balance?.final, 1)} MW`}
                    </span>
                    {!loadingPreview && previewResult ? (
                      <StatusIndicator
                        tone={
                          (previewResult.metrics.electricity_balance?.final ?? 0) < 0
                            ? "danger"
                            : "success"
                        }
                        label={
                          (previewResult.metrics.electricity_balance?.final ?? 0) < 0
                            ? "Deficit"
                            : "Surplus"
                        }
                      />
                    ) : null}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-[var(--orbit-text-secondary)]">Threshold Events</div>
                  <div className="text-lg font-mono font-semibold tabular-nums mt-0.5">
                    {loadingPreview ? "..." : previewResult?.events.length ?? 0}
                    <span className="text-xs font-normal text-[var(--orbit-text-secondary)] ml-1">
                      recorded
                    </span>
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        </section>

        {/* Core Workflow */}
        <section
          id="workflow"
          className="border-t border-[var(--orbit-border-subtle)] py-14"
        >
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="text-2xl font-semibold tracking-tight">
              Structured workflow from description to computed evidence
            </h2>
            <p className="text-base text-[var(--orbit-text-secondary)] mt-2 prose-measure">
              Every stage keeps AI-generated modeling assumptions clearly separated from verified
              Python numerical calculations.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mt-8">
              {[
                {
                  num: "01.",
                  icon: SlidersHorizontal,
                  title: "Scenario Interpretation",
                  body: "Describe entities, stocks, rates, and horizon in plain language. Gemini drafts a structured schema and asks clarifying questions if critical inputs are missing.",
                },
                {
                  num: "02.",
                  icon: ShieldCheck,
                  title: "AST Validation Gate",
                  body: "An independent Python parser verifies every equation against an explicit mathematical allowlist and checks references, units, and algebraic cycles.",
                },
                {
                  num: "03.",
                  icon: Cpu,
                  title: "Deterministic Execution",
                  body: "Stock-and-flow equations integrate deterministically via Euler or RK4 solvers with fixed seeds, constraint monitoring, and SQLite versioning.",
                },
                {
                  num: "04.",
                  icon: FlaskConical,
                  title: "Experiments & Analysis",
                  body: "Clone baselines without modifying originals, compare parameter variants quantitatively, and inspect AI explanations grounded strictly in computed outputs.",
                },
              ].map((step) => {
                const Icon = step.icon;
                return (
                  <Panel key={step.num} className="p-5 space-y-3">
                    <div className="flex items-center justify-between text-sm font-mono text-[var(--orbit-text-secondary)]">
                      <span>{step.num}</span>
                      <Icon className="w-5 h-5 text-[var(--orbit-primary)]" aria-hidden="true" />
                    </div>
                    <h3 className="text-base font-semibold">{step.title}</h3>
                    <p className="text-sm text-[var(--orbit-text-secondary)] leading-relaxed">
                      {step.body}
                    </p>
                  </Panel>
                );
              })}
            </div>
          </div>
        </section>

        {/* Bundled Demonstration Scenarios */}
        <section
          id="scenarios"
          className="border-t border-[var(--orbit-border-subtle)] py-14"
        >
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Bundled offline demonstration scenarios
                </h2>
                <p className="text-base text-[var(--orbit-text-secondary)] mt-1.5 prose-measure">
                  Clearly labeled sample models that execute locally in Python with visible,
                  editable equations and assumptions.
                </p>
              </div>
              <Button variant="secondary" onClick={() => onNavigate("dashboard")}>
                Open Overview
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
              {exampleModels.map((model) => (
                <Panel key={model.id} className="p-5 flex flex-col justify-between gap-4">
                  <div>
                    <div className="text-xs font-mono text-[var(--orbit-text-secondary)]">
                      Sample Model · {model.domain} · {model.time_config.end_time}{" "}
                      {model.time_config.time_unit}
                    </div>
                    <h3 className="text-base font-semibold mt-2">{model.name}</h3>
                    <p className="text-sm text-[var(--orbit-text-secondary)] mt-2 leading-relaxed">
                      {model.description}
                    </p>
                  </div>
                  <div className="pt-4 border-t border-[var(--orbit-border-subtle)] flex items-center justify-between gap-3">
                    <span className="text-xs font-mono text-[var(--orbit-text-secondary)]">
                      {model.stocks.length} stocks · {model.parameters.length} parameters
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onOpenModelInWorkspace(model.id)}
                    >
                      Open Workspace
                    </Button>
                  </div>
                </Panel>
              ))}
            </div>
          </div>
        </section>

        {/* Architecture & Documentation */}
        <section
          id="architecture"
          className="border-t border-[var(--orbit-border-subtle)] py-14"
        >
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Engineered for scientific reproducibility
              </h2>
              <p className="text-base text-[var(--orbit-text-secondary)] mt-3 leading-relaxed prose-measure">
                ORBIT snapshots every model revision in SQLite alongside solver choices, parameter
                overrides, and random seeds. Simulation results are intended for research,
                education, and exploratory analysis—not unvalidated real-world forecasting.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={() => onNavigate("dashboard")}>Open Workspace Dashboard</Button>
                <Button variant="secondary" onClick={() => onNavigate("documentation")}>
                  <BookOpen className="w-4 h-4" aria-hidden="true" />
                  Read Documentation
                </Button>
              </div>
            </div>

            <Panel className="p-5 space-y-3 text-sm text-[var(--orbit-text-secondary)]">
              <div className="font-semibold text-[var(--orbit-text-primary)]">
                Technical Guarantees
              </div>
              <div className="flex items-start gap-2.5">
                <GitBranch className="w-4 h-4 text-[var(--orbit-secondary)] shrink-0 mt-1" />
                <span>Immutable model versions with exact run reproduction in SQLite.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[var(--orbit-success)] shrink-0 mt-1" />
                <span>Restricted Python AST math parser with zero eval, exec, or shell access.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Cpu className="w-4 h-4 text-[var(--orbit-primary)] shrink-0 mt-1" />
                <span>Lightweight CPU-only execution suitable for standard 4-core workstations.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <FlaskConical className="w-4 h-4 text-[var(--orbit-warning)] shrink-0 mt-1" />
                <span>Non-destructive experiments with deterministic delta tables and exports.</span>
              </div>
            </Panel>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--orbit-border-subtle)] py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4 text-sm text-[var(--orbit-text-secondary)]">
          <div>ORBIT — Open-ended Reasoning &amp; Behavior Intelligence for Simulation and Testing</div>
          <div>Illustrative computational models are not validated real-world forecasts.</div>
        </div>
      </footer>
    </div>
  );
}
