import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import type {
  ExperimentComparison,
  OrbitModelSpec,
  SimulationResult,
  ValidationReport,
} from "../src/types/orbit";

const CLI_PATH = path.resolve(process.cwd(), "backend", "app", "engine_cli.py");
const DEFAULT_TIMEOUT_MS = 15000;

const activeRunProcesses = new Map<string, ChildProcess>();

interface PythonCliResponse {
  ok: boolean;
  error?: string;
  python_version?: string;
  schema_version?: string;
  solvers?: string[];
  validation?: ValidationReport;
  result?: SimulationResult;
  comparison?: ExperimentComparison;
}

function invokePythonEngine(
  payload: Record<string, unknown>,
  options?: { runId?: string; timeoutMs?: number }
): Promise<PythonCliResponse> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    // Spawn Python directly with argument array and shell: false (never shell interpolation)
    const child = spawn("python3", [CLI_PATH], {
      cwd: process.cwd(),
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        PYTHONUNBUFFERED: "1",
        PYTHONDONTWRITEBYTECODE: "1",
      },
    });

    if (options?.runId) {
      activeRunProcesses.set(options.runId, child);
    }

    let stdout = "";
    let stderr = "";
    let settled = false;

    const cleanup = () => {
      if (options?.runId) {
        activeRunProcesses.delete(options.runId);
      }
      clearTimeout(timer);
    };

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill("SIGKILL");
        cleanup();
        reject(new Error(`Python simulation engine timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });

    child.on("error", (err) => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error(`Failed to start Python engine: ${err.message}`));
      }
    });

    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      cleanup();

      if (signal === "SIGTERM" || signal === "SIGKILL") {
        reject(new Error("Simulation execution was cancelled"));
        return;
      }

      try {
        const parsed = JSON.parse(stdout.trim() || "{}") as PythonCliResponse;
        if (!parsed.ok) {
          reject(new Error(parsed.error || stderr.trim() || `Python exited with code ${code}`));
          return;
        }
        resolve(parsed);
      } catch {
        reject(
          new Error(
            stderr.trim() || `Malformed response from Python engine (exit code ${code})`
          )
        );
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

export function cancelActiveRun(runId: string): boolean {
  const proc = activeRunProcesses.get(runId);
  if (!proc) return false;
  proc.kill("SIGTERM");
  activeRunProcesses.delete(runId);
  return true;
}

export async function checkPythonHealth(): Promise<{
  available: boolean;
  python_version: string;
  schema_version: string;
  solvers: string[];
}> {
  try {
    const res = await invokePythonEngine({ command: "health" }, { timeoutMs: 5000 });
    return {
      available: true,
      python_version: res.python_version ?? "3.11",
      schema_version: res.schema_version ?? "1.0.0",
      solvers: res.solvers ?? ["euler", "rk4"],
    };
  } catch {
    return {
      available: false,
      python_version: "unavailable",
      schema_version: "1.0.0",
      solvers: [],
    };
  }
}

export async function validateModelInPython(
  model: OrbitModelSpec
): Promise<ValidationReport> {
  const res = await invokePythonEngine({ command: "validate", model });
  if (!res.validation) {
    throw new Error("Python validator returned no report");
  }
  return res.validation;
}

export async function runSimulationInPython(params: {
  runId?: string;
  model: OrbitModelSpec;
  parameterOverrides?: Record<string, number>;
  timeOverrides?: Record<string, unknown>;
  randomSeed?: number;
}): Promise<SimulationResult> {
  const res = await invokePythonEngine(
    {
      command: "simulate",
      model: params.model,
      parameter_overrides: params.parameterOverrides ?? {},
      time_overrides: params.timeOverrides ?? {},
      random_seed: params.randomSeed,
    },
    { runId: params.runId }
  );
  if (!res.result) {
    throw new Error("Python engine returned empty simulation result");
  }
  return res.result;
}

export async function compareResultsInPython(
  baseline: SimulationResult,
  variant: SimulationResult
): Promise<ExperimentComparison> {
  const res = await invokePythonEngine({
    command: "compare",
    baseline,
    variant,
  });
  if (!res.comparison) {
    throw new Error("Python comparison engine returned no delta payload");
  }
  return res.comparison;
}
