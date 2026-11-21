import "dotenv/config";
import crypto from "node:crypto";
import express, { type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { createServer as createViteServer } from "vite";
import {
  createProject,
  deleteModel,
  getDashboardStats,
  getDatabaseInfo,
  getModelById,
  getSimulationResult,
  getSimulationRun,
  initializeDatabase,
  insertSimulationRun,
  listExperiments,
  listExports,
  listModels,
  listModelVersions,
  listProjects,
  listSimulationRuns,
  recordExport,
  saveExperiment,
  saveNewModel,
  saveSimulationResult,
  updateModel,
  updateSimulationRunStatus,
} from "./server/db";
import {
  explainResultsWithGemini,
  GEMINI_MODEL,
  interpretScenarioWithGemini,
  isGeminiConfigured,
} from "./server/geminiService";
import {
  cancelActiveRun,
  checkPythonHealth,
  compareResultsInPython,
  runSimulationInPython,
  validateModelInPython,
} from "./server/pythonBridge";
import type { OrbitModelSpec } from "./src/types/orbit";

const PORT = 3000;
const MAX_EXPORT_BYTES = 5 * 1024 * 1024; // 5 MB safety limit

initializeDatabase();

const app = express();
app.use(express.json({ limit: "2mb" }));

// ---------------------------------------------------------------------------
// Security: Explicit Environment-Based CORS & Cross-Origin Mutation Guard
// ---------------------------------------------------------------------------
function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>([
    `http://localhost:${PORT}`,
    `http://127.0.0.1:${PORT}`,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);

  if (process.env.ALLOWED_ORIGINS) {
    for (const item of process.env.ALLOWED_ORIGINS.split(",")) {
      const trimmed = item.trim().replace(/\/+$/, "");
      if (trimmed) origins.add(trimmed);
    }
  }

  if (process.env.APP_URL) {
    try {
      const parsed = new URL(process.env.APP_URL);
      origins.add(parsed.origin);
    } catch {
      // Ignore invalid URL in environment
    }
  }

  return origins;
}

const allowedOrigins = getAllowedOrigins();

// Secure CORS middleware using explicit environment allowlist (never wildcard '*')
app.use((req: Request, res: Response, next: express.NextFunction) => {
  const originHeader = req.headers.origin;
  const isAllowedOrigin = typeof originHeader === "string" && allowedOrigins.has(originHeader);

  if (isAllowedOrigin && originHeader) {
    res.setHeader("Access-Control-Allow-Origin", originHeader);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept"
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }

  // Preflight handling
  if (req.method === "OPTIONS") {
    if (originHeader && !isAllowedOrigin) {
      return res.status(403).json({
        error: "Cross-origin request rejected: origin not permitted by allowlist.",
      });
    }
    return res.status(204).end();
  }

  // State-changing mutation guard against unauthorized cross-origin requests
  const stateChangingMethods = new Set(["POST", "PUT", "DELETE", "PATCH"]);
  if (stateChangingMethods.has(req.method)) {
    // Check Origin header if present
    if (originHeader && !isAllowedOrigin) {
      return res.status(403).json({
        error: "Cross-origin state-changing request forbidden.",
      });
    }

    // Check Referer header if Origin is not present
    const referer = req.headers.referer;
    if (!originHeader && typeof referer === "string") {
      try {
        const refOrigin = new URL(referer).origin;
        if (!allowedOrigins.has(refOrigin)) {
          return res.status(403).json({
            error: "State-changing request forbidden: unauthorized referer.",
          });
        }
      } catch {
        return res.status(403).json({
          error: "State-changing request forbidden: malformed referer header.",
        });
      }
    }

    // Check modern browser Fetch metadata if present
    const secFetchSite = req.headers["sec-fetch-site"];
    if (secFetchSite === "cross-site" && !isAllowedOrigin) {
      return res.status(403).json({
        error: "Cross-site request rejected.",
      });
    }
  }

  return next();
});

// Lightweight in-memory rate guard for AI & execution endpoints
const requestBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, maxPerMinute: number) {
  return (req: Request, res: Response, next: express.NextFunction) => {
    const ip = req.ip || "local";
    const bucketKey = `${key}:${ip}`;
    const now = Date.now();
    const current = requestBuckets.get(bucketKey);
    if (!current || current.resetAt < now) {
      requestBuckets.set(bucketKey, { count: 1, resetAt: now + 60_000 });
      return next();
    }
    if (current.count >= maxPerMinute) {
      return res.status(429).json({
        error: "Rate limit exceeded. Please wait briefly before retrying.",
      });
    }
    current.count += 1;
    return next();
  };
}

