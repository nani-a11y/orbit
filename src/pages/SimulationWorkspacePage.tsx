import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Edit3,
  FileBarChart2,
  FlaskConical,
  Info,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Square,
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
import { DependencyGraph } from "../components/charts/DependencyGraph";
import {
  Button,
  EmptyState,
  IconButton,
  Input,
  InsetSurface,
  Panel,
  Select,
  StatusIndicator,
  StatusNotice,
  Tabs,
} from "../components/ui/primitives";
import { useToast } from "../components/ui/Toast";
import { formatDelta, formatMetricValue } from "../lib/utils";
import { orbitApi } from "../services/api";
import type {
  AIExplanationResponse,
  OrbitModelSpec,
  SimulationResult,
  SimulationRunRecord,
  SolverType,
  ValidationReport,
} from "../types/orbit";

interface SimulationWorkspacePageProps {
  models: OrbitModelSpec[];
  activeModelId: string | null;
  initialRunId?: string | null;
  defaultPrecision?: number;
  onSelectModel: (modelId: string) => void;
  onRunCompleted: (run: SimulationRunRecord) => void;
  onOpenEditor: (modelId: string) => void;
  onOpenExperimentLab: (modelId: string, overrides?: Record<string, number>) => void;
  onOpenReport: (runId: string) => void;
}

const SERIES_COLORS = [
  "var(--orbit-series-1)",
  "var(--orbit-series-2)",
  "var(--orbit-series-3)",
  "var(--orbit-series-4)",
  "var(--orbit-series-5)",
  "var(--orbit-series-6)",
];

type CenterTab = "timeseries" | "graph" | "ai";
type RightTab = "inspector" | "parameters" | "properties";

