import React, { useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Cpu,
  Layers,
  Palette,
  Server,
  ShieldCheck,
} from "lucide-react";
import {
  InsetSurface,
  Panel,
  SectionHeader,
  StatusNotice,
} from "../components/ui/primitives";

type DocTopic =
  | "getting-started"
  | "schema"
  | "ast-safety"
  | "solvers"
  | "design-tokens"
  | "api";

const DOC_TOPICS: Array<{
  id: DocTopic;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "getting-started", label: "Getting Started", icon: BookOpen },
  { id: "schema", label: "Model Schema v1.0.0", icon: Layers },
  { id: "ast-safety", label: "Equations & AST Safety", icon: ShieldCheck },
  { id: "solvers", label: "Numerical Solvers", icon: Cpu },
  { id: "design-tokens", label: "Design System Tokens", icon: Palette },
  { id: "api", label: "REST API v1", icon: Server },
];

export function DocumentationPage() {
  const [topic, setTopic] = useState<DocTopic>("getting-started");

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Documentation"
        subtitle="Technical reference for ORBIT's deterministic Python 3.11 simulation engine, canonical JSON schema, AST equation sandbox, and REST API."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Section Navigation */}
        <Panel className="lg:col-span-3 p-3 space-y-1">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--orbit-text-muted)]">
            Reference Sections
          </div>
          {DOC_TOPICS.map((item) => {
            const Icon = item.icon;
            const active = topic === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTopic(item.id)}
                className={`w-full min-h-[44px] px-3 py-2 rounded-[var(--orbit-radius-md)] flex items-center gap-2.5 text-sm font-medium text-left cursor-pointer transition-colors ${
                  active
                    ? "bg-[var(--orbit-selected-surface)] text-[var(--orbit-text-primary)]"
                    : "text-[var(--orbit-text-secondary)] hover:bg-[var(--orbit-hover-surface)] hover:text-[var(--orbit-text-primary)]"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    active ? "text-[var(--orbit-primary)]" : "text-[var(--orbit-text-muted)]"
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </Panel>

        {/* Documentation Content */}
        <Panel className="lg:col-span-9 p-6 space-y-6">
          {topic === "getting-started" ? (
            <div className="space-y-5 prose-measure">
              <h2 className="text-lg font-semibold text-[var(--orbit-text-primary)]">
                How ORBIT Separates AI Modeling from Mathematical Execution
              </h2>
              <p className="text-base text-[var(--orbit-text-secondary)] leading-relaxed">
                ORBIT transforms natural-language system descriptions into explicit, inspectable
                stock-and-flow simulation models. AI is used solely for interpreting intent,
                drafting candidate model specifications, and summarizing verified results—never for
                fabricating time-series outputs.
              </p>

              <InsetSurface className="p-4 space-y-2.5">
                <div className="text-sm font-semibold text-[var(--orbit-text-primary)]">
                  Standard Scientific Workflow
                </div>
                <ol className="list-decimal pl-5 space-y-2 text-base text-[var(--orbit-text-secondary)]">
                  <li>
                    <strong className="text-[var(--orbit-text-primary)]">Describe a System:</strong>{" "}
                    Draft a scenario in natural language or start from a validated sample model.
                  </li>
                  <li>
                    <strong className="text-[var(--orbit-text-primary)]">Validate &amp; Approve:</strong>{" "}
                    Inspect stocks, flows, equations, constraints, and assumptions in the Model
                    Editor. The independent Python validator checks syntax, cycles, and bounds.
                  </li>
                  <li>
                    <strong className="text-[var(--orbit-text-primary)]">Execute &amp; Experiment:</strong>{" "}
                    Run deterministic Euler or RK4 integrations in the Simulation Workspace, scrub
                    time-steps, and run non-destructive parameter comparisons in Experiments.
                  </li>
                  <li>
                    <strong className="text-[var(--orbit-text-primary)]">Explain &amp; Export:</strong>{" "}
                    Generate evidence-grounded commentary tied to exact run metrics and export
                    reproducible CSV, JSON, or PDF reports.
                  </li>
                </ol>
              </InsetSurface>

              <StatusNotice
                tone="info"
                title="Scientific Disclaimer"
                message="ORBIT is built for exploratory computational modeling, research, and education. Computed trajectories reflect strictly the equations, initial conditions, and assumptions defined inside each model and must not be treated as validated operational forecasts without external calibration."
              />
            </div>
          ) : null}

          {topic === "schema" ? (
            <div className="space-y-5 prose-measure">
              <h2 className="text-lg font-semibold text-[var(--orbit-text-primary)]">
                Canonical ORBIT Model Schema v1.0.0
              </h2>
              <p className="text-base text-[var(--orbit-text-secondary)] leading-relaxed">
                Every model stored in SQLite or exchanged over the REST API conforms to the
                canonical v1.0.0 system-dynamics specification. Models are immutable per version:
                editing a saved model increments its version while preserving historical run
                provenance.
              </p>

              <div className="space-y-3">
                {[
                  {
                    field: "stocks[]",
                    desc: "State accumulators integrated over time via d(stock)/dt = sum(inflows) - sum(outflows), with optional min_value / max_value physical bounds.",
                  },
                  {
                    field: "flows[]",
                    desc: "Rate equations evaluated topologically at each integration substep. May connect a source_stock to a target_stock and enforce non_negative clamping.",
                  },
                  {
                    field: "parameters[]",
                    desc: "User-configurable constants with physical units and optional min_value, max_value, and step metadata for live parameter sweeps.",
                  },
                  {
                    field: "auxiliaries[]",
                    desc: "Derived algebraic quantities computed from stocks, parameters, and upstream auxiliaries.",
                  },
                  {
                    field: "constraints[]",
                    desc: "Threshold monitors (<, <=, >, >=) that emit timestamped warning, info, or critical events when crossed or recovered.",
                  },
                  {
                    field: "assumptions[]",
                    desc: "Explicit modeling premises with category, source, and impact level displayed beside every result and exported in PDF reports.",
                  },
                ].map((row) => (
                  <InsetSurface key={row.field} className="p-4">
                    <div className="font-mono text-sm font-semibold text-[var(--orbit-secondary)]">
                      {row.field}
                    </div>
                    <p className="text-sm text-[var(--orbit-text-secondary)] mt-1 leading-relaxed">
                      {row.desc}
                    </p>
                  </InsetSurface>
                ))}
              </div>
            </div>
          ) : null}

          {topic === "ast-safety" ? (
            <div className="space-y-5 prose-measure">
              <h2 className="text-lg font-semibold text-[var(--orbit-text-primary)]">
                Safe AST Equation Evaluation &amp; Execution Guardrails
              </h2>
              <p className="text-base text-[var(--orbit-text-secondary)] leading-relaxed">
                ORBIT never passes model equations to Python <code className="font-mono">eval()</code>{" "}
                or <code className="font-mono">exec()</code>. Every flow and auxiliary expression is
                parsed into an abstract syntax tree via{" "}
                <code className="font-mono">ast.parse(expr, mode=&quot;eval&quot;)</code> and
                recursively evaluated against a strict mathematical allowlist.
              </p>

              <InsetSurface className="p-4 space-y-2">
                <div className="text-sm font-semibold text-[var(--orbit-text-primary)]">
                  Allowed Operators &amp; Functions
                </div>
                <div className="font-mono text-xs text-[var(--orbit-text-secondary)] space-y-1 leading-relaxed">
                  <div>Operators: +  -  *  /  **  (unary + / -)</div>
                  <div>
                    Functions: min, max, abs, clamp, sqrt, exp, log, log10, sin, cos, pow, round,
                    floor, ceil, step
                  </div>
                  <div>Constants: pi, e, t (current simulation time)</div>
                </div>
              </InsetSurface>

              <div className="space-y-3 text-base text-[var(--orbit-text-secondary)]">
                {[
                  "Attribute access, indexing, comprehensions, lambdas, imports, and dunder identifiers are unconditionally rejected at validation time.",
                  "Kahn topological sorting detects circular algebraic dependencies among auxiliaries and flows before simulation execution.",
                  "Hard runtime limits: maximum 80 variables, maximum 5,000 integration steps, 12-second subprocess compute timeout, magnitude overflow guards (1e15), and 5 MB export payload cap.",
                ].map((point, idx) => (
                  <div key={idx} className="flex items-start gap-2.5">
                    <CheckCircle2
                      className="w-5 h-5 text-[var(--orbit-success)] shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {topic === "solvers" ? (
            <div className="space-y-5 prose-measure">
              <h2 className="text-lg font-semibold text-[var(--orbit-text-primary)]">
                Deterministic Numerical Integration Solvers
              </h2>
              <p className="text-base text-[var(--orbit-text-secondary)] leading-relaxed">
                Every simulation run stores its solver choice, step size (<code className="font-mono">dt</code>),
                and <code className="font-mono">random_seed</code> in SQLite so identical inputs
                reproduce identical trajectories bit-for-bit.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InsetSurface className="p-4 space-y-2">
                  <div className="font-mono text-sm font-semibold text-[var(--orbit-primary)]">
                    RK4 (4th-Order Runge-Kutta) — Default
                  </div>
                  <p className="text-sm text-[var(--orbit-text-secondary)] leading-relaxed">
                    Evaluates four intermediate derivative slopes (k1, k2, k3, k4) per step with
                    local truncation error O(dt^5). Recommended for oscillatory, coupled, or
                    nonlinear feedback models such as epidemic SIR and urban infrastructure dynamics.
                  </p>
                </InsetSurface>
                <InsetSurface className="p-4 space-y-2">
                  <div className="font-mono text-sm font-semibold text-[var(--orbit-secondary)]">
                    Forward Euler (1st-Order)
                  </div>
                  <p className="text-sm text-[var(--orbit-text-secondary)] leading-relaxed">
                    Explicit single-slope integration with local error O(dt^2). Useful for fast
                    educational comparison against RK4 or demonstrating numerical stiffness when dt
                    is large.
                  </p>
                </InsetSurface>
              </div>
            </div>
          ) : null}

          {topic === "design-tokens" ? (
            <div className="space-y-5 prose-measure">
              <h2 className="text-lg font-semibold text-[var(--orbit-text-primary)]">
                ORBIT Monochrome Editorial Token Architecture
              </h2>
              <p className="text-base text-[var(--orbit-text-secondary)] leading-relaxed">
                ORBIT uses a centralized CSS variable token layer organized into 10 categories
                (Color, Typography, 4px Spacing, Hairline Borders, Nested Radii, Elevation,
                44&times;44px Component Sizing, Interaction States, Motion with reduced-motion
                support, and Layering). All UI chrome stays strictly obsidian black and crisp white
                (with a calibrated Gallery White companion theme), reserving desaturated scientific
                hues strictly for multi-series trajectories and semantic alerts.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                {[
                  { token: "--orbit-background", label: "Obsidian Canvas" },
                  { token: "--orbit-surface", label: "Matte Surface" },
                  { token: "--orbit-surface-elevated", label: "Elevated" },
                  { token: "--orbit-primary", label: "Primary Ink/CTA" },
                  { token: "--orbit-series-2", label: "Series Steel" },
                  { token: "--orbit-success", label: "Semantic Sage" },
                  { token: "--orbit-warning", label: "Semantic Ochre" },
                  { token: "--orbit-danger", label: "Semantic Coral" },
                ].map((swatch) => (
                  <InsetSurface key={swatch.token} className="p-3 space-y-2">
                    <div
                      className="h-8 rounded-[var(--orbit-radius-sm)] border border-[var(--orbit-border)]"
                      style={{ backgroundColor: `var(${swatch.token})` }}
                    />
                    <div className="text-[var(--orbit-text-primary)] font-semibold">
                      {swatch.label}
                    </div>
                    <div className="text-[var(--orbit-text-muted)] truncate">{swatch.token}</div>
                  </InsetSurface>
                ))}
              </div>
            </div>
          ) : null}

          {topic === "api" ? (
            <div className="space-y-5">
              <div className="prose-measure space-y-2">
                <h2 className="text-lg font-semibold text-[var(--orbit-text-primary)]">
                  Versioned REST API v1
                </h2>
                <p className="text-base text-[var(--orbit-text-secondary)] leading-relaxed">
                  All frontend workflows execute against the Express API gateway on port 3000,
                  backed by SQLite WAL storage and the Python 3.11 computational bridge.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 font-mono text-xs">
                {[
                  "GET  /api/v1/health",
                  "GET  /api/v1/dashboard/stats",
                  "GET  /api/v1/projects",
                  "POST /api/v1/projects",
                  "POST /api/v1/scenarios/interpret",
                  "GET  /api/v1/models",
                  "POST /api/v1/models",
                  "PUT  /api/v1/models/:id",
                  "DELETE /api/v1/models/:id",
                  "POST /api/v1/models/:id/validate",
                  "POST /api/v1/simulations/run",
                  "POST /api/v1/simulations/:run_id/cancel",
                  "GET  /api/v1/simulations/:run_id/results",
                  "GET  /api/v1/experiments",
                  "POST /api/v1/experiments",
                  "POST /api/v1/experiments/compare",
                  "POST /api/v1/analysis/explain",
                  "POST /api/v1/exports",
                ].map((ep) => (
                  <InsetSurface
                    key={ep}
                    className="px-3.5 py-2.5 text-[var(--orbit-text-primary)]"
                  >
                    {ep}
                  </InsetSurface>
                ))}
              </div>
            </div>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
