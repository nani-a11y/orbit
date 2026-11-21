import React, { useMemo, useState } from "react";
import {
  Edit3,
  FlaskConical,
  FolderPlus,
  Play,
  Trash2,
} from "lucide-react";
import { ConfirmDialog, Dialog } from "../components/ui/Dialog";
import {
  Button,
  EmptyState,
  FormField,
  IconButton,
  Input,
  Panel,
  SectionHeader,
  StatusIndicator,
  Textarea,
} from "../components/ui/primitives";
import { useToast } from "../components/ui/Toast";
import { formatTimestamp } from "../lib/utils";
import { orbitApi } from "../services/api";
import type { OrbitModelSpec, ProjectRecord } from "../types/orbit";

interface ProjectsPageProps {
  projects: ProjectRecord[];
  models: OrbitModelSpec[];
  onProjectCreated: () => Promise<void>;
  onOpenWorkspace: (modelId: string) => void;
  onOpenEditor: (modelId: string) => void;
  onOpenExperimentLab: (modelId: string) => void;
  onDeleteModel: (modelId: string) => Promise<void>;
}

export function ProjectsPage({
  projects,
  models,
  onProjectCreated,
  onOpenWorkspace,
  onOpenEditor,
  onOpenExperimentLab,
  onDeleteModel,
}: ProjectsPageProps) {
  const { notify } = useToast();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [projName, setProjName] = useState("");
  const [projDesc, setProjDesc] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [modelToDelete, setModelToDelete] = useState<OrbitModelSpec | null>(null);
  const [deleting, setDeleting] = useState(false);

  const visibleModels = useMemo(() => {
    if (selectedProjectId === "all") return models;
    if (selectedProjectId === "unassigned") return models.filter((m) => !m.project_id);
    return models.filter((m) => m.project_id === selectedProjectId);
  }, [models, selectedProjectId]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName.trim()) {
      setNameError("Enter a project name to create a workspace group.");
      return;
    }
    setCreating(true);
    setNameError(null);
    try {
      const created = await orbitApi.createProject({
        name: projName.trim(),
        description: projDesc.trim(),
      });
      setProjName("");
      setProjDesc("");
      setCreateOpen(false);
      await onProjectCreated();
      setSelectedProjectId(created.id);
      notify({ tone: "success", title: "Project created", description: created.name });
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Could not create project.");
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = async () => {
    if (!modelToDelete) return;
    setDeleting(true);
    try {
      await onDeleteModel(modelToDelete.id);
      notify({
        tone: "info",
        title: "Model removed",
        description: `${modelToDelete.name} was deleted from local storage.`,
      });
      setModelToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Projects"
        subtitle="Organize related simulation models, inspect approval status, and manage stored specifications."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <FolderPlus className="w-4 h-4" aria-hidden="true" />
            New Project
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Project Selector List */}
        <Panel className="lg:col-span-4 p-3 space-y-1">
          <button
            type="button"
            onClick={() => setSelectedProjectId("all")}
            className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-[var(--orbit-radius-md)] text-left flex items-center justify-between text-sm font-medium cursor-pointer transition-colors ${
              selectedProjectId === "all"
                ? "bg-[var(--orbit-selected-surface)] text-[var(--orbit-text-primary)]"
                : "text-[var(--orbit-text-secondary)] hover:bg-[var(--orbit-hover-surface)] hover:text-[var(--orbit-text-primary)]"
            }`}
          >
            <span>All Models</span>
            <span className="font-mono text-xs tabular-nums">{models.length}</span>
          </button>

          {projects.map((p) => {
            const active = selectedProjectId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedProjectId(p.id)}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-[var(--orbit-radius-md)] text-left cursor-pointer transition-colors ${
                  active
                    ? "bg-[var(--orbit-selected-surface)] text-[var(--orbit-text-primary)]"
                    : "text-[var(--orbit-text-secondary)] hover:bg-[var(--orbit-hover-surface)] hover:text-[var(--orbit-text-primary)]"
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-sm font-medium">
                  <span className="truncate">{p.name}</span>
                  <span className="font-mono text-xs tabular-nums shrink-0">{p.model_count}</span>
                </div>
                {p.description ? (
                  <div className="text-xs text-[var(--orbit-text-muted)] mt-0.5 line-clamp-1">
                    {p.description}
                  </div>
                ) : null}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setSelectedProjectId("unassigned")}
            className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-[var(--orbit-radius-md)] text-left flex items-center justify-between text-sm font-medium cursor-pointer transition-colors ${
              selectedProjectId === "unassigned"
                ? "bg-[var(--orbit-selected-surface)] text-[var(--orbit-text-primary)]"
                : "text-[var(--orbit-text-secondary)] hover:bg-[var(--orbit-hover-surface)] hover:text-[var(--orbit-text-primary)]"
            }`}
          >
            <span>Custom / Unassigned</span>
            <span className="font-mono text-xs tabular-nums">
              {models.filter((m) => !m.project_id).length}
            </span>
          </button>
        </Panel>

        {/* Project Models */}
        <div className="lg:col-span-8 space-y-4">
          {visibleModels.length === 0 ? (
            <EmptyState
              title="No models in this project"
              description="This project does not have any saved simulation models assigned yet."
              nextStep="Create a new simulation from the New Simulation page or select All Models."
            />
          ) : (
            <div className="space-y-3">
              {visibleModels.map((model) => (
                <Panel
                  key={model.id}
                  className="p-5 flex flex-wrap items-start justify-between gap-4"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-[var(--orbit-text-secondary)]">
                      <span>{model.domain}</span>
                      <span aria-hidden="true">·</span>
                      <span>v{model.version}</span>
                      <span aria-hidden="true">·</span>
                      <span>{model.is_example ? "Sample Model" : "Custom Model"}</span>
                      <span aria-hidden="true">·</span>
                      <span>Updated {formatTimestamp(model.updated_at)}</span>
                    </div>
                    <h2 className="text-base font-semibold text-[var(--orbit-text-primary)]">
                      {model.name}
                    </h2>
                    <p className="text-sm text-[var(--orbit-text-secondary)] prose-measure">
                      {model.description}
                    </p>
                    <div className="pt-1 flex flex-wrap items-center gap-4 text-xs font-mono text-[var(--orbit-text-secondary)]">
                      <span>
                        {model.stocks.length} stocks · {model.flows.length} flows ·{" "}
                        {model.parameters.length} parameters
                      </span>
                      <StatusIndicator
                        tone={model.approved ? "success" : "warning"}
                        label={model.approved ? "Validated & Approved" : "Awaiting Approval"}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onOpenWorkspace(model.id)}
                    >
                      <Play className="w-4 h-4 text-[var(--orbit-secondary)]" aria-hidden="true" />
                      Workspace
                    </Button>
                    <IconButton label={`Edit ${model.name}`} onClick={() => onOpenEditor(model.id)}>
                      <Edit3 className="w-4 h-4" />
                    </IconButton>
                    <IconButton
                      label={`Compare ${model.name} in Lab`}
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
                </Panel>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Project"
        description="Group related simulation models and experiments inside SQLite."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject} loading={creating}>
              Create Project
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          <FormField id="proj-name" label="Project Name" error={nameError}>
            <Input
              id="proj-name"
              value={projName}
              onChange={(e) => {
                setProjName(e.target.value);
                setNameError(null);
              }}
              placeholder="e.g., Municipal Resilience Studies"
              aria-invalid={Boolean(nameError)}
            />
          </FormField>
          <FormField id="proj-desc" label="Description">
            <Textarea
              id="proj-desc"
              rows={3}
              value={projDesc}
              onChange={(e) => setProjDesc(e.target.value)}
              placeholder="Describe the research scope or hypotheses for this project."
            />
          </FormField>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(modelToDelete)}
        onClose={() => setModelToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete simulation model"
        description={`Delete "${modelToDelete?.name ?? ""}" permanently? Stored runs and versions for this model will also be removed.`}
        confirmLabel="Delete Model"
        destructive
        loading={deleting}
      />
    </div>
  );
}
