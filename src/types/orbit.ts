export type SolverType = "euler" | "rk4";
export type EngineType = "system_dynamics";
export type VariableKind = "stock" | "flow" | "parameter" | "auxiliary";

export interface TimeConfig {
  start_time: number;
  end_time: number;
  dt: number;
  time_unit: string;
  solver: SolverType;
}

export interface StockDefinition {
  id: string;
  name: string;
  initial_value: number;
  unit: string;
  description: string;
  inflows: string[];
  outflows: string[];
  min_value?: number | null;
  max_value?: number | null;
}

export interface FlowDefinition {
  id: string;
  name: string;
  equation: string;
  unit: string;
  description: string;
  source_stock?: string | null;
  target_stock?: string | null;
  non_negative?: boolean;
}

export interface ParameterDefinition {
  id: string;
  name: string;
  value: number;
  unit: string;
  description: string;
  min_value?: number | null;
  max_value?: number | null;
  step?: number | null;
  editable?: boolean;
}

export interface AuxiliaryDefinition {
  id: string;
  name: string;
  equation: string;
  unit: string;
  description: string;
}

export interface ConstraintDefinition {
  id: string;
  variable: string;
  operator: "<" | "<=" | ">" | ">=";
  threshold: number;
  severity: "info" | "warning" | "critical";
  label: string;
}

export interface AssumptionDefinition {
  id: string;
  statement: string;
  category: string;
  source: string;
  impact: "low" | "medium" | "high" | string;
  editable_parameter?: string | null;
}

export interface OrbitModelSpec {
  id: string;
  name: string;
  description: string;
  domain: string;
  schema_version: string;
  version: number;
  engine_type: EngineType;
  time_config: TimeConfig;
  stocks: StockDefinition[];
  flows: FlowDefinition[];
  parameters: ParameterDefinition[];
  auxiliaries: AuxiliaryDefinition[];
  constraints: ConstraintDefinition[];
  assumptions: AssumptionDefinition[];
  random_seed: number;
  visualization?: {
    primary_series?: string[];
    secondary_series?: string[];
    resource_series?: string[];
  };
  approved: boolean;
  is_example?: boolean;
  project_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ValidationIssue {
  code: string;
  message: string;
  variable?: string;
  severity: "error" | "warning";
}

export interface DependencyNode {
  id: string;
  label: string;
  kind: VariableKind;
  unit: string;
}

export interface DependencyEdge {
  source: string;
  target: string;
  relation: "inflow" | "outflow" | "depends";
}

export interface ValidationReport {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  assumptions: AssumptionDefinition[];
  evaluation_order: string[];
  dependency_graph: {
    nodes: DependencyNode[];
    edges: DependencyEdge[];
  };
  estimated_steps: number;
}

export interface SimulationEvent {
  time: number;
  step: number;
  type: "constraint_triggered" | "constraint_recovered" | string;
  severity: "info" | "warning" | "critical" | string;
  variable: string;
  value: number;
  threshold: number;
  message: string;
}

export interface VariableMetrics {
  initial: number;
  final: number;
  min: number;
  min_time: number;
  max: number;
  max_time: number;
  mean: number;
  abs_change: number;
  pct_change: number | null;
}

export interface SimulationResult {
  model_id: string;
  model_version: number;
  solver: SolverType;
  time_unit: string;
  start_time: number;
  end_time: number;
  dt: number;
  steps: number;
  random_seed: number;
  parameter_overrides: Record<string, number>;
  execution_ms: number;
  times: number[];
  series: Record<string, number[]>;
  metrics: Record<string, VariableMetrics>;
  events: SimulationEvent[];
  warnings: string[];
  assumptions: AssumptionDefinition[];
}

export interface SimulationRunRecord {
  id: string;
  model_id: string;
  model_name?: string;
  model_version: number;
  status: "queued" | "running" | "completed" | "cancelled" | "failed";
  progress: number;
  solver: SolverType;
  random_seed: number;
  parameter_overrides: Record<string, number>;
  time_overrides: Record<string, unknown>;
  execution_ms: number | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface VariableDelta {
  baseline_final: number;
  variant_final: number;
  final_diff: number;
  final_pct_diff: number | null;
  baseline_max: number;
  variant_max: number;
  peak_diff: number;
  mean_diff: number;
  max_abs_divergence: number;
  max_divergence_time: number;
}

export interface ExperimentComparison {
  shared_variables: string[];
  most_affected_variables: string[];
  deltas: Record<string, VariableDelta>;
  baseline_event_count: number;
  variant_event_count: number;
}

export interface ExperimentRecord {
  id: string;
  name: string;
  description: string;
  model_id: string;
  model_name?: string;
  baseline_run_id: string;
  variant_run_id: string;
  parameter_overrides: Record<string, number>;
  comparison: ExperimentComparison | null;
  created_at: string;
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  reason: string;
  suggested_default: string;
}

export interface AIInterpretationResponse {
  needs_clarification: boolean;
  summary: string;
  clarifications: ClarificationQuestion[];
  model_draft: OrbitModelSpec | null;
  validation: ValidationReport | null;
  missing_information: string[];
}

export interface AIExplanationResponse {
  headline: string;
  summary: string;
  key_changes: Array<{
    variable: string;
    observation: string;
    computed_evidence: string;
  }>;
  causal_mechanisms: string[];
  unexpected_outcomes: string[];
  limitations_and_assumptions: string[];
  disclaimer: string;
  generated_at: string;
}

export interface HealthStatus {
  status: string;
  python_engine: {
    available: boolean;
    python_version: string;
    schema_version: string;
    solvers: string[];
  };
  database: {
    engine: string;
    path: string;
    size_bytes: number;
  };
  gemini: {
    configured: boolean;
    model: string;
  };
}

export interface DashboardStats {
  total_projects: number;
  total_models: number;
  total_runs: number;
  total_experiments: number;
  total_exports: number;
  recent_models: OrbitModelSpec[];
  recent_runs: SimulationRunRecord[];
  recent_experiments: ExperimentRecord[];
}

export interface ExportRecord {
  id: string;
  run_id: string;
  model_id: string;
  format: "csv" | "json" | "pdf";
  size_bytes: number;
  created_at: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  created_at: string;
  model_count: number;
}

export type ThemeMode = "dark" | "light";

export type AppView =
  | "landing"
  | "dashboard"
  | "projects"
  | "builder"
  | "editor"
  | "workspace"
  | "experiments"
  | "reports"
  | "documentation"
  | "settings";

