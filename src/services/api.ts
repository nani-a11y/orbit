import type {
  AIExplanationResponse,
  AIInterpretationResponse,
  DashboardStats,
  ExperimentComparison,
  ExperimentRecord,
  ExportRecord,
  HealthStatus,
  OrbitModelSpec,
  ProjectRecord,
  SimulationResult,
  SimulationRunRecord,
  ValidationReport,
} from "../types/orbit";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg =
      typeof payload?.error === "string"
        ? payload.error
        : `Request failed with HTTP ${response.status}`;
    throw new Error(msg);
  }
  return payload as T;
}

export const orbitApi = {
  getHealth: () => request<HealthStatus>("/api/v1/health"),

  getDashboardStats: () => request<DashboardStats>("/api/v1/dashboard/stats"),

  listProjects: () => request<{ projects: ProjectRecord[] }>("/api/v1/projects"),

  createProject: (params: { name: string; description: string }) =>
    request<ProjectRecord>("/api/v1/projects", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  listModels: () => request<{ models: OrbitModelSpec[] }>("/api/v1/models"),

  getModel: (modelId: string) =>
    request<{
      model: OrbitModelSpec;
      versions: Array<{
        id: string;
        model_id: string;
        version: number;
        change_note: string;
        created_at: string;
      }>;
    }>(`/api/v1/models/${encodeURIComponent(modelId)}`),

  createModel: (model: Partial<OrbitModelSpec> & { change_note?: string }) =>
    request<{ model: OrbitModelSpec; validation: ValidationReport }>("/api/v1/models", {
      method: "POST",
      body: JSON.stringify(model),
    }),

  updateModel: (modelId: string, model: OrbitModelSpec & { change_note?: string }) =>
    request<{ model: OrbitModelSpec; validation: ValidationReport }>(
      `/api/v1/models/${encodeURIComponent(modelId)}`,
      {
        method: "PUT",
        body: JSON.stringify(model),
      }
    ),

  deleteModel: (modelId: string) =>
    request<{ deleted: boolean }>(`/api/v1/models/${encodeURIComponent(modelId)}`, {
      method: "DELETE",
    }),

  validateModel: (modelId: string, draft?: OrbitModelSpec) =>
    request<ValidationReport>(`/api/v1/models/${encodeURIComponent(modelId)}/validate`, {
      method: "POST",
      body: JSON.stringify(draft ?? {}),
    }),

  validateDraft: (draft: OrbitModelSpec) =>
    request<ValidationReport>("/api/v1/validate-draft", {
      method: "POST",
      body: JSON.stringify(draft),
    }),

  interpretScenario: (params: {
    prompt: string;
    duration?: number;
    time_unit?: string;
    dt?: number;
    solver?: "euler" | "rk4";
    clarification_answers?: Record<string, string>;
    skip_clarification?: boolean;
  }) =>
    request<AIInterpretationResponse>("/api/v1/scenarios/interpret", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  listRuns: (modelId?: string) =>
    request<{ runs: SimulationRunRecord[] }>(
      modelId
        ? `/api/v1/simulations?model_id=${encodeURIComponent(modelId)}`
        : "/api/v1/simulations"
    ),

  runSimulation: (params: {
    model_id: string;
    parameter_overrides?: Record<string, number>;
    time_overrides?: Record<string, unknown>;
    random_seed?: number;
    sync?: boolean;
  }) =>
    request<{ run: SimulationRunRecord; result?: SimulationResult }>("/api/v1/simulations/run", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  getRunResults: (runId: string) =>
    request<{ run: SimulationRunRecord; result: SimulationResult }>(
      `/api/v1/simulations/${encodeURIComponent(runId)}/results`
    ),

  cancelRun: (runId: string) =>
    request<{ run: SimulationRunRecord; cancelled: boolean }>(
      `/api/v1/simulations/${encodeURIComponent(runId)}/cancel`,
      { method: "POST" }
    ),

  listExperiments: () => request<{ experiments: ExperimentRecord[] }>("/api/v1/experiments"),

  createExperiment: (params: {
    name: string;
    description: string;
    model_id: string;
    baseline_run_id?: string;
    parameter_overrides: Record<string, number>;
    time_overrides?: Record<string, unknown>;
  }) =>
    request<{
      experiment: ExperimentRecord;
      baseline_result: SimulationResult;
      variant_result: SimulationResult;
      comparison: ExperimentComparison;
    }>("/api/v1/experiments", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  compareRuns: (baselineRunId: string, variantRunId: string) =>
    request<{
      baseline: SimulationResult;
      variant: SimulationResult;
      comparison: ExperimentComparison;
    }>("/api/v1/experiments/compare", {
      method: "POST",
      body: JSON.stringify({
        baseline_run_id: baselineRunId,
        variant_run_id: variantRunId,
      }),
    }),

  explainResults: (params: {
    run_id: string;
    variant_run_id?: string;
    focus_question?: string;
  }) =>
    request<AIExplanationResponse>("/api/v1/analysis/explain", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  exportRun: (runId: string, format: "csv" | "json" | "pdf") =>
    request<{
      export_record: ExportRecord;
      filename: string;
      mime_type: string;
      content?: string;
    }>("/api/v1/exports", {
      method: "POST",
      body: JSON.stringify({ run_id: runId, format }),
    }),

  listExports: () => request<{ exports: ExportRecord[] }>("/api/v1/exports"),
};