function sendError(res: Response, status: number, message: string, details?: unknown) {
  res.status(status).json({
    error: message,
    ...(details ? { details } : {}),
  });
}

// ---------------------------------------------------------------------------
// API v1 Routes
// ---------------------------------------------------------------------------

app.get("/api/v1/health", async (_req, res) => {
  const python = await checkPythonHealth();
  res.json({
    status: python.available ? "ok" : "degraded",
    python_engine: python,
    database: getDatabaseInfo(),
    gemini: {
      configured: isGeminiConfigured(),
      model: GEMINI_MODEL,
    },
  });
});

app.get("/api/v1/dashboard/stats", (_req, res) => {
  res.json(getDashboardStats());
});

app.get("/api/v1/projects", (_req, res) => {
  res.json({ projects: listProjects() });
});

app.post("/api/v1/projects", (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
  if (!name || name.length > 120) {
    return sendError(res, 400, "Project name is required (max 120 characters).");
  }
  const id = `proj-${crypto.randomBytes(4).toString("hex")}`;
  res.status(201).json(createProject(id, name, description));
});

// Scenario interpretation via server-side Gemini + independent Python validation
app.post("/api/v1/scenarios/interpret", rateLimit("interpret", 20), async (req, res) => {
  try {
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
    if (!prompt || prompt.length < 10) {
      return sendError(res, 400, "Please describe your simulation scenario in at least 10 characters.");
    }
    if (prompt.length > 4000) {
      return sendError(res, 400, "Scenario description exceeds 4,000 character limit.");
    }

    const result = await interpretScenarioWithGemini({
      prompt,
      duration: req.body?.duration ? Number(req.body.duration) : undefined,
      timeUnit: typeof req.body?.time_unit === "string" ? req.body.time_unit : undefined,
      dt: req.body?.dt ? Number(req.body.dt) : undefined,
      solver: req.body?.solver === "euler" || req.body?.solver === "rk4" ? req.body.solver : undefined,
      clarificationAnswers:
        req.body?.clarification_answers && typeof req.body.clarification_answers === "object"
          ? req.body.clarification_answers
          : undefined,
      skipClarification: Boolean(req.body?.skip_clarification),
    });

    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to interpret scenario";
    sendError(res, 502, msg);
  }
});

// Models CRUD
app.get("/api/v1/models", (_req, res) => {
  res.json({ models: listModels() });
});

app.post("/api/v1/models", async (req, res) => {
  try {
    const raw = req.body as Partial<OrbitModelSpec>;
    if (!raw || typeof raw.name !== "string" || !raw.name.trim()) {
      return sendError(res, 400, "Model specification must include a valid 'name'.");
    }

    const id =
      raw.id && typeof raw.id === "string" && raw.id.trim()
        ? raw.id.trim()
        : `model-${crypto.randomBytes(4).toString("hex")}`;

    const existing = getModelById(id);
    const finalId = existing ? `${id}-${crypto.randomBytes(2).toString("hex")}` : id;

    const spec: OrbitModelSpec = {
      id: finalId,
      name: raw.name.trim(),
      description: raw.description ?? "",
      domain: raw.domain ?? "General",
      schema_version: raw.schema_version ?? "1.0.0",
      version: 1,
      engine_type: "system_dynamics",
      time_config: raw.time_config ?? {
        start_time: 0,
        end_time: 20,
        dt: 0.25,
        time_unit: "years",
        solver: "rk4",
      },
      stocks: Array.isArray(raw.stocks) ? raw.stocks : [],
      flows: Array.isArray(raw.flows) ? raw.flows : [],
      parameters: Array.isArray(raw.parameters) ? raw.parameters : [],
      auxiliaries: Array.isArray(raw.auxiliaries) ? raw.auxiliaries : [],
      constraints: Array.isArray(raw.constraints) ? raw.constraints : [],
      assumptions: Array.isArray(raw.assumptions) ? raw.assumptions : [],
      random_seed: Number(raw.random_seed ?? 42),
      visualization: raw.visualization ?? {},
      approved: Boolean(raw.approved),
      project_id: raw.project_id ?? null,
      is_example: false,
    };

    const validation = await validateModelInPython(spec);
    const saved = saveNewModel(spec, req.body?.change_note ?? "Created model");
    res.status(201).json({ model: saved, validation });
  } catch (err) {
    sendError(res, 400, err instanceof Error ? err.message : "Failed to save model");
  }
});

app.get("/api/v1/models/:modelId", (req, res) => {
  const model = getModelById(req.params.modelId);
  if (!model) return sendError(res, 404, "Model not found");
  res.json({ model, versions: listModelVersions(model.id) });
});

app.put("/api/v1/models/:modelId", async (req, res) => {
  try {
    const existing = getModelById(req.params.modelId);
    if (!existing) return sendError(res, 404, "Model not found");

    const incoming = req.body as OrbitModelSpec;
    const validation = await validateModelInPython({ ...incoming, id: existing.id });

    // Only allow approved=true if Python validation succeeds
    const canApprove = Boolean(incoming.approved) && validation.valid;
    const updated = updateModel(
      existing.id,
      { ...incoming, approved: canApprove },
      typeof (req.body as { change_note?: string })?.change_note === "string"
        ? (req.body as { change_note?: string }).change_note
        : "Updated model specification"
    );

    res.json({ model: updated, validation });
  } catch (err) {
    sendError(res, 400, err instanceof Error ? err.message : "Failed to update model");
  }
});

app.delete("/api/v1/models/:modelId", (req, res) => {
  const deleted = deleteModel(req.params.modelId);
  if (!deleted) return sendError(res, 404, "Model not found");
  res.json({ deleted: true });
});

app.post("/api/v1/models/:modelId/validate", async (req, res) => {
  try {
    const stored = getModelById(req.params.modelId);
    const candidate =
      req.body && Array.isArray(req.body.stocks) ? (req.body as OrbitModelSpec) : stored;
    if (!candidate) return sendError(res, 404, "Model not found");
    const validation = await validateModelInPython(candidate);
    res.json(validation);
  } catch (err) {
    sendError(res, 400, err instanceof Error ? err.message : "Validation failed");
  }
});

app.post("/api/v1/validate-draft", async (req, res) => {
  try {
    const candidate = req.body as OrbitModelSpec;
    if (!candidate || typeof candidate !== "object") {
      return sendError(res, 400, "Model specification object is required");
    }
    const validation = await validateModelInPython(candidate);
    res.json(validation);
  } catch (err) {
    sendError(res, 400, err instanceof Error ? err.message : "Validation failed");
  }
});

// Simulation Execution (non-blocking background runner backed by real Python 3.11 subprocess)
app.get("/api/v1/simulations", (req, res) => {
  const modelId = typeof req.query.model_id === "string" ? req.query.model_id : undefined;
  res.json({ runs: listSimulationRuns(modelId, 40) });
});

app.post("/api/v1/simulations/run", rateLimit("simulate", 60), async (req, res) => {
  try {
    const modelId = typeof req.body?.model_id === "string" ? req.body.model_id : "";
    const model = getModelById(modelId);
    if (!model) {
      return sendError(res, 404, `Model '${modelId}' not found`);
    }

    const parameterOverrides =
      req.body?.parameter_overrides && typeof req.body.parameter_overrides === "object"
        ? (req.body.parameter_overrides as Record<string, number>)
        : {};
    const timeOverrides =
      req.body?.time_overrides && typeof req.body.time_overrides === "object"
        ? (req.body.time_overrides as Record<string, unknown>)
        : {};
    const randomSeed =
      req.body?.random_seed !== undefined ? Number(req.body.random_seed) : model.random_seed;
    const solver =
      typeof timeOverrides.solver === "string" ? timeOverrides.solver : model.time_config.solver;

    const runId = `run-${crypto.randomBytes(5).toString("hex")}`;
    const runRecord = insertSimulationRun({
      id: runId,
      model_id: model.id,
      model_version: model.version,
      status: "running",
      solver,
      random_seed: randomSeed,
      parameter_overrides: parameterOverrides,
      time_overrides: timeOverrides,
    });

    const syncMode = req.body?.sync !== false;

    const executePromise = runSimulationInPython({
      runId,
      model,
      parameterOverrides,
      timeOverrides,
      randomSeed,
    })
      .then((result) => {
        saveSimulationResult(runId, result);
        updateSimulationRunStatus({
          id: runId,
          status: "completed",
          progress: 100,
          execution_ms: result.execution_ms,
          completed: true,
        });
        return result;
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Simulation failed";
        const isCancelled = msg.toLowerCase().includes("cancelled");
        updateSimulationRunStatus({
          id: runId,
          status: isCancelled ? "cancelled" : "failed",
          error_message: msg,
          completed: true,
        });
        throw err;
      });

    if (syncMode) {
      try {
        const result = await executePromise;
        const completedRun = getSimulationRun(runId);
        return res.status(201).json({ run: completedRun, result });
      } catch (err) {
        return sendError(res, 422, err instanceof Error ? err.message : "Simulation execution failed");
      }
    }

    // Async non-blocking mode for long-running jobs
    executePromise.catch(() => {
      // Already persisted as failed/cancelled in DB
    });
    return res.status(202).json({ run: runRecord });
  } catch (err) {
    sendError(res, 400, err instanceof Error ? err.message : "Failed to start simulation");
  }
});

app.get("/api/v1/simulations/:runId", (req, res) => {
  const run = getSimulationRun(req.params.runId);
  if (!run) return sendError(res, 404, "Simulation run not found");
  res.json({ run });
});

app.post("/api/v1/simulations/:runId/cancel", (req, res) => {
  const run = getSimulationRun(req.params.runId);
  if (!run) return sendError(res, 404, "Simulation run not found");
  const killed = cancelActiveRun(run.id);
  if (killed || run.status === "running" || run.status === "queued") {
    updateSimulationRunStatus({
      id: run.id,
      status: "cancelled",
      error_message: "Cancelled by user",
      completed: true,
    });
  }
  res.json({ run: getSimulationRun(run.id), cancelled: true });
});

app.get("/api/v1/simulations/:runId/results", (req, res) => {
  const run = getSimulationRun(req.params.runId);
  if (!run) return sendError(res, 404, "Simulation run not found");
  const result = getSimulationResult(run.id);
  if (!result) return sendError(res, 404, "Results not available for this run");
  res.json({ run, result });
});

// Experiments & Comparison
app.get("/api/v1/experiments", (_req, res) => {
  res.json({ experiments: listExperiments(40) });
});

