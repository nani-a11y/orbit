import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  Edit3,
  FlaskConical,
  FolderKanban,
  Play,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { ConfirmDialog } from "../components/ui/Dialog";
import {
  Button,
  EmptyState,
  IconButton,
  Input,
  LoadingState,
  Panel,
  SectionHeader,
  StatusIndicator,
} from "../components/ui/primitives";
import { formatTimestamp } from "../lib/utils";
import type {
  AppView,
  DashboardStats,
  OrbitModelSpec,
  ProjectRecord,
} from "../types/orbit";

interface DashboardPageProps {
  stats: DashboardStats | null;
  projects: ProjectRecord[];
  models: OrbitModelSpec[];
  loading: boolean;
  onNavigate: (view: AppView) => void;
  onOpenWorkspace: (modelId: string, runId?: string) => void;
  onOpenEditor: (modelId: string) => void;
  onOpenExperimentLab: (modelId: string) => void;
  onOpenReport: (runId: string) => void;
  onDeleteModel: (modelId: string) => Promise<void>;
}

export function DashboardPage({
  stats,
  projects,
  models,
  loading,
  onNavigate,
  onOpenWorkspace,
  onOpenEditor,
  onOpenExperimentLab,
  onOpenReport,
  onDeleteModel,
}: DashboardPageProps) {
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [modelToDelete, setModelToDelete] = useState<OrbitModelSpec | null>(null);
  const [deleting, setDeleting] = useState(false);

  const domains = useMemo(() => {
    const set = new Set<string>();
    models.forEach((m) => set.add(m.domain || "General"));
    return ["all", ...Array.from(set)];
  }, [models]);

  const filteredModels = useMemo(() => {
    const q = search.trim().toLowerCase();
    return models.filter((m) => {
      const matchesDomain = domainFilter === "all" || m.domain === domainFilter;
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.domain.toLowerCase().includes(q);
      return matchesDomain && matchesSearch;
    });
  }, [models, search, domainFilter]);

  const confirmDelete = async () => {
    if (!modelToDelete) return;
    setDeleting(true);
    try {
      await onDeleteModel(modelToDelete.id);
      setModelToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  if (loading && models.length === 0) {
    return (
      <LoadingState
        title="Loading workspace overview"
        description="Retrieving saved projects, simulation models, and recorded runs from SQLite."
      />
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Overview"
        subtitle="Inspect stored simulation models, recent Python runs, projects, and saved comparisons."
        action={
          <Button onClick={() => onNavigate("builder")}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            New Simulation
          </Button>
        }
      />

      {/* Actual SQLite-backed summary counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Projects", value: stats?.total_projects ?? projects.length, unit: "workspaces" },
          { label: "Saved Models", value: stats?.total_models ?? models.length, unit: "specs" },
          { label: "Simulation Runs", value: stats?.total_runs ?? 0, unit: "recorded" },
          { label: "Experiments", value: stats?.total_experiments ?? 0, unit: "comparisons" },
        ].map((metric) => (
          <Panel key={metric.label} className="p-4">
            <div className="text-sm text-[var(--orbit-text-secondary)]">{metric.label}</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-mono font-semibold tabular-nums text-[var(--orbit-text-primary)]">
                {metric.value}
              </span>
              <span className="text-xs font-mono text-[var(--orbit-text-muted)]">
                {metric.unit}
              </span>
            </div>
          </Panel>
        ))}
      </div>

      {/* Saved Simulation Models */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Saved Simulation Models</h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-64">
              <Search
                className="w-4 h-4 text-[var(--orbit-text-muted)] absolute left-3.5 top-3.5 pointer-events-none"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search models..."
                aria-label="Search simulation models"
                className="pl-10"
              />
            </div>
            <div
              role="group"
              aria-label="Filter models by domain"
              className="flex flex-wrap items-center gap-1 p-1 rounded-[var(--orbit-radius-md)] bg-[var(--orbit-surface-inset)] border border-[var(--orbit-border-subtle)]"
            >
              {domains.map((dom) => (
                <button
                  key={dom}
                  type="button"
                  onClick={() => setDomainFilter(dom)}
                  className={`min-h-[44px] px-3 rounded-[var(--orbit-radius-sm)] text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    domainFilter === dom
                      ? "bg-[var(--orbit-surface-elevated)] text-[var(--orbit-text-primary)] border border-[var(--orbit-border)]"
                      : "text-[var(--orbit-text-secondary)] hover:text-[var(--orbit-text-primary)] border border-transparent"
                  }`}
                >
                  {dom === "all" ? "All Domains" : dom}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredModels.length === 0 ? (
          <EmptyState
            title="No matching models"
            description="No saved simulation models match your current filter."
            nextStep="Clear the search filter or describe a new system in New Simulation."
            action={
              <Button onClick={() => onNavigate("builder")}>
                <Plus className="w-4 h-4" aria-hidden="true" />
                Create New Simulation
              </Button>
            }
          />
        ) : (
          <Panel className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--orbit-border-subtle)] text-[var(--orbit-text-secondary)]">
                  <th className="py-3.5 px-4 font-medium">Model</th>
                  <th className="py-3.5 px-4 font-medium">Domain</th>
                  <th className="py-3.5 px-4 font-medium text-right">Structure</th>
                  <th className="py-3.5 px-4 font-medium text-right">Horizon</th>
                  <th className="py-3.5 px-4 font-medium">Status</th>
                  <th className="py-3.5 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--orbit-border-subtle)]">
                {filteredModels.map((model) => (
                  <tr
                    key={model.id}
                    className="hover:bg-[var(--orbit-hover-surface)] transition-colors"
                  >
                    <td className="py-3.5 px-4 max-w-md">
                      <div className="font-medium text-[var(--orbit-text-primary)]">
                        {model.name}
                      </div>
                      <div className="text-sm text-[var(--orbit-text-secondary)] mt-0.5 line-clamp-1">
                        v{model.version} · {model.is_example ? "Sample Demonstration" : "User Model"}{" "}
                        · {model.description}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[var(--orbit-text-secondary)] whitespace-nowrap">
                      {model.domain}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[var(--orbit-text-secondary)] whitespace-nowrap">
                      {model.stocks.length}S / {model.flows.length}F / {model.parameters.length}P
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[var(--orbit-text-secondary)] whitespace-nowrap">
                      {model.time_config.end_time} {model.time_config.time_unit} (
                      {model.time_config.solver.toUpperCase()})
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusIndicator
                        tone={model.approved ? "success" : "warning"}
                        label={model.approved ? "Approved" : "Draft"}
                      />
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onOpenWorkspace(model.id)}
                        >
                          <Play className="w-4 h-4 text-[var(--orbit-secondary)]" aria-hidden="true" />
                          Simulate
                        </Button>
                        <IconButton
                          label={`Edit ${model.name}`}
                          onClick={() => onOpenEditor(model.id)}
                        >
                          <Edit3 className="w-4 h-4" />
                        </IconButton>
                        <IconButton
                          label={`Compare ${model.name} in Experiment Lab`}
                          onClick={() => onOpenExperimentLab(model.id)}
                        >
                          <FlaskConical className="w-4 h-4" />
                        </IconButton>
                        {!model.is_example ? (
                          <IconButton
                            label={`Delete ${model.name}`}
                            variant="danger"
                            onClick={() => setModelToDelete(model)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </IconButton>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}
      </section>

      {/* Projects, Recent Runs & Recent Experiments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Panel className="p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--orbit-border-subtle)]">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-[var(--orbit-primary)]" aria-hidden="true" />
                Projects
              </h2>
              <Button size="sm" variant="ghost" onClick={() => onNavigate("projects")}>
                Manage
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>
            {projects.length === 0 ? (
              <p className="text-sm text-[var(--orbit-text-secondary)] py-4">
                No projects created yet. Organize related models in the Projects view.
              </p>
            ) : (
              <div className="divide-y divide-[var(--orbit-border-subtle)]">
                {projects.slice(0, 5).map((proj) => (
                  <div key={proj.id} className="py-3">
                    <div className="font-medium text-sm text-[var(--orbit-text-primary)]">
                      {proj.name}
                    </div>
                    <div className="text-xs font-mono text-[var(--orbit-text-secondary)] mt-0.5">
                      {proj.model_count} model(s) · {formatTimestamp(proj.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>

        <Panel className="p-5 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--orbit-border-subtle)]">
            <h2 className="text-base font-semibold">Recent Runs</h2>
            <span className="text-xs font-mono text-[var(--orbit-text-secondary)]">
              {stats?.recent_runs.length ?? 0} latest
            </span>
          </div>
          {!stats || stats.recent_runs.length === 0 ? (
            <p className="text-sm text-[var(--orbit-text-secondary)] py-4">
              No simulations have been executed yet. Select any model above to run your first
              simulation.
            </p>
          ) : (
            <div className="divide-y divide-[var(--orbit-border-subtle)]">
              {stats.recent_runs.slice(0, 5).map((run) => (
                <div key={run.id} className="py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {run.model_name || run.model_id}
                    </div>
                    <div className="text-xs font-mono text-[var(--orbit-text-secondary)] mt-0.5">
                      {run.solver.toUpperCase()} ·{" "}
                      {run.execution_ms !== null ? `${run.execution_ms} ms` : run.status} ·{" "}
                      {formatTimestamp(run.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onOpenWorkspace(run.model_id, run.id)}
                    >
                      Open
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onOpenReport(run.id)}>
                      Report
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="p-5 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--orbit-border-subtle)]">
            <h2 className="text-base font-semibold">Recent Experiments</h2>
            <Button size="sm" variant="ghost" onClick={() => onNavigate("experiments")}>
              Open Lab
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
          {!stats || stats.recent_experiments.length === 0 ? (
            <p className="text-sm text-[var(--orbit-text-secondary)] py-4">
              No experiments saved yet. Open the Experiment Laboratory to compare parameter
              scenarios against a baseline.
            </p>
          ) : (
            <div className="divide-y divide-[var(--orbit-border-subtle)]">
              {stats.recent_experiments.slice(0, 5).map((exp) => (
                <div key={exp.id} className="py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{exp.name}</div>
                    <div className="text-xs font-mono text-[var(--orbit-text-secondary)] mt-0.5">
                      {Object.keys(exp.parameter_overrides).length} overrides ·{" "}
                      {formatTimestamp(exp.created_at)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onOpenExperimentLab(exp.model_id)}
                  >
                    Inspect
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <ConfirmDialog
        open={Boolean(modelToDelete)}
        onClose={() => setModelToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete simulation model"
        description={`Delete "${modelToDelete?.name ?? ""}" and its associated version history from SQLite? This action cannot be undone.`}
        confirmLabel="Delete Model"
        destructive
        loading={deleting}
      />
    </div>
  );
}
