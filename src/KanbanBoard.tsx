import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, X, FileText, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  AI_ANALYZER_ENDPOINT,
  COLUMNS,
  DEFAULT_TASKS,
  STATUS_FILTER_BUTTONS,
  buildFodaCoverageCounters,
  buildKanbanExportJson,
  buildPlanningAnalysis,
  buildTrelloCsv,
  createTask,
  mapTaskLikeArray,
  mergePlanningAnalysis,
  normalizeStatus,
  parseImportContent,
  persistTasks,
  priorityStyles,
  safeReadTasks,
  type PlanningAnalysis,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type TaskLike,
} from './services/kanbanService';
import { BoardHeader } from './components/kanban/BoardHeader';
import { FiltersBar } from './components/kanban/FiltersBar';
import { KanbanColumn } from './components/kanban/KanbanColumn';
import { TaskCard } from './components/kanban/TaskCard';

const downloadFile = (content: BlobPart, mimeType: string, filename: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const KanbanBoard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(safeReadTasks);
  const [activeTab, setActiveTab] = useState<'board' | 'metrics'>('board');
  const [filter, setFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [horizontalMobileMode, setHorizontalMobileMode] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [message, setMessage] = useState('');
  const [analysis, setAnalysis] = useState<PlanningAnalysis>(() => buildPlanningAnalysis(safeReadTasks()));
  const importRef = useRef<HTMLInputElement | null>(null);
  const aiImportRef = useRef<HTMLInputElement | null>(null);

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    category: 'general',
    priority: 'medium' as TaskPriority,
    estimated: '1h',
    status: 'backlog' as TaskStatus,
  });

  useEffect(() => {
    persistTasks(tasks);

    setAnalysis(buildPlanningAnalysis(tasks));
  }, [tasks]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const syncViewport = (query: MediaQueryList | MediaQueryListEvent) => {
      setIsCompactViewport(query.matches);
    };

    syncViewport(media);
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', syncViewport);
      return () => media.removeEventListener('change', syncViewport);
    }

    media.addListener(syncViewport);
    return () => media.removeListener(syncViewport);
  }, []);

  const categories = useMemo(
    () => ['all', ...new Set(tasks.map((task) => task.category).sort((a, b) => a.localeCompare(b)))],
    [tasks],
  );

  const filteredTasks = useMemo(
    () =>
      tasks.filter(
        (task) => (filter === 'all' || task.category === filter) && (statusFilter === 'all' || task.status === statusFilter),
      ),
    [tasks, filter, statusFilter],
  );

  const taskCountByStatus = useMemo(
    () =>
      COLUMNS.reduce<Record<TaskStatus, number>>((acc, column) => {
        acc[column.id] = filteredTasks.filter((task) => task.status === column.id).length;
        return acc;
      }, { backlog: 0, todo: 0, 'in-progress': 0, review: 0, done: 0 }),
    [filteredTasks],
  );

  const visibleColumns = useMemo(() => {
    if (statusFilter !== 'all') {
      return COLUMNS.filter((column) => column.id === statusFilter);
    }

    // En "Todos los estados" solo se muestran contenedores con tareas visibles.
    return COLUMNS.filter((column) => taskCountByStatus[column.id] > 0);
  }, [statusFilter, taskCountByStatus]);

  const stats = useMemo(
    () => ({
      total: tasks.length,
      backlog: tasks.filter((task) => task.status === 'backlog').length,
      todo: tasks.filter((task) => task.status === 'todo').length,
      inProgress: tasks.filter((task) => task.status === 'in-progress').length,
      review: tasks.filter((task) => task.status === 'review').length,
      done: tasks.filter((task) => task.status === 'done').length,
    }),
    [tasks],
  );

  const fodaCoverage = useMemo(() => buildFodaCoverageCounters(tasks), [tasks]);

  const moveTask = (taskId: string, newStatus: TaskStatus) => {
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, status: newStatus } : task)));
  };

  const addTask = () => {
    if (!newTask.title.trim()) {
      setMessage('El titulo es obligatorio para crear una tarea.');
      return;
    }

    setTasks((prev) => [createTask(newTask), ...prev]);
    setNewTask({
      title: '',
      description: '',
      category: newTask.category || 'general',
      priority: 'medium',
      estimated: '1h',
      status: 'backlog',
    });
    setMessage('Tarea agregada al tablero.');
    setIsCreateModalOpen(false);
  };

  const exportToTrelloCsv = () => {
    downloadFile(buildTrelloCsv(tasks), 'text/csv;charset=utf-8;', 'kanban-trello.csv');
  };

  const exportJson = () => {
    const payload = buildKanbanExportJson(tasks);
    downloadFile(JSON.stringify(payload, null, 2), 'application/json;charset=utf-8;', 'kanban-general.json');
  };

  const importTasks = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const extension = file.name.split('.').pop()?.toLowerCase();
      const imported = parseImportContent(content, extension);

      if (imported.length === 0) {
        setMessage('No se encontraron tareas validas en el archivo.');
        return;
      }

      setTasks(imported);
      setFilter('all');
      setStatusFilter('all');
      setMessage(`Importacion completada: ${imported.length} tareas cargadas.`);
    } catch {
      setMessage('No fue posible importar el archivo. Revisa formato JSON o CSV.');
    } finally {
      event.target.value = '';
    }
  };

  const analyzePlanningDocument = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    try {
      const content = await file.text();
      const extension = file.name.split('.').pop()?.toLowerCase();

      let generatedTasks: Task[] = [];
      let nextAnalysis: PlanningAnalysis | null = null;

      try {
        const response = await fetch(AI_ANALYZER_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            extension,
            content,
            output: 'kanban_backlog_sprintlog_metrics',
          }),
        });

        if (!response.ok) throw new Error('Servicio de analisis IA no disponible');
        const data = (await response.json()) as {
          backlog?: TaskLike[];
          sprintlog?: TaskLike[];
          sprintLog?: TaskLike[];
          metrics?: {
            smart?: Partial<PlanningAnalysis['smart']>;
            foda?: Partial<PlanningAnalysis['foda']>;
            summary?: string;
            suggestions?: string[];
          };
        };

        generatedTasks = [
          ...mapTaskLikeArray(data.backlog, 'backlog'),
          ...mapTaskLikeArray(data.sprintlog ?? data.sprintLog, 'todo'),
        ];

        if (generatedTasks.length > 0) {
          const inferred = buildPlanningAnalysis(generatedTasks);
          nextAnalysis = mergePlanningAnalysis(inferred, data.metrics);
        }
      } catch {
        // Fallback local: parsea el documento y construye backlog/sprintlog con reglas basicas.
        generatedTasks = parseImportContent(content, extension);
        if (generatedTasks.length === 0 && extension === 'json') {
          generatedTasks = mapTaskLikeArray(JSON.parse(content), 'backlog');
        }
      }

      if (generatedTasks.length === 0) {
        setMessage('No se pudieron generar tareas desde el documento cargado.');
        return;
      }

      setTasks(generatedTasks);
      setFilter('all');
      setStatusFilter('all');
      setActiveTab('metrics');
      if (nextAnalysis) setAnalysis(nextAnalysis);
      setMessage(`Documento analizado. Se generaron ${generatedTasks.length} tareas para backlog/sprint log.`);
    } catch {
      setMessage('No fue posible analizar el documento. Usa TXT, MD, CSV, TOON o JSON.');
    } finally {
      setIsAnalyzing(false);
      event.target.value = '';
    }
  };

  const resetBoard = () => {
    setTasks(DEFAULT_TASKS);
    setFilter('all');
    setStatusFilter('all');
    setMessage('Tablero restaurado a plantilla base.');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="relative md:sticky md:top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Kanban General</h1>
              <p className="text-sm text-slate-600">Backlog y sprint log reutilizable con importacion de documentos y analisis IA.</p>
            </div>

            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-lg bg-slate-100 px-3 py-1 font-medium text-slate-700">Total: {stats.total}</span>
              <span className="rounded-lg bg-emerald-100 px-3 py-1 font-medium text-emerald-700">Done: {stats.done}</span>
              <span className="rounded-lg bg-amber-100 px-3 py-1 font-medium text-amber-700">In progress: {stats.inProgress}</span>
            </div>
          </div>

          <div className="inline-flex rounded-full border border-slate-300 bg-white p-1">
            <button
              type="button"
              onClick={() => setActiveTab('board')}
              className={`rounded-full px-4 py-1 text-sm font-semibold ${
                activeTab === 'board' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Tablero
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('metrics')}
              className={`rounded-full px-4 py-1 text-sm font-semibold ${
                activeTab === 'metrics' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Metricas
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
            <button
              type="button"
              onClick={exportToTrelloCsv}
              className="whitespace-nowrap rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Exportar CSV Trello
            </button>
            <button
              type="button"
              onClick={exportJson}
              className="whitespace-nowrap rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Exportar JSON
            </button>
              <button
              type="button"
              onClick={() => importRef.current?.click()}
              className="whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Importar JSON/CSV/TOON
            </button>
            <button
              type="button"
              onClick={() => aiImportRef.current?.click()}
              disabled={isAnalyzing}
              className="whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isAnalyzing ? 'Analizando documento...' : 'Subir documento + IA'}
            </button>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Agregar tarea
            </button>
            <button
              type="button"
              onClick={resetBoard}
              className="whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Restaurar plantilla
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".json,.csv,.txt,.toon"
              className="hidden"
              onChange={importTasks}
            />
            <input
              ref={aiImportRef}
              type="file"
              accept=".txt,.md,.json,.csv,.toon"
              className="hidden"
              onChange={analyzePlanningDocument}
            />
          </div>

          {activeTab === 'board' ? (
          <div className="grid gap-2">
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setFilter(category)}
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                    filter === category ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {category === 'all' ? 'Todas las tareas' : category}
                </button>
              ))}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {STATUS_FILTER_BUTTONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatusFilter(option.value)}
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                    statusFilter === option.value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {isCompactViewport ? (
              <label className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={horizontalMobileMode}
                  onChange={(e) => setHorizontalMobileMode(e.target.checked)}
                  className="h-4 w-4"
                />
                Desplazamiento horizontal (movil/tablet)
              </label>
            ) : null}
          </div>
          ) : null}

          {message ? <p className="text-sm text-slate-600">{message}</p> : null}

          {activeTab === 'metrics' ? (
            <>
              <p className="text-xs text-slate-500">
                Documento recomendado para analisis IA: objetivos del proyecto, alcance, entregables, requisitos funcionales/no funcionales,
                riesgos, dependencias, estimaciones y fechas objetivo. Formatos sugeridos: TXT, MD, JSON, CSV o TOON.
              </p>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-indigo-100 px-3 py-1 font-semibold text-indigo-700">SMART completado: {analysis.smart.coverage}%</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">FODA Fortalezas: {fodaCoverage.fortalezas}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">FODA Oportunidades: {fodaCoverage.oportunidades}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">FODA Debilidades: {fodaCoverage.debilidades}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">FODA Amenazas: {fodaCoverage.amenazas}</span>
              </div>
            </>
          ) : null}

        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-6 pt-3 md:pt-6">
        {activeTab === 'board' ? (
          <div
            className={
              isCompactViewport && horizontalMobileMode
                ? 'flex gap-4 overflow-x-auto pb-4 hide-scrollbar'
                : 'grid grid-cols-1 gap-4 pb-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5'
            }
          >
            {visibleColumns.map((column) => (
              <section
                key={column.id}
                className={
                  isCompactViewport && horizontalMobileMode
                    ? 'w-full min-w-[85%] snap-start sm:min-w-[70%] md:min-w-[48%]'
                    : 'w-full'
                }
              >
                <div className={`rounded-t-xl bg-gradient-to-r ${column.color} px-3 py-2 text-white`}>
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold">{column.label}</h2>
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                      {taskCountByStatus[column.id]}
                    </span>
                  </div>
                </div>

                <div className="min-h-[260px] space-y-3 rounded-b-xl border border-slate-200 bg-white p-3 md:min-h-[380px]">
                  {filteredTasks
                    .filter((task) => task.status === column.id)
                    .map((task) => (
                      <button
                        type="button"
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-left transition hover:shadow"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                            {task.category}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${priorityStyles[task.priority]}`}>
                            {task.priority}
                          </span>
                        </div>
                        <p className="font-semibold text-slate-800">{task.title}</p>
                        <p className="mt-1 text-sm text-slate-600">{task.description}</p>
                      </button>
                    ))}
                </div>
              </section>
            ))}

            {visibleColumns.length === 0 ? (
              <section className="w-full rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                No hay tareas visibles con los filtros actuales.
              </section>
            ) : null}
          </div>
        ) : (
          <section className="grid gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-lg font-semibold text-slate-900">Analisis SMART</h3>
              <p className="mt-1 text-sm text-slate-600">{analysis.summary}</p>
              <div className="mt-3 space-y-2 text-sm">
                <p>Specific: {analysis.smart.specific}%</p>
                <p>Measurable: {analysis.smart.measurable}%</p>
                <p>Achievable: {analysis.smart.achievable}%</p>
                <p>Relevant: {analysis.smart.relevant}%</p>
                <p>Time-bound: {analysis.smart.timeBound}%</p>
                <p className="font-semibold text-indigo-700">Cobertura total: {analysis.smart.coverage}%</p>
              </div>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-lg font-semibold text-slate-900">Matriz FODA</h3>
              <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-lg bg-emerald-50 p-3">
                  <p className="font-semibold text-emerald-800">Fortalezas</p>
                  <p className="mt-1 text-slate-700">{analysis.foda.fortalezas.slice(0, 3).join(' | ') || 'Sin datos'}</p>
                </div>
                <div className="rounded-lg bg-blue-50 p-3">
                  <p className="font-semibold text-blue-800">Oportunidades</p>
                  <p className="mt-1 text-slate-700">{analysis.foda.oportunidades.slice(0, 3).join(' | ') || 'Sin datos'}</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-3">
                  <p className="font-semibold text-amber-800">Debilidades</p>
                  <p className="mt-1 text-slate-700">{analysis.foda.debilidades.slice(0, 3).join(' | ') || 'Sin datos'}</p>
                </div>
                <div className="rounded-lg bg-rose-50 p-3">
                  <p className="font-semibold text-rose-800">Amenazas</p>
                  <p className="mt-1 text-slate-700">{analysis.foda.amenazas.slice(0, 3).join(' | ') || 'Sin datos'}</p>
                </div>
              </div>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-4 md:col-span-2">
              <h3 className="text-lg font-semibold text-slate-900">Sugerencias de gestion</h3>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {analysis.suggestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </section>
        )}
      </main>

      {selectedTask ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedTask(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">{selectedTask.title}</h3>
              <button type="button" onClick={() => setSelectedTask(null)} className="text-slate-500 hover:text-slate-700">
                Cerrar
              </button>
            </div>
            <p className="text-sm text-slate-600">{selectedTask.description}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-2 py-1">Categoria: {selectedTask.category}</span>
              <span className="rounded-full bg-slate-100 px-2 py-1">Estimado: {selectedTask.estimated}</span>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-slate-500">Mover a</p>
              <div className="flex flex-wrap gap-2">
                {COLUMNS.map((column) => (
                  <button
                    key={column.id}
                    type="button"
                    onClick={() => {
                      moveTask(selectedTask.id, column.id);
                      setSelectedTask(null);
                    }}
                    className={`rounded-lg px-3 py-1 text-sm font-semibold ${
                      selectedTask.status === column.id ? 'bg-slate-200 text-slate-700' : 'bg-blue-600 text-white'
                    }`}
                  >
                    {column.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setIsCreateModalOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Agregar tarea</h3>
              <button type="button" onClick={() => setIsCreateModalOpen(false)} className="text-slate-500 hover:text-slate-700">
                Cerrar
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={newTask.title}
                onChange={(e) => setNewTask((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Titulo"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                value={newTask.category}
                onChange={(e) => setNewTask((prev) => ({ ...prev, category: e.target.value || 'general' }))}
                placeholder="Categoria"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <textarea
                value={newTask.description}
                onChange={(e) => setNewTask((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Descripcion"
                className="md:col-span-2 min-h-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={newTask.priority}
                onChange={(e) => setNewTask((prev) => ({ ...prev, priority: e.target.value as TaskPriority }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
              <select
                value={newTask.status}
                onChange={(e) => setNewTask((prev) => ({ ...prev, status: normalizeStatus(e.target.value) }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {COLUMNS.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.label}
                  </option>
                ))}
              </select>
              <input
                value={newTask.estimated}
                onChange={(e) => setNewTask((prev) => ({ ...prev, estimated: e.target.value || '1h' }))}
                placeholder="Estimado (ej: 2h)"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={addTask}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Guardar tarea
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default KanbanBoard;