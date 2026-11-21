import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  GitBranch,
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
  InsetSurface,
  LoadingState,
  Panel,
  SectionHeader,
  Select,
  StatusIndicator,
  StatusNotice,
} from "../components/ui/primitives";
import { useToast } from "../components/ui/Toast";
import {
  downloadTextFile,
  formatBytes,
  formatMetricValue,
  formatTimestamp,
} from "../lib/utils";
import { orbitApi } from "../services/api";
import type {
  AIExplanationResponse,
  ExportRecord,
  OrbitModelSpec,
  SimulationResult,
  SimulationRunRecord,
} from "../types/orbit";
import { exportSimulationPdfReport } from "../utils/pdfReport";

interface ReportsPageProps {
  models: OrbitModelSpec[];
  runs: SimulationRunRecord[];
  initialRunId?: string | null;
  defaultPrecision?: number;
  onExportLogged: () => void;
}

const LINE_COLORS = [
  "var(--orbit-series-1)",
  "var(--orbit-series-2)",
  "var(--orbit-series-3)",
  "var(--orbit-series-4)",
];

export function ReportsPage({
  models,
  runs,
  initialRunId,
  defaultPrecision = 2,
  onExportLogged,
}: ReportsPageProps) {
  const { notify } = useToast();
  const completedRuns = useMemo(() => runs.filter((r) => r.status === "completed"), [runs]);

  const [selectedRunId, setSelectedRunId] = useState<string>(
    initialRunId || completedRuns[0]?.id || ""
  );
  const [runDetail, setRunDetail] = useState<SimulationRunRecord | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [exportsList, setExportsList] = useState<ExportRecord[]>([]);
  const [explanation, setExplanation] = useState<AIExplanationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialRunId) {
      setSelectedRunId(initialRunId);
    } else if (!selectedRunId && completedRuns[0]) {
      setSelectedRunId(completedRuns[0].id);
    }
  }, [initialRunId, completedRuns, selectedRunId]);

  useEffect(() => {
    orbitApi
      .listExports()
      .then((res) => setExportsList(res.exports))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedRunId) return;
    setLoading(true);
    setError(null);
    setExplanation(null);
    orbitApi
      .getRunResults(selectedRunId)
      .then(({ run, result: res }) => {
        setRunDetail(run);
        setResult(res);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load run report."))
      .finally(() => setLoading(false));
  }, [selectedRunId]);

  const model = models.find((m) => m.id === runDetail?.model_id) ?? null;

  const handleExport = async (format: "csv" | "json" | "pdf") => {
    if (!runDetail || !result || !model) return;
    setExportingFormat(format);
    setError(null);
    try {
      const res = await orbitApi.exportRun(runDetail.id, format);
      if (format === "pdf") {
        exportSimulationPdfReport({ model, run: runDetail, result, explanation });
      } else if (res.content !== undefined) {
        downloadTextFile(res.filename, res.content, res.mime_type);
      }
      setExportsList((prev) => [res.export_record, ...prev]);
      onExportLogged();
      notify({
        tone: "success",
        title: `${format.toUpperCase()} export complete`,
        description: `Saved ${res.filename} and recorded export metadata in SQLite.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to export ${format.toUpperCase()}.`);
    } finally {
      setExportingFormat(null);
    }
  };

  const handleGenerateAiSummary = async () => {
    if (!runDetail) return;
    setExplaining(true);
    setError(null);
    try {
      const res = await orbitApi.explainResults({ run_id: runDetail.id });
      setExplanation(res);
      notify({
        tone: "success",
        title: "AI interpretation generated",
        description: "Evidence-grounded commentary is now ready to include in your PDF report.",
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate grounded AI interpretation."
      );
    } finally {
      setExplaining(false);
    }
  };

  if (completedRuns.length === 0) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Results & Reports"
          subtitle="Export reproducible simulation data, numerical tables, variable relationships, and evidence-grounded analyses."
        />
        <EmptyState
          title="No completed simulation runs yet"
          description="Execute a simulation in the Simulation Workspace or Experiments Lab to inspect verified numerical reports and export CSV, JSON, or PDF files."
          nextStep="Open Simulation Workspace and run a validated model to populate this report view."
        />
      </div>
    );
  }

  const primaryVars =
    model?.visualization?.primary_series && model.visualization.primary_series.length > 0
      ? model.visualization.primary_series
      : Object.keys(result?.series ?? {}).slice(0, 4);

  const chartData =
    result?.times.map((t, idx) => {
      const row: Record<string, number> = { time: t };
      primaryVars.forEach((v) => {
        row[v] = result.series[v]?.[idx] ?? 0;
      });
      return row;
    }) ?? [];

  const flowMap = new Map(model?.flows.map((f) => [f.id, f]) ?? []);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Results & Reports"
        subtitle="Inspect verified numerical tables, variable relationships, threshold events, and export reproducible CSV, JSON, or PDF reports."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={selectedRunId}
              onChange={(e) => setSelectedRunId(e.target.value)}
              aria-label="Select completed simulation run"
            >
              {completedRuns.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.model_name || r.model_id} ({r.id})
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              variant="secondary"
              loading={exportingFormat === "csv"}
              disabled={!result || exportingFormat !== null}
              onClick={() => handleExport("csv")}
            >
              <FileSpreadsheet
                className="w-4 h-4 text-[var(--orbit-success)]"
                aria-hidden="true"
              />
              Export CSV
            </Button>
            <Button
              size="sm"
              variant="secondary"
              loading={exportingFormat === "json"}
              disabled={!result || exportingFormat !== null}
              onClick={() => handleExport("json")}
            >
              <FileJson className="w-4 h-4 text-[var(--orbit-secondary)]" aria-hidden="true" />
              Export JSON
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={exportingFormat === "pdf"}
              disabled={!result || exportingFormat !== null}
              onClick={() => handleExport("pdf")}
            >
              <FileText className="w-4 h-4" aria-hidden="true" />
              Export PDF Report
            </Button>
          </div>
        }
      />

      {error ? <StatusNotice tone="error" title="Report Error" message={error} /> : null}

      {loading || !result || !runDetail ? (
        <LoadingState
          title="Loading Simulation Report"
          description="Retrieving persisted run metrics, time-series arrays, and model metadata from SQLite..."
        />
      ) : (
        <div className="space-y-6">
          {/* Execution Provenance Metadata */}
          <Panel className="p-5 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm font-mono tabular-nums">
            <div>
              <div className="text-xs text-[var(--orbit-text-secondary)]">Run ID</div>
              <div className="text-[var(--orbit-text-primary)] mt-1 truncate">{runDetail.id}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--orbit-text-secondary)]">Solver &amp; Seed</div>
              <div className="text-[var(--orbit-text-primary)] mt-1">
                {result.solver.toUpperCase()} &middot; seed {result.random_seed}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--orbit-text-secondary)]">Time Horizon</div>
              <div className="text-[var(--orbit-text-primary)] mt-1">
                {result.start_time}&ndash;{result.end_time} {result.time_unit} (dt={result.dt})
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--orbit-text-secondary)]">Compute Time</div>
              <div className="text-[var(--orbit-text-primary)] mt-1">{result.execution_ms} ms</div>
            </div>
            <div>
              <div className="text-xs text-[var(--orbit-text-secondary)]">Recorded</div>
              <div className="text-[var(--orbit-text-primary)] mt-1">
                {formatTimestamp(runDetail.created_at)}
              </div>
            </div>
          </Panel>

          {/* Computed Chart vs. AI-Generated Interpretation */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <Panel className="lg:col-span-7 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--orbit-border-subtle)]">
                <h2 className="text-base font-semibold text-[var(--orbit-text-primary)]">
                  Primary Computed Trajectories
                </h2>
                <StatusIndicator tone="success" label="Computed Data · Python Engine" />
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 20, left: 6, bottom: 20 }}>
                    <CartesianGrid stroke="var(--orbit-chart-grid)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="time"
                      stroke="var(--orbit-chart-axis)"
                      tick={{ fontSize: 12, fontFamily: "JetBrains Mono" }}
                      label={{
                        value: `Time (${result.time_unit})`,
                        position: "insideBottom",
                        offset: -12,
                        fill: "var(--orbit-chart-axis)",
                        fontSize: 12,
                      }}
                    />
                    <YAxis
                      stroke="var(--orbit-chart-axis)"
                      tick={{ fontSize: 12, fontFamily: "JetBrains Mono" }}
                      width={66}
                      tickFormatter={(v) => formatMetricValue(v, 1)}
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
                      labelFormatter={(label) => `t = ${label} ${result.time_unit}`}
                    />
                    {primaryVars.map((v, i) => (
                      <Line
                        key={v}
                        type="monotone"
                        dataKey={v}
                        stroke={LINE_COLORS[i % LINE_COLORS.length]}
                        strokeWidth={2.25}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel className="lg:col-span-5 p-5 space-y-4 border-[var(--orbit-secondary)]/40">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--orbit-border-subtle)]">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[var(--orbit-secondary)]" aria-hidden="true" />
                  <h2 className="text-base font-semibold text-[var(--orbit-text-primary)]">
                    AI-Generated Interpretation
                  </h2>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={explaining}
                  onClick={handleGenerateAiSummary}
                >
                  Generate Interpretation
                </Button>
              </div>

              <StatusIndicator
                tone="info"
                label="AI Commentary · Separate from Deterministic Results"
              />

              {explanation ? (
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-[var(--orbit-text-primary)]">
                    {explanation.headline}
                  </h3>
                  <p className="text-sm text-[var(--orbit-text-secondary)] leading-relaxed">
                    {explanation.summary}
                  </p>
                  {explanation.causal_mechanisms.length > 0 ? (
                    <InsetSurface className="p-3.5 space-y-1.5">
                      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--orbit-text-secondary)]">
                        Causal Mechanisms Cited
                      </div>
                      <ul className="space-y-1 text-sm text-[var(--orbit-text-primary)] list-disc pl-5">
                        {explanation.causal_mechanisms.slice(0, 3).map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </InsetSurface>
                  ) : null}
                  <StatusNotice tone="warning" message={explanation.disclaimer} />
                </div>
              ) : (
                <p className="text-sm text-[var(--orbit-text-secondary)] leading-relaxed py-4">
                  Generate an evidence-grounded AI commentary based strictly on the computed
                  numerical metrics above. Once generated, it is also bundled into your PDF export
                  with clear separation from verified calculations.
                </p>
              )}
            </Panel>
          </div>

          {/* Complete Computed Variable Metrics Table */}
          <Panel className="overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--orbit-border-subtle)] flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-[var(--orbit-text-primary)]">
                Complete Computed Metrics
              </h2>
              <span className="text-xs font-mono text-[var(--orbit-text-secondary)] tabular-nums">
                {Object.keys(result.metrics).length} tracked variables &middot; {result.steps} steps
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm font-mono tabular-nums">
                <thead>
                  <tr className="border-b border-[var(--orbit-border-subtle)] text-xs text-[var(--orbit-text-secondary)]">
                    <th className="py-3 px-5 font-medium">Variable</th>
                    <th className="py-3 px-4 font-medium text-right">Initial</th>
                    <th className="py-3 px-4 font-medium text-right">Final</th>
                    <th className="py-3 px-4 font-medium text-right">Min</th>
                    <th className="py-3 px-4 font-medium text-right">Max</th>
                    <th className="py-3 px-4 font-medium text-right">Mean</th>
                    <th className="py-3 px-5 font-medium text-right">Change %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--orbit-border-subtle)]">
                  {Object.entries(result.metrics).map(([vid, m]) => (
                    <tr key={vid} className="hover:bg-[var(--orbit-hover-surface)]">
                      <td className="py-3 px-5 text-[var(--orbit-text-primary)] font-medium">
                        {vid}
                      </td>
                      <td className="py-3 px-4 text-right text-[var(--orbit-text-secondary)]">
                        {formatMetricValue(m.initial, defaultPrecision)}
                      </td>
                      <td className="py-3 px-4 text-right text-[var(--orbit-secondary)] font-medium">
                        {formatMetricValue(m.final, defaultPrecision)}
                      </td>
                      <td className="py-3 px-4 text-right text-[var(--orbit-text-secondary)]">
                        {formatMetricValue(m.min, defaultPrecision)}
                      </td>
                      <td className="py-3 px-4 text-right text-[var(--orbit-text-secondary)]">
                        {formatMetricValue(m.max, defaultPrecision)}
                      </td>
                      <td className="py-3 px-4 text-right text-[var(--orbit-text-primary)]">
                        {formatMetricValue(m.mean, defaultPrecision)}
                      </td>
                      <td className="py-3 px-5 text-right text-[var(--orbit-text-primary)]">
                        {m.pct_change !== null
                          ? `${m.pct_change > 0 ? "+" : ""}${m.pct_change}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Variable Relationships & Threshold Events */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Panel className="p-5 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-[var(--orbit-border-subtle)]">
                <GitBranch className="w-4 h-4 text-[var(--orbit-primary)]" aria-hidden="true" />
                <h2 className="text-base font-semibold text-[var(--orbit-text-primary)]">
                  Variable Relationships &amp; Equations
                </h2>
              </div>
              {model ? (
                <div className="space-y-3">
                  {model.stocks.map((stock) => (
                    <InsetSurface key={stock.id} className="p-3.5 space-y-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold text-[var(--orbit-text-primary)]">
                          {stock.name}
                        </span>
                        <span className="font-mono text-xs text-[var(--orbit-text-muted)]">
                          d({stock.id})/dt ({stock.unit})
                        </span>
                      </div>
                      <div className="font-mono text-xs text-[var(--orbit-text-secondary)] space-y-1">
                        <div>
                          <span className="text-[var(--orbit-success)]">+ Inflows:</span>{" "}
                          {stock.inflows.length > 0
                            ? stock.inflows
                                .map((fid) => `${fid} [${flowMap.get(fid)?.equation ?? "—"}]`)
                                .join(" ; ")
                            : "None"}
                        </div>
                        <div>
                          <span className="text-[var(--orbit-danger)]">&minus; Outflows:</span>{" "}
                          {stock.outflows.length > 0
                            ? stock.outflows
                                .map((fid) => `${fid} [${flowMap.get(fid)?.equation ?? "—"}]`)
                                .join(" ; ")
                            : "None"}
                        </div>
                      </div>
                    </InsetSurface>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--orbit-text-secondary)]">
                  Model specification is no longer available for this archived run.
                </p>
              )}
            </Panel>

            <Panel className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--orbit-border-subtle)]">
                <div className="flex items-center gap-2">
                  <AlertTriangle
                    className="w-4 h-4 text-[var(--orbit-warning)]"
                    aria-hidden="true"
                  />
                  <h2 className="text-base font-semibold text-[var(--orbit-text-primary)]">
                    Important Threshold Events
                  </h2>
                </div>
                <span className="text-xs font-mono text-[var(--orbit-text-secondary)] tabular-nums">
                  {result.events.length} recorded
                </span>
              </div>

              {result.events.length === 0 ? (
                <p className="text-sm text-[var(--orbit-text-secondary)] py-2">
                  No constraint thresholds were crossed during this simulation horizon.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {result.events.map((ev, idx) => (
                    <InsetSurface key={idx} className="p-3.5 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <StatusIndicator
                          tone={
                            ev.severity === "critical"
                              ? "danger"
                              : ev.severity === "warning"
                              ? "warning"
                              : "info"
                          }
                          label={ev.severity.toUpperCase()}
                        />
                        <span className="font-mono text-xs text-[var(--orbit-text-muted)] tabular-nums">
                          t = {ev.time} {result.time_unit} (step {ev.step})
                        </span>
                      </div>
                      <p className="text-sm text-[var(--orbit-text-primary)]">{ev.message}</p>
                      <div className="font-mono text-xs text-[var(--orbit-text-secondary)] tabular-nums">
                        {ev.variable} = {formatMetricValue(ev.value, defaultPrecision)} (threshold{" "}
                        {ev.threshold})
                      </div>
                    </InsetSurface>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          {/* Assumptions, Limitations & Export History */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Panel className="p-5 space-y-3">
              <h2 className="text-base font-semibold text-[var(--orbit-text-primary)] pb-3 border-b border-[var(--orbit-border-subtle)]">
                Model Assumptions &amp; Limitations
              </h2>
              <div className="space-y-2.5">
                {(model?.assumptions ?? result.assumptions).map((a) => (
                  <InsetSurface key={a.id} className="p-3.5">
                    <p className="text-sm text-[var(--orbit-text-primary)] leading-relaxed">
                      {a.statement}
                    </p>
                    <div className="font-mono text-xs text-[var(--orbit-text-muted)] mt-1.5">
                      {a.category} &middot; {a.impact} impact &middot; source: {a.source}
                    </div>
                  </InsetSurface>
                ))}
              </div>
              <StatusNotice
                tone="info"
                message="Simulation outputs are strictly deterministic consequences of the model equations, initial conditions, and assumptions shown above."
              />
            </Panel>

            <Panel className="p-5 space-y-3">
              <div className="flex items-center gap-2 pb-3 border-b border-[var(--orbit-border-subtle)]">
                <Download className="w-4 h-4 text-[var(--orbit-primary)]" aria-hidden="true" />
                <h2 className="text-base font-semibold text-[var(--orbit-text-primary)]">
                  Export Audit History
                </h2>
              </div>
              {exportsList.length === 0 ? (
                <p className="text-sm text-[var(--orbit-text-secondary)] py-3">
                  No files exported yet. Use the CSV, JSON, or PDF actions above.
                </p>
              ) : (
                <div className="divide-y divide-[var(--orbit-border-subtle)]">
                  {exportsList.slice(0, 10).map((ex) => (
                    <div
                      key={ex.id}
                      className="py-3 flex flex-wrap items-center justify-between gap-2 font-mono text-xs tabular-nums"
                    >
                      <span className="text-[var(--orbit-text-primary)] font-medium">
                        {ex.format.toUpperCase()} &middot; {ex.run_id}
                      </span>
                      <span className="text-[var(--orbit-text-secondary)]">
                        {formatBytes(ex.size_bytes)} &middot; {formatTimestamp(ex.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
