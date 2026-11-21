import { GoogleGenAI, Type } from "@google/genai";
import crypto from "node:crypto";
import type {
  AIExplanationResponse,
  AIInterpretationResponse,
  ExperimentComparison,
  OrbitModelSpec,
  SimulationResult,
} from "../src/types/orbit";
import { validateModelInPython } from "./pythonBridge";

export const GEMINI_MODEL = "gemini-4-hydrogen";

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error(
      "GEMINI_API_KEY is not configured on the server. Offline simulations and bundled models remain fully available."
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim().length > 8 && key !== "MY_GEMINI_API_KEY");
}

const INTERPRETATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    needs_clarification: {
      type: Type.BOOLEAN,
      description:
        "Set to true ONLY if critical initial values, units, or system boundaries are genuinely missing and no clarifications were provided yet.",
    },
    summary: {
      type: Type.STRING,
      description: "Concise scientific summary of the interpreted system.",
    },
    missing_information: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    clarifications: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          question: { type: Type.STRING },
          reason: { type: Type.STRING },
          suggested_default: { type: Type.STRING },
        },
        required: ["id", "question", "reason", "suggested_default"],
      },
    },
    model_draft: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        name: { type: Type.STRING },
        description: { type: Type.STRING },
        domain: { type: Type.STRING },
        time_config: {
          type: Type.OBJECT,
          properties: {
            start_time: { type: Type.NUMBER },
            end_time: { type: Type.NUMBER },
            dt: { type: Type.NUMBER },
            time_unit: { type: Type.STRING },
            solver: { type: Type.STRING },
          },
          required: ["start_time", "end_time", "dt", "time_unit", "solver"],
        },
        stocks: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              initial_value: { type: Type.NUMBER },
              unit: { type: Type.STRING },
              description: { type: Type.STRING },
              inflows: { type: Type.ARRAY, items: { type: Type.STRING } },
              outflows: { type: Type.ARRAY, items: { type: Type.STRING } },
              min_value: { type: Type.NUMBER, nullable: true },
              max_value: { type: Type.NUMBER, nullable: true },
            },
            required: ["id", "name", "initial_value", "unit", "description", "inflows", "outflows"],
          },
        },
        parameters: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              value: { type: Type.NUMBER },
              unit: { type: Type.STRING },
              description: { type: Type.STRING },
              min_value: { type: Type.NUMBER, nullable: true },
              max_value: { type: Type.NUMBER, nullable: true },
              step: { type: Type.NUMBER, nullable: true },
            },
            required: ["id", "name", "value", "unit", "description"],
          },
        },
        auxiliaries: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              equation: { type: Type.STRING },
              unit: { type: Type.STRING },
              description: { type: Type.STRING },
            },
            required: ["id", "name", "equation", "unit", "description"],
          },
        },
        flows: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              equation: { type: Type.STRING },
              unit: { type: Type.STRING },
              description: { type: Type.STRING },
              source_stock: { type: Type.STRING, nullable: true },
              target_stock: { type: Type.STRING, nullable: true },
              non_negative: { type: Type.BOOLEAN },
            },
            required: ["id", "name", "equation", "unit", "description", "non_negative"],
          },
        },
        constraints: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              variable: { type: Type.STRING },
              operator: { type: Type.STRING },
              threshold: { type: Type.NUMBER },
              severity: { type: Type.STRING },
              label: { type: Type.STRING },
            },
            required: ["id", "variable", "operator", "threshold", "severity", "label"],
          },
        },
        assumptions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              statement: { type: Type.STRING },
              category: { type: Type.STRING },
              source: { type: Type.STRING },
              impact: { type: Type.STRING },
            },
            required: ["id", "statement", "category", "source", "impact"],
          },
        },
        primary_series: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: [
        "name",
        "description",
        "domain",
        "time_config",
        "stocks",
        "parameters",
        "auxiliaries",
        "flows",
        "constraints",
        "assumptions",
      ],
    },
  },
  required: ["needs_clarification", "summary", "missing_information", "clarifications"],
};

const EXPLANATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING },
    summary: { type: Type.STRING },
    key_changes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          variable: { type: Type.STRING },
          observation: { type: Type.STRING },
          computed_evidence: { type: Type.STRING },
        },
        required: ["variable", "observation", "computed_evidence"],
      },
    },
    causal_mechanisms: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    unexpected_outcomes: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    limitations_and_assumptions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    disclaimer: { type: Type.STRING },
  },
  required: [
    "headline",
    "summary",
    "key_changes",
    "causal_mechanisms",
    "unexpected_outcomes",
    "limitations_and_assumptions",
    "disclaimer",
  ],
};

