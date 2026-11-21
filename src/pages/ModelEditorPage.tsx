import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  GitBranch,
  Play,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { DependencyGraph } from "../components/charts/DependencyGraph";
import {
  Button,
  FormField,
  IconButton,
  Input,
  InsetSurface,
  Panel,
  SectionHeader,
  Select,
  StatusIndicator,
  StatusNotice,
  Tabs,
  Textarea,
} from "../components/ui/primitives";
import { useToast } from "../components/ui/Toast";
import { orbitApi } from "../services/api";
import type {
  OrbitModelSpec,
  SolverType,
  ValidationReport,
} from "../types/orbit";

interface ModelEditorPageProps {
  model: OrbitModelSpec | null;
  onModelSaved: (updated: OrbitModelSpec) => void;
  onApproveAndRun: (modelId: string) => void;
}

type EditorTab = "stocks_flows" | "params_aux" | "graph" | "assumptions_time";

export function ModelEditorPage({
  model,
  onModelSaved,
  onApproveAndRun,
}: ModelEditorPageProps) {
  const { notify } = useToast();
  const [draft, setDraft] = useState<OrbitModelSpec | null>(model);
  const [activeTab, setActiveTab] = useState<EditorTab>("stocks_flows");
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedGraphNode, setSelectedGraphNode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(model);
    setError(null);
    if (model) {
      runValidation(model);
    }
  }, [model?.id, model?.version]);

  const runValidation = async (spec: OrbitModelSpec) => {
    setValidating(true);
    setError(null);
    try {
      const report = await orbitApi.validateDraft(spec);
      setValidation(report);
      return report;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation request failed.");
      return null;
    } finally {
      setValidating(false);
    }
  };

  if (!draft) {
    return (
      <StatusNotice
        tone="info"
        title="No model selected"
        message="Choose a model from Overview or Projects, or generate one in New Simulation."
      />
    );
  }

  const updateDraft = (mutator: (prev: OrbitModelSpec) => OrbitModelSpec) => {
    setDraft((prev) => (prev ? { ...mutator(prev), approved: false } : prev));
  };

  const handleSave = async (approve: boolean) => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const report = await runValidation(draft);
      if (approve && (!report || !report.valid)) {
        setError("Resolve all blocking validation errors before approving this model for execution.");
        setSaving(false);
        return;
      }

      const payload: OrbitModelSpec & { change_note: string } = {
        ...draft,
        approved: approve,
        change_note: approve ? "Validated and approved for execution" : "Edited in Model Editor",
      };

      const isNew = !model?.created_at;
      const response = isNew
        ? await orbitApi.createModel(payload)
        : await orbitApi.updateModel(draft.id, payload);

      setDraft(response.model);
      setValidation(response.validation);
      onModelSaved(response.model);
      notify({
        tone: "success",
        title: approve ? "Model validated and approved" : "Model version saved",
        description: `${response.model.name} · v${response.model.version}`,
      });
      if (approve) {
        onApproveAndRun(response.model.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save model.");
    } finally {
      setSaving(false);
    }
  };

  const addStock = () => {
    const idx = draft.stocks.length + 1;
    updateDraft((prev) => ({
      ...prev,
      stocks: [
        ...prev.stocks,
        {
          id: `stock_${idx}`,
          name: `Stock ${idx}`,
          initial_value: 100,
          unit: "units",
          description: "",
          inflows: [],
          outflows: [],
          min_value: 0,
        },
      ],
    }));
  };

  const addFlow = () => {
    const idx = draft.flows.length + 1;
    updateDraft((prev) => ({
      ...prev,
      flows: [
        ...prev.flows,
        {
          id: `flow_${idx}`,
          name: `Flow ${idx}`,
          equation: "0",
          unit: "units/yr",
          description: "",
          source_stock: null,
          target_stock: null,
          non_negative: true,
        },
      ],
    }));
  };

  const addParameter = () => {
    const idx = draft.parameters.length + 1;
    updateDraft((prev) => ({
      ...prev,
      parameters: [
        ...prev.parameters,
        {
          id: `param_${idx}`,
          name: `Parameter ${idx}`,
          value: 1,
          unit: "",
          description: "",
          min_value: 0,
          max_value: 10,
          step: 0.1,
          editable: true,
        },
      ],
    }));
  };

  const addAuxiliary = () => {
    const idx = draft.auxiliaries.length + 1;
    updateDraft((prev) => ({
      ...prev,
      auxiliaries: [
        ...prev.auxiliaries,
        {
          id: `aux_${idx}`,
          name: `Auxiliary ${idx}`,
          equation: "0",
          unit: "",
          description: "",
        },
      ],
    }));
  };

  const addAssumption = () => {
    const idx = draft.assumptions.length + 1;
    updateDraft((prev) => ({
      ...prev,
      assumptions: [
        ...prev.assumptions,
        {
          id: `assump_${idx}`,
          statement: "",
          category: "modeling",
          source: "user",
          impact: "medium",
        },
      ],
    }));
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Model Inspector & Editor"
        subtitle={`${draft.name} · v${draft.version} · Schema v${draft.schema_version}`}
        action={
          <>
            <Button
              variant="secondary"
              loading={validating}
              onClick={() => runValidation(draft)}
            >
              <ShieldCheck className="w-4 h-4 text-[var(--orbit-secondary)]" aria-hidden="true" />
              Validate Equations
            </Button>
            <Button variant="outline" loading={saving} onClick={() => handleSave(false)}>
              <Save className="w-4 h-4" aria-hidden="true" />
              Save Version
            </Button>
            <Button
              variant="primary"
              loading={saving}
              disabled={validation !== null && !validation.valid}
              onClick={() => handleSave(true)}
            >
              <Play className="w-4 h-4" aria-hidden="true" />
              Approve &amp; Run
            </Button>
          </>
        }
      />

      {error ? <StatusNotice tone="error" title="Validation or Save Error" message={error} /> : null}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-5">
          {/* Model Metadata */}
          <Panel className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <FormField id="editor-model-name" label="Model Name">
                <Input
                  id="editor-model-name"
                  value={draft.name}
                  onChange={(e) => updateDraft((p) => ({ ...p, name: e.target.value }))}
                />
              </FormField>
            </div>
            <div>
              <FormField id="editor-model-domain" label="Domain">
                <Input
                  id="editor-model-domain"
                  value={draft.domain}
                  onChange={(e) => updateDraft((p) => ({ ...p, domain: e.target.value }))}
                />
              </FormField>
            </div>
            <div className="md:col-span-3">
              <FormField id="editor-model-desc" label="Description">
                <Textarea
                  id="editor-model-desc"
                  rows={2}
                  value={draft.description}
                  onChange={(e) => updateDraft((p) => ({ ...p, description: e.target.value }))}
                />
              </FormField>
            </div>
          </Panel>

          <Tabs<EditorTab>
            ariaLabel="Model editor sections"
            value={activeTab}
            onChange={setActiveTab}
            items={[
              {
                id: "stocks_flows",
                label: `Stocks & Flows (${draft.stocks.length + draft.flows.length})`,
              },
              {
                id: "params_aux",
                label: `Parameters & Auxiliaries (${draft.parameters.length + draft.auxiliaries.length})`,
              },
              { id: "graph", label: "Dependency Graph" },
              { id: "assumptions_time", label: "Assumptions & Time" },
            ]}
          />

          <InsetSurface className="px-4 py-3 text-xs font-mono text-[var(--orbit-text-secondary)]">
            Allowlisted functions: min, max, abs, sqrt, exp, log, ln, sin, cos, pow, round,
            clamp(x, lo, hi), safe_div(a, b, 0), step(t, x) · Conditionals: a if cond else b
          </InsetSurface>

          {activeTab === "stocks_flows" ? (
            <div className="space-y-6">
              <Panel className="p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">Stocks (Accumulating State)</h2>
                  <Button size="sm" variant="secondary" onClick={addStock}>
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    Add Stock
                  </Button>
                </div>
                <div className="space-y-3">
                  {draft.stocks.map((s, idx) => (
                    <InsetSurface
                      key={`${s.id}-${idx}`}
                      className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3"
                    >
                      <div className="md:col-span-3">
                        <label className="block text-xs text-[var(--orbit-text-secondary)] mb-1">
                          Identifier
                        </label>
                        <Input
                          className="font-mono text-sm"
                          value={s.id}
                          onChange={(e) =>
                            updateDraft((p) => {
                              const next = [...p.stocks];
                              next[idx] = { ...next[idx], id: e.target.value };
                              return { ...p, stocks: next };
                            })
                          }
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-xs text-[var(--orbit-text-secondary)] mb-1">
                          Label
                        </label>
                        <Input
                          value={s.name}
                          onChange={(e) =>
                            updateDraft((p) => {
                              const next = [...p.stocks];
                              next[idx] = { ...next[idx], name: e.target.value };
                              return { ...p, stocks: next };
                            })
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs text-[var(--orbit-text-secondary)] mb-1">
                          Initial
                        </label>
                        <Input
                          type="number"
                          className="font-mono tabular-nums"
                          value={s.initial_value}
                          onChange={(e) =>
                            updateDraft((p) => {
                              const next = [...p.stocks];
                              next[idx] = { ...next[idx], initial_value: Number(e.target.value) };
                              return { ...p, stocks: next };
                            })
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs text-[var(--orbit-text-secondary)] mb-1">
                          Unit
                        </label>
                        <Input
                          value={s.unit}
                          onChange={(e) =>
                            updateDraft((p) => {
                              const next = [...p.stocks];
                              next[idx] = { ...next[idx], unit: e.target.value };
                              return { ...p, stocks: next };
                            })
                          }
                        />
                      </div>
                      <div className="md:col-span-2 flex items-end justify-end">
                        <IconButton
                          label={`Remove stock ${s.name}`}
                          variant="danger"
                          onClick={() =>
                            updateDraft((p) => ({
                              ...p,
                              stocks: p.stocks.filter((_, i) => i !== idx),
                            }))
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </IconButton>
                      </div>
                      <div className="md:col-span-6">
                        <label className="block text-xs text-[var(--orbit-text-secondary)] mb-1">
                          Inflow IDs (comma-separated)
                        </label>
                        <Input
                          className="font-mono text-sm"
                          value={s.inflows.join(", ")}
                          onChange={(e) =>
                            updateDraft((p) => {
                              const next = [...p.stocks];
                              next[idx] = {
                                ...next[idx],
                                inflows: e.target.value
                                  .split(",")
                                  .map((x) => x.trim())
                                  .filter(Boolean),
                              };
                              return { ...p, stocks: next };
                            })
                          }
                        />
                      </div>
                      <div className="md:col-span-6">
                        <label className="block text-xs text-[var(--orbit-text-secondary)] mb-1">
                          Outflow IDs (comma-separated)
                        </label>
                        <Input
                          className="font-mono text-sm"
                          value={s.outflows.join(", ")}
                          onChange={(e) =>
                            updateDraft((p) => {
                              const next = [...p.stocks];
                              next[idx] = {
                                ...next[idx],
                                outflows: e.target.value
                                  .split(",")
                                  .map((x) => x.trim())
                                  .filter(Boolean),
                              };
                              return { ...p, stocks: next };
                            })
                          }
                        />
                      </div>
                    </InsetSurface>
                  ))}
                </div>
              </Panel>

              <Panel className="p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">Flows (Rate Equations)</h2>
                  <Button size="sm" variant="secondary" onClick={addFlow}>
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    Add Flow
                  </Button>
                </div>
                <div className="space-y-3">
                  {draft.flows.map((f, idx) => (
                    <InsetSurface
                      key={`${f.id}-${idx}`}
                      className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3"
                    >
                      <div className="md:col-span-3">
                        <label className="block text-xs text-[var(--orbit-text-secondary)] mb-1">
                          Flow ID
                        </label>
                        <Input
                          className="font-mono text-sm"
                          value={f.id}
                          onChange={(e) =>
                            updateDraft((p) => {
                              const next = [...p.flows];
                              next[idx] = { ...next[idx], id: e.target.value };
                              return { ...p, flows: next };
                            })
                          }
                        />
                      </div>
                      <div className="md:col-span-4">
                        <label className="block text-xs text-[var(--orbit-text-secondary)] mb-1">
                          Label
                        </label>
                        <Input
                          value={f.name}
                          onChange={(e) =>
                            updateDraft((p) => {
                              const next = [...p.flows];
                              next[idx] = { ...next[idx], name: e.target.value };
                              return { ...p, flows: next };
                            })
                          }
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-xs text-[var(--orbit-text-secondary)] mb-1">
                          Unit
                        </label>
                        <Input
                          value={f.unit}
                          onChange={(e) =>
                            updateDraft((p) => {
                              const next = [...p.flows];
                              next[idx] = { ...next[idx], unit: e.target.value };
                              return { ...p, flows: next };
                            })
                          }
                        />
                      </div>
                      <div className="md:col-span-2 flex items-end justify-end">
                        <IconButton
                          label={`Remove flow ${f.name}`}
                          variant="danger"
                          onClick={() =>
                            updateDraft((p) => ({
                              ...p,
                              flows: p.flows.filter((_, i) => i !== idx),
                            }))
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </IconButton>
                      </div>
                      <div className="md:col-span-12">
                        <label className="block text-xs text-[var(--orbit-text-secondary)] mb-1">
                          Equation
                        </label>
                        <Input
                          className="font-mono text-sm text-[var(--orbit-secondary)]"
                          value={f.equation}
                          onChange={(e) =>
                            updateDraft((p) => {
                              const next = [...p.flows];
                              next[idx] = { ...next[idx], equation: e.target.value };
                              return { ...p, flows: next };
                            })
                          }
                        />
                      </div>
                    </InsetSurface>
                  ))}
                </div>
              </Panel>
            </div>
          ) : null}

          {activeTab === "params_aux" ? (
            <div className="space-y-6">
              <Panel className="p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">Configurable Parameters</h2>
                  <Button size="sm" variant="secondary" onClick={addParameter}>
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    Add Parameter
                  </Button>
                </div>
                <div className="space-y-3">
                  {draft.parameters.map((param, idx) => (
                    <InsetSurface
                      key={`${param.id}-${idx}`}
                      className="p-4 grid grid-cols-2 md:grid-cols-12 gap-3"
                    >
                      <div className="md:col-span-3">
                        <label className="block text-xs text-[var(--orbit-text-secondary)] mb-1">
                          ID
                        </label>
                        <Input
                          className="font-mono text-sm"
                          value={param.id}
                          onChange={(e) =>
                            updateDraft((p) => {
                              const next = [...p.parameters];
                              next[idx] = { ...next[idx], id: e.target.value };
                              return { ...p, parameters: next };
                            })
                          }
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-xs text-[var(--orbit-text-secondary)] mb-1">
                          Label
                        </label>
                        <Input
                          value={param.name}
                          onChange={(e) =>
                            updateDraft((p) => {
                              const next = [...p.parameters];
                              next[idx] = { ...next[idx], name: e.target.value };
                              return { ...p, parameters: next };
                            })
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs text-[var(--orbit-text-secondary)] mb-1">
                          Value
                        </label>
                        <Input
                          type="number"
                          step="any"
                          className="font-mono tabular-nums"
                          value={param.value}
                          onChange={(e) =>
                            updateDraft((p) => {
                              const next = [...p.parameters];
                              next[idx] = { ...next[idx], value: Number(e.target.value) };
                              return { ...p, parameters: next };
                            })
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs text-[var(--orbit-text-secondary)] mb-1">
                          Unit
                        </label>
                        <Input
                          value={param.unit}
                          onChange={(e) =>
                            updateDraft((p) => {
                              const next = [...p.parameters];
                              next[idx] = { ...next[idx], unit: e.target.value };
                              return { ...p, parameters: next };
                            })
                          }
                        />
                      </div>
                      <div className="md:col-span-2 flex items-end justify-end">
                        <IconButton
                          label={`Remove parameter ${param.name}`}
                          variant="danger"
                          onClick={() =>
                            updateDraft((p) => ({
                              ...p,
                              parameters: p.parameters.filter((_, i) => i !== idx),
                            }))
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </IconButton>
                      </div>
                    </InsetSurface>
                  ))}
                </div>
              </Panel>

              <Panel className="p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">Auxiliary Variables</h2>
                  <Button size="sm" variant="secondary" onClick={addAuxiliary}>
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    Add Auxiliary
                  </Button>
                </div>
                <div className="space-y-3">
                  {draft.auxiliaries.map((aux, idx) => (
                    <InsetSurface
                      key={`${aux.id}-${idx}`}
                      className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3"
                    >
                      <div className="md:col-span-3">
                        <label className="block text-xs text-[var(--orbit-text-secondary)] mb-1">
                          ID
                        </label>
                        <Input
                          className="font-mono text-sm"
                          value={aux.id}
                          onChange={(e) =>
                            updateDraft((p) => {
                              const next = [...p.auxiliaries];
                              next[idx] = { ...next[idx], id: e.target.value };
                              return { ...p, auxiliaries: next };
                            })
                          }
                        />
                      </div>
                      <div className="md:col-span-4">
                        <label className="block text-xs text-[var(--orbit-text-secondary)] mb-1">
                          Label
                        </label>
                        <Input
                          value={aux.name}
                          onChange={(e) =>
                            updateDraft((p) => {
                              const next = [...p.auxiliaries];
                              next[idx] = { ...next[idx], name: e.target.value };
                              return { ...p, auxiliaries: next };
                            })
                          }
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-xs text-[var(--orbit-text-secondary)] mb-1">
                          Unit
                        </label>
                        <Input
                          value={aux.unit}
                          onChange={(e) =>
                            updateDraft((p) => {
                              const next = [...p.auxiliaries];
                              next[idx] = { ...next[idx], unit: e.target.value };
                              return { ...p, auxiliaries: next };
                            })
                          }
                        />
                      </div>
                      <div className="md:col-span-2 flex items-end justify-end">
                        <IconButton
                          label={`Remove auxiliary ${aux.name}`}
                          variant="danger"
                          onClick={() =>
                            updateDraft((p) => ({
                              ...p,
                              auxiliaries: p.auxiliaries.filter((_, i) => i !== idx),
                            }))
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </IconButton>
                      </div>
                      <div className="md:col-span-12">
                        <label className="block text-xs text-[var(--orbit-text-secondary)] mb-1">
                          Equation
                        </label>
                        <Input
                          className="font-mono text-sm text-[var(--orbit-secondary)]"
                          value={aux.equation}
                          onChange={(e) =>
                            updateDraft((p) => {
                              const next = [...p.auxiliaries];
                              next[idx] = { ...next[idx], equation: e.target.value };
                              return { ...p, auxiliaries: next };
                            })
                          }
                        />
                      </div>
                    </InsetSurface>
                  ))}
                </div>
              </Panel>
            </div>
          ) : null}

          {activeTab === "graph" ? (
            <div className="space-y-3">
              <DependencyGraph
                nodes={validation?.dependency_graph.nodes ?? []}
                edges={validation?.dependency_graph.edges ?? []}
                selectedNodeId={selectedGraphNode}
                onSelectNode={(id) => setSelectedGraphNode(id)}
                height={440}
              />
              {selectedGraphNode ? (
                <Panel className="p-4 text-sm font-mono">
                  <span className="text-[var(--orbit-text-secondary)]">Selected: </span>
                  <span className="text-[var(--orbit-secondary)]">{selectedGraphNode}</span>
                  {" · "}
                  <span className="text-[var(--orbit-text-primary)]">
                    {draft.flows.find((f) => f.id === selectedGraphNode)?.equation ||
                      draft.auxiliaries.find((a) => a.id === selectedGraphNode)?.equation ||
                      `Initial/Value = ${
                        draft.stocks.find((s) => s.id === selectedGraphNode)?.initial_value ??
                        draft.parameters.find((p) => p.id === selectedGraphNode)?.value ??
                        "—"
                      }`}
                  </span>
                </Panel>
              ) : null}
            </div>
          ) : null}

          {activeTab === "assumptions_time" ? (
            <div className="space-y-5">
              <Panel className="p-5 space-y-4">
                <h2 className="text-base font-semibold">Time &amp; Solver Configuration</h2>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <FormField id="time-start" label="Start">
                    <Input
                      id="time-start"
                      type="number"
                      className="font-mono tabular-nums"
                      value={draft.time_config.start_time}
                      onChange={(e) =>
                        updateDraft((p) => ({
                          ...p,
                          time_config: { ...p.time_config, start_time: Number(e.target.value) },
                        }))
                      }
                    />
                  </FormField>
                  <FormField id="time-end" label="End">
                    <Input
                      id="time-end"
                      type="number"
                      className="font-mono tabular-nums"
                      value={draft.time_config.end_time}
                      onChange={(e) =>
                        updateDraft((p) => ({
                          ...p,
                          time_config: { ...p.time_config, end_time: Number(e.target.value) },
                        }))
                      }
                    />
                  </FormField>
                  <FormField id="time-dt" label="Step (dt)">
                    <Input
                      id="time-dt"
                      type="number"
                      step="any"
                      className="font-mono tabular-nums"
                      value={draft.time_config.dt}
                      onChange={(e) =>
                        updateDraft((p) => ({
                          ...p,
                          time_config: { ...p.time_config, dt: Number(e.target.value) },
                        }))
                      }
                    />
                  </FormField>
                  <FormField id="time-solver" label="Solver">
                    <Select
                      id="time-solver"
                      value={draft.time_config.solver}
                      onChange={(e) =>
                        updateDraft((p) => ({
                          ...p,
                          time_config: {
                            ...p.time_config,
                            solver: e.target.value as SolverType,
                          },
                        }))
                      }
                      className="w-full"
                    >
                      <option value="rk4">RK4</option>
                      <option value="euler">Euler</option>
                    </Select>
                  </FormField>
                  <FormField id="time-seed" label="Seed">
                    <Input
                      id="time-seed"
                      type="number"
                      className="font-mono tabular-nums"
                      value={draft.random_seed}
                      onChange={(e) =>
                        updateDraft((p) => ({ ...p, random_seed: Number(e.target.value) }))
                      }
                    />
                  </FormField>
                </div>
              </Panel>

              <Panel className="p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">Explicit Modeling Assumptions</h2>
                  <Button size="sm" variant="secondary" onClick={addAssumption}>
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    Add Assumption
                  </Button>
                </div>
                <div className="space-y-3">
                  {draft.assumptions.map((a, idx) => (
                    <InsetSurface key={`${a.id}-${idx}`} className="p-3.5 flex items-start gap-3">
                      <div className="flex-1 space-y-2">
                        <Input
                          value={a.statement}
                          onChange={(e) =>
                            updateDraft((p) => {
                              const next = [...p.assumptions];
                              next[idx] = { ...next[idx], statement: e.target.value };
                              return { ...p, assumptions: next };
                            })
                          }
                          placeholder="State the simplification or calibration premise explicitly..."
                        />
                        <div className="text-xs font-mono text-[var(--orbit-text-secondary)]">
                          Category: {a.category} · Impact: {a.impact} · Source: {a.source}
                        </div>
                      </div>
                      <IconButton
                        label="Remove assumption"
                        variant="danger"
                        onClick={() =>
                          updateDraft((p) => ({
                            ...p,
                            assumptions: p.assumptions.filter((_, i) => i !== idx),
                          }))
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </IconButton>
                    </InsetSurface>
                  ))}
                </div>
              </Panel>
            </div>
          ) : null}
        </div>

        {/* Independent Validation Results Sidebar */}
        <Panel className="xl:col-span-4 p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--orbit-border-subtle)]">
            <h2 className="text-base font-semibold">Validation Report</h2>
            {validation ? (
              <StatusIndicator
                tone={validation.valid ? "success" : "danger"}
                label={validation.valid ? "Valid" : `${validation.errors.length} Error(s)`}
              />
            ) : null}
          </div>

          {validation ? (
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between font-mono">
                <span className="text-[var(--orbit-text-secondary)]">Estimated Steps</span>
                <span className="tabular-nums font-medium">{validation.estimated_steps}</span>
              </div>

              <div className="space-y-2">
                <div className="font-semibold text-[var(--orbit-danger)] flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" aria-hidden="true" />
                  Blocking Errors ({validation.errors.length})
                </div>
                {validation.errors.length === 0 ? (
                  <p className="text-[var(--orbit-text-secondary)]">
                    All AST allowlist, reference, and cycle checks passed.
                  </p>
                ) : (
                  validation.errors.map((err, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-[var(--orbit-radius-md)] bg-[var(--orbit-danger-tint)] border border-[var(--orbit-danger)]/35 space-y-1"
                    >
                      <div className="font-mono text-xs text-[var(--orbit-danger)]">{err.code}</div>
                      <div className="text-sm">{err.message}</div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2 pt-3 border-t border-[var(--orbit-border-subtle)]">
                <div className="font-semibold text-[var(--orbit-warning)] flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                  Warnings ({validation.warnings.length})
                </div>
                {validation.warnings.length === 0 ? (
                  <p className="text-[var(--orbit-text-secondary)]">
                    No numerical stability or structural warnings.
                  </p>
                ) : (
                  validation.warnings.map((w, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-[var(--orbit-radius-md)] bg-[var(--orbit-warning-tint)] border border-[var(--orbit-warning)]/35 space-y-1"
                    >
                      <div className="font-mono text-xs text-[var(--orbit-warning)]">{w.code}</div>
                      <div className="text-sm">{w.message}</div>
                    </div>
                  ))
                )}
              </div>

              {validation.evaluation_order.length > 0 ? (
                <div className="space-y-1.5 pt-3 border-t border-[var(--orbit-border-subtle)]">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <GitBranch className="w-4 h-4 text-[var(--orbit-primary)]" aria-hidden="true" />
                    Evaluation Order
                  </div>
                  <div className="font-mono text-xs text-[var(--orbit-text-secondary)] leading-relaxed break-words">
                    {validation.evaluation_order.join(" → ")}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[var(--orbit-text-secondary)]">
              Run equation validation to inspect syntax safety and dependency cycles.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}
