import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildAsanaCsv,
  buildJiraCsv,
  buildKanbanExportJson,
  buildPlanningAnalysis,
  buildTrelloCsv,
  COLUMNS,
  createTask,
  convertRequirementsTextToTasks,
  getTaskRoadmapPage,
  mapTaskLikeArray,
  mergePlanningAnalysis,
  parseImportContent,
  parseEstimatedHours,
  persistTasks,
  ROADMAP_PAGES,
  ROADMAP_WEEKLY_TARGET_HOURS,
  type RoadmapPageId,
  requestPlanningAnalysis,
  safeReadTasks,
  type FodaMetrics,
  type SmartMetrics,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "./services/kanbanService";
import { useKanbanFilters } from "./hooks/useKanbanFilters";
import { KanbanHeader } from "./components/kanban/KanbanHeader";
import { KanbanActionsBar } from "./components/kanban/KanbanActionsBar";
import { KanbanFilters } from "./components/kanban/KanbanFilters";
import { KanbanMetricsPanel } from "./components/kanban/KanbanMetricsPanel";
import { KanbanColumn } from "./components/kanban/KanbanColumn";
import { CreateTaskModal } from "./components/kanban/CreateTaskModal";
import { TaskDetailsModal } from "./components/kanban/TaskDetailsModal";
import { KanbanTaskTable } from "./components/kanban/KanbanTaskTable";
import { RoadmapSprintBar } from "./components/kanban/RoadmapSprintBar";
import type { TraceabilityEntry } from "./components/kanban/TraceabilityPanel";

type RemotePlanningMetrics = {
  smart?: Partial<SmartMetrics>;
  foda?: Partial<FodaMetrics>;
  summary?: string;
  suggestions?: string[];
};

type ImportPreview = {
  source: "structured" | "analysis";
  tasks: Task[];
  summary: string;
};

const downloadFile = (content: string, mime: string, name: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const TIMER_STORAGE_KEY = "kanban.project.timer.by-sprint.v1";
const TRACE_STORAGE_KEY = "kanban.trace.entries.v1";
const TRACE_LIMIT = 25;

type TimerSnapshot = {
  elapsedMs: number;
  isRunning: boolean;
  startedAt: number | null;
};

type TimerByRoadmap = Record<RoadmapPageId, TimerSnapshot>;

const createDefaultTimerByRoadmap = (): TimerByRoadmap => ({
  ...Object.fromEntries(ROADMAP_PAGES.map((page) => [page.id, { elapsedMs: 0, isRunning: false, startedAt: null }])) as TimerByRoadmap,
});

const readTimerByRoadmap = (): TimerByRoadmap => {
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);
    if (!raw) return createDefaultTimerByRoadmap();
    const parsed = JSON.parse(raw) as Partial<TimerByRoadmap>;
    const fallback = createDefaultTimerByRoadmap();
    const normalize = (entry?: Partial<TimerSnapshot>): TimerSnapshot => ({
      elapsedMs: Number.isFinite(entry?.elapsedMs) ? Number(entry?.elapsedMs) : 0,
      isRunning: Boolean(entry?.isRunning),
      startedAt: typeof entry?.startedAt === "number" ? entry.startedAt : null,
    });
    return Object.fromEntries(ROADMAP_PAGES.map((page) => [page.id, normalize(parsed[page.id] ?? fallback[page.id])])) as TimerByRoadmap;
  } catch {
    return createDefaultTimerByRoadmap();
  }
};

const safeReadTraceEntries = (): TraceabilityEntry[] => {
  try {
    const raw = localStorage.getItem(TRACE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TraceabilityEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, TRACE_LIMIT) : [];
  } catch {
    return [];
  }
};

const createTraceId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `trace-${Date.now()}`);

