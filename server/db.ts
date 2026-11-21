import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type {
  DashboardStats,
  ExperimentComparison,
  ExperimentRecord,
  ExportRecord,
  OrbitModelSpec,
  SimulationResult,
  SimulationRunRecord,
} from "../src/types/orbit";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "orbit.sqlite");

fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS simulation_models (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      domain TEXT NOT NULL DEFAULT 'general',
      version INTEGER NOT NULL DEFAULT 1,
      approved INTEGER NOT NULL DEFAULT 0,
      is_example INTEGER NOT NULL DEFAULT 0,
      spec_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS model_versions (
      id TEXT PRIMARY KEY,
      model_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      spec_json TEXT NOT NULL,
      change_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (model_id) REFERENCES simulation_models(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS simulation_runs (
      id TEXT PRIMARY KEY,
      model_id TEXT NOT NULL,
      model_version INTEGER NOT NULL,
      status TEXT NOT NULL,
      progress REAL NOT NULL DEFAULT 0,
      solver TEXT NOT NULL,
      random_seed INTEGER NOT NULL DEFAULT 42,
      parameter_overrides_json TEXT NOT NULL DEFAULT '{}',
      time_overrides_json TEXT NOT NULL DEFAULT '{}',
      execution_ms REAL,
      error_message TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY (model_id) REFERENCES simulation_models(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS simulation_results (
      run_id TEXT PRIMARY KEY,
      result_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES simulation_runs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS experiments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      model_id TEXT NOT NULL,
      baseline_run_id TEXT NOT NULL,
      variant_run_id TEXT NOT NULL,
      parameter_overrides_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY (model_id) REFERENCES simulation_models(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS experiment_comparisons (
      experiment_id TEXT PRIMARY KEY,
      comparison_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS export_history (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      format TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  seedExamplesIfEmpty();
}

function seedExamplesIfEmpty(): void {
  const now = new Date().toISOString();
  const defaultProjectId = "proj-demonstrations";

  db.prepare(
    `INSERT OR IGNORE INTO projects (id, name, description, created_at) VALUES (?, ?, ?, ?)`
  ).run(
    defaultProjectId,
    "Reference Demonstrations",
    "Offline executable system-dynamics models included with ORBIT.",
    now
  );

  const examplePaths = [
    path.resolve(process.cwd(), "examples", "urban_ecosystem", "model.json"),
    path.resolve(process.cwd(), "examples", "epidemic_sir", "model.json"),
    path.resolve(process.cwd(), "examples", "renewable_microgrid", "model.json"),
  ];

  const existsStmt = db.prepare(`SELECT id FROM simulation_models WHERE id = ?`);
  const insertModelStmt = db.prepare(`
    INSERT INTO simulation_models
      (id, project_id, name, description, domain, version, approved, is_example, spec_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `);
  const insertVersionStmt = db.prepare(`
    INSERT INTO model_versions (id, model_id, version, spec_json, change_note, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const filePath of examplePaths) {
    if (!fs.existsSync(filePath)) continue;
    const raw = fs.readFileSync(filePath, "utf-8");
    const spec = JSON.parse(raw) as OrbitModelSpec;
    const existing = existsStmt.get(spec.id);
    if (!existing) {
      spec.project_id = defaultProjectId;
      spec.is_example = true;
      spec.created_at = now;
      spec.updated_at = now;
      insertModelStmt.run(
        spec.id,
        defaultProjectId,
        spec.name,
        spec.description,
        spec.domain,
        spec.version ?? 1,
        spec.approved ? 1 : 0,
        JSON.stringify(spec),
        now,
        now
      );
      insertVersionStmt.run(
        `${spec.id}-v1`,
        spec.id,
        spec.version ?? 1,
        JSON.stringify(spec),
        "Initial bundled reference model",
        now
      );
    }
  }
}

export function getDatabaseInfo(): { engine: string; path: string; size_bytes: number } {
  const size = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;
  return {
    engine: "SQLite 3 (WAL mode)",
    path: "data/orbit.sqlite",
    size_bytes: size,
  };
}

export function listProjects() {
  return db
    .prepare(
      `SELECT p.*, COUNT(m.id) AS model_count
       FROM projects p
       LEFT JOIN simulation_models m ON m.project_id = p.id
       GROUP BY p.id
       ORDER BY p.created_at DESC`
    )
    .all();
}

export function createProject(id: string, name: string, description: string) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO projects (id, name, description, created_at) VALUES (?, ?, ?, ?)`
  ).run(id, name, description, now);
  return { id, name, description, created_at: now, model_count: 0 };
}

function hydrateModelRow(row: {
  spec_json: string;
  approved: number;
  is_example: number;
  project_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}): OrbitModelSpec {
  const spec = JSON.parse(row.spec_json) as OrbitModelSpec;
  return {
    ...spec,
    version: row.version,
    approved: Boolean(row.approved),
    is_example: Boolean(row.is_example),
    project_id: row.project_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function listModels(): OrbitModelSpec[] {
  const rows = db
    .prepare(`SELECT * FROM simulation_models ORDER BY updated_at DESC`)
    .all() as Array<{
    spec_json: string;
    approved: number;
    is_example: number;
    project_id: string | null;
    version: number;
    created_at: string;
    updated_at: string;
  }>;
  return rows.map(hydrateModelRow);
}

export function getModelById(id: string): OrbitModelSpec | null {
  const row = db
    .prepare(`SELECT * FROM simulation_models WHERE id = ?`)
    .get(id) as
    | {
        spec_json: string;
        approved: number;
        is_example: number;
        project_id: string | null;
        version: number;
        created_at: string;
        updated_at: string;
      }
    | undefined;
  return row ? hydrateModelRow(row) : null;
}

export function saveNewModel(spec: OrbitModelSpec, changeNote = "Initial model creation"): OrbitModelSpec {
  const now = new Date().toISOString();
  const version = spec.version || 1;
  const fullSpec: OrbitModelSpec = {
    ...spec,
    version,
    created_at: now,
    updated_at: now,
  };

  db.prepare(`
    INSERT INTO simulation_models
      (id, project_id, name, description, domain, version, approved, is_example, spec_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    fullSpec.id,
    fullSpec.project_id ?? null,
    fullSpec.name,
    fullSpec.description,
    fullSpec.domain || "General",
    version,
    fullSpec.approved ? 1 : 0,
    fullSpec.is_example ? 1 : 0,
    JSON.stringify(fullSpec),
    now,
    now
  );

  db.prepare(`
    INSERT INTO model_versions (id, model_id, version, spec_json, change_note, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    `${fullSpec.id}-v${version}-${Date.now()}`,
    fullSpec.id,
    version,
    JSON.stringify(fullSpec),
    changeNote,
    now
  );

  return fullSpec;
}

export function updateModel(
  id: string,
  spec: OrbitModelSpec,
  changeNote = "Updated model specification"
): OrbitModelSpec | null {
  const existing = getModelById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const nextVersion = existing.version + 1;
  const updated: OrbitModelSpec = {
    ...spec,
    id,
    version: nextVersion,
    is_example: existing.is_example,
    project_id: spec.project_id ?? existing.project_id ?? null,
    created_at: existing.created_at ?? now,
    updated_at: now,
  };

  db.prepare(`
    UPDATE simulation_models
    SET name = ?, description = ?, domain = ?, version = ?, approved = ?, spec_json = ?, updated_at = ?
    WHERE id = ?
  `).run(
    updated.name,
    updated.description,
    updated.domain || "General",
    nextVersion,
    updated.approved ? 1 : 0,
    JSON.stringify(updated),
    now,
    id
  );

  db.prepare(`
    INSERT INTO model_versions (id, model_id, version, spec_json, change_note, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    `${id}-v${nextVersion}-${Date.now()}`,
    id,
    nextVersion,
    JSON.stringify(updated),
    changeNote,
    now
  );

  return updated;
}

export function deleteModel(id: string): boolean {
  const res = db.prepare(`DELETE FROM simulation_models WHERE id = ?`).run(id);
  return res.changes > 0;
}

export function listModelVersions(modelId: string) {
  return db
    .prepare(
      `SELECT id, model_id, version, change_note, created_at
       FROM model_versions
       WHERE model_id = ?
       ORDER BY version DESC`
    )
    .all(modelId);
}

export function insertSimulationRun(run: {
  id: string;
  model_id: string;
  model_version: number;
  status: SimulationRunRecord["status"];
  solver: string;
  random_seed: number;
  parameter_overrides: Record<string, number>;
  time_overrides: Record<string, unknown>;
}): SimulationRunRecord {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO simulation_runs
      (id, model_id, model_version, status, progress, solver, random_seed,
       parameter_overrides_json, time_overrides_json, created_at)
    VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
  `).run(
    run.id,
    run.model_id,
    run.model_version,
    run.status,
    run.solver,
    run.random_seed,
    JSON.stringify(run.parameter_overrides),
    JSON.stringify(run.time_overrides),
    now
  );

  return getSimulationRun(run.id)!;
}

export function updateSimulationRunStatus(params: {
  id: string;
  status: SimulationRunRecord["status"];
  progress?: number;
  execution_ms?: number | null;
  error_message?: string | null;
  completed?: boolean;
}): void {
  const completedAt = params.completed ? new Date().toISOString() : null;
  db.prepare(`
    UPDATE simulation_runs
    SET status = ?,
        progress = COALESCE(?, progress),
        execution_ms = COALESCE(?, execution_ms),
        error_message = COALESCE(?, error_message),
        completed_at = COALESCE(?, completed_at)
    WHERE id = ?
  `).run(
    params.status,
    params.progress ?? null,
    params.execution_ms ?? null,
    params.error_message ?? null,
    completedAt,
    params.id
  );
}

export function saveSimulationResult(runId: string, result: SimulationResult): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO simulation_results (run_id, result_json, created_at)
    VALUES (?, ?, ?)
  `).run(runId, JSON.stringify(result), now);
}

function hydrateRunRow(row: {
  id: string;
  model_id: string;
  model_name?: string;
  model_version: number;
  status: SimulationRunRecord["status"];
  progress: number;
  solver: SimulationRunRecord["solver"];
  random_seed: number;
  parameter_overrides_json: string;
  time_overrides_json: string;
  execution_ms: number | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}): SimulationRunRecord {
  return {
    id: row.id,
    model_id: row.model_id,
    model_name: row.model_name,
    model_version: row.model_version,
    status: row.status,
    progress: row.progress,
    solver: row.solver,
    random_seed: row.random_seed,
    parameter_overrides: JSON.parse(row.parameter_overrides_json || "{}"),
    time_overrides: JSON.parse(row.time_overrides_json || "{}"),
    execution_ms: row.execution_ms,
    error_message: row.error_message,
    created_at: row.created_at,
    completed_at: row.completed_at,
  };
}

export function getSimulationRun(runId: string): SimulationRunRecord | null {
  const row = db
    .prepare(
      `SELECT r.*, m.name AS model_name
       FROM simulation_runs r
       LEFT JOIN simulation_models m ON m.id = r.model_id
       WHERE r.id = ?`
    )
    .get(runId) as Parameters<typeof hydrateRunRow>[0] | undefined;
  return row ? hydrateRunRow(row) : null;
}

export function listSimulationRuns(modelId?: string, limit = 30): SimulationRunRecord[] {
  const rows = modelId
    ? (db
        .prepare(
          `SELECT r.*, m.name AS model_name
           FROM simulation_runs r
           LEFT JOIN simulation_models m ON m.id = r.model_id
           WHERE r.model_id = ?
           ORDER BY r.created_at DESC
           LIMIT ?`
        )
        .all(modelId, limit) as Array<Parameters<typeof hydrateRunRow>[0]>)
    : (db
        .prepare(
          `SELECT r.*, m.name AS model_name
           FROM simulation_runs r
           LEFT JOIN simulation_models m ON m.id = r.model_id
           ORDER BY r.created_at DESC
           LIMIT ?`
        )
        .all(limit) as Array<Parameters<typeof hydrateRunRow>[0]>);
  return rows.map(hydrateRunRow);
}

export function getSimulationResult(runId: string): SimulationResult | null {
  const row = db
    .prepare(`SELECT result_json FROM simulation_results WHERE run_id = ?`)
    .get(runId) as { result_json: string } | undefined;
  return row ? (JSON.parse(row.result_json) as SimulationResult) : null;
}

export function saveExperiment(params: {
  id: string;
  name: string;
  description: string;
  model_id: string;
  baseline_run_id: string;
  variant_run_id: string;
  parameter_overrides: Record<string, number>;
  comparison: ExperimentComparison;
}): ExperimentRecord {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO experiments
      (id, name, description, model_id, baseline_run_id, variant_run_id, parameter_overrides_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.id,
    params.name,
    params.description,
    params.model_id,
    params.baseline_run_id,
    params.variant_run_id,
    JSON.stringify(params.parameter_overrides),
    now
  );

  db.prepare(`
    INSERT OR REPLACE INTO experiment_comparisons (experiment_id, comparison_json, created_at)
    VALUES (?, ?, ?)
  `).run(params.id, JSON.stringify(params.comparison), now);

  const model = getModelById(params.model_id);
  return {
    id: params.id,
    name: params.name,
    description: params.description,
    model_id: params.model_id,
    model_name: model?.name,
    baseline_run_id: params.baseline_run_id,
    variant_run_id: params.variant_run_id,
    parameter_overrides: params.parameter_overrides,
    comparison: params.comparison,
    created_at: now,
  };
}

export function listExperiments(limit = 30): ExperimentRecord[] {
  const rows = db
    .prepare(
      `SELECT e.*, m.name AS model_name, c.comparison_json
       FROM experiments e
       LEFT JOIN simulation_models m ON m.id = e.model_id
       LEFT JOIN experiment_comparisons c ON c.experiment_id = e.id
       ORDER BY e.created_at DESC
       LIMIT ?`
    )
    .all(limit) as Array<{
    id: string;
    name: string;
    description: string;
    model_id: string;
    model_name?: string;
    baseline_run_id: string;
    variant_run_id: string;
    parameter_overrides_json: string;
    comparison_json: string | null;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    model_id: row.model_id,
    model_name: row.model_name,
    baseline_run_id: row.baseline_run_id,
    variant_run_id: row.variant_run_id,
    parameter_overrides: JSON.parse(row.parameter_overrides_json || "{}"),
    comparison: row.comparison_json
      ? (JSON.parse(row.comparison_json) as ExperimentComparison)
      : null,
    created_at: row.created_at,
  }));
}

export function recordExport(entry: Omit<ExportRecord, "created_at">): ExportRecord {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO export_history (id, run_id, model_id, format, size_bytes, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(entry.id, entry.run_id, entry.model_id, entry.format, entry.size_bytes, now);
  return { ...entry, created_at: now };
}

export function listExports(limit = 20): ExportRecord[] {
  return db
    .prepare(`SELECT * FROM export_history ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as ExportRecord[];
}

export function getDashboardStats(): DashboardStats {
  const countOf = (table: string) =>
    (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;

  return {
    total_projects: countOf("projects"),
    total_models: countOf("simulation_models"),
    total_runs: countOf("simulation_runs"),
    total_experiments: countOf("experiments"),
    total_exports: countOf("export_history"),
    recent_models: listModels().slice(0, 8),
    recent_runs: listSimulationRuns(undefined, 8),
    recent_experiments: listExperiments(6),
  };
}
