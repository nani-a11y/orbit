import React, { useCallback, useEffect, useState } from "react";
import {
  Activity,
  BookOpen,
  FileBarChart2,
  FlaskConical,
  FolderKanban,
  LayoutDashboard,
  Menu,
  Moon,
  PlusSquare,
  Settings,
  Sun,
} from "lucide-react";
import { Drawer } from "./components/ui/Dialog";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { IconButton } from "./components/ui/primitives";
import { ToastProvider } from "./components/ui/Toast";
import { DashboardPage } from "./pages/DashboardPage";
import { DocumentationPage } from "./pages/DocumentationPage";
import { ExperimentLabPage } from "./pages/ExperimentLabPage";
import { LandingPage } from "./pages/LandingPage";
import { ModelEditorPage } from "./pages/ModelEditorPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { ScenarioBuilderPage } from "./pages/ScenarioBuilderPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SimulationWorkspacePage } from "./pages/SimulationWorkspacePage";
import { orbitApi } from "./services/api";
import type {
  AppView,
  DashboardStats,
  ExperimentRecord,
  HealthStatus,
  OrbitModelSpec,
  ProjectRecord,
  SimulationRunRecord,
  SolverType,
  ThemeMode,
} from "./types/orbit";

function createBlankModelSpec(defaultSolver: SolverType): OrbitModelSpec {
  return {
    id: `custom-${Math.random().toString(36).slice(2, 8)}`,
    name: "Custom System Dynamics Model",
    description: "User-defined stock-and-flow simulation model.",
    domain: "Custom",
    schema_version: "1.0.0",
    version: 1,
    engine_type: "system_dynamics",
    time_config: {
      start_time: 0,
      end_time: 20,
      dt: 0.25,
      time_unit: "years",
      solver: defaultSolver,
    },
    stocks: [
      {
        id: "primary_stock",
        name: "Primary Stock",
        initial_value: 100,
        unit: "units",
        description: "Initial state variable.",
        inflows: ["growth_flow"],
        outflows: ["decay_flow"],
        min_value: 0,
      },
    ],
    parameters: [
      {
        id: "growth_rate",
        name: "Growth Rate",
        value: 0.08,
        unit: "1/year",
        description: "Fractional annual growth rate.",
        min_value: 0,
        max_value: 0.3,
        step: 0.01,
        editable: true,
      },
      {
        id: "decay_rate",
        name: "Decay Rate",
        value: 0.03,
        unit: "1/year",
        description: "Fractional annual decay rate.",
        min_value: 0,
        max_value: 0.3,
        step: 0.01,
        editable: true,
      },
    ],
    auxiliaries: [],
    flows: [
      {
        id: "growth_flow",
        name: "Growth Flow",
        equation: "primary_stock * growth_rate",
        unit: "units/year",
        description: "Annual additions to primary stock.",
        source_stock: null,
        target_stock: "primary_stock",
        non_negative: true,
      },
      {
        id: "decay_flow",
        name: "Decay Flow",
        equation: "primary_stock * decay_rate",
        unit: "units/year",
        description: "Annual outflows from primary stock.",
        source_stock: "primary_stock",
        target_stock: null,
        non_negative: true,
      },
    ],
    constraints: [],
    assumptions: [
      {
        id: "custom_assump_1",
        statement: "Illustrative starting template; edit equations and rates to fit your system.",
        category: "modeling",
        source: "user",
        impact: "medium",
      },
    ],
    random_seed: 42,
    approved: false,
  };
}

const PRIMARY_NAV_ITEMS: Array<{
  id: AppView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "builder", label: "New Simulation", icon: PlusSquare },
  { id: "workspace", label: "Simulation Workspace", icon: Activity },
  { id: "experiments", label: "Experiments", icon: FlaskConical },
  { id: "reports", label: "Results & Reports", icon: FileBarChart2 },
  { id: "documentation", label: "Documentation", icon: BookOpen },
  { id: "settings", label: "Settings", icon: Settings },
];

