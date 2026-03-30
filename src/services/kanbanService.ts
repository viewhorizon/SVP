import { requestJSON } from "./httpClient";

export type TaskStatus = "backlog" | "todo" | "in-progress" | "review" | "done";
export type TaskPriority = "high" | "medium" | "low";
export type RoadmapPageId = "foundation" | "sprint-1" | "sprint-2" | "sprint-3";

export interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: TaskPriority;
  estimated: string;
  status: TaskStatus;
  roadmapPage?: RoadmapPageId | "custom";
  notes?: string;
}

export type TaskLike = Partial<Task> | string;

export interface SmartMetrics {
  specific: number;
  measurable: number;
  achievable: number;
  relevant: number;
  timeBound: number;
  coverage: number;
}

export interface FodaMetrics {
  fortalezas: string[];
  oportunidades: string[];
  debilidades: string[];
  amenazas: string[];
}

export interface PlanningAnalysis {
  summary: string;
  smart: SmartMetrics;
  foda: FodaMetrics;
  suggestions: string[];
}

export const STORAGE_KEY = "kanban.general.tasks.v1";
export const AI_ANALYZER_ENDPOINT = "/api/ai/planning/analyze";
export const ROADMAP_PAGES: Array<{ id: RoadmapPageId; label: string; subtitle: string }> = [
  { id: "foundation", label: "Sprint Base", subtitle: "Integracion y cierre funcional" },
  { id: "sprint-1", label: "Sprint 1", subtitle: "Ledger hash + Outbox" },
  { id: "sprint-2", label: "Sprint 2", subtitle: "Policy Engine + Dispatcher" },
  { id: "sprint-3", label: "Sprint 3", subtitle: "Gobernanza, observabilidad y hardening" },
];

export const ROADMAP_WEEKLY_TARGET_HOURS: Record<RoadmapPageId, number> = {
  foundation: 30,
  "sprint-1": 36,
  "sprint-2": 40,
  "sprint-3": 42,
};

export const COLUMNS: Array<{ id: TaskStatus; label: string; color: string }> = [
  { id: "backlog", label: "Backlog", color: "from-slate-500 to-slate-600" },
  { id: "todo", label: "Por Hacer / Pendiente", color: "from-rose-500 to-rose-600" },
  { id: "in-progress", label: "En Proceso", color: "from-amber-500 to-amber-600" },
  { id: "review", label: "Revision", color: "from-violet-500 to-violet-600" },
  { id: "done", label: "Completado", color: "from-emerald-500 to-emerald-600" },
];

export const DEFAULT_TASKS: Task[] = [
  { id: "k-01", title: "Alcance definido: SVP + Inventario + Actividades + LiveOps + Unity", description: "Definir el alcance completo del sistema SPV integrado con Inventario y Parque 3D", category: "planning", priority: "high", estimated: "8h", status: "done" },
  { id: "k-02", title: "PostgreSQL confirmado como fuente de verdad", description: "Confirmar y documentar PostgreSQL como base de datos principal para puntos", category: "database", priority: "high", estimated: "4h", status: "done" },
  { id: "k-03", title: "Prototipo UI HTML creado", description: "Crear prototipo HTML inicial del sistema SPV con votes, puntos e inventario", category: "frontend", priority: "high", estimated: "6h", status: "done" },
  { id: "k-04", title: "Migrado a React + TypeScript", description: "Migrar el prototipo HTML a React con TypeScript", category: "frontend", priority: "high", estimated: "8h", status: "done" },
  { id: "k-05", title: "Fuente de verdad cerrada: PostgreSQL para puntos, Firebase para inventario", description: "Definir arquitectura de datos: PostgreSQL (puntos) + Firebase (inventario usuario)", category: "architecture", priority: "high", estimated: "6h", status: "done" },
  { id: "k-06", title: "Crear tablas points_wallet, points_ledger, point_rules, point_limits", description: "Implementar tablas SPV en PostgreSQL con ledger append-only", category: "database", priority: "high", estimated: "6h", status: "done" },
  { id: "k-07", title: "Implementar API de votos (POST /votes, GET /votes/count, GET /votes/limits)", description: "Crear endpoints K-11 para gestion de votos con auth y rate-limit", category: "backend", priority: "high", estimated: "8h", status: "done" },
  { id: "k-08", title: "Implementar API de puntos (credit, debit, transfer, convert, balance)", description: "Crear endpoints K-12 para gestion de puntos con ledger transaccional", category: "backend", priority: "high", estimated: "10h", status: "done" },
  { id: "spv-01", title: "Integrar navegacion SPV | Kanban en pestanas separadas", description: "Crear navegacion principal con iconos para cambiar entre SPV y Kanban", category: "frontend", priority: "high", estimated: "3h", status: "done" },
  { id: "spv-02", title: "Agregar iconos a elementos del SPV (metricas, pestanas, botones)", description: "Integrar iconos lucide-react en toda la interfaz SPV", category: "frontend", priority: "medium", estimated: "4h", status: "done" },
  { id: "spv-03", title: "Manejo de errores, logs y comentarios en SPV", description: "Implementar manejo robusto de errores con panel de logs visible", category: "frontend", priority: "high", estimated: "5h", status: "done" },
  { id: "spv-04", title: "Conectar SPV a endpoints reales /votes y /points", description: "Reemplazar datos simulados por llamadas a API con fallback local", category: "frontend", priority: "high", estimated: "6h", status: "done" },
  { id: "spv-05", title: "Anadir panel de Health Check en SPV", description: "Panel que prueba conectividad con /api/votes/count y /api/points/balance", category: "frontend", priority: "medium", estimated: "4h", status: "done" },
  { id: "kan-01", title: "Tablero Kanban responsive en movil y tablet", description: "Ajustar layout del tablero para diferentes tamanos de pantalla", category: "frontend", priority: "high", estimated: "6h", status: "done" },
  { id: "kan-02", title: "Extraccion de servicios Kanban (kanbanService.ts)", description: "Extraer logica de importacion, exportacion, metricas a modulo reutilizable", category: "refactor", priority: "medium", estimated: "5h", status: "done" },
  { id: "kan-03", title: "Agregar modal para crear tareas con formulario", description: "Implementar modal con campos para crear nuevas tareas en el tablero", category: "frontend", priority: "high", estimated: "4h", status: "done" },
  { id: "kan-04", title: "Filtro de estados con botonera (no select)", description: "Usar botones para filtrar por estado en lugar de dropdown", category: "frontend", priority: "medium", estimated: "2h", status: "done" },
  { id: "kan-05", title: "Importacion JSON, CSV, TOONTXT", description: "Permitir importar tareas desde archivos JSON, CSV y TOON", category: "frontend", priority: "high", estimated: "5h", status: "done" },
  { id: "kan-06", title: "Check slide para desplazamiento horizontal en movil/tablet", description: "Toggle para cambiar entre scroll horizontal y grid en movil", category: "frontend", priority: "medium", estimated: "3h", status: "done" },
  { id: "kan-07", title: "Eliminar barras de desplazamiento visibles en movil/tablet", description: "Ocultar scrollbars pero permitir scroll", category: "frontend", priority: "medium", estimated: "2h", status: "done" },
  { id: "kan-08", title: "Metricas SMART y FODA en el Kanban", description: "Implementar analisis SMART y FODA basado en tareas del tablero", category: "frontend", priority: "medium", estimated: "6h", status: "done" },
  { id: "kan-09", title: "Pestana Metricas separada en el Kanban", description: "Crear tab especifico para mostrar metricas y analisis", category: "frontend", priority: "medium", estimated: "3h", status: "done" },
  { id: "kan-10", title: "Upload documento para analisis IA", description: "Permitir subir documento para generar backlog/sprintlog via IA", category: "frontend", priority: "high", estimated: "5h", status: "done" },
  { id: "kan-11", title: "Mover texto guia solo a pestana Metricas", description: "Texto de documentacion recomendada solo visible en tab Metricas", category: "frontend", priority: "low", estimated: "1h", status: "done" },
  { id: "be-01", title: "Middleware requireAuth para validacion token Firebase", description: "Middleware que verifica y extrae user.uid del token Firebase", category: "backend", priority: "high", estimated: "4h", status: "done" },
  { id: "be-02", title: "Transaccion PostgreSQL (withTransaction helper)", description: "Helper para ejecutar operaciones transaccionales en PostgreSQL", category: "backend", priority: "high", estimated: "3h", status: "done" },
  { id: "be-03", title: "Repository de puntos con ledger append-only", description: "Acceso a datos de puntos desacoplado de rutas", category: "backend", priority: "high", estimated: "5h", status: "done" },
  { id: "be-04", title: "Alinear contratos API (requestId, remainingVotes)", description: "Corregir mismatch de campos entre frontend y backend", category: "backend", priority: "high", estimated: "3h", status: "done" },
  { id: "be-05", title: "POST /api/ai/planning/analyze", description: "Endpoint para analisis de documentos con IA (backlog + sprintlog)", category: "backend", priority: "medium", estimated: "8h", status: "done" },
  { id: "db-01", title: "Indices optimizados para points_wallet y points_ledger", description: "Crear indices para mejorar performance de consultas de puntos", category: "database", priority: "medium", estimated: "3h", status: "done" },
  { id: "db-02", title: "Seed data de prueba para point_rules y point_limits", description: "Poblar tablas con reglas de conversion y limites de ejemplo", category: "database", priority: "medium", estimated: "2h", status: "done" },
  { id: "db-03", title: "Tabla de votos (votes) si no existe aun", description: "Definir estructura de tabla para persistir votos auditablemente", category: "database", priority: "high", estimated: "3h", status: "done" },
  { id: "int-01", title: "Integracion con cross_system_transactions", description: "Conectar conversion puntos->objetos con tabla existente", category: "backend", priority: "high", estimated: "5h", status: "done" },
  { id: "int-02", title: "Conversion puntos<->LiveOps con liveops_rates", description: "Implementar conversion bidireccion usando tasas vigentes", category: "backend", priority: "medium", estimated: "4h", status: "done" },
  { id: "int-03", title: "Webhook para recibir puntos externos", description: "Endpoint seguro para recibir creditos de puntos de otros sistemas", category: "backend", priority: "medium", estimated: "4h", status: "done" },
  { id: "test-01", title: "Unit tests para parseo JSON/CSV/TOON", description: "Testear importacion de diferentes formatos", category: "testing", priority: "medium", estimated: "3h", status: "done" },
  { id: "test-02", title: "Unit tests para metricas SMART/FODA", description: "Validar calculos de metricas de planificacion", category: "testing", priority: "medium", estimated: "2h", status: "done" },
  { id: "test-03", title: "Integration tests para endpoints votos/puntos", description: "Test flujo completo vote->points->ledger", category: "testing", priority: "medium", estimated: "4h", status: "done" },
  { id: "test-04", title: "E2E test: voto -> puntos -> transferencia -> balance", description: "Caso de usuario completo de principio a fin", category: "testing", priority: "medium", estimated: "3h", status: "done" },
  { id: "sec-01", title: "Rate limiting por usuario en API de votos", description: "Prevenir abuso en endpoints de votacion", category: "security", priority: "high", estimated: "4h", status: "done" },
  { id: "sec-02", title: "Validacion robusta con Zod/Joi", description: "Validar todos los inputs de endpoints con schema validator", category: "security", priority: "medium", estimated: "3h", status: "done" },
  { id: "sec-03", title: "Header Authorization en todas las llamadas API", description: "Incluir token Firebase en todas las requests protegidas", category: "security", priority: "high", estimated: "2h", status: "done" },
  { id: "opt-01", title: "Dividir KanbanBoard en subcomponentes", description: "Extraer BoardHeader, FiltersBar, Column, TaskCard y modales", category: "refactor", priority: "medium", estimated: "5h", status: "done" },
  { id: "opt-02", title: "Extraer SPV logica a hooks (useSpv)", description: "Hook para manejo de estado SPV reutilizable", category: "refactor", priority: "medium", estimated: "4h", status: "done" },
  { id: "opt-03", title: "Observabilidad: requestId visible en UI y logs", description: "Mostrar ID de solicitud en interfaz para debugging", category: "monitoring", priority: "low", estimated: "2h", status: "done" },
  { id: "opt-04", title: "Error boundary + logger remoto opcional", description: "Capturar errores sin pantalla blanca con logging", category: "monitoring", priority: "medium", estimated: "3h", status: "done" },
  { id: "fea-01", title: "Vista tabla 'Todas las tareas' ademas de Kanban", description: "Lista consolidada de tareas para revision rapida", category: "feature", priority: "low", estimated: "4h", status: "done" },
  { id: "fea-02", title: "Conversor de texto de requisitos a tareas JSON", description: "Pegar texto libre y transformar a tareas sugeridas", category: "feature", priority: "low", estimated: "3h", status: "done" },
  { id: "fea-03", title: "Contadores de carga en cada boton de estado", description: "Mostrar cantidad de tareas por estado (ej. En Proceso (4))", category: "feature", priority: "low", estimated: "2h", status: "done" },
  { id: "fea-04", title: "Validacion previa en modal de importacion", description: "Mostrar cuantas tareas se detectan antes de confirmar", category: "feature", priority: "low", estimated: "2h", status: "done" },
  { id: "fea-05", title: "Exportacion a Jira/Asana format", description: "Opcion adicional para exportar a otros gestores de tareas", category: "feature", priority: "low", estimated: "4h", status: "done" },
  { id: "nxt-01", title: "Disenar esquema hash-chain para InventoryLedger", description: "Agregar previous_hash/current_hash con version de hash y serializacion canonica", category: "ledger", priority: "high", estimated: "6h", status: "done", roadmapPage: "sprint-1" },
  { id: "nxt-02", title: "Implementar verificador de integridad de ledger", description: "Job/verificador que recorre eventos y detecta alteraciones de cadena", category: "ledger", priority: "high", estimated: "5h", status: "done", roadmapPage: "sprint-1" },
  { id: "nxt-03", title: "Tabla outbox_events con estados de entrega", description: "Persistir eventos para integraciones externas con retry controlado", category: "integration", priority: "high", estimated: "5h", status: "done", roadmapPage: "sprint-1" },
  { id: "nxt-04", title: "Worker SVP Dispatcher con retry y dead letter", description: "Despacho at-least-once para eventos TierList y sistemas externos", category: "integration", priority: "high", estimated: "7h", status: "done", roadmapPage: "sprint-1" },
  { id: "nxt-05", title: "Idempotencia estricta por sourceApp + eventId", description: "Unicidad e idempotencia uniforme en todos los sumideros externos", category: "security", priority: "high", estimated: "4h", status: "done", roadmapPage: "sprint-1" },
  { id: "nxt-06", title: "Contratos /v1 para ingestion TierList", description: "Versionar endpoints de eventos y documentar deprecaciones", category: "backend", priority: "medium", estimated: "4h", status: "done", roadmapPage: "sprint-1" },
  { id: "nxt-07", title: "Policy Engine desacoplado con ProposedMutation", description: "Motor de reglas que evalua contexto y retorna mutaciones propuestas", category: "policy", priority: "high", estimated: "8h", status: "done", roadmapPage: "sprint-2" },
  { id: "nxt-08", title: "Versionado de reglas de valorizacion de objetos", description: "Persistir versiones activas por tipo de actividad y vigencia temporal", category: "policy", priority: "high", estimated: "6h", status: "done", roadmapPage: "sprint-2" },
  { id: "nxt-09", title: "Eventos de lifecycle: transform/destroy/transfer", description: "Registrar mutaciones de objeto con impacto en puntos y auditoria", category: "inventory", priority: "high", estimated: "7h", status: "done", roadmapPage: "sprint-2" },
  { id: "nxt-10", title: "Suite de pruebas de concurrencia para ledger", description: "Validar invariantes contables bajo operaciones simultaneas", category: "testing", priority: "medium", estimated: "6h", status: "done", roadmapPage: "sprint-2" },
  { id: "nxt-11", title: "Runbooks de incidentes para dispatcher y ledger", description: "Definir respuesta operativa ante desbalance, replay o cola saturada", category: "ops", priority: "medium", estimated: "3h", status: "done", roadmapPage: "sprint-2" },
  { id: "nxt-12", title: "Panel de trazabilidad por requestId y eventId", description: "Vista operativa para soporte y auditoria de transacciones", category: "monitoring", priority: "medium", estimated: "5h", status: "done", roadmapPage: "sprint-2" },
  { id: "nxt-13", title: "Monitor transaccional base del SVP", description: "Endpoint consolidado para consultar transacciones cross-system con filtros", category: "monitoring", priority: "medium", estimated: "3h", status: "done", roadmapPage: "sprint-2" },
  { id: "nxt-14", title: "Stream en tiempo real para monitor transaccional", description: "Agregar endpoint SSE para snapshots periodicos de transacciones del SVP", category: "monitoring", priority: "medium", estimated: "4h", status: "done", roadmapPage: "sprint-2" },
  { id: "sp3-01", title: "Hash audit endpoint firmado", description: "Exponer verificacion de integridad con firma de servidor y hashVersion", category: "ledger", priority: "high", estimated: "6h", status: "done", roadmapPage: "sprint-3" },
  { id: "sp3-02", title: "Outbox dead-letter replay seguro", description: "Herramienta para reintentar eventos DLQ con control de idempotencia", category: "integration", priority: "high", estimated: "7h", status: "done", roadmapPage: "sprint-3" },
  { id: "sp3-03", title: "Alertas operativas de dispatcher", description: "Disparar alertas por backlog envejecido y fallos consecutivos", category: "ops", priority: "medium", estimated: "5h", status: "done", roadmapPage: "sprint-3" },
  { id: "sp3-04", title: "Rate limit distribuido", description: "Agregar opcion Redis para rate limiting multi-instancia", category: "security", priority: "medium", estimated: "6h", status: "done", roadmapPage: "sprint-3" },
  { id: "sp3-05", title: "Suite automatizada de carga para votos/eventos", description: "Escenarios de stress para throughput y latencia", category: "testing", priority: "medium", estimated: "8h", status: "done", roadmapPage: "sprint-3" },
  { id: "sp3-06", title: "Panel de conciliacion contable", description: "Vista para verificar invariantes de ledger y desbalances", category: "monitoring", priority: "high", estimated: "7h", status: "done", roadmapPage: "sprint-3" },
];

const TASK_STATUS_OVERRIDES: Partial<Record<string, TaskStatus>> = {
  "spv-04": "done",
  "spv-05": "done",
  "kan-03": "done",
  "kan-05": "done",
  "kan-06": "done",
  "be-04": "done",
  "db-01": "done",
  "sec-02": "done",
  "sec-03": "done",
  "int-02": "done",
  "int-03": "done",
  "opt-03": "done",
  "opt-02": "done",
  "opt-04": "done",
  "fea-01": "done",
  "fea-02": "done",
  "fea-03": "done",
  "test-01": "done",
  "test-02": "done",
  "test-03": "done",
  "test-04": "done",
  "fea-04": "done",
  "fea-05": "done",
  "nxt-03": "done",
  "nxt-04": "done",
  "nxt-05": "done",
  "nxt-06": "done",
  "nxt-01": "done",
  "nxt-02": "done",
  "nxt-07": "done",
  "nxt-08": "done",
  "nxt-09": "done",
  "nxt-10": "done",
  "nxt-11": "done",
  "nxt-12": "done",
  "nxt-14": "done",
  "sp3-01": "done",
  "sp3-02": "done",
  "sp3-03": "done",
  "sp3-04": "done",
  "sp3-05": "done",
  "sp3-06": "done",
};

const applyTaskStatusOverrides = (tasks: Task[]): Task[] =>
  tasks.map((task) => {
    const override = TASK_STATUS_OVERRIDES[task.id];
    return override ? { ...task, status: override } : task;
  });

export const priorityStyles: Record<TaskPriority, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-emerald-100 text-emerald-700",
};

export const STATUS_FILTER_BUTTONS: Array<{ value: "all" | TaskStatus; label: string }> = [
  { value: "all", label: "Todos los estados" },
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "Por Hacer / Pendiente" },
  { value: "in-progress", label: "En Proceso" },
  { value: "review", label: "Revision" },
  { value: "done", label: "Completado" },
];

export const normalizeStatus = (value?: string): TaskStatus => {
  const input = (value ?? "").trim().toLowerCase();
  if (input === "todo" || input === "to-do" || input === "por hacer") return "todo";
  if (input === "in-progress" || input === "in progress" || input === "en proceso") return "in-progress";
  if (input === "review" || input === "revision") return "review";
  if (input === "done" || input === "completado") return "done";
  return "backlog";
};

export const normalizePriority = (value?: string): TaskPriority => {
  const input = (value ?? "").trim().toLowerCase();
  if (input === "high" || input === "alta") return "high";
  if (input === "medium" || input === "media") return "medium";
  return "low";
};