export default function KanbanBoard() {
  const [tasks, setTasks] = useState<Task[]>(safeReadTasks);
  const [roadmapPage, setRoadmapPage] = useState<RoadmapPageId>("foundation");
  const [view, setView] = useState<"board" | "metrics">("board");
  const [boardDisplay, setBoardDisplay] = useState<"kanban" | "table">("kanban");
  const [slideMode, setSlideMode] = useState(true);
  const [message, setMessage] = useState("");
  const [remoteMetrics, setRemoteMetrics] = useState<RemotePlanningMetrics | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [timersByRoadmap, setTimersByRoadmap] = useState<TimerByRoadmap>(readTimerByRoadmap);
  const [traceEntries, setTraceEntries] = useState<TraceabilityEntry[]>(safeReadTraceEntries);
  const importRef = useRef<HTMLInputElement | null>(null);
  const analyzeRef = useRef<HTMLInputElement | null>(null);
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const pageTasks = useMemo(() => tasks.filter((task) => getTaskRoadmapPage(task) === roadmapPage), [tasks, roadmapPage]);
  const { categoryFilter, setCategoryFilter, statusFilters, toggleStatusFilter, isStatusVisible, categories, filteredTasks, statusButtons, statusCounters } = useKanbanFilters(pageTasks);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimersByRoadmap((current) => {
        const now = Date.now();
        let changed = false;
        const next = { ...current };
        (Object.keys(current) as RoadmapPageId[]).forEach((pageId) => {
          const snapshot = current[pageId];
          if (!snapshot.isRunning || !snapshot.startedAt) return;
          next[pageId] = { ...snapshot, elapsedMs: now - snapshot.startedAt };
          changed = true;
        });
        return changed ? next : current;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(timersByRoadmap));
  }, [timersByRoadmap]);

  useEffect(() => {
    localStorage.setItem(TRACE_STORAGE_KEY, JSON.stringify(traceEntries));
  }, [traceEntries]);

  useEffect(() => {
    const onRequest = (event: Event) => {
      const custom = event as CustomEvent<{ requestId?: string; path?: string; status?: number; ok?: boolean }>;
      const detail = custom.detail;
      if (!detail?.requestId) return;
      const entry: TraceabilityEntry = {
        id: createTraceId(),
        timestamp: new Date().toISOString(),
        action: `API ${detail.path ?? "request"}`,
        source: "api",
        status: detail.ok ? "ok" : "error",
        requestId: detail.requestId,
        detail: typeof detail.status === "number" ? `HTTP ${detail.status}` : undefined,
      };
      setTraceEntries((current) => [entry, ...current].slice(0, TRACE_LIMIT));
    };

    window.addEventListener("spv:request", onRequest as EventListener);
    return () => window.removeEventListener("spv:request", onRequest as EventListener);
  }, []);

  const logUiTrace = (action: string, status: "ok" | "error", detail?: string, eventId?: string) => {
    const entry: TraceabilityEntry = {
      id: createTraceId(),
      timestamp: new Date().toISOString(),
      action,
      source: "ui",
      status,
      eventId,
      detail,
    };
    setTraceEntries((current) => [entry, ...current].slice(0, TRACE_LIMIT));
  };

  useEffect(() => {
    setRemoteMetrics(null);
  }, [roadmapPage]);

  const handleBoardWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    // Horizontal scroll is opt-in with Shift to avoid hijacking normal vertical page scroll.
    if (!slideMode || !event.shiftKey) return;
    const container = boardScrollRef.current;
    if (!container) return;
    event.preventDefault();
    container.scrollLeft += event.deltaY;
  };

  const analysis = useMemo(() => {
    const inferred = buildPlanningAnalysis(pageTasks);
    if (!remoteMetrics) return inferred;
    return mergePlanningAnalysis(inferred, {
      smart: remoteMetrics.smart,
      foda: remoteMetrics.foda,
      summary: remoteMetrics.summary,
      suggestions: remoteMetrics.suggestions,
    });
  }, [pageTasks, remoteMetrics]);

  const addTask = (newTask: Task) => {
    const next = [createTask({ ...newTask, roadmapPage }), ...tasks];
    setTasks(next);
    persistTasks(next);
    setMessage("Tarea agregada.");
  };

  const moveTask = (taskId: string, newStatus: TaskStatus) => {
    const next = tasks.map((task) => (task.id === taskId ? { ...task, status: newStatus } : task));
    setTasks(next);
    persistTasks(next);
  };

  const exportToTrelloCsv = () => downloadFile(buildTrelloCsv(pageTasks), "text/csv;charset=utf-8;", `kanban-${roadmapPage}-trello.csv`);
  const exportToJiraCsv = () => downloadFile(buildJiraCsv(pageTasks), "text/csv;charset=utf-8;", `kanban-${roadmapPage}-jira.csv`);
  const exportToAsanaCsv = () => downloadFile(buildAsanaCsv(pageTasks), "text/csv;charset=utf-8;", `kanban-${roadmapPage}-asana.csv`);
  const exportJson = () => downloadFile(JSON.stringify(buildKanbanExportJson(pageTasks), null, 2), "application/json;charset=utf-8;", `kanban-${roadmapPage}.json`);

  const analyzePlan = async () => {
    const eventId = createTraceId();
    try {
      const payload = await requestPlanningAnalysis({ tasks: pageTasks });
      setRemoteMetrics(payload);
      setMessage("Analisis actualizado desde /api/ai/planning/analyze.");
      logUiTrace("Analizar tablero", "ok", `Tareas analizadas: ${pageTasks.length}`, eventId);
    } catch {
      setRemoteMetrics(null);
      setMessage("No fue posible usar el analisis remoto, se muestra analisis local.");
      logUiTrace("Analizar tablero", "error", "Fallo analisis remoto", eventId);
    }
  };

  const analyzeDocumentContent = async (document: string) => {
    const eventId = createTraceId();
    if (!document.trim()) {
      setMessage("El documento esta vacio o no contiene texto legible.");
      logUiTrace("Analizar documento", "error", "Documento vacio", eventId);
      return;
    }

    try {
      const payload = await requestPlanningAnalysis({ document });
      setRemoteMetrics(payload);

      const fromBacklog = mapTaskLikeArray(payload.backlog, "backlog");
      const fromSprint = mapTaskLikeArray(payload.sprintlog, "todo");
      const mergedTasks = [...fromBacklog, ...fromSprint].map((task) => createTask({ ...task, roadmapPage }));

      if (mergedTasks.length > 0) {
        setPreview({
          source: "analysis",
          tasks: mergedTasks,
          summary: `La IA genero ${mergedTasks.length} tareas. Confirma para reemplazar el tablero.`,
        });
        setMessage("Revision previa lista para tareas generadas por IA.");
        logUiTrace("Analizar documento", "ok", `IA genero ${mergedTasks.length} tareas`, eventId);
      } else {
        setMessage("La IA devolvio analisis, pero no genero tareas convertibles.");
        logUiTrace("Analizar documento", "error", "IA sin tareas convertibles", eventId);
      }
    } catch {
      const localTasks = convertRequirementsTextToTasks(document);
      if (localTasks.length > 0) {
        setPreview({
          source: "analysis",
          tasks: localTasks.map((task) => createTask({ ...task, roadmapPage })),
          summary: `No hubo respuesta IA. Se generaron ${localTasks.length} tareas con conversion local.`,
        });
        setMessage("Conversion local aplicada como fallback.");
        logUiTrace("Analizar documento", "ok", `Fallback local genero ${localTasks.length} tareas`, eventId);
      } else {
        setMessage("No fue posible convertir el documento con IA.");
        logUiTrace("Analizar documento", "error", "Sin conversion IA ni fallback", eventId);
      }
    }
  };

  const mapSpreadsheetRowsToTasks = (rows: Record<string, unknown>[]) => {
    const taskLikeRows: Array<Partial<Task>> = [];
    rows.forEach((row) => {
      const title = String(row.title ?? row.titulo ?? row.task ?? row.tarea ?? row.name ?? "").trim();
      if (!title) return;
      taskLikeRows.push({
        title,
        description: String(row.description ?? row.descripcion ?? "").trim(),
        status: String(row.status ?? row.estado ?? "backlog") as TaskStatus,
        category: String(row.category ?? row.categoria ?? "general"),
        priority: String(row.priority ?? row.prioridad ?? "medium") as TaskPriority,
        estimated: String(row.estimated ?? row.estimado ?? "1h"),
        notes: String(row.notes ?? row.notas ?? "").trim() || undefined,
      });
    });

    return mapTaskLikeArray(taskLikeRows, "backlog");
  };

  const importStructuredFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const eventId = createTraceId();
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = (file.name.split(".").pop() ?? "txt").toLowerCase();

    try {
      let imported: Task[] = [];

      if (extension === "xlsx" || extension === "xls") {
        const [{ read, utils }, buffer] = await Promise.all([import("xlsx"), file.arrayBuffer()]);
        const workbook = read(buffer, { type: "array" });
        const firstSheet = workbook.SheetNames[0];
        if (!firstSheet) throw new Error("Hoja vacia");
        const rows = utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: "" }) as Record<string, unknown>[];
        imported = mapSpreadsheetRowsToTasks(rows);
      } else {
        const content = await file.text();
        imported = parseImportContent(content, extension);
      }

      if (imported.length === 0) {
        setMessage("El archivo no contiene tareas validas para importar.");
        logUiTrace("Importar archivo", "error", `Sin tareas validas (${file.name})`, eventId);
        return;
      }

      const pageImported = imported.map((task) => createTask({ ...task, roadmapPage }));

      setPreview({
        source: "structured",
        tasks: pageImported,
        summary: `Se detectaron ${pageImported.length} tareas para ${ROADMAP_PAGES.find((page) => page.id === roadmapPage)?.label}. Confirma para importar.`,
      });
      setMessage("Revision previa lista para importacion estructurada.");
      logUiTrace("Importar archivo", "ok", `${file.name}: ${pageImported.length} tareas detectadas`, eventId);
    } catch {
      setMessage("No fue posible importar el archivo. Verifica formato JSON, CSV, TOON o Excel.");
      logUiTrace("Importar archivo", "error", `Fallo parseo en ${file.name}`, eventId);
    } finally {
      event.target.value = "";
    }
  };

  const applyPreview = () => {
    if (!preview) return;

    const otherPages = tasks.filter((task) => getTaskRoadmapPage(task) !== roadmapPage);
    const next = [...otherPages, ...preview.tasks.map((task) => createTask({ ...task, roadmapPage }))];
    setTasks(next);
    persistTasks(next);
    setMessage(
      preview.source === "analysis"
        ? `Conversion IA aplicada en ${ROADMAP_PAGES.find((page) => page.id === roadmapPage)?.label}: ${preview.tasks.length} tareas.`
        : `Importacion aplicada en ${ROADMAP_PAGES.find((page) => page.id === roadmapPage)?.label}: ${preview.tasks.length} tareas.`,
    );
    logUiTrace("Aplicar preview", "ok", `${preview.tasks.length} tareas aplicadas`, createTraceId());
    setPreview(null);
  };

  const discardPreview = () => {
    setPreview(null);
    setMessage("Importacion cancelada.");
    logUiTrace("Aplicar preview", "error", "Operacion cancelada", createTraceId());
  };

  const previewByStatus = useMemo(() => {
    if (!preview) return null;
    return COLUMNS.map((column) => ({
      id: column.id,
      label: column.label,
      count: preview.tasks.filter((task) => task.status === column.id).length,
    }));
  }, [preview]);

  const roadmapCounters = useMemo(() => {
    const base = Object.fromEntries(ROADMAP_PAGES.map((page) => [page.id, 0])) as Record<RoadmapPageId, number>;
    tasks.forEach((task) => {
      const page = getTaskRoadmapPage(task);
      if (page === "custom") return;
      base[page] += 1;
    });
    return base;
  }, [tasks]);

  const roadmapDoneCounters = useMemo(() => {
    const base = Object.fromEntries(ROADMAP_PAGES.map((page) => [page.id, 0])) as Record<RoadmapPageId, number>;
    tasks.forEach((task) => {
      const page = getTaskRoadmapPage(task);
      if (page === "custom" || task.status !== "done") return;
      base[page] += 1;
    });
    return base;
  }, [tasks]);

  const roadmapProgress = useMemo(
    () =>
      ROADMAP_PAGES.map((page) => ({
        id: page.id,
        label: page.label,
        done: roadmapDoneCounters[page.id] ?? 0,
        total: roadmapCounters[page.id] ?? 0,
      })),
    [roadmapCounters, roadmapDoneCounters],
  );

  const baseline = useMemo(() => {
    const totalEstimatedHours = pageTasks.reduce((sum, task) => sum + parseEstimatedHours(task.estimated), 0);
    const doneTasks = pageTasks.filter((task) => task.status === "done");
    const doneEstimatedHours = doneTasks.reduce((sum, task) => sum + parseEstimatedHours(task.estimated), 0);
    return {
      totalEstimatedHours,
      doneEstimatedHours,
      tasksDone: doneTasks.length,
      tasksTotal: pageTasks.length,
    };
  }, [pageTasks]);

  const activeTimer = timersByRoadmap[roadmapPage];

  const startTimer = () => {
    setTimersByRoadmap((current) => ({
      ...current,
      [roadmapPage]: {
        elapsedMs: current[roadmapPage].elapsedMs,
        isRunning: true,
        startedAt: Date.now() - current[roadmapPage].elapsedMs,
      },
    }));
  };

  const pauseTimer = () => {
    setTimersByRoadmap((current) => ({
      ...current,
      [roadmapPage]: { ...current[roadmapPage], isRunning: false, startedAt: null },
    }));
  };

  const resetTimer = () => {
    setTimersByRoadmap((current) => ({
      ...current,
      [roadmapPage]: { elapsedMs: 0, isRunning: false, startedAt: null },
    }));
  };

  const importDocumentToAnalyze = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      await analyzeDocumentContent(content);
    } catch {
      setMessage("No fue posible leer el archivo para analisis IA.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <section className="mx-auto max-w-[1440px] px-4 py-6 lg:px-6">
      <div className="kanban-fade-in mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <KanbanHeader view={view} onChangeView={setView} />
        <KanbanActionsBar
          boardDisplay={boardDisplay}
          slideMode={slideMode}
          onOpenCreateModal={() => setCreateOpen(true)}
          onToggleDisplay={() => setBoardDisplay((prev) => (prev === "kanban" ? "table" : "kanban"))}
          onToggleSlideMode={() => setSlideMode((prev) => !prev)}
          onImportFile={() => importRef.current?.click()}
          onAnalyzeFile={() => analyzeRef.current?.click()}
          onAnalyzeBoard={() => void analyzePlan()}
          onExportCsv={exportToTrelloCsv}
          onExportJiraCsv={exportToJiraCsv}
          onExportAsanaCsv={exportToAsanaCsv}
          onExportJson={exportJson}
        />
      </div>

      <input ref={importRef} type="file" accept=".json,.csv,.toon,.txt,.xlsx,.xls" onChange={(event) => void importStructuredFile(event)} className="hidden" />
      <input ref={analyzeRef} type="file" accept=".md,.txt,.json,.csv,.toon" onChange={(event) => void importDocumentToAnalyze(event)} className="hidden" />
      {view === "board" ? (
        <>
          <RoadmapSprintBar
            pages={ROADMAP_PAGES}
            selectedPage={roadmapPage}
            onSelectPage={setRoadmapPage}
            counts={roadmapCounters}
            doneCounts={roadmapDoneCounters}
            weeklyTargets={ROADMAP_WEEKLY_TARGET_HOURS}
          />

          {preview && previewByStatus ? (
            <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <p className="font-semibold">{preview.summary}</p>
              <p className="mt-1 text-xs text-blue-800">
                {previewByStatus.map((item) => `${item.label}: ${item.count}`).join(" · ")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={applyPreview}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={discardPreview}
                  className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}

          <KanbanFilters
            categories={categories}
            categoryFilter={categoryFilter}
            statusFilters={statusFilters}
            statusButtons={statusButtons}
            statusCounters={statusCounters}
            onChangeCategory={setCategoryFilter}
            onChangeStatus={toggleStatusFilter}
          />

          {boardDisplay === "table" ? (
            <KanbanTaskTable tasks={filteredTasks} onMoveTask={moveTask} onSelectTask={setSelectedTask} />
          ) : (
            <div
              ref={boardScrollRef}
              onWheel={handleBoardWheel}
              className={`hide-scrollbar -mx-1 px-1 pb-2 ${slideMode ? "flex gap-3 overflow-x-auto" : "grid gap-3 md:grid-cols-2 xl:grid-cols-3"}`}
            >
              {COLUMNS.filter((column) => isStatusVisible(column.id)).map((column) => {
                const colTasks = filteredTasks.filter((task) => task.status === column.id);
                return <KanbanColumn key={column.id} column={column} tasks={colTasks} allTasks={tasks} onMoveTask={moveTask} onSelectTask={setSelectedTask} />;
              })}
            </div>
          )}
        </>
      ) : (
        <KanbanMetricsPanel
          analysis={analysis}
          tasks={pageTasks}
          roadmapLabel={ROADMAP_PAGES.find((page) => page.id === roadmapPage)?.label ?? roadmapPage}
          roadmapProgress={roadmapProgress}
          traces={traceEntries}
          baseline={{
            elapsedMs: activeTimer.elapsedMs,
            isRunning: activeTimer.isRunning,
            totalEstimatedHours: baseline.totalEstimatedHours,
            doneEstimatedHours: baseline.doneEstimatedHours,
            weeklyTargetHours: ROADMAP_WEEKLY_TARGET_HOURS[roadmapPage],
            tasksDone: baseline.tasksDone,
            tasksTotal: baseline.tasksTotal,
            onStart: startTimer,
            onPause: pauseTimer,
            onReset: resetTimer,
          }}
        />
      )}

      {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
      <CreateTaskModal open={createOpen} defaultCategory={categoryFilter === "all" ? "general" : categoryFilter} onClose={() => setCreateOpen(false)} onCreate={addTask} />
      <TaskDetailsModal task={selectedTask} onClose={() => setSelectedTask(null)} />
    </section>
  );
}