export async function interpretScenarioWithGemini(input: {
  prompt: string;
  duration?: number;
  timeUnit?: string;
  dt?: number;
  solver?: "euler" | "rk4";
  clarificationAnswers?: Record<string, string>;
  skipClarification?: boolean;
}): Promise<AIInterpretationResponse> {
  const ai = getGeminiClient();

  const hasAnswers =
    input.clarificationAnswers && Object.keys(input.clarificationAnswers).length > 0;

  const systemInstruction = [
    "You are ORBIT's scientific systems-dynamics modeling architect.",
    "Convert the user's natural-language system description into a canonical, mathematically consistent Stock-and-Flow specification.",
    "STRICT MATHEMATICAL RULES:",
    "1. Every identifier (stock, flow, parameter, auxiliary) MUST be snake_case alphanumeric (a-z, 0-9, _), unique across all categories, and NOT a reserved keyword (t, dt, pi, e, min, max, abs, sqrt, exp, log, ln, sin, cos, pow, round, clamp, safe_div, step).",
    "2. Equations MUST ONLY use numeric literals, defined variable IDs, operators (+, -, *, /, **, comparisons, `a if cond else b`), and allowlisted scalar functions: min, max, abs, sqrt, exp, log, ln, sin, cos, pow, round, clamp, safe_div(num, den, fallback), step(t, threshold).",
    "3. NEVER emit Python statements, imports, loops, lambdas, or attribute access.",
    "4. Avoid instantaneous circular dependencies between auxiliaries/flows; all feedback loops MUST pass through a stock.",
    "5. Use safe_div(a, b, 0) whenever a denominator could approach zero.",
    "6. Every flow listed in a stock's inflows/outflows MUST exist in the flows array.",
    "7. Provide explicit, editable modeling assumptions distinguishing illustrative estimates from user-specified values.",
    "8. If the user's prompt is very brief or underspecified AND skipClarification is false AND no clarificationAnswers have been provided yet, set needs_clarification=true with 2-3 targeted questions and suggested_default values (and still provide a best-effort model_draft or null). If the prompt already specifies clear quantities/horizon OR clarificationAnswers are provided OR skipClarification is true, set needs_clarification=false and generate the complete valid model_draft.",
  ].join("\n");

  const userPayload = {
    scenario_prompt: input.prompt,
    requested_settings: {
      end_time: input.duration ?? 20,
      time_unit: input.timeUnit ?? "years",
      dt: input.dt ?? 0.25,
      solver: input.solver ?? "rk4",
    },
    clarification_answers: input.clarificationAnswers ?? {},
    skip_clarification: Boolean(input.skipClarification || hasAnswers),
  };

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: JSON.stringify(userPayload, null, 2),
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: INTERPRETATION_SCHEMA,
    },
  });

  const text = (response.text ?? "").trim();
  if (!text) {
    throw new Error("Gemini returned an empty interpretation response");
  }

  const parsed = JSON.parse(text) as {
    needs_clarification: boolean;
    summary: string;
    missing_information: string[];
    clarifications: AIInterpretationResponse["clarifications"];
    model_draft?: (OrbitModelSpec & { primary_series?: string[] }) | null;
  };

  let modelDraft: OrbitModelSpec | null = null;
  let validation = null;

  if (parsed.model_draft) {
    const rawDraft = parsed.model_draft;
    const slug = (rawDraft.name || "model")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32);

    modelDraft = {
      id: `${slug || "sim"}-${crypto.randomBytes(3).toString("hex")}`,
      name: rawDraft.name || "Generated Simulation Model",
      description: rawDraft.description || input.prompt.slice(0, 240),
      domain: rawDraft.domain || "General Systems",
      schema_version: "1.0.0",
      version: 1,
      engine_type: "system_dynamics",
      time_config: {
        start_time: Number(rawDraft.time_config?.start_time ?? 0),
        end_time: Number(rawDraft.time_config?.end_time ?? input.duration ?? 20),
        dt: Number(rawDraft.time_config?.dt ?? input.dt ?? 0.25),
        time_unit: rawDraft.time_config?.time_unit || input.timeUnit || "years",
        solver:
          rawDraft.time_config?.solver === "euler" || rawDraft.time_config?.solver === "rk4"
            ? rawDraft.time_config.solver
            : input.solver ?? "rk4",
      },
      stocks: Array.isArray(rawDraft.stocks) ? rawDraft.stocks : [],
      parameters: Array.isArray(rawDraft.parameters)
        ? rawDraft.parameters.map((p) => ({ ...p, editable: true }))
        : [],
      auxiliaries: Array.isArray(rawDraft.auxiliaries) ? rawDraft.auxiliaries : [],
      flows: Array.isArray(rawDraft.flows) ? rawDraft.flows : [],
      constraints: Array.isArray(rawDraft.constraints) ? rawDraft.constraints : [],
      assumptions: Array.isArray(rawDraft.assumptions) ? rawDraft.assumptions : [],
      random_seed: 42,
      visualization: {
        primary_series:
          Array.isArray(rawDraft.primary_series) && rawDraft.primary_series.length > 0
            ? rawDraft.primary_series
            : (rawDraft.stocks ?? []).slice(0, 3).map((s) => s.id),
      },
      approved: false,
    };

    // Always validate untrusted AI output independently via Python AST validator
    validation = await validateModelInPython(modelDraft);
  }

  return {
    needs_clarification: Boolean(parsed.needs_clarification && !hasAnswers && !input.skipClarification),
    summary: parsed.summary || "Scenario interpreted.",
    missing_information: parsed.missing_information ?? [],
    clarifications: parsed.clarifications ?? [],
    model_draft: modelDraft,
    validation,
  };
}