const createId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `task-${Date.now()}`);

export const createTask = (seed: Partial<Task>): Task => ({
  id: seed.id ?? createId(),
  title: seed.title?.trim() || "Nueva tarea",
  description: seed.description?.trim() || "",
  category: seed.category?.trim() || "general",
  priority: seed.priority ?? "medium",
  estimated: seed.estimated?.trim() || "1h",
  status: seed.status ?? "backlog",
  roadmapPage: seed.roadmapPage ?? "foundation",
  notes: seed.notes?.trim() || undefined,
});

export const getTaskRoadmapPage = (task: Task): RoadmapPageId | "custom" => task.roadmapPage ?? "foundation";

export const parseEstimatedHours = (estimated: string): number => {
  const value = estimated.trim().toLowerCase();
  const daysMatch = value.match(/(\d+(?:[.,]\d+)?)\s*d/);
  const hoursMatch = value.match(/(\d+(?:[.,]\d+)?)\s*h/);
  const normalized = (input?: string) => Number((input ?? "0").replace(",", "."));
  if (daysMatch) return normalized(daysMatch[1]) * 8;
  if (hoursMatch) return normalized(hoursMatch[1]);
  const raw = normalized(value);
  return Number.isFinite(raw) ? raw : 0;
};

export const safeReadTasks = (): Task[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return applyTaskStatusOverrides(DEFAULT_TASKS);
    const parsed = JSON.parse(raw) as Task[];
    if (Array.isArray(parsed) && parsed.length >= 20) {
      // Merge by id so newly added sprint tasks appear without losing user edits.
      const persistedById = new Map(parsed.map((task) => [task.id, task]));
      const merged = DEFAULT_TASKS.map((seed) => persistedById.get(seed.id) ?? seed);
      const custom = parsed.filter((task) => !merged.some((seed) => seed.id === task.id));
      return applyTaskStatusOverrides([...merged, ...custom]);
    }
    return applyTaskStatusOverrides(DEFAULT_TASKS);
  } catch {
    return applyTaskStatusOverrides(DEFAULT_TASKS);
  }
};