export function SimulationWorkspacePage({
  models,
  activeModelId,
  initialRunId,
  defaultPrecision = 2,
  onSelectModel,
  onRunCompleted,
  onOpenEditor,
  onOpenExperimentLab,
  onOpenReport,
}: SimulationWorkspacePageProps) {
  const { notify } = useToast();
  const model = useMemo(
    () => models.find((m) => m.id === activeModelId) ?? models[0] ?? null,
    [models, activeModelId]
  );

  // Collapsible 4-panel workstation state
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showEventLog, setShowEventLog] = useState(false);

  const [varSearch, setVarSearch] = useState("");
  const [centerTab, setCenterTab] = useState<CenterTab>("timeseries");
  const [rightTab, setRightTab] = useState<RightTab>("parameters");

  // Solver & parameter working overrides
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [solver, setSolver] = useState<SolverType>("rk4");
  const [endTime, setEndTime] = useState<number>(20);
  const [dt, setDt] = useState<number>(0.25);
  const [seed, setSeed] = useState<number>(42);

  // Execution state
  const [running, setRunning] = useState(false);
  const [activeRun, setActiveRun] = useState<SimulationRunRecord | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Playback state
  const [stepIdx, setStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Selection state
  const [selectedSeries, setSelectedSeries] = useState<string[]>([]);
  const [inspectedVar, setInspectedVar] = useState<string | null>(null);

  // Grounded AI Explanation state
  const [focusQuestion, setFocusQuestion] = useState("");
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState<AIExplanationResponse | null>(null);
  const [explainError, setExplainError] = useState<string | null>(null);

  useEffect(() => {
    if (!model) return;
    const defaults: Record<string, number> = {};
    model.parameters.forEach((p) => {
      defaults[p.id] = p.value;
    });
    setOverrides(defaults);
    setSolver(model.time_config.solver);
    setEndTime(model.time_config.end_time);
    setDt(model.time_config.dt);
    setSeed(model.random_seed);
    setExplanation(null);
    setExplainError(null);
    setIsPlaying(false);

    const defaultSeries =
      model.visualization?.primary_series && model.visualization.primary_series.length > 0
        ? model.visualization.primary_series
        : model.stocks.slice(0, 3).map((s) => s.id);
    setSelectedSeries(defaultSeries);
    setInspectedVar(defaultSeries[0] ?? model.stocks[0]?.id ?? null);

    orbitApi
      .validateModel(model.id, model)
      .then(setValidation)
      .catch(() => setValidation(null));

    if (initialRunId) {
      orbitApi
        .getRunResults(initialRunId)
        .then(({ run, result: res }) => {
          if (run.model_id === model.id) {
            setActiveRun(run);
            setResult(res);
            setStepIdx(Math.max(0, res.times.length - 1));
            setOverrides((prev) => ({ ...prev, ...run.parameter_overrides }));
          }
        })
        .catch(() => {
          executeSimulation(
            model,
            defaults,
            model.time_config.solver,
            model.time_config.end_time,
            model.time_config.dt,
            model.random_seed
          );
        });
    } else {
      executeSimulation(
        model,
        defaults,
        model.time_config.solver,
        model.time_config.end_time,
        model.time_config.dt,
        model.random_seed
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model?.id]);

  useEffect(() => {
    if (!isPlaying || !result) return;
    const maxStep = Math.max(0, result.times.length - 1);
    const intervalMs = Math.max(40, Math.round(140 / playbackSpeed));
    const timer = window.setInterval(() => {
      setStepIdx((curr) => {
        if (curr >= maxStep) {
          setIsPlaying(false);
          return maxStep;
        }
        return curr + 1;
      });
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [isPlaying, playbackSpeed, result]);

  const executeSimulation = async (
    targetModel = model,
    paramVals = overrides,
    effSolver = solver,
    effEnd = endTime,
    effDt = dt,
    effSeed = seed,
    announce = false
  ) => {
    if (!targetModel) return;
    setRunning(true);
    setError(null);
    setIsPlaying(false);
    setExplanation(null);

    const changedOverrides: Record<string, number> = {};
    targetModel.parameters.forEach((p) => {
      const currVal = paramVals[p.id];
      if (currVal !== undefined && Math.abs(currVal - p.value) > 1e-9) {
        changedOverrides[p.id] = currVal;
      }
    });

    try {
      const { run, result: res } = await orbitApi.runSimulation({
        model_id: targetModel.id,
        parameter_overrides: changedOverrides,
        time_overrides: { end_time: effEnd, dt: effDt, solver: effSolver },
        random_seed: effSeed,
        sync: true,
      });
      setActiveRun(run);
      if (res) {
        setResult(res);
        setStepIdx(Math.max(0, res.times.length - 1));
      }
      onRunCompleted(run);
      if (announce && res) {
        notify({
          tone: "success",
          title: "Simulation completed",
          description: `${res.steps} points computed via ${res.solver.toUpperCase()} in ${res.execution_ms} ms.`,
        });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Python simulation execution failed.";
      setError(message);
    } finally {
      setRunning(false);
    }
  };

  const handleCancel = async () => {
    if (!activeRun) return;
    try {
      await orbitApi.cancelRun(activeRun.id);
      setRunning(false);
      notify({ tone: "info", title: "Simulation cancelled" });
    } catch {
      // Ignore if already completed
    }
  };

  const handleExplain = async () => {
    if (!activeRun) return;
    setExplaining(true);
    setExplainError(null);
    setCenterTab("ai");
    try {
      const res = await orbitApi.explainResults({
        run_id: activeRun.id,
        focus_question: focusQuestion.trim() || undefined,
      });
      setExplanation(res);
    } catch (err) {
      setExplainError(err instanceof Error ? err.message : "AI analysis could not be completed.");
    } finally {
      setExplaining(false);
    }
  };

  if (!model) {
    return (
      <EmptyState
        title="No simulation model available"
        description="Load a sample model or generate a new system specification to launch the Simulation Workspace."
      />
    );
  }

  const allVariableMeta = useMemo(() => {
    const map: Record<
      string,
      { id: string; name: string; kind: "stock" | "flow" | "auxiliary" | "parameter"; unit: string; equation: string; description: string }
    > = {};
    model.stocks.forEach((s) => {
      map[s.id] = {
        id: s.id,
        name: s.name,
        kind: "stock",
        unit: s.unit,
        equation: `d(${s.id})/dt = (${s.inflows.join(" + ") || "0"}) - (${s.outflows.join(" + ") || "0"})`,
        description: s.description,
      };
    });
    model.flows.forEach((f) => {
      map[f.id] = {
        id: f.id,
        name: f.name,
        kind: "flow",
        unit: f.unit,
        equation: f.equation,
        description: f.description,
      };
    });
    model.auxiliaries.forEach((a) => {
      map[a.id] = {
        id: a.id,
        name: a.name,
        kind: "auxiliary",
        unit: a.unit,
        equation: a.equation,
        description: a.description,
      };
    });
    model.parameters.forEach((p) => {
      map[p.id] = {
        id: p.id,
        name: p.name,
        kind: "parameter",
        unit: p.unit,
        equation: `parameter = ${overrides[p.id] ?? p.value}`,
        description: p.description,
      };
    });
    return map;
  }, [model, overrides]);

  const trackedIds = result ? Object.keys(result.series) : model.stocks.map((s) => s.id);
  const currentTime = result?.times[stepIdx] ?? 0;

  const chartData = useMemo(() => {
    if (!result) return [];
    return result.times.map((t, i) => {
      const point: Record<string, number> = { time: t };
      selectedSeries.forEach((vid) => {
        point[vid] = result.series[vid]?.[i] ?? 0;
      });
      return point;
    });
  }, [result, selectedSeries]);

  const toggleSeries = (vid: string) => {
    setSelectedSeries((prev) =>
      prev.includes(vid)
        ? prev.length > 1
          ? prev.filter((x) => x !== vid)
          : prev
        : [...prev.slice(-4), vid]
    );
  };

  const selectVariable = (vid: string) => {
    setInspectedVar(vid);
    setRightTab("inspector");
  };

  const structureGroups = useMemo(() => {
    const q = varSearch.trim().toLowerCase();
    const filterFn = (item: { id: string; name: string }) =>
      !q || item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q);
    return [
      { label: "Stocks", items: model.stocks.filter(filterFn) },
      { label: "Flows", items: model.flows.filter(filterFn) },
      { label: "Auxiliaries", items: model.auxiliaries.filter(filterFn) },
      { label: "Parameters", items: model.parameters.filter(filterFn) },
    ];
  }, [model, varSearch]);

  const inspectedMeta = inspectedVar ? allVariableMeta[inspectedVar] : null;
  const inspectedMetrics = inspectedVar ? result?.metrics[inspectedVar] : null;
  const upstreamDeps =
    inspectedVar && validation
      ? validation.dependency_graph.edges.filter((e) => e.target === inspectedVar)
      : [];
  const downstreamDeps =
    inspectedVar && validation
      ? validation.dependency_graph.edges.filter((e) => e.source === inspectedVar)
      : [];

  return (
    <div className="space-y-4">
      {/* Top Workspace Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--orbit-border-subtle)]">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <IconButton
            label={showLeftPanel ? "Collapse model structure panel" : "Expand model structure panel"}
            variant="secondary"
            onClick={() => setShowLeftPanel((v) => !v)}
          >
            {showLeftPanel ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </IconButton>

          <Select
            value={model.id}
            onChange={(e) => onSelectModel(e.target.value)}
            aria-label="Active simulation model"
            className="max-w-xs sm:max-w-sm font-medium"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {m.is_example ? "(Sample)" : ""}
              </option>
            ))}
          </Select>

          <span className="text-xs font-mono text-[var(--orbit-text-secondary)] hidden md:inline">
            v{model.version} · {model.domain}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => onOpenEditor(model.id)}>
            <Edit3 className="w-4 h-4" aria-hidden="true" />
            Edit Model
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onOpenExperimentLab(model.id, overrides)}
          >
            <FlaskConical className="w-4 h-4 text-[var(--orbit-secondary)]" aria-hidden="true" />
            Compare in Lab
          </Button>
          {activeRun ? (
            <Button size="sm" variant="secondary" onClick={() => onOpenReport(activeRun.id)}>
              <FileBarChart2 className="w-4 h-4" aria-hidden="true" />
              Report
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="primary"
            loading={running}
            onClick={() => executeSimulation(model, overrides, solver, endTime, dt, seed, true)}
          >
            <Play className="w-4 h-4" aria-hidden="true" />
            Run Simulation
          </Button>
          <IconButton
            label={showRightPanel ? "Collapse inspector panel" : "Expand inspector panel"}
            variant="secondary"
            onClick={() => setShowRightPanel((v) => !v)}
          >
            {showRightPanel ? (
              <PanelRightClose className="w-4 h-4" />
            ) : (
              <PanelRightOpen className="w-4 h-4" />
            )}
          </IconButton>
        </div>
      </div>

      {error ? <StatusNotice tone="error" title="Simulation Error" message={error} /> : null}

      {/* 3-Column Scientific Workstation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT PANEL: Model Structure & Variables Explorer */}
        {showLeftPanel ? (
          <Panel className="lg:col-span-3 xl:col-span-2 p-3.5 space-y-3 lg:max-h-[680px] flex flex-col">
            <div className="text-sm font-semibold">Model Structure</div>
            <div className="relative">
              <Search
                className="w-4 h-4 text-[var(--orbit-text-muted)] absolute left-3 top-3.5 pointer-events-none"
                aria-hidden="true"
              />
              <Input
                value={varSearch}
                onChange={(e) => setVarSearch(e.target.value)}
                placeholder="Filter variables..."
                aria-label="Filter model variables"
                className="pl-9 text-sm"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {structureGroups.map((group) => (
                <div key={group.label} className="space-y-1">
                  <div className="text-xs font-mono text-[var(--orbit-text-muted)] px-2">
                    {group.label} ({group.items.length})
                  </div>
                  {group.items.map((item) => {
                    const selected = inspectedVar === item.id;
                    const plotted = selectedSeries.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectVariable(item.id)}
                        className={`w-full min-h-[44px] px-2.5 py-2 rounded-[var(--orbit-radius-md)] text-left transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                          selected
                            ? "bg-[var(--orbit-selected-surface)] text-[var(--orbit-text-primary)] border border-[var(--orbit-primary)]/40"
                            : "text-[var(--orbit-text-secondary)] hover:bg-[var(--orbit-hover-surface)] hover:text-[var(--orbit-text-primary)] border border-transparent"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{item.name}</div>
                          <div className="text-xs font-mono text-[var(--orbit-text-muted)] truncate">
                            {item.id}
                          </div>
                        </div>
                        {plotted ? (
                          <span
                            className="text-[11px] font-mono text-[var(--orbit-secondary)] shrink-0"
                            title="Plotted in chart"
                          >
                            Plot
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </Panel>
        ) : null}

        {/* CENTER PANEL: Main Visualization Stage */}
        <div
          className={`space-y-4 ${
            showLeftPanel && showRightPanel
              ? "lg:col-span-6 xl:col-span-7"
              : showLeftPanel || showRightPanel
              ? "lg:col-span-9 xl:col-span-9"
              : "lg:col-span-12"
          }`}
        >
          {/* Live Scrubbed Metric Strip */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {selectedSeries.slice(0, 4).map((vid, idx) => {
              const meta = allVariableMeta[vid];
              const currVal = result?.series[vid]?.[stepIdx];
              const initVal = result?.series[vid]?.[0];
              const delta =
                currVal !== undefined && initVal !== undefined ? currVal - initVal : null;
              const isSelected = inspectedVar === vid;

              return (
                <button
                  key={vid}
                  type="button"
                  onClick={() => selectVariable(vid)}
                  className={`text-left p-3.5 rounded-[var(--orbit-radius-lg)] border transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[var(--orbit-surface-elevated)] border-[var(--orbit-primary)]"
                      : "bg-[var(--orbit-surface)] border-[var(--orbit-border-subtle)] hover:border-[var(--orbit-border)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-[var(--orbit-text-secondary)]">
                    <span className="truncate font-medium">{meta?.name ?? vid}</span>
                    <span
                      className="w-3 h-1 rounded-sm shrink-0"
                      style={{ backgroundColor: SERIES_COLORS[idx % SERIES_COLORS.length] }}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <span className="text-xl font-mono font-semibold tabular-nums text-[var(--orbit-text-primary)]">
                      {formatMetricValue(currVal, defaultPrecision)}
                    </span>
                    <span className="text-xs font-mono text-[var(--orbit-text-muted)] truncate">
                      {meta?.unit ?? ""}
                    </span>
                  </div>
                  <div className="mt-1 text-xs font-mono tabular-nums text-[var(--orbit-text-secondary)]">
                    Δ t0: {formatDelta(delta)}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Center Visualization View Switcher */}
          <Panel className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--orbit-border-subtle)]">
              <Tabs<CenterTab>
                ariaLabel="Center visualization view"
                value={centerTab}
                onChange={setCenterTab}
                items={[
                  { id: "timeseries", label: "Time-Series" },
                  { id: "graph", label: "System Graph" },
                  { id: "ai", label: "AI Analysis" },
                ]}
              />

              <Button
                size="sm"
                variant="secondary"
                loading={explaining}
                disabled={!activeRun}
                onClick={handleExplain}
              >
                <Sparkles className="w-4 h-4 text-[var(--orbit-secondary)]" aria-hidden="true" />
                Explain Results
              </Button>
            </div>

            {centerTab === "timeseries" ? (
              <div className="space-y-4">
                <div
                  role="group"
                  aria-label="Toggle plotted variables"
                  className="flex flex-wrap items-center gap-2"
                >
                  {trackedIds.slice(0, 10).map((vid) => {
                    const active = selectedSeries.includes(vid);
                    return (
                      <button
                        key={vid}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleSeries(vid)}
                        className={`min-h-[36px] px-3 rounded-[var(--orbit-radius-md)] text-xs font-mono transition-colors cursor-pointer whitespace-nowrap border ${
                          active
                            ? "bg-[var(--orbit-selected-surface)] text-[var(--orbit-text-primary)] border-[var(--orbit-primary)]"
                            : "bg-[var(--orbit-surface-inset)] text-[var(--orbit-text-secondary)] border-[var(--orbit-border-subtle)] hover:text-[var(--orbit-text-primary)]"
                        }`}
                      >
                        {allVariableMeta[vid]?.name ?? vid}
                      </button>
                    );
                  })}
                </div>

                <div className="h-[360px]">
                  {result ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartData}
                        margin={{ top: 10, right: 20, left: 8, bottom: 18 }}
                      >
                        <CartesianGrid stroke="var(--orbit-chart-grid)" strokeDasharray="3 3" />
                        <XAxis
                          dataKey="time"
                          stroke="var(--orbit-chart-axis)"
                          tick={{ fontSize: 12, fontFamily: "JetBrains Mono" }}
                          label={{
                            value: `Time (${result.time_unit})`,
                            position: "insideBottom",
                            offset: -10,
                            fill: "var(--orbit-chart-axis)",
                            fontSize: 12,
                          }}
                        />
                        <YAxis
                          stroke="var(--orbit-chart-axis)"
                          tick={{ fontSize: 12, fontFamily: "JetBrains Mono" }}
                          width={64}
                          tickFormatter={(v) => formatMetricValue(v, 1)}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--orbit-surface-elevated)",
                            border: "1px solid var(--orbit-border)",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontFamily: "JetBrains Mono",
                            color: "var(--orbit-text-primary)",
                          }}
                        />
                        <ReferenceLine
                          x={currentTime}
                          stroke="var(--orbit-primary)"
                          strokeDasharray="3 3"
                        />
                        {selectedSeries.map((vid, idx) => (
                          <Line
                            key={vid}
                            type="monotone"
                            dataKey={vid}
                            name={`${allVariableMeta[vid]?.name ?? vid} (${allVariableMeta[vid]?.unit ?? ""})`}
                            stroke={SERIES_COLORS[idx % SERIES_COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-[var(--orbit-text-secondary)]">
                      Run the simulation to calculate trajectories in Python.
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {centerTab === "graph" ? (
              <DependencyGraph
                nodes={validation?.dependency_graph.nodes ?? []}
                edges={validation?.dependency_graph.edges ?? []}
                selectedNodeId={inspectedVar}
                onSelectNode={(id) => selectVariable(id)}
                height={400}
              />
            ) : null}

            {centerTab === "ai" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Input
                    value={focusQuestion}
                    onChange={(e) => setFocusQuestion(e.target.value)}
                    placeholder="Ask about computed trajectories (e.g., What triggered the power deficit?)"
                    aria-label="Focus question for AI analysis"
                    className="flex-1 min-w-[220px]"
                  />
                  <Button loading={explaining} disabled={!activeRun} onClick={handleExplain}>
                    <Sparkles className="w-4 h-4" aria-hidden="true" />
                    Analyze
                  </Button>
                </div>

                {explainError ? <StatusNotice tone="error" message={explainError} /> : null}

                {explanation ? (
                  <div className="space-y-4">
                    <div className="text-xs font-mono text-[var(--orbit-secondary)]">
                      AI-Generated Interpretation · Grounded strictly in computed Python outputs
                    </div>
                    <div>
                      <h3 className="text-base font-semibold">{explanation.headline}</h3>
                      <p className="text-base text-[var(--orbit-text-secondary)] mt-1 prose-measure">
                        {explanation.summary}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {explanation.key_changes.map((c, idx) => (
                        <InsetSurface key={idx} className="p-3.5 space-y-1">
                          <div className="font-mono text-xs text-[var(--orbit-secondary)]">
                            {c.variable}
                          </div>
                          <div className="text-sm">{c.observation}</div>
                          <div className="font-mono text-xs text-[var(--orbit-text-secondary)]">
                            Computed: {c.computed_evidence}
                          </div>
                        </InsetSurface>
                      ))}
                    </div>
                    <StatusNotice tone="warning" title="Modeling Caveat" message={explanation.disclaimer} />
                  </div>
                ) : (
                  <EmptyState
                    title="No AI interpretation generated for this run"
                    description="Click Explain Results to ask Gemini to summarize changes, model mechanisms, and limitations using only the verified numerical output."
                  />
                )}
              </div>
            ) : null}
          </Panel>
        </div>

        {/* RIGHT PANEL: Variable Inspector, Parameter Controls & Assumptions */}
        {showRightPanel ? (
          <Panel className="lg:col-span-3 xl:col-span-3 p-4 space-y-4 lg:max-h-[680px] flex flex-col">
            <Tabs<RightTab>
              ariaLabel="Right workspace panel tabs"
              value={rightTab}
              onChange={setRightTab}
              items={[
                { id: "parameters", label: "Parameters" },
                { id: "inspector", label: "Inspector" },
                { id: "properties", label: "Assumptions" },
              ]}
            />

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {rightTab === "parameters" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Run Configuration</span>
                    <button
                      type="button"
                      onClick={() => {
                        const defaults: Record<string, number> = {};
                        model.parameters.forEach((p) => {
                          defaults[p.id] = p.value;
                        });
                        setOverrides(defaults);
                        setSolver(model.time_config.solver);
                        setEndTime(model.time_config.end_time);
                        setDt(model.time_config.dt);
                        setSeed(model.random_seed);
                      }}
                      className="text-xs font-medium text-[var(--orbit-primary)] hover:underline cursor-pointer"
                    >
                      Reset defaults
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label
                        htmlFor="ws-solver"
                        className="block text-xs text-[var(--orbit-text-secondary)] mb-1"
                      >
                        Solver
                      </label>
                      <Select
                        id="ws-solver"
                        value={solver}
                        onChange={(e) => setSolver(e.target.value as SolverType)}
                        className="w-full"
                      >
                        <option value="rk4">RK4</option>
                        <option value="euler">Euler</option>
                      </Select>
                    </div>
                    <div>
                      <label
                        htmlFor="ws-horizon"
                        className="block text-xs text-[var(--orbit-text-secondary)] mb-1"
                      >
                        End ({model.time_config.time_unit})
                      </label>
                      <Input
                        id="ws-horizon"
                        type="number"
                        className="font-mono tabular-nums text-sm"
                        value={endTime}
                        onChange={(e) => setEndTime(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="ws-dt"
                        className="block text-xs text-[var(--orbit-text-secondary)] mb-1"
                      >
                        Step (dt)
                      </label>
                      <Input
                        id="ws-dt"
                        type="number"
                        step="any"
                        className="font-mono tabular-nums text-sm"
                        value={dt}
                        onChange={(e) => setDt(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="ws-seed"
                        className="block text-xs text-[var(--orbit-text-secondary)] mb-1"
                      >
                        Seed
                      </label>
                      <Input
                        id="ws-seed"
                        type="number"
                        className="font-mono tabular-nums text-sm"
                        value={seed}
                        onChange={(e) => setSeed(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-[var(--orbit-border-subtle)]">
                    {model.parameters.map((param) => {
                      const currVal = overrides[param.id] ?? param.value;
                      const min = param.min_value ?? Math.min(0, param.value * 0.25);
                      const max = param.max_value ?? (param.value === 0 ? 10 : param.value * 2.5);
                      const step = param.step ?? (max - min) / 50;
                      const modified = Math.abs(currVal - param.value) > 1e-9;

                      return (
                        <InsetSurface key={param.id} className="p-3 space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <label
                              htmlFor={`param-${param.id}`}
                              className={
                                modified
                                  ? "font-semibold text-[var(--orbit-secondary)]"
                                  : "font-medium text-[var(--orbit-text-primary)]"
                              }
                            >
                              {param.name}
                            </label>
                            <span className="font-mono tabular-nums text-[var(--orbit-text-primary)]">
                              {formatMetricValue(currVal, 4)}{" "}
                              <span className="text-[var(--orbit-text-muted)]">{param.unit}</span>
                            </span>
                          </div>
                          <input
                            id={`param-${param.id}`}
                            type="range"
                            min={min}
                            max={max}
                            step={step || 0.01}
                            value={currVal}
                            onChange={(e) =>
                              setOverrides((prev) => ({
                                ...prev,
                                [param.id]: Number(e.target.value),
                              }))
                            }
                            className="w-full accent-[var(--orbit-primary)] cursor-pointer h-6"
                          />
                        </InsetSurface>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {rightTab === "inspector" ? (
                inspectedMeta ? (
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs font-mono text-[var(--orbit-secondary)]">
                        {inspectedMeta.kind} · {inspectedMeta.unit || "dimensionless"}
                      </div>
                      <h3 className="text-base font-semibold mt-0.5">{inspectedMeta.name}</h3>
                      <p className="text-sm text-[var(--orbit-text-secondary)] mt-1">
                        {inspectedMeta.description || "No description recorded."}
                      </p>
                    </div>

                    <InsetSurface className="p-3 font-mono text-xs text-[var(--orbit-secondary)] break-words">
                      {inspectedMeta.equation}
                    </InsetSurface>

                    {inspectedMetrics ? (
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
                        {[
                          ["Initial", formatMetricValue(inspectedMetrics.initial, defaultPrecision)],
                          ["Final", formatMetricValue(inspectedMetrics.final, defaultPrecision)],
                          [
                            "Min",
                            `${formatMetricValue(inspectedMetrics.min, defaultPrecision)} @ t=${inspectedMetrics.min_time}`,
                          ],
                          [
                            "Max",
                            `${formatMetricValue(inspectedMetrics.max, defaultPrecision)} @ t=${inspectedMetrics.max_time}`,
                          ],
                          ["Mean", formatMetricValue(inspectedMetrics.mean, defaultPrecision)],
                          [
                            "Net %",
                            inspectedMetrics.pct_change !== null
                              ? `${inspectedMetrics.pct_change > 0 ? "+" : ""}${inspectedMetrics.pct_change}%`
                              : formatDelta(inspectedMetrics.abs_change),
                          ],
                        ].map(([lbl, val]) => (
                          <InsetSurface key={lbl} className="p-2.5">
                            <div className="text-[var(--orbit-text-muted)]">{lbl}</div>
                            <div className="text-[var(--orbit-text-primary)] mt-0.5">{val}</div>
                          </InsetSurface>
                        ))}
                      </div>
                    ) : null}

                    <div className="space-y-2 text-xs pt-2 border-t border-[var(--orbit-border-subtle)]">
                      <div>
                        <div className="font-semibold text-[var(--orbit-text-primary)] mb-1">
                          Upstream Dependencies
                        </div>
                        {upstreamDeps.length === 0 ? (
                          <span className="text-[var(--orbit-text-muted)]">Exogenous input</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {upstreamDeps.map((e, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => selectVariable(e.source)}
                                className="px-2 py-1 rounded bg-[var(--orbit-surface-inset)] border border-[var(--orbit-border-subtle)] font-mono hover:border-[var(--orbit-primary)] cursor-pointer"
                              >
                                {e.source}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-[var(--orbit-text-primary)] mb-1">
                          Downstream Targets
                        </div>
                        {downstreamDeps.length === 0 ? (
                          <span className="text-[var(--orbit-text-muted)]">Terminal metric</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {downstreamDeps.map((e, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => selectVariable(e.target)}
                                className="px-2 py-1 rounded bg-[var(--orbit-surface-inset)] border border-[var(--orbit-border-subtle)] font-mono hover:border-[var(--orbit-primary)] cursor-pointer"
                              >
                                {e.target}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--orbit-text-secondary)]">
                    Select any variable from the left structure panel or chart cards to inspect its
                    formula and trajectory statistics.
                  </p>
                )
              ) : null}

              {rightTab === "properties" ? (
                <div className="space-y-4 text-sm">
                  <InsetSurface className="p-3.5 space-y-1">
                    <div className="font-semibold">{model.name}</div>
                    <p className="text-[var(--orbit-text-secondary)] text-sm">
                      {model.description}
                    </p>
                  </InsetSurface>
                  <div className="space-y-2">
                    <div className="font-semibold">
                      Explicit Assumptions ({model.assumptions.length})
                    </div>
                    {model.assumptions.map((a) => (
                      <InsetSurface key={a.id} className="p-3 space-y-1">
                        <div className="text-sm leading-relaxed">{a.statement}</div>
                        <div className="text-xs font-mono text-[var(--orbit-text-muted)]">
                          {a.category} · {a.impact} impact · {a.source}
                        </div>
                      </InsetSurface>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Panel>
        ) : null}
      </div>

      {/* BOTTOM PANEL: Simulation Timeline, Playback, Execution Status & Event Log */}
      <Panel className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            {running ? (
              <Button size="sm" variant="danger" onClick={handleCancel}>
                <Square className="w-4 h-4" aria-hidden="true" />
                Cancel
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                disabled={!result}
                onClick={() => {
                  if (!result) return;
                  if (!isPlaying && stepIdx >= result.times.length - 1) {
                    setStepIdx(0);
                  }
                  setIsPlaying((p) => !p);
                }}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Play className="w-4 h-4" aria-hidden="true" />
                )}
                {isPlaying ? "Pause" : "Replay"}
              </Button>
            )}
            <IconButton
              label="Reset timeline to t=0"
              variant="secondary"
              disabled={!result}
              onClick={() => {
                setIsPlaying(false);
                setStepIdx(0);
              }}
            >
              <RotateCcw className="w-4 h-4" />
            </IconButton>
            <Select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              aria-label="Replay speed"
              className="font-mono"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={4}>4x</option>
            </Select>
          </div>

          <div className="flex-1 min-w-[200px] flex items-center gap-3">
            <input
              type="range"
              aria-label="Simulation timeline step"
              min={0}
              max={Math.max(0, (result?.times.length ?? 1) - 1)}
              value={stepIdx}
              onChange={(e) => {
                setIsPlaying(false);
                setStepIdx(Number(e.target.value));
              }}
              className="w-full accent-[var(--orbit-secondary)] cursor-pointer h-6"
            />
            <span className="text-sm font-mono tabular-nums text-[var(--orbit-secondary)] whitespace-nowrap">
              t = {formatMetricValue(currentTime, 2)} / {result?.end_time ?? endTime}{" "}
              {result?.time_unit ?? model.time_config.time_unit}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {running ? (
              <span className="inline-flex items-center gap-2 text-sm text-[var(--orbit-primary)]">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Computing in Python...
              </span>
            ) : result ? (
              <StatusIndicator
                tone={result.events.some((e) => e.severity === "critical") ? "warning" : "success"}
                label={`${result.solver.toUpperCase()} · ${result.execution_ms} ms`}
              />
            ) : null}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowEventLog((s) => !s)}
              aria-expanded={showEventLog}
            >
              Event Log ({result?.events.length ?? 0})
              {showEventLog ? (
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              ) : (
                <ChevronUp className="w-4 h-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>

        {showEventLog ? (
          <div className="pt-3 border-t border-[var(--orbit-border-subtle)] space-y-2 max-h-52 overflow-y-auto">
            {!result || result.events.length === 0 ? (
              <p className="text-sm text-[var(--orbit-text-secondary)]">
                No threshold crossings or constraint alerts occurred during this run.
              </p>
            ) : (
              result.events.map((ev, i) => {
                const Icon =
                  ev.severity === "critical"
                    ? AlertCircle
                    : ev.severity === "warning"
                    ? AlertTriangle
                    : Info;
                const color =
                  ev.severity === "critical"
                    ? "text-[var(--orbit-danger)]"
                    : ev.severity === "warning"
                    ? "text-[var(--orbit-warning)]"
                    : "text-[var(--orbit-secondary)]";
                return (
                  <InsetSurface key={i} className="p-3 flex items-start gap-3 text-sm">
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} aria-hidden="true" />
                    <div className="min-w-0">
                      <span className="font-mono text-xs text-[var(--orbit-text-secondary)]">
                        t = {ev.time} {result.time_unit} · {ev.variable} = {ev.value}
                      </span>
                      <div className="text-[var(--orbit-text-primary)]">{ev.message}</div>
                    </div>
                  </InsetSurface>
                );
              })
            )}
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
