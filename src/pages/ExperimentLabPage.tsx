import React, { useEffect, useMemo, useState } from "react";
import {
  FlaskConical,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Button,
  EmptyState,
  FormField,
  Input,
  InsetSurface,
  LoadingState,
  Panel,
  SectionHeader,
  Select,
  StatusIndicator,
  StatusNotice,
} from "../components/ui/primitives";
import { useToast } from "../components/ui/Toast";
import { formatDelta, formatMetricValue, formatTimestamp } from "../lib/utils";
import { orbitApi } from "../services/api";
import type {
  AIExplanationResponse,
  ExperimentComparison,
  ExperimentRecord,
  OrbitModelSpec,
  SimulationResult,
} from "../types/orbit";

interface ExperimentLabPageProps {
  models: OrbitModelSpec[];
  experiments: ExperimentRecord[];
  initialModelId?: string | null;
  initialOverrides?: Record<string, number> | null;
  defaultPrecision?: number;
  onExperimentSaved: (exp: ExperimentRecord) => void;
}

export function ExperimentLabPage({
  models,
  experiments,
  initialModelId,
  initialOverrides,
  defaultPrecision = 2,
  onExperimentSaved,
}: ExperimentLabPageProps) {
  const { notify } = useToast();

  const [selectedModelId, setSelectedModelId] = useState<string>(
    initialModelId || models[0]?.id || ""
  );
  const model = useMemo(
    () => models.find((m) => m.id === selectedModelId) ?? models[0] ?? null,
    [models, selectedModelId]
  );

  const [expName, setExpName] = useState("Expanded Power & Water Infrastructure");
  const [expDesc, setExpDesc] = useState(
    "Tests alternative parameter assumptions against the unmodified baseline."
  );
  const [variantOverrides, setVariantOverrides] = useState<Record<string, number>>({});

  const [running, setRunning] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baselineResult, setBaselineResult] = useState<SimulationResult | null>(null);
  const [variantResult, setVariantResult] = useState<SimulationResult | null>(null);
  const [comparison, setComparison] = useState<ExperimentComparison | null>(null);
  const [activeExperiment, setActiveExperiment] = useState<ExperimentRecord | null>(null);
  const [compareVar, setCompareVar] = useState<string>("");

  const [explaining, setExplaining] = useState(false);
  const [aiComparison, setAiComparison] = useState<AIExplanationResponse | null>(null);

  useEffect(() => {
    if (initialModelId) setSelectedModelId(initialModelId);
  }, [initialModelId]);

  useEffect(() => {
    if (!model) return;
    const defaults: Record<string, number> = {};
    model.parameters.forEach((p) => {
      defaults[p.id] = initialOverrides?.[p.id] ?? p.value;
    });
    if (model.id === "urban-ecosystem-baseline" && !initialOverrides) {
      defaults.power_stations = 5;
      defaults.water_reservoirs = 3;
    }
    setVariantOverrides(defaults);
    setCompareVar(model.stocks[0]?.id ?? "");
    setAiComparison(null);
  }, [model?.id]);

  const variableMetadata = useMemo(() => {
    const map: Record<string, { name: string; unit: string }> = {};
    if (!model) return map;
    model.stocks.forEach((s) => {
      map[s.id] = { name: s.name, unit: s.unit };
    });
    model.flows.forEach((f) => {
      map[f.id] = { name: f.name, unit: f.unit };
    });
    model.auxiliaries.forEach((a) => {
      map[a.id] = { name: a.name, unit: a.unit };
    });
    return map;
  }, [model]);

  const changedParameters = useMemo(() => {
    if (!model) return {} as Record<string, number>;
    const changed: Record<string, number> = {};
    model.parameters.forEach((p) => {
      const v = variantOverrides[p.id];
      if (v !== undefined && Math.abs(v - p.value) > 1e-9) {
        changed[p.id] = v;
      }
    });
    return changed;
  }, [model, variantOverrides]);

  const handleRunExperiment = async () => {
    if (!model) return;
    setRunning(true);
    setError(null);
    setAiComparison(null);

    if (Object.keys(changedParameters).length === 0) {
      setError("Modify at least one parameter relative to the baseline to compare scenarios.");
      setRunning(false);
      return;
    }

    try {
      const res = await orbitApi.createExperiment({
        name: expName.trim() || `${model.name} Variant`,
        description: expDesc.trim(),
        model_id: model.id,
        parameter_overrides: changedParameters,
      });
      setActiveExperiment(res.experiment);
      setBaselineResult(res.baseline_result);
      setVariantResult(res.variant_result);
      setComparison(res.comparison);
      setCompareVar(res.comparison.most_affected_variables[0] ?? model.stocks[0]?.id ?? "");
      onExperimentSaved(res.experiment);
      notify({
        tone: "success",
        title: "Experiment completed and saved",
        description: `Computed baseline vs. "${res.experiment.name}" (${Object.keys(changedParameters).length} parameter overrides).`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute comparison experiment.");
    } finally {
      setRunning(false);
    }
  };

  const handleLoadExperiment = async (exp: ExperimentRecord) => {
    setError(null);
    setAiComparison(null);
    setLoadingSaved(true);
    setSelectedModelId(exp.model_id);
    try {
      const res = await orbitApi.compareRuns(exp.baseline_run_id, exp.variant_run_id);
      setActiveExperiment(exp);
      setBaselineResult(res.baseline);
      setVariantResult(res.variant);
      setComparison(res.comparison);
      setCompareVar(res.comparison.most_affected_variables[0] ?? "");
      notify({
        tone: "info",
        title: "Experiment reproduced",
        description: `Loaded stored trajectories for "${exp.name}".`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load saved experiment.");
    } finally {
      setLoadingSaved(false);
    }
  };

  const handleExplainComparison = async () => {
    if (!activeExperiment) return;
    setExplaining(true);
    setError(null);
    try {
      const res = await orbitApi.explainResults({
        run_id: activeExperiment.baseline_run_id,
        variant_run_id: activeExperiment.variant_run_id,
        focus_question: `Explain the exact computed differences between the baseline and experiment "${activeExperiment.name}".`,
      });
      setAiComparison(res);
      notify({
        tone: "success",
        title: "AI comparative analysis generated",
        description: "Interpretation grounded in computed baseline and variant metrics.",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate comparative explanation.");
    } finally {
      setExplaining(false);
    }
  };

  const comparisonChartData = useMemo(() => {
    if (!baselineResult || !variantResult || !compareVar) return [];
    return baselineResult.times.map((t, i) => ({
      time: t,
      baseline: baselineResult.series[compareVar]?.[i] ?? 0,
      variant: variantResult.series[compareVar]?.[i] ?? 0,
    }));
  }, [baselineResult, variantResult, compareVar]);

  const compareVarMeta = variableMetadata[compareVar];
  const rankedVariables = useMemo(() => {
    if (!comparison) return [];
    const priority = new Set(comparison.most_affected_variables);
    const ordered = [
      ...comparison.most_affected_variables.filter((v) => comparison.deltas[v]),
      ...comparison.shared_variables.filter((v) => !priority.has(v) && comparison.deltas[v]),
    ];
    return ordered;
  }, [comparison]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Experiments"
        subtitle="Non-destructively clone a baseline model, override selected parameters, compare trajectories, and quantify numerical deltas."
        action={
          <Select
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            aria-label="Select baseline model"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                Baseline: {m.name}
              </option>
            ))}
          </Select>
        }
      />

      {error ? <StatusNotice tone="error" title="Experiment Error" message={error} /> : null}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Non-Destructive Variant Builder */}
        <Panel className="xl:col-span-4 p-5 space-y-5">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--orbit-border-subtle)]">
            <div>
              <h2 className="text-base font-semibold text-[var(--orbit-text-primary)]">
                Alternative Scenario Setup
              </h2>
              <p className="text-xs font-mono text-[var(--orbit-text-secondary)] mt-0.5 tabular-nums">
                {Object.keys(changedParameters).length} parameter{" "}
                {Object.keys(changedParameters).length === 1 ? "override" : "overrides"} active
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (!model) return;
                const reset: Record<string, number> = {};
                model.parameters.forEach((p) => {
                  reset[p.id] = p.value;
                });
                setVariantOverrides(reset);
              }}
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              Reset
            </Button>
          </div>

          <div className="space-y-4">
            <FormField id="exp-name" label="Experiment Name">
              <Input
                id="exp-name"
                value={expName}
                onChange={(e) => setExpName(e.target.value)}
                placeholder="Describe this parameter variant"
              />
            </FormField>

            <FormField id="exp-desc" label="Hypothesis / Notes">
              <Input
                id="exp-desc"
                value={expDesc}
                onChange={(e) => setExpDesc(e.target.value)}
                placeholder="What system change are you testing?"
              />
            </FormField>
          </div>

          <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 pt-4 border-t border-[var(--orbit-border-subtle)]">
            {model?.parameters.map((param) => {
              const val = variantOverrides[param.id] ?? param.value;
              const min = param.min_value ?? Math.min(0, param.value * 0.25);
              const max = param.max_value ?? (param.value === 0 ? 10 : param.value * 2.5);
              const step = param.step ?? (max - min) / 50;
              const changed = Math.abs(val - param.value) > 1e-9;

              return (
                <div key={param.id} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <label
                      htmlFor={`exp-param-${param.id}`}
                      className={
                        changed
                          ? "text-[var(--orbit-secondary)] font-semibold"
                          : "text-[var(--orbit-text-primary)] font-medium"
                      }
                    >
                      {param.name}
                    </label>
                    <span className="font-mono text-xs tabular-nums text-[var(--orbit-text-primary)] shrink-0">
                      <span className="text-[var(--orbit-text-muted)]">
                        {formatMetricValue(param.value, defaultPrecision)} &rarr;{" "}
                      </span>
                      {formatMetricValue(val, defaultPrecision)} {param.unit}
                    </span>
                  </div>
                  <input
                    id={`exp-param-${param.id}`}
                    type="range"
                    min={min}
                    max={max}
                    step={step || 0.01}
                    value={val}
                    onChange={(e) =>
                      setVariantOverrides((prev) => ({
                        ...prev,
                        [param.id]: Number(e.target.value),
                      }))
                    }
                    className="w-full h-2 accent-[var(--orbit-primary)] cursor-pointer"
                  />
                </div>
              );
            })}
          </div>

          <Button
            className="w-full"
            loading={running}
            disabled={!model}
            onClick={handleRunExperiment}
          >
            <Play className="w-4 h-4" aria-hidden="true" />
            {running ? "Computing Baseline & Variant..." : "Run & Compare Experiment"}
          </Button>
        </Panel>

        {/* Right: Comparison Charts, Deltas, AI Analysis, and History */}
        <div className="xl:col-span-8 space-y-6">
          {running || loadingSaved ? (
            <LoadingState
              title={running ? "Executing Paired Simulations" : "Loading Saved Experiment"}
              description="Running deterministic baseline and variant trajectories in the Python 3.11 engine..."
            />
          ) : comparison && baselineResult && variantResult ? (
            <>
              <Panel className="p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[var(--orbit-border-subtle)]">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-base font-semibold text-[var(--orbit-text-primary)]">
                        Computed Trajectory Overlay: Baseline vs. {activeExperiment?.name}
                      </h2>
                      <StatusIndicator tone="success" label="Computed Data" />
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-[var(--orbit-text-secondary)] mt-2 tabular-nums">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="w-5 h-0.5 inline-block"
                          style={{ backgroundColor: "var(--orbit-series-1)" }}
                          aria-hidden="true"
                        />
                        Baseline (solid)
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="w-5 h-0.5 inline-block border-t-2 border-dashed"
                          style={{ borderColor: "var(--orbit-series-2)" }}
                          aria-hidden="true"
                        />
                        Variant (dashed)
                      </span>
                      <span>
                        Events: {comparison.baseline_event_count} baseline /{" "}
                        {comparison.variant_event_count} variant
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={compareVar}
                      onChange={(e) => setCompareVar(e.target.value)}
                      aria-label="Variable to compare on chart"
                      className="font-mono"
                    >
                      {rankedVariables.map((v) => (
                        <option key={v} value={v}>
                          {variableMetadata[v]?.name || v}
                        </option>
                      ))}
                    </Select>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={explaining}
                      onClick={handleExplainComparison}
                    >
                      <Sparkles
                        className="w-4 h-4 text-[var(--orbit-secondary)]"
                        aria-hidden="true"
                      />
                      AI Diff Analysis
                    </Button>
                  </div>
                </div>

                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={comparisonChartData}
                      margin={{ top: 10, right: 24, left: 10, bottom: 20 }}
                    >
                      <CartesianGrid stroke="var(--orbit-chart-grid)" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="time"
                        stroke="var(--orbit-chart-axis)"
                        tick={{ fontSize: 12, fontFamily: "JetBrains Mono" }}
                        label={{
                          value: `Time (${baselineResult.time_unit})`,
                          position: "insideBottom",
                          offset: -12,
                          fill: "var(--orbit-chart-axis)",
                          fontSize: 12,
                        }}
                      />
                      <YAxis
                        stroke="var(--orbit-chart-axis)"
                        tick={{ fontSize: 12, fontFamily: "JetBrains Mono" }}
                        width={72}
                        tickFormatter={(v) => formatMetricValue(v, 1)}
                        label={
                          compareVarMeta?.unit
                            ? {
                                value: compareVarMeta.unit,
                                angle: -90,
                                position: "insideLeft",
                                fill: "var(--orbit-chart-axis)",
                                fontSize: 12,
                              }
                            : undefined
                        }
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--orbit-surface-elevated)",
                          border: "1px solid var(--orbit-border)",
                          borderRadius: "8px",
                          color: "var(--orbit-text-primary)",
                          fontSize: "12px",
                          fontFamily: "JetBrains Mono",
                        }}
                        formatter={(val: unknown) =>
                          typeof val === "number"
                            ? `${formatMetricValue(val, defaultPrecision)}${
                                compareVarMeta?.unit ? ` ${compareVarMeta.unit}` : ""
                              }`
                            : String(val)
                        }
                        labelFormatter={(label) => `t = ${label} ${baselineResult.time_unit}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="baseline"
                        name={`Baseline (${compareVarMeta?.name || compareVar})`}
                        stroke="var(--orbit-series-1)"
                        strokeWidth={2.25}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="variant"
                        name={`Variant (${compareVarMeta?.name || compareVar})`}
                        stroke="var(--orbit-series-2)"
                        strokeWidth={2.25}
                        strokeDasharray="6 4"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              {/* Quantitative Difference Table */}
              <Panel className="overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--orbit-border-subtle)] flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-[var(--orbit-text-primary)]">
                      Ranked Variable Deltas (Baseline vs. Variant)
                    </h2>
                    <p className="text-sm text-[var(--orbit-text-secondary)]">
                      Ordered by largest computed divergence. Select any row to inspect its overlaid trajectory.
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm font-mono tabular-nums">
                    <thead>
                      <tr className="border-b border-[var(--orbit-border-subtle)] text-xs text-[var(--orbit-text-secondary)]">
                        <th className="py-3 px-5 font-medium">Variable</th>
                        <th className="py-3 px-4 font-medium text-right">Baseline Final</th>
                        <th className="py-3 px-4 font-medium text-right">Variant Final</th>
                        <th className="py-3 px-4 font-medium text-right">Final Delta</th>
                        <th className="py-3 px-4 font-medium text-right">Change %</th>
                        <th className="py-3 px-5 font-medium text-right">Peak Divergence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--orbit-border-subtle)]">
                      {rankedVariables.map((vid) => {
                        const d = comparison.deltas[vid];
                        const selected = compareVar === vid;
                        return (
                          <tr
                            key={vid}
                            onClick={() => setCompareVar(vid)}
                            className={`cursor-pointer transition-colors ${
                              selected
                                ? "bg-[var(--orbit-selected-surface)]"
                                : "hover:bg-[var(--orbit-hover-surface)]"
                            }`}
                          >
                            <td className="py-3 px-5 text-[var(--orbit-text-primary)] font-medium">
                              <div>{variableMetadata[vid]?.name || vid}</div>
                              <div className="text-xs text-[var(--orbit-text-muted)]">
                                {vid}
                                {variableMetadata[vid]?.unit ? ` (${variableMetadata[vid].unit})` : ""}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right text-[var(--orbit-text-secondary)]">
                              {formatMetricValue(d.baseline_final, defaultPrecision)}
                            </td>
                            <td className="py-3 px-4 text-right text-[var(--orbit-secondary)] font-medium">
                              {formatMetricValue(d.variant_final, defaultPrecision)}
                            </td>
                            <td
                              className={`py-3 px-4 text-right font-medium ${
                                d.final_diff > 0
                                  ? "text-[var(--orbit-success)]"
                                  : d.final_diff < 0
                                  ? "text-[var(--orbit-danger)]"
                                  : "text-[var(--orbit-text-secondary)]"
                              }`}
                            >
                              {formatDelta(d.final_diff)}
                            </td>
                            <td className="py-3 px-4 text-right text-[var(--orbit-text-primary)]">
                              {d.final_pct_diff !== null
                                ? `${d.final_pct_diff > 0 ? "+" : ""}${d.final_pct_diff}%`
                                : "—"}
                            </td>
                            <td className="py-3 px-5 text-right text-[var(--orbit-text-secondary)]">
                              {formatMetricValue(d.max_abs_divergence, defaultPrecision)} @ t=
                              {d.max_divergence_time}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>

              {aiComparison ? (
                <Panel className="p-5 space-y-4 border-[var(--orbit-secondary)]/40">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--orbit-border-subtle)]">
                    <div className="flex items-center gap-2">
                      <Sparkles
                        className="w-4 h-4 text-[var(--orbit-secondary)]"
                        aria-hidden="true"
                      />
                      <h2 className="text-base font-semibold text-[var(--orbit-text-primary)]">
                        AI-Generated Comparative Interpretation
                      </h2>
                    </div>
                    <StatusIndicator tone="info" label="AI Commentary · Grounded in Run Metrics" />
                  </div>

                  <div className="space-y-2 prose-measure">
                    <h3 className="text-base font-semibold text-[var(--orbit-text-primary)]">
                      {aiComparison.headline}
                    </h3>
                    <p className="text-base text-[var(--orbit-text-secondary)] leading-relaxed">
                      {aiComparison.summary}
                    </p>
                  </div>

                  {aiComparison.key_changes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {aiComparison.key_changes.map((ch, idx) => (
                        <InsetSurface key={idx} className="p-3.5 space-y-1.5">
                          <div className="font-mono text-xs font-semibold text-[var(--orbit-secondary)]">
                            {ch.variable}
                          </div>
                          <p className="text-sm text-[var(--orbit-text-primary)] leading-relaxed">
                            {ch.observation}
                          </p>
                          <div className="font-mono text-xs text-[var(--orbit-text-muted)]">
                            Evidence: {ch.computed_evidence}
                          </div>
                        </InsetSurface>
                      ))}
                    </div>
                  ) : null}

                  <StatusNotice tone="warning" message={aiComparison.disclaimer} />
                </Panel>
              ) : null}
            </>
          ) : (
            <EmptyState
              title="Configure an alternative parameter set and run comparison"
              description="ORBIT keeps the original baseline model untouched and computes both trajectories in Python so every numerical delta is exact and reproducible."
              nextStep="Adjust one or more parameter sliders on the left, then select Run & Compare Experiment."
              action={
                <div className="inline-flex items-center gap-2 text-sm text-[var(--orbit-text-secondary)]">
                  <FlaskConical className="w-4 h-4 text-[var(--orbit-secondary)]" aria-hidden="true" />
                  <span>Deterministic baseline vs. variant diff engine</span>
                </div>
              }
            />
          )}

          {/* Saved Experiment History */}
          <Panel className="p-5 space-y-4">
            <div className="pb-3 border-b border-[var(--orbit-border-subtle)] flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-[var(--orbit-text-primary)]">
                Saved Experiment History
              </h2>
              <span className="text-xs font-mono text-[var(--orbit-text-secondary)] tabular-nums">
                {experiments.length} stored
              </span>
            </div>

            {experiments.length === 0 ? (
              <p className="text-sm text-[var(--orbit-text-secondary)] py-2">
                No experiments saved yet. Run your first baseline vs. variant comparison above.
              </p>
            ) : (
              <div className="divide-y divide-[var(--orbit-border-subtle)]">
                {experiments.map((exp) => (
                  <div
                    key={exp.id}
                    className="py-3.5 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-[var(--orbit-text-primary)]">
                        {exp.name}
                      </div>
                      <div className="font-mono text-xs text-[var(--orbit-text-secondary)] mt-1 break-words">
                        {exp.model_name || exp.model_id} &middot;{" "}
                        {Object.entries(exp.parameter_overrides)
                          .map(([k, v]) => `${k}=${v}`)
                          .join(", ")}{" "}
                        &middot; {formatTimestamp(exp.created_at)}
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => handleLoadExperiment(exp)}>
                      Reproduce &amp; Inspect
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