app.post("/api/v1/experiments", rateLimit("experiments", 40), async (req, res) => {
  try {
    const modelId = typeof req.body?.model_id === "string" ? req.body.model_id : "";
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
    const parameterOverrides =
      req.body?.parameter_overrides && typeof req.body.parameter_overrides === "object"
        ? (req.body.parameter_overrides as Record<string, number>)
        : {};
    const timeOverrides =
      req.body?.time_overrides && typeof req.body.time_overrides === "object"
        ? (req.body.time_overrides as Record<string, unknown>)
        : {};

    const model = getModelById(modelId);
    if (!model) return sendError(res, 404, "Baseline model not found");
    if (!name) return sendError(res, 400, "Experiment name is required");

    // Ensure baseline run exists (reuse provided baseline_run_id or run fresh baseline)
    let baselineRunId =
      typeof req.body?.baseline_run_id === "string" ? req.body.baseline_run_id : "";
    let baselineResult = baselineRunId ? getSimulationResult(baselineRunId) : null;

    if (!baselineResult) {
      baselineRunId = `run-${crypto.randomBytes(5).toString("hex")}`;
      insertSimulationRun({
        id: baselineRunId,
        model_id: model.id,
        model_version: model.version,
        status: "running",
        solver: model.time_config.solver,
        random_seed: model.random_seed,
        parameter_overrides: {},
        time_overrides: timeOverrides,
      });
      baselineResult = await runSimulationInPython({
        runId: baselineRunId,
        model,
        parameterOverrides: {},
        timeOverrides,
        randomSeed: model.random_seed,
      });
      saveSimulationResult(baselineRunId, baselineResult);
      updateSimulationRunStatus({
        id: baselineRunId,
        status: "completed",
        progress: 100,
        execution_ms: baselineResult.execution_ms,
        completed: true,
      });
    }

    // Run alternative variant without mutating the original model
    const variantRunId = `run-${crypto.randomBytes(5).toString("hex")}`;
    insertSimulationRun({
      id: variantRunId,
      model_id: model.id,
      model_version: model.version,
      status: "running",
      solver:
        typeof timeOverrides.solver === "string" ? timeOverrides.solver : model.time_config.solver,
      random_seed: model.random_seed,
      parameter_overrides: parameterOverrides,
      time_overrides: timeOverrides,
    });

    const variantResult = await runSimulationInPython({
      runId: variantRunId,
      model,
      parameterOverrides,
      timeOverrides,
      randomSeed: model.random_seed,
    });
    saveSimulationResult(variantRunId, variantResult);
    updateSimulationRunStatus({
      id: variantRunId,
      status: "completed",
      progress: 100,
      execution_ms: variantResult.execution_ms,
      completed: true,
    });

    const comparison = await compareResultsInPython(baselineResult, variantResult);
    const experimentId = `exp-${crypto.randomBytes(4).toString("hex")}`;
    const experiment = saveExperiment({
      id: experimentId,
      name,
      description,
      model_id: model.id,
      baseline_run_id: baselineRunId,
      variant_run_id: variantRunId,
      parameter_overrides: parameterOverrides,
      comparison,
    });

    res.status(201).json({
      experiment,
      baseline_result: baselineResult,
      variant_result: variantResult,
      comparison,
    });
  } catch (err) {
    sendError(res, 422, err instanceof Error ? err.message : "Failed to run experiment");
  }
});

app.post("/api/v1/experiments/compare", async (req, res) => {
  try {
    const baselineRunId = typeof req.body?.baseline_run_id === "string" ? req.body.baseline_run_id : "";
    const variantRunId = typeof req.body?.variant_run_id === "string" ? req.body.variant_run_id : "";
    const baseline = getSimulationResult(baselineRunId);
    const variant = getSimulationResult(variantRunId);
    if (!baseline || !variant) {
      return sendError(res, 404, "Both baseline and variant run results must exist");
    }
    const comparison = await compareResultsInPython(baseline, variant);
    res.json({ baseline, variant, comparison });
  } catch (err) {
    sendError(res, 400, err instanceof Error ? err.message : "Comparison failed");
  }
});

