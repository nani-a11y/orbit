import { jsPDF } from "jspdf";
import type {
  AIExplanationResponse,
  OrbitModelSpec,
  SimulationResult,
  SimulationRunRecord,
} from "../types/orbit";
import { formatMetricValue } from "../lib/utils";

// Calibrated monochrome editorial palette mapped from src/styles/tokens.css (light/print gallery theme)
const PDF_PALETTE = {
  inkPrimary: [9, 9, 11] as [number, number, number],       // #09090b - Carbon black ink
  inkSecondary: [63, 63, 70] as [number, number, number],   // #3f3f46 - Editorial secondary body
  inkMuted: [113, 113, 122] as [number, number, number],    // #71717a - Muted metadata text
  hairline: [212, 212, 216] as [number, number, number],    // #d4d4d8 - Subtle border rule
  hairlineSubtle: [228, 228, 231] as [number, number, number], // #e4e4e7 - Light divider
};

export function exportSimulationPdfReport(params: {
  model: OrbitModelSpec;
  run: SimulationRunRecord;
  result: SimulationResult;
  explanation?: AIExplanationResponse | null;
}): void {
  const { model, run, result, explanation } = params;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 44;
  const maxWidth = pageWidth - margin * 2;
  let y = 52;

  const ensureSpace = (needed: number) => {
    if (y + needed > 780) {
      doc.addPage();
      y = 52;
    }
  };

  const writeHeading = (text: string) => {
    ensureSpace(34);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...PDF_PALETTE.inkPrimary);
    doc.text(text, margin, y);
    y += 18;
  };

  const writeBody = (text: string, indent = 0) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...PDF_PALETTE.inkSecondary);
    const lines = doc.splitTextToSize(text, maxWidth - indent) as string[];
    for (const line of lines) {
      ensureSpace(14);
      doc.text(line, margin + indent, y);
      y += 13;
    }
  };

  // Title banner
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...PDF_PALETTE.inkPrimary);
  doc.text("ORBIT Simulation Report", margin, y);
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...PDF_PALETTE.inkSecondary);
  doc.text(model.name, margin, y);
  y += 16;

  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_PALETTE.inkMuted);
  doc.text(
    `Run ID: ${run.id}  |  Model v${model.version}  |  Solver: ${result.solver.toUpperCase()}  |  Horizon: ${result.start_time}-${result.end_time} ${result.time_unit} (dt=${result.dt})  |  Seed: ${result.random_seed}`,
    margin,
    y
  );
  y += 18;
  doc.setDrawColor(...PDF_PALETTE.hairline);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  // Overview
  writeHeading("1. Model Description");
  writeBody(model.description || "No model description recorded.");
  y += 10;

  // Key metrics table
  writeHeading("2. Computed Variable Metrics");
  const vars = Object.keys(result.metrics);
  ensureSpace(24);
  doc.setFont("courier", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_PALETTE.inkPrimary);
  doc.text("Variable", margin, y);
  doc.text("Initial", margin + 175, y);
  doc.text("Final", margin + 250, y);
  doc.text("Min", margin + 325, y);
  doc.text("Max", margin + 400, y);
  doc.text("Change %", margin + 465, y);
  y += 12;

  doc.setFont("courier", "normal");
  doc.setTextColor(...PDF_PALETTE.inkSecondary);
  for (const vid of vars) {
    ensureSpace(14);
    const m = result.metrics[vid];
    doc.text(vid.slice(0, 26), margin, y);
    doc.text(formatMetricValue(m.initial), margin + 175, y);
    doc.text(formatMetricValue(m.final), margin + 250, y);
    doc.text(formatMetricValue(m.min), margin + 325, y);
    doc.text(formatMetricValue(m.max), margin + 400, y);
    doc.text(m.pct_change !== null ? `${m.pct_change > 0 ? "+" : ""}${m.pct_change}%` : "n/a", margin + 465, y);
    y += 12;
  }
  y += 10;

  // Events
  writeHeading("3. Threshold & System Events");
  if (result.events.length === 0) {
    writeBody("No constraint thresholds were crossed during this simulation run.");
  } else {
    for (const ev of result.events.slice(0, 20)) {
      writeBody(`[t=${ev.time} ${result.time_unit}] (${ev.severity.toUpperCase()}) ${ev.message}`, 6);
    }
  }
  y += 10;

  // Assumptions
  writeHeading("4. Explicit Assumptions & Limitations");
  if (model.assumptions.length === 0) {
    writeBody("No explicit assumptions recorded in this model.");
  } else {
    for (const a of model.assumptions) {
      writeBody(`• [${a.category} / ${a.impact} impact] ${a.statement}`, 6);
    }
  }
  y += 10;

  // Grounded AI Explanation if generated
  if (explanation) {
    writeHeading("5. Evidence-Grounded AI Analysis");
    writeBody(explanation.headline);
    writeBody(explanation.summary);
    y += 6;
    for (const ch of explanation.key_changes) {
      writeBody(`• ${ch.variable}: ${ch.observation} (Computed: ${ch.computed_evidence})`, 6);
    }
    y += 6;
    writeBody(`Caveat: ${explanation.disclaimer}`);
  }

  const safeName = model.id.replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`${safeName}_${run.id}_report.pdf`);
}
