import React, { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FilePlus2,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import {
  Button,
  FormField,
  Input,
  InsetSurface,
  LoadingState,
  Panel,
  SectionHeader,
  Select,
  StatusIndicator,
  StatusNotice,
  Textarea,
} from "../components/ui/primitives";
import { useToast } from "../components/ui/Toast";
import { orbitApi } from "../services/api";
import type {
  AIInterpretationResponse,
  HealthStatus,
  OrbitModelSpec,
  SolverType,
} from "../types/orbit";

interface ScenarioBuilderPageProps {
  health: HealthStatus | null;
  defaultSolver: SolverType;
  onModelCreated: (model: OrbitModelSpec) => void;
  onOpenEditorWithBlank: () => void;
}

const EXAMPLE_PROMPTS = [
  {
    title: "Urban Resource & Grid Dynamics",
    duration: 20,
    unit: "years",
    dt: 0.25,
    prompt:
      "Simulate a city starting with 10,000 residents, limited electricity supplied by 3 power stations (18 MW each), 2 water reservoirs holding 2.4M m3 with annual recharge, regional material reserves, and population growth over 20 years. Track electricity balance, water reserves, and crowding stress.",
  },
  {
    title: "Coastal Fishery & Harvest Policy",
    duration: 30,
    unit: "years",
    dt: 0.25,
    prompt:
      "Simulate a coastal fish population starting at 50,000 tons with a carrying capacity of 120,000 tons, logistic reproduction rate of 0.35/year, and a commercial fishing fleet of 40 vessels harvesting proportionally to fish density over 30 years. Flag collapse warnings below 15,000 tons.",
  },
  {
    title: "SaaS Product Growth & Support Load",
    duration: 36,
    unit: "months",
    dt: 0.5,
    prompt:
      "Simulate a software product with 1,200 initial active customers, acquiring 180 customers/month, organic referrals at 4% of active customers/month, and monthly churn of 3.5% that increases when support ticket load exceeds engineering support capacity over 36 months.",
  },
  {
    title: "Regional Aquifer & Agriculture",
    duration: 25,
    unit: "years",
    dt: 0.25,
    prompt:
      "Simulate a groundwater aquifer starting with 800 million m3, natural rainfall recharge of 35 million m3/year, irrigated farmland starting at 12,000 hectares using 4,000 m3/hectare/year, and efficiency improvements over 25 years. Flag depletion below 200 million m3.",
  },
];

export function ScenarioBuilderPage({
  health,
  defaultSolver,
  onModelCreated,
  onOpenEditorWithBlank,
}: ScenarioBuilderPageProps) {
  const { notify } = useToast();
  const [prompt, setPrompt] = useState(EXAMPLE_PROMPTS[0].prompt);
  const [duration, setDuration] = useState(20);
  const [timeUnit, setTimeUnit] = useState("years");
  const [dt, setDt] = useState(0.25);
  const [solver, setSolver] = useState<SolverType>(defaultSolver);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interpretation, setInterpretation] = useState<AIInterpretationResponse | null>(null);
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<string, string>>({});

  const geminiAvailable = health?.gemini.configured ?? false;

  const runInterpretation = async (opts?: {
    skipClarification?: boolean;
    answers?: Record<string, string>;
  }) => {
    if (prompt.trim().length < 10) {
      setError("Describe your simulation scenario in at least 10 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await orbitApi.interpretScenario({
        prompt,
        duration,
        time_unit: timeUnit,
        dt,
        solver,
        clarification_answers: opts?.answers,
        skip_clarification: opts?.skipClarification,
      });
      setInterpretation(res);
      if (res.needs_clarification && res.clarifications.length > 0) {
        const defaults: Record<string, string> = {};
        res.clarifications.forEach((q) => {
          defaults[q.id] = q.suggested_default;
        });
        setClarificationAnswers(defaults);
      } else if (res.model_draft) {
        notify({
          tone: "success",
          title: "Structured model draft ready",
          description: "Review equations and assumptions in the Model Editor before executing.",
        });
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Scenario interpretation could not be completed. Check your connection or create a model manually."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!interpretation?.model_draft) return;
    setSaving(true);
    setError(null);
    try {
      const { model } = await orbitApi.createModel({
        ...interpretation.model_draft,
        approved: false,
        change_note: "Generated from natural-language scenario",
      });
      notify({
        tone: "success",
        title: "Draft saved to SQLite",
        description: `Opening ${model.name} in the Model Inspector & Editor.`,
      });
      onModelCreated(model);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save draft model.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="New Simulation"
        subtitle="Describe a system in plain language to generate a structured, AST-validated mathematical specification."
        action={
          <Button variant="secondary" onClick={onOpenEditorWithBlank}>
            <FilePlus2 className="w-4 h-4" aria-hidden="true" />
            Create Manually
          </Button>
        }
      />

      {!geminiAvailable ? (
        <StatusNotice
          tone="warning"
          title="AI interpretation is running in offline mode"
          message="Natural-language model generation requires GEMINI_API_KEY in the server environment. Manual model authoring and all bundled offline scenarios remain fully functional."
        />
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-5">
          <Panel className="p-6 space-y-5">
            <FormField
              id="scenario-prompt-input"
              label="Scenario Description"
              hint="Specify initial quantities, key rates or capacities, constraints, and the time horizon you want to observe."
            >
              <Textarea
                id="scenario-prompt-input"
                rows={6}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Example: Simulate a city with 10,000 residents, three power stations, two water reservoirs, and population growth over 20 years."
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[var(--orbit-border-subtle)]">
              <FormField id="builder-duration" label="Duration">
                <Input
                  id="builder-duration"
                  type="number"
                  min={1}
                  max={1000}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                />
              </FormField>
              <FormField id="builder-unit" label="Time Unit">
                <Select
                  id="builder-unit"
                  value={timeUnit}
                  onChange={(e) => setTimeUnit(e.target.value)}
                  className="w-full"
                >
                  <option value="years">years</option>
                  <option value="months">months</option>
                  <option value="days">days</option>
                  <option value="hours">hours</option>
                </Select>
              </FormField>
              <FormField id="builder-dt" label="Time Step (dt)">
                <Input
                  id="builder-dt"
                  type="number"
                  step={0.05}
                  min={0.01}
                  max={5}
                  value={dt}
                  onChange={(e) => setDt(Number(e.target.value))}
                />
              </FormField>
            </div>

            {/* Collapsible secondary settings */}
            <div className="border-t border-[var(--orbit-border-subtle)] pt-3">
              <button
                type="button"
                onClick={() => setShowAdvanced((s) => !s)}
                aria-expanded={showAdvanced}
                className="min-h-[44px] inline-flex items-center gap-2 text-sm font-medium text-[var(--orbit-text-secondary)] hover:text-[var(--orbit-text-primary)] cursor-pointer"
              >
                {showAdvanced ? (
                  <ChevronDown className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                )}
                Advanced numerical settings
              </button>

              {showAdvanced ? (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField id="builder-solver" label="Numerical Solver">
                    <Select
                      id="builder-solver"
                      value={solver}
                      onChange={(e) => setSolver(e.target.value as SolverType)}
                      className="w-full"
                    >
                      <option value="rk4">RK4 (4th-order Runge-Kutta)</option>
                      <option value="euler">Euler (1st-order explicit)</option>
                    </Select>
                  </FormField>
                  <InsetSurface className="p-3.5 flex flex-col justify-center text-sm font-mono">
                    <span className="text-[var(--orbit-text-secondary)]">Estimated steps</span>
                    <span className="text-[var(--orbit-text-primary)] font-semibold tabular-nums mt-0.5">
                      {dt > 0 ? Math.round(duration / dt) : 0} integration points
                    </span>
                  </InsetSurface>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--orbit-border-subtle)]">
              <Button
                variant="secondary"
                disabled={loading || prompt.trim().length < 10}
                onClick={() => runInterpretation({ skipClarification: true })}
              >
                Skip Clarifications &amp; Draft
              </Button>
              <Button
                loading={loading}
                disabled={prompt.trim().length < 10}
                onClick={() => runInterpretation({ skipClarification: false })}
              >
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                Interpret Scenario
              </Button>
            </div>
          </Panel>

          {loading ? (
            <LoadingState
              title="Interpreting scenario and validating equations"
              description="Generating canonical stock-and-flow equations on the server and checking AST safety in Python."
            />
          ) : null}

          {error ? <StatusNotice tone="error" title="Interpretation Error" message={error} /> : null}

          {!loading && interpretation?.needs_clarification && interpretation.clarifications.length > 0 ? (
            <Panel className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <HelpCircle
                  className="w-5 h-5 text-[var(--orbit-warning)] shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div>
                  <h2 className="text-base font-semibold">Clarifications Requested</h2>
                  <p className="text-sm text-[var(--orbit-text-secondary)] mt-1 prose-measure">
                    {interpretation.summary} Confirm these parameters so ORBIT does not silently
                    invent missing assumptions.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {interpretation.clarifications.map((q) => (
                  <InsetSurface key={q.id} className="p-4 space-y-2">
                    <label
                      htmlFor={`clarify-${q.id}`}
                      className="block text-sm font-medium text-[var(--orbit-text-primary)]"
                    >
                      {q.question}
                    </label>
                    <p className="text-sm text-[var(--orbit-text-secondary)]">{q.reason}</p>
                    <Input
                      id={`clarify-${q.id}`}
                      value={clarificationAnswers[q.id] ?? ""}
                      onChange={(e) =>
                        setClarificationAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                      }
                      placeholder={`Suggested default: ${q.suggested_default}`}
                    />
                  </InsetSurface>
                ))}
              </div>

              <div className="flex justify-end">
                <Button
                  loading={loading}
                  onClick={() =>
                    runInterpretation({
                      skipClarification: true,
                      answers: clarificationAnswers,
                    })
                  }
                >
                  Apply Answers &amp; Generate Model
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>
            </Panel>
          ) : null}

          {!loading && interpretation?.model_draft ? (
            <Panel className="p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[var(--orbit-border-subtle)]">
                <div className="min-w-0">
                  <div className="text-xs font-mono text-[var(--orbit-secondary)]">
                    Generated Draft · {interpretation.model_draft.domain}
                  </div>
                  <h2 className="text-lg font-semibold mt-1">
                    {interpretation.model_draft.name}
                  </h2>
                  <p className="text-sm text-[var(--orbit-text-secondary)] mt-1 prose-measure">
                    {interpretation.model_draft.description}
                  </p>
                </div>
                <Button loading={saving} onClick={handleSaveDraft}>
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  Review in Model Editor
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm font-mono">
                <InsetSurface className="p-3.5">
                  <div className="text-xs text-[var(--orbit-text-secondary)]">Stocks</div>
                  <div className="text-lg font-semibold tabular-nums mt-0.5">
                    {interpretation.model_draft.stocks.length}
                  </div>
                </InsetSurface>
                <InsetSurface className="p-3.5">
                  <div className="text-xs text-[var(--orbit-text-secondary)]">Flows</div>
                  <div className="text-lg font-semibold tabular-nums mt-0.5">
                    {interpretation.model_draft.flows.length}
                  </div>
                </InsetSurface>
                <InsetSurface className="p-3.5">
                  <div className="text-xs text-[var(--orbit-text-secondary)]">Parameters</div>
                  <div className="text-lg font-semibold tabular-nums mt-0.5">
                    {interpretation.model_draft.parameters.length}
                  </div>
                </InsetSurface>
                <InsetSurface className="p-3.5">
                  <div className="text-xs text-[var(--orbit-text-secondary)]">Validation</div>
                  <div className="mt-1">
                    <StatusIndicator
                      tone={interpretation.validation?.valid ? "success" : "warning"}
                      label={
                        interpretation.validation?.valid
                          ? "Passed"
                          : `${interpretation.validation?.errors.length ?? 0} Issue(s)`
                      }
                    />
                  </div>
                </InsetSurface>
              </div>

              {interpretation.model_draft.assumptions.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-sm font-semibold">Explicit AI-Generated Assumptions</div>
                  <ul className="space-y-1.5 text-sm text-[var(--orbit-text-secondary)]">
                    {interpretation.model_draft.assumptions.map((a) => (
                      <li key={a.id} className="prose-measure">
                        • [{a.impact} impact] {a.statement}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Panel>
          ) : null}
        </div>

        {/* Right: Example Scenario Selector */}
        <Panel className="lg:col-span-4 p-5 space-y-3">
          <h2 className="text-base font-semibold">Example Scenarios</h2>
          <p className="text-sm text-[var(--orbit-text-secondary)]">
            Load a structured starting description and customize its conditions.
          </p>
          <div className="space-y-2.5 pt-1">
            {EXAMPLE_PROMPTS.map((ex) => (
              <button
                key={ex.title}
                type="button"
                onClick={() => {
                  setPrompt(ex.prompt);
                  setDuration(ex.duration);
                  setTimeUnit(ex.unit);
                  setDt(ex.dt);
                  setInterpretation(null);
                  setError(null);
                }}
                className="w-full text-left p-3.5 rounded-[var(--orbit-radius-md)] bg-[var(--orbit-surface-inset)] hover:bg-[var(--orbit-surface-elevated)] border border-[var(--orbit-border-subtle)] transition-colors cursor-pointer"
              >
                <div className="text-sm font-semibold text-[var(--orbit-text-primary)]">
                  {ex.title}
                </div>
                <div className="text-xs font-mono text-[var(--orbit-text-muted)] mt-0.5">
                  {ex.duration} {ex.unit} · dt={ex.dt}
                </div>
                <div className="text-sm text-[var(--orbit-text-secondary)] mt-1.5 line-clamp-2">
                  {ex.prompt}
                </div>
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