// Grounded AI Explanation
app.post("/api/v1/analysis/explain", rateLimit("explain", 25), async (req, res) => {
  try {
    const runId = typeof req.body?.run_id === "string" ? req.body.run_id : "";
    const variantRunId =
      typeof req.body?.variant_run_id === "string" ? req.body.variant_run_id : undefined;
    const focusQuestion =
      typeof req.body?.focus_question === "string" ? req.body.focus_question.trim() : undefined;

    const run = getSimulationRun(runId);
    if (!run) return sendError(res, 404, "Simulation run not found");

    const model = getModelById(run.model_id);
    const result = getSimulationResult(runId);
    if (!model || !result) {
      return sendError(res, 404, "Model or computed simulation results not found");
    }

    let variantResult = null;
    let comparison = null;
    if (variantRunId) {
      variantResult = getSimulationResult(variantRunId);
      if (variantResult) {
        comparison = await compareResultsInPython(result, variantResult);
      }
    }

    const explanation = await explainResultsWithGemini({
      model,
      result,
      variantResult,
      comparison,
      focusQuestion,
    });

    res.json(explanation);
  } catch (err) {
    sendError(res, 502, err instanceof Error ? err.message : "Failed to generate grounded analysis");
  }
});

// Exports (CSV, JSON, and structured PDF payload with size limits + history logging)
app.get("/api/v1/exports", (_req, res) => {
  res.json({ exports: listExports(30) });
});

app.post("/api/v1/exports", (req, res) => {
  const runId = typeof req.body?.run_id === "string" ? req.body.run_id : "";
  const format = req.body?.format === "csv" || req.body?.format === "pdf" ? req.body.format : "json";

  const run = getSimulationRun(runId);
  const result = run ? getSimulationResult(run.id) : null;
  const model = run ? getModelById(run.model_id) : null;
  if (!run || !result || !model) {
    return sendError(res, 404, "Simulation run and results are required for export");
  }

  let content = "";
  let mimeType = "application/json";
  const safeBase = model.id.replace(/[^a-zA-Z0-9_-]/g, "_");
  let filename = `${safeBase}_${run.id}.${format}`;

  if (format === "csv") {
    const varNames = Object.keys(result.series);
    const header = ["time", ...varNames].join(",");
    const rows = result.times.map((t, idx) =>
      [t, ...varNames.map((v) => result.series[v]?.[idx] ?? "")].join(",")
    );
    content = [header, ...rows].join("\n");
    mimeType = "text/csv;charset=utf-8";
  } else {
    const bundle = {
      orbit_schema_version: "1.0.0",
      exported_at: new Date().toISOString(),
      model,
      run,
      result,
    };
    content = JSON.stringify(bundle, null, 2);
    mimeType = "application/json;charset=utf-8";
    if (format === "pdf") {
      filename = `${safeBase}_${run.id}.pdf`;
    }
  }

  const sizeBytes = Buffer.byteLength(content, "utf-8");
  if (sizeBytes > MAX_EXPORT_BYTES) {
    return sendError(res, 413, "Export payload exceeds 5 MB safety limit");
  }

  const entry = recordExport({
    id: `exp-dl-${crypto.randomBytes(4).toString("hex")}`,
    run_id: run.id,
    model_id: model.id,
    format,
    size_bytes: sizeBytes,
  });

  res.json({
    export_record: entry,
    filename,
    mime_type: mimeType,
    content: format === "pdf" ? undefined : content,
  });
});

// ---------------------------------------------------------------------------
// Frontend Hosting (Vite dev middleware in dev, dist/ in production)
// ---------------------------------------------------------------------------

async function startServer() {
  const isProd = process.env.NODE_ENV === "production";

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      const indexFile = path.join(distDir, "index.html");
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send("Production bundle not built");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ORBIT server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to boot ORBIT server:", err);
  process.exit(1);
});