export const persistTasks = (tasks: Task[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // Ignore storage failures.
  }
};

export const mapTaskLikeArray = (input: unknown, fallbackStatus: TaskStatus): Task[] => {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry) => {
      if (typeof entry === "string") return createTask({ title: entry, status: fallbackStatus });
      const task = entry as Partial<Task>;
      return createTask({
        ...task,
        status: task.status ? normalizeStatus(task.status) : fallbackStatus,
        priority: task.priority ? normalizePriority(task.priority) : "medium",
      });
    })
    .filter((task) => task.title.trim().length > 0);
};

export const parseImportContent = (content: string, extension?: string): Task[] => {
  const normalizedExtension = (extension ?? "").toLowerCase();

  if (normalizedExtension === "json") {
    const parsed = JSON.parse(content) as Task[] | { cards?: Task[]; tasks?: Task[]; backlog?: TaskLike[]; sprintlog?: TaskLike[] };
    if (Array.isArray(parsed)) return parsed.map((item) => createTask(item));
    if (Array.isArray(parsed.cards)) return parsed.cards.map((item) => createTask(item));
    if (Array.isArray(parsed.tasks)) return parsed.tasks.map((item) => createTask(item));
    return [...mapTaskLikeArray(parsed.backlog, "backlog"), ...mapTaskLikeArray(parsed.sprintlog, "todo")];
  }

  if (normalizedExtension === "csv") {
    const csvLines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (csvLines.length === 0) return [];

    const separator = csvLines[0].includes(";") ? ";" : ",";
    const splitLine = (line: string) => line.split(separator).map((item) => item.trim().replace(/^"|"$/g, ""));
    const headers = splitLine(csvLines[0]).map((header) => header.toLowerCase());
    const hasHeader = headers.some((header) => ["title", "titulo", "task", "tarea", "status", "estado"].includes(header));
    const dataLines = hasHeader ? csvLines.slice(1) : csvLines;

    return dataLines
      .map((line) => {
        const cols = splitLine(line);
        if (hasHeader) {
          const row: Record<string, string> = {};
          headers.forEach((key, idx) => {
            row[key] = cols[idx] ?? "";
          });
          return createTask({
            title: row.title || row.titulo || row.task || row.tarea,
            description: row.description || row.descripcion || "",
            status: normalizeStatus(row.status || row.estado),
            category: row.category || row.categoria || "general",
            priority: normalizePriority(row.priority || row.prioridad),
            estimated: row.estimated || row.estimado || "1h",
            notes: row.notes || row.notas || undefined,
          });
        }

        const [title, description = "", status = "backlog", category = "general", priority = "medium", estimated = "1h"] = cols;
        return createTask({ title, description, status: normalizeStatus(status), category, priority: normalizePriority(priority), estimated });
      })
      .filter((task) => task.title.trim().length > 0);
  }

  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  return lines.map((line) => {
    const [title, description = "", status = "backlog", category = "general", priority = "medium", estimated = "1h"] = line.split("|").map((part) => part.trim());
    return createTask({ title, description, status: normalizeStatus(status), category, priority: normalizePriority(priority), estimated });
  });
};