export async function explainResultsWithGemini(input: {
  model: OrbitModelSpec;
  result: SimulationResult;
  variantResult?: SimulationResult | null;
  comparison?: ExperimentComparison | null;
  focusQuestion?: string;
}): Promise<AIExplanationResponse> {
  const ai = getGeminiClient();

  const systemInstruction = [
    "You are ORBIT's scientific simulation analyst.",
    "Explain ONLY what occurred inside the computed simulation results provided in the JSON payload.",
    "EVIDENCE GROUNDING RULES:",
    "1. Every numerical statement MUST cite exact values from the provided metrics, events, or comparison deltas.",
    "2. Never invent numbers, extrapolate beyond the simulated horizon, or recalculate trajectories.",
    "3. Explain mechanisms strictly through the model's defined stocks, flows, auxiliaries, and equations.",
    "4. Never claim that correlation proves causation outside the model's explicit equations.",
    "5. Never present simulated outcomes as reliable real-world forecasts; always highlight key model assumptions and limitations.",
  ].join("\n");

  const evidencePayload = {
    model_name: input.model.name,
    domain: input.model.domain,
    time_horizon: {
      start: input.result.start_time,
      end: input.result.end_time,
      dt: input.result.dt,
      unit: input.result.time_unit,
      solver: input.result.solver,
    },
    equations: {
      stocks: input.model.stocks.map((s) => ({
        id: s.id,
        unit: s.unit,
        initial: s.initial_value,
        inflows: s.inflows,
        outflows: s.outflows,
      })),
      flows: input.model.flows.map((f) => ({ id: f.id, equation: f.equation, unit: f.unit })),
      auxiliaries: input.model.auxiliaries.map((a) => ({
        id: a.id,
        equation: a.equation,
        unit: a.unit,
      })),
    },
    assumptions: input.model.assumptions,
    baseline_overrides: input.result.parameter_overrides,
    baseline_metrics: input.result.metrics,
    baseline_events: input.result.events.slice(0, 15),
    variant_overrides: input.variantResult?.parameter_overrides ?? null,
    variant_metrics: input.variantResult?.metrics ?? null,
    variant_events: input.variantResult?.events.slice(0, 15) ?? null,
    comparison_deltas: input.comparison ?? null,
    focus_question: input.focusQuestion ?? null,
  };

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: JSON.stringify(evidencePayload, null, 2),
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: EXPLANATION_SCHEMA,
    },
  });

  const text = (response.text ?? "").trim();
  if (!text) {
    throw new Error("Gemini returned an empty analysis response");
  }

  const parsed = JSON.parse(text) as Omit<AIExplanationResponse, "generated_at">;
  return {
    ...parsed,
    generated_at: new Date().toISOString(),
  };
}