function OrbitAppShell() {
  const [view, setView] = useState<AppView>("landing");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [models, setModels] = useState<OrbitModelSpec[]>([]);
  const [runs, setRuns] = useState<SimulationRunRecord[]>([]);
  const [experiments, setExperiments] = useState<ExperimentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeModelId, setActiveModelId] = useState<string | null>("urban-ecosystem-baseline");
  const [editorDraft, setEditorDraft] = useState<OrbitModelSpec | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [labInitialOverrides, setLabInitialOverrides] = useState<Record<string, number> | null>(
    null
  );

  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem("orbit_theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      // Ignore storage errors
    }
    return "dark";
  });

  const [prefs, setPrefs] = useState<{ solver: SolverType; precision: number }>(() => {
    try {
      const saved = localStorage.getItem("orbit_prefs");
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore storage errors
    }
    return { solver: "rk4", precision: 2 };
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("orbit_theme", theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const [h, s, p, m, r, e] = await Promise.all([
        orbitApi.getHealth(),
        orbitApi.getDashboardStats(),
        orbitApi.listProjects(),
        orbitApi.listModels(),
        orbitApi.listRuns(),
        orbitApi.listExperiments(),
      ]);
      setHealth(h);
      setStats(s);
      setProjects(p.projects);
      setModels(m.models);
      setRuns(r.runs);
      setExperiments(e.experiments);
    } catch {
      // Errors are surfaced inside individual views when needed
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleUpdatePrefs = (next: { solver: SolverType; precision: number }) => {
    setPrefs(next);
    try {
      localStorage.setItem("orbit_prefs", JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  };

  const navigateTo = (next: AppView) => {
    if (next === "editor" && !editorDraft) {
      const fallback = models.find((m) => m.id === activeModelId) ?? models[0] ?? null;
      setEditorDraft(fallback);
    }
    setView(next);
    setMobileMenuOpen(false);
  };

  const openWorkspace = (modelId: string, runId?: string) => {
    setActiveModelId(modelId);
    setActiveRunId(runId ?? null);
    setView("workspace");
    setMobileMenuOpen(false);
  };

  const openEditor = (modelId: string) => {
    const found = models.find((m) => m.id === modelId) ?? null;
    setActiveModelId(modelId);
    setEditorDraft(found);
    setView("editor");
    setMobileMenuOpen(false);
  };

  const openExperimentLab = (modelId: string, overrides?: Record<string, number>) => {
    setActiveModelId(modelId);
    setLabInitialOverrides(overrides ?? null);
    setView("experiments");
    setMobileMenuOpen(false);
  };

  const openReport = (runId: string) => {
    setActiveRunId(runId);
    setView("reports");
    setMobileMenuOpen(false);
  };

  const handleDeleteModel = async (modelId: string) => {
    await orbitApi.deleteModel(modelId);
    await refreshData();
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  if (view === "landing") {
    return (
      <LandingPage
        models={models}
        theme={theme}
        onToggleTheme={toggleTheme}
        onNavigate={navigateTo}
        onOpenModelInWorkspace={(id) => openWorkspace(id)}
      />
    );
  }

  const currentBreadcrumb =
    view === "editor"
      ? "Model Inspector & Editor"
      : PRIMARY_NAV_ITEMS.find((n) => n.id === view)?.label ?? "Simulation Workspace";

  const renderNavButtons = (closeAfterClick = false) =>
    PRIMARY_NAV_ITEMS.map((item) => {
      const Icon = item.icon;
      const active = view === item.id || (view === "editor" && item.id === "workspace");
      return (
        <button
          key={item.id}
          type="button"
          aria-current={view === item.id ? "page" : undefined}
          onClick={() => {
            navigateTo(item.id);
            if (closeAfterClick) setMobileMenuOpen(false);
          }}
          className={`w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2 rounded-[var(--orbit-radius-md)] text-sm font-medium transition-colors duration-[var(--orbit-duration-fast)] cursor-pointer whitespace-nowrap ${
            active
              ? "bg-[var(--orbit-surface-elevated)] text-[var(--orbit-text-primary)] border border-[var(--orbit-border)]"
              : "text-[var(--orbit-text-secondary)] hover:text-[var(--orbit-text-primary)] hover:bg-[var(--orbit-hover-surface)] border border-transparent"
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
    });

  return (
    <div className="min-h-screen bg-[var(--orbit-background)] text-[var(--orbit-text-primary)] flex">
      {/* Persistent Desktop Sidebar (8 Primary Destinations) */}
      <aside
        aria-label="Primary navigation"
        className="hidden lg:flex lg:flex-col lg:w-[var(--orbit-sidebar-width)] shrink-0 border-r border-[var(--orbit-border-subtle)] bg-[var(--orbit-surface)]"
      >
        <div className="h-[var(--orbit-header-height)] px-5 flex items-center justify-between border-b border-[var(--orbit-border-subtle)]">
          <button
            type="button"
            onClick={() => setView("landing")}
            className="min-h-[44px] inline-flex items-center gap-2 text-base font-semibold tracking-tight text-[var(--orbit-text-primary)] cursor-pointer"
          >
            <span>ORBIT</span>
            <span className="font-mono text-xs text-[var(--orbit-text-muted)] font-normal">
              v1.0
            </span>
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">{renderNavButtons(false)}</nav>

        <div className="p-4 border-t border-[var(--orbit-border-subtle)] text-xs font-mono text-[var(--orbit-text-muted)] space-y-1">
          <div>
            Python {health?.python_engine.python_version ?? "3.11"} &middot; SQLite
          </div>
          <div>
            AI: {health?.gemini.configured ? health.gemini.model : "Offline engine only"}
          </div>
        </div>
      </aside>

      {/* Collapsible Mobile Navigation Drawer */}
      <Drawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        title="ORBIT Navigation"
        side="left"
      >
        <nav className="space-y-1">{renderNavButtons(true)}</nav>
        <div className="mt-6 pt-4 border-t border-[var(--orbit-border-subtle)] px-2 text-xs font-mono text-[var(--orbit-text-muted)] space-y-1">
          <div>
            Python {health?.python_engine.python_version ?? "3.11"} &middot; SQLite
          </div>
          <div>
            AI: {health?.gemini.configured ? health.gemini.model : "Offline engine only"}
          </div>
        </div>
      </Drawer>

      {/* Main Workspace Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-[var(--orbit-header-height)] px-4 sm:px-6 border-b border-[var(--orbit-border-subtle)] bg-[var(--orbit-surface)] flex items-center justify-between gap-4 shrink-0 sticky top-0 z-[var(--orbit-z-sticky)]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="lg:hidden">
              <IconButton label="Open navigation menu" onClick={() => setMobileMenuOpen(true)}>
                <Menu className="w-5 h-5" />
              </IconButton>
            </div>
            <nav aria-label="Breadcrumb" className="text-sm text-[var(--orbit-text-secondary)] truncate">
              <button
                type="button"
                onClick={() => setView("dashboard")}
                className="min-h-[44px] px-1 hover:text-[var(--orbit-text-primary)] cursor-pointer transition-colors"
              >
                ORBIT
              </button>
              <span className="mx-2 text-[var(--orbit-text-muted)]" aria-hidden="true">
                /
              </span>
              <span className="text-[var(--orbit-text-primary)] font-semibold">
                {currentBreadcrumb}
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-xs font-mono text-[var(--orbit-text-secondary)] tabular-nums hidden md:block whitespace-nowrap">
              {models.length} models &middot; {runs.length} runs
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="min-h-[44px] min-w-[44px] px-3 rounded-[var(--orbit-radius-md)] border border-[var(--orbit-border)] bg-[var(--orbit-surface-elevated)] hover:bg-[var(--orbit-active-surface)] text-[var(--orbit-text-primary)] inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors duration-[var(--orbit-duration-fast)] cursor-pointer whitespace-nowrap"
            >
              {theme === "dark" ? (
                <>
                  <Sun className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>
          </div>
        </header>

        <main
          className={`flex-1 w-full mx-auto ${
            view === "workspace"
              ? "p-4 sm:p-5 max-w-[1680px]"
              : "p-5 sm:p-7 max-w-[1440px]"
          }`}
        >
          {view === "dashboard" ? (
            <DashboardPage
              stats={stats}
              projects={projects}
              models={models}
              loading={loading}
              onNavigate={navigateTo}
              onOpenWorkspace={openWorkspace}
              onOpenEditor={openEditor}
              onOpenExperimentLab={openExperimentLab}
              onOpenReport={openReport}
              onDeleteModel={handleDeleteModel}
            />
          ) : null}

          {view === "projects" ? (
            <ProjectsPage
              projects={projects}
              models={models}
              onProjectCreated={refreshData}
              onOpenWorkspace={openWorkspace}
              onOpenEditor={openEditor}
              onOpenExperimentLab={openExperimentLab}
              onDeleteModel={handleDeleteModel}
            />
          ) : null}

          {view === "builder" ? (
            <ScenarioBuilderPage
              health={health}
              defaultSolver={prefs.solver}
              onModelCreated={(created) => {
                setModels((prev) => [created, ...prev]);
                setActiveModelId(created.id);
                setEditorDraft(created);
                setView("editor");
                refreshData();
              }}
              onOpenEditorWithBlank={() => {
                const blank = createBlankModelSpec(prefs.solver);
                setEditorDraft(blank);
                setView("editor");
              }}
            />
          ) : null}

          {view === "editor" ? (
            <ModelEditorPage
              model={
                editorDraft ?? models.find((m) => m.id === activeModelId) ?? models[0] ?? null
              }
              onModelSaved={(saved) => {
                setEditorDraft(saved);
                setActiveModelId(saved.id);
                refreshData();
              }}
              onApproveAndRun={(modelId) => {
                refreshData();
                openWorkspace(modelId);
              }}
            />
          ) : null}

          {view === "workspace" ? (
            <SimulationWorkspacePage
              models={models}
              activeModelId={activeModelId}
              initialRunId={activeRunId}
              defaultPrecision={prefs.precision}
              onSelectModel={(id) => {
                setActiveModelId(id);
                setActiveRunId(null);
              }}
              onRunCompleted={(run) => {
                setActiveRunId(run.id);
                refreshData();
              }}
              onOpenEditor={openEditor}
              onOpenExperimentLab={openExperimentLab}
              onOpenReport={openReport}
            />
          ) : null}

          {view === "experiments" ? (
            <ExperimentLabPage
              models={models}
              experiments={experiments}
              initialModelId={activeModelId}
              initialOverrides={labInitialOverrides}
              defaultPrecision={prefs.precision}
              onExperimentSaved={() => {
                refreshData();
              }}
            />
          ) : null}

          {view === "reports" ? (
            <ReportsPage
              models={models}
              runs={runs}
              initialRunId={activeRunId}
              defaultPrecision={prefs.precision}
              onExportLogged={() => refreshData()}
            />
          ) : null}

          {view === "documentation" ? <DocumentationPage /> : null}

          {view === "settings" ? (
            <SettingsPage
              health={health}
              theme={theme}
              defaultSolver={prefs.solver}
              defaultPrecision={prefs.precision}
              onChangeTheme={setTheme}
              onChangeDefaults={handleUpdatePrefs}
              onOpenDocumentation={() => navigateTo("documentation")}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <OrbitAppShell />
      </ToastProvider>
    </ErrorBoundary>
  );
}