export const convertRequirementsTextToTasks = (content: string): Task[] => {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*\d.)\s]+/, ""))
    .filter((line) => line.length >= 4);

  return lines.map((line) => {
    const normalized = line.toLowerCase();
    const status = /completad|done|cerrad/.test(normalized)
      ? "done"
      : /proceso|in progress|in-progress/.test(normalized)
        ? "in-progress"
        : /revision|review/.test(normalized)
          ? "review"
          : /hacer|todo|pendient/.test(normalized)
            ? "todo"
            : "backlog";

    const priority = /critic|urgente|high|alta/.test(normalized)
      ? "high"
      : /media|medium/.test(normalized)
        ? "medium"
        : "low";

    return createTask({ title: line, status, priority, category: "requirements" });
  });
};

const inferSmartFromTasks = (tasks: Task[]): SmartMetrics => {
  if (tasks.length === 0) return { specific: 0, measurable: 0, achievable: 0, relevant: 0, timeBound: 0, coverage: 0 };
  const specific = tasks.filter((task) => task.title.length > 0 && task.description.length > 10).length;
  const measurable = tasks.filter((task) => /\d/.test(task.estimated)).length;
  const achievable = tasks.filter((task) => task.priority !== "high").length;
  const relevant = tasks.filter((task) => task.category.length > 0).length;
  const timeBound = tasks.filter((task) => /\d/.test(task.estimated)).length;
  const coverage = Math.round(((specific + measurable + achievable + relevant + timeBound) / (tasks.length * 5)) * 100);
  return {
    specific: Math.round((specific / tasks.length) * 100),
    measurable: Math.round((measurable / tasks.length) * 100),
    achievable: Math.round((achievable / tasks.length) * 100),
    relevant: Math.round((relevant / tasks.length) * 100),
    timeBound: Math.round((timeBound / tasks.length) * 100),
    coverage,
  };
};

const inferFodaFromTasks = (tasks: Task[]): FodaMetrics => {
  const result: FodaMetrics = { fortalezas: [], oportunidades: [], debilidades: [], amenazas: [] };
  tasks.forEach((task) => {
    const source = `${task.title} ${task.description} ${task.category}`.toLowerCase();
    if (/fortaleza|strength/.test(source)) result.fortalezas.push(task.title);
    if (/oportunidad|opportunity/.test(source)) result.oportunidades.push(task.title);
    if (/debilidad|weakness/.test(source)) result.debilidades.push(task.title);
    if (/amenaza|threat/.test(source)) result.amenazas.push(task.title);
  });
  return result;
};

export const buildPlanningAnalysis = (tasks: Task[]): PlanningAnalysis => ({
  summary: tasks.length === 0 ? "No hay tareas para analizar." : `Analisis generado sobre ${tasks.length} tareas.`,
  smart: inferSmartFromTasks(tasks),
  foda: inferFodaFromTasks(tasks),
  suggestions: [
    "Asegurar que cada tarea tenga criterio de aceptacion medible.",
    "Separar backlog estrategico de sprint log operativo.",
    "Agregar dependencia y riesgo por tarea de alta prioridad.",
  ],
});

export const mergePlanningAnalysis = (
  inferred: PlanningAnalysis,
  metrics?: { smart?: Partial<SmartMetrics>; foda?: Partial<FodaMetrics>; summary?: string; suggestions?: string[] },
): PlanningAnalysis => ({
  ...inferred,
  summary: metrics?.summary || inferred.summary,
  smart: { ...inferred.smart, ...metrics?.smart },
  foda: {
    fortalezas: metrics?.foda?.fortalezas || inferred.foda.fortalezas,
    oportunidades: metrics?.foda?.oportunidades || inferred.foda.oportunidades,
    debilidades: metrics?.foda?.debilidades || inferred.foda.debilidades,
    amenazas: metrics?.foda?.amenazas || inferred.foda.amenazas,
  },
  suggestions: metrics?.suggestions || inferred.suggestions,
});

export async function requestPlanningAnalysis(input: { tasks?: Task[]; document?: string }) {
  return requestJSON<{
    smart?: Partial<SmartMetrics>;
    foda?: Partial<FodaMetrics>;
    summary?: string;
    suggestions?: string[];
    backlog?: Array<Partial<Task> | string>;
    sprintlog?: Array<Partial<Task> | string>;
  }>(
    AI_ANALYZER_ENDPOINT,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export const buildFodaCoverageCounters = (tasks: Task[]) => {
  const counters = { fortalezas: 0, oportunidades: 0, debilidades: 0, amenazas: 0 };
  tasks.forEach((task) => {
    const source = `${task.title} ${task.description} ${task.category}`.toLowerCase();
    if (/fortaleza|strength/.test(source)) counters.fortalezas += 1;
    if (/oportunidad|opportunity/.test(source)) counters.oportunidades += 1;
    if (/debilidad|weakness/.test(source)) counters.debilidades += 1;
    if (/amenaza|threat/.test(source)) counters.amenazas += 1;
  });
  return counters;
};

export const buildTrelloCsv = (tasks: Task[]) => {
  const rows = [
    ["Name", "Description", "List", "Labels"],
    ...tasks.map((task) => [task.title, `${task.description} | Estimado: ${task.estimated}`, task.status, `${task.category},${task.priority}`]),
  ];
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
};

export const buildJiraCsv = (tasks: Task[]) => {
  const rows = [
    ["Summary", "Description", "Issue Type", "Priority", "Labels", "Original Estimate", "Status"],
    ...tasks.map((task) => [
      task.title,
      task.description,
      "Task",
      task.priority,
      task.category,
      task.estimated,
      task.status,
    ]),
  ];
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
};

export const buildAsanaCsv = (tasks: Task[]) => {
  const rows = [
    ["Name", "Notes", "Tags", "Priority", "Estimated", "Section/Column"],
    ...tasks.map((task) => [task.title, task.description, task.category, task.priority, task.estimated, task.status]),
  ];
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
};

export const buildKanbanExportJson = (tasks: Task[]) => ({
  board: { name: "Kanban General", exportedAt: new Date().toISOString() },
  lists: COLUMNS,
  cards: tasks,
});
