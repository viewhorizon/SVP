export type TaskStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: TaskPriority;
  estimated: string;
  status: TaskStatus;
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

export const STORAGE_KEY = 'kanban.general.tasks.v1';
export const AI_ANALYZER_ENDPOINT = '/api/ai/planning/analyze';

export const COLUMNS: Array<{ id: TaskStatus; label: string; color: string }> = [
  { id: 'backlog', label: 'Backlog', color: 'from-slate-500 to-slate-600' },
  { id: 'todo', label: 'Por Hacer', color: 'from-rose-500 to-rose-600' },
  { id: 'in-progress', label: 'En Proceso', color: 'from-amber-500 to-amber-600' },
  { id: 'review', label: 'Revision', color: 'from-violet-500 to-violet-600' },
  { id: 'done', label: 'Completado', color: 'from-emerald-500 to-emerald-600' },
];

export const DEFAULT_TASKS: Task[] = [
  // KANBAN - COMPLETED AND IN PROGRESS
  { id: 'k-01', title: 'Alcance definido: SVP + Inventario + Actividades + LiveOps + Unity', description: 'Definir el alcance completo del sistema SPV integrado con Inventario y Parque 3D', category: 'planning', priority: 'high', estimated: '8h', status: 'done' },
  { id: 'k-02', title: 'PostgreSQL confirmado como fuente de verdad', description: 'Confirmar y documentar PostgreSQL como base de datos principal para puntos', category: 'database', priority: 'high', estimated: '4h', status: 'done' },
  { id: 'k-03', title: 'Prototipo UI HTML creado', description: 'Crear prototipo HTML inicial del sistema SPV con votes, puntos e inventario', category: 'frontend', priority: 'high', estimated: '6h', status: 'done' },
  { id: 'k-04', title: 'Migrado a React + TypeScript', description: 'Migrar el prototipo HTML a React con TypeScript', category: 'frontend', priority: 'high', estimated: '8h', status: 'done' },
  { id: 'k-05', title: 'Fuente de verdad cerrada: PostgreSQL para puntos, Firebase para inventario', description: 'Definir arquitectura de datos: PostgreSQL (puntos) + Firebase (inventario usuario)', category: 'architecture', priority: 'high', estimated: '6h', status: 'done' },
  { id: 'k-06', title: 'Crear tablas points_wallet, points_ledger, point_rules, point_limits', description: 'Implementar tablas SPV en PostgreSQL con ledger append-only', category: 'database', priority: 'high', estimated: '6h', status: 'done' },
  { id: 'k-07', title: 'Implementar API de votos (POST /votes, GET /votes/count, GET /votes/limits)', description: 'Crear endpoints K-11 para gestión de votos con auth y rate-limit', category: 'backend', priority: 'high', estimated: '8h', status: 'done' },
  { id: 'k-08', title: 'Implementar API de puntos (credit, debit, transfer, convert, balance)', description: 'Crear endpoints K-12 para gestión de puntos con ledger transaccional', category: 'backend', priority: 'high', estimated: '10h', status: 'done' },
  
  // SPV FRONTEND - IN PROGRESS
  { id: 'spv-01', title: 'Integrar navegación SPV | Kanban en pestañas separadas', description: 'Crear navegación principal con iconos para cambiar entre SPV y Kanban', category: 'frontend', priority: 'high', estimated: '3h', status: 'done' },
  { id: 'spv-02', title: 'Agregar iconos a elementos del SPV (métricas, pestañas, botones)', description: 'Integrar iconos lucide-react en toda la interfaz SPV', category: 'frontend', priority: 'medium', estimated: '4h', status: 'done' },
  { id: 'spv-03', title: 'Manejo de errores, logs y comentarios en SPV', description: 'Implementar manejo robusto de errores con panel de logs visible', category: 'frontend', priority: 'high', estimated: '5h', status: 'done' },
  { id: 'spv-04', title: 'Conectar SPV a endpoints reales /votes y /points', description: 'Reemplazar datos simulados por llamadas a API con fallback local', category: 'frontend', priority: 'high', estimated: '6h', status: 'in-progress' },
  { id: 'spv-05', title: 'Añadir panel de Health Check en SPV', description: 'Panel que prueba conectividad con /api/votes/count y /api/points/balance', category: 'frontend', priority: 'medium', estimated: '4h', status: 'todo' },
  
  // KANBAN FRONTEND - IN PROGRESS
  { id: 'kan-01', title: 'Tablero Kanban responsive en móvil y tablet', description: 'Ajustar layout del tablero para diferentes tamaños de pantalla', category: 'frontend', priority: 'high', estimated: '6h', status: 'done' },
  { id: 'kan-02', title: 'Extracción de servicios Kanban (kanbanService.ts)', description: 'Extraer lógica de importación, exportación, métricas a módulo reutilizable', category: 'refactor', priority: 'medium', estimated: '5h', status: 'done' },
  { id: 'kan-03', title: 'Agregar modal para crear tareas con formulario', description: 'Implementar modal con campos para crear nuevas tareas en el tablero', category: 'frontend', priority: 'high', estimated: '4h', status: 'done' },
  { id: 'kan-04', title: 'Filtro de estados con botonera (no select)', description: 'Usar botones para filtrar por estado en lugar de dropdown', category: 'frontend', priority: 'medium', estimated: '2h', status: 'done' },
  { id: 'kan-05', title: 'Importación JSON, CSV, TOONTXT', description: 'Permitir importar tareas desde archivos JSON, CSV y TOON', category: 'frontend', priority: 'high', estimated: '5h', status: 'done' },
  { id: 'kan-06', title: 'Check slide para desplazamiento horizontal en móvil/tablet', description: 'Toggle para cambiar entre scroll horizontal y grid en móvil', category: 'frontend', priority: 'medium', estimated: '3h', status: 'done' },
  { id: 'kan-07', title: 'Eliminar barras de desplazamiento visibles en móvil/tablet', description: 'Ocultar scrollbars pero permitir scroll', category: 'frontend', priority: 'medium', estimated: '2h', status: 'done' },
  { id: 'kan-08', title: 'Métricas SMART y FODA en el Kanban', description: 'Implementar análisis SMART y FODA basado en tareas del tablero', category: 'frontend', priority: 'medium', estimated: '6h', status: 'done' },
  { id: 'kan-09', title: 'Pestaña Métricas separada en el Kanban', description: 'Crear tab específico para mostrar métricas y análisis', category: 'frontend', priority: 'medium', estimated: '3h', status: 'done' },
  { id: 'kan-10', title: 'Upload documento para análisis IA', description: 'Permitir subir documento para generar backlog/sprintlog vía IA', category: 'frontend', priority: 'high', estimated: '5h', status: 'done' },
  { id: 'kan-11', title: 'Mover texto guía solo a pestaña Métricas', description: 'Texto de documentación recomendada solo visible en tab Métricas', category: 'frontend', priority: 'low', estimated: '1h', status: 'done' },
  
  // BACKEND SERVICES - IN PROGRESS
  { id: 'be-01', title: 'Middleware requireAuth para validación token Firebase', description: 'Middleware que verifica y extrae user.uid del token Firebase', category: 'backend', priority: 'high', estimated: '4h', status: 'done' },
  { id: 'be-02', title: 'Transacción PostgreSQL (withTransaction helper)', description: 'Helper para ejecutar operaciones transaccionales en PostgreSQL', category: 'backend', priority: 'high', estimated: '3h', status: 'done' },
  { id: 'be-03', title: 'Repository de puntos con ledger append-only', description: 'Acceso a datos de puntos desacoplado de rutas', category: 'backend', priority: 'high', estimated: '5h', status: 'done' },
  { id: 'be-04', title: 'Alinear contratos API (requestId, remainingVotes)', description: 'Corregir mismatch de campos entre frontend y backend', category: 'backend', priority: 'high', estimated: '3h', status: 'in-progress' },
  { id: 'be-05', title: 'POST /api/ai/planning/analyze', description: 'Endpoint para análisis de documentos con IA (backlog + sprintlog)', category: 'backend', priority: 'medium', estimated: '8h', status: 'todo' },
  
  // DATABASE - PENDING
  { id: 'db-01', title: 'Índices optimizados para points_wallet y points_ledger', description: 'Crear índices para mejorar performance de consultas de puntos', category: 'database', priority: 'medium', estimated: '3h', status: 'todo' },
  { id: 'db-02', title: 'Seed data de prueba para point_rules y point_limits', description: 'Poblar tablas con reglas de conversión y límites de ejemplo', category: 'database', priority: 'medium', estimated: '2h', status: 'todo' },
  { id: 'db-03', title: 'Tabla de votos (votes) si no existe aún', description: 'Definir estructura de tabla para persistir votos auditablemente', category: 'database', priority: 'high', estimated: '3h', status: 'todo' },
  
  // INTEGRATION - PENDING
  { id: 'int-01', title: 'Integración con cross_system_transactions', description: 'Conectar conversión puntos→objetos con tabla existente', category: 'backend', priority: 'high', estimated: '5h', status: 'todo' },
  { id: 'int-02', title: 'Conversión puntos↔LiveOps con liveops_rates', description: 'Implementar conversión bidirección usando tasas vigentes', category: 'backend', priority: 'medium', estimated: '4h', status: 'todo' },
  { id: 'int-03', title: 'Webhook para recibir puntos externos', description: 'Endpoint seguro para recibir créditos de puntos de otros sistemas', category: 'backend', priority: 'medium', estimated: '4h', status: 'todo' },
  
  // TESTING - PENDING
  { id: 'test-01', title: 'Unit tests para parseo JSON/CSV/TOON', description: 'Testear importación de diferentes formatos', category: 'testing', priority: 'medium', estimated: '3h', status: 'todo' },
  { id: 'test-02', title: 'Unit tests para métricas SMART/FODA', description: 'Validar cálculos de métricas de planificación', category: 'testing', priority: 'medium', estimated: '2h', status: 'todo' },
  { id: 'test-03', title: 'Integration tests para endpoints votos/puntos', description: 'Test flujo completo vote→points→ledger', category: 'testing', priority: 'medium', estimated: '4h', status: 'todo' },
  { id: 'test-04', title: 'E2E test: voto → puntos → transferencia → balance', description: 'Caso de usuario completo de principio a fin', category: 'testing', priority: 'medium', estimated: '3h', status: 'todo' },
  
  // SECURITY - PENDING
  { id: 'sec-01', title: 'Rate limiting por usuario en API de votos', description: 'Prevenir abuso en endpoints de votación', category: 'security', priority: 'high', estimated: '4h', status: 'todo' },
  { id: 'sec-02', title: 'Validación robusta con Zod/Joi', description: 'Validar todos los inputs de endpoints con schema validator', category: 'security', priority: 'medium', estimated: '3h', status: 'todo' },
  { id: 'sec-03', title: 'header Authorization en todas las llamadas API', description: 'Incluir token Firebase en todas las requests protegidas', category: 'security', priority: 'high', estimated: '2h', status: 'in-progress' },
  
  // OPTIMIZATION - PENDING
  { id: 'opt-01', title: 'Dividir KanbanBoard en subcomponentes', description: 'Extraer BoardHeader, FiltersBar, Column, TaskCard, modales', category: 'refactor', priority: 'medium', estimated: '5h', status: 'todo' },
  { id: 'opt-02', title: 'Extraer SPV lógica a hooks (useSpv)', description: 'Hook para manejo de estado SPV reutilizable', category: 'refactor', priority: 'medium', estimated: '4h', status: 'todo' },
  { id: 'opt-03', title: 'Observabilidad: requestId visible en UI y logs', description: 'Mostrar ID de solicitud en interfaz para debugging', category: 'monitoring', priority: 'low', estimated: '2h', status: 'todo' },
  { id: 'opt-04', title: 'Error boundary + logger remoto opcional', description: 'Capturar errores sin pantalla blanca con logging', category: 'monitoring', priority: 'medium', estimated: '3h', status: 'todo' },
  
  // FUTURE FEATURES - PENDING
  { id: 'fea-01', title: 'Vista tabla "Todas las tareas" además de Kanban', description: 'Lista consolidada de tareas para revisión rápida', category: 'feature', priority: 'low', estimated: '4h', status: 'todo' },
  { id: 'fea-02', title: 'Conversor de texto de requisitos a tareas JSON', description: 'Pegar texto libre y transformar a tareas sugeridas', category: 'feature', priority: 'low', estimated: '3h', status: 'todo' },
  { id: 'fea-03', title: 'Contadores de carga en cada botón de estado', description: 'Mostrar cantidad de tareas por estado (ej. "En Proceso (4)")', category: 'feature', priority: 'low', estimated: '2h', status: 'todo' },
  { id: 'fea-04', title: 'Validación previa en modal de importación', description: 'Mostrar cuántas tareas se detectan antes de confirmar', category: 'feature', priority: 'low', estimated: '2h', status: 'todo' },
  { id: 'fea-05', title: 'Exportación a Jira/Asana format', description: 'Opción adicional para exportar a otros gestores de tareas', category: 'feature', priority: 'low', estimated: '4h', status: 'todo' },
];

export const priorityStyles: Record<TaskPriority, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-emerald-100 text-emerald-700',
};

export const STATUS_FILTER_BUTTONS: Array<{ value: 'all' | TaskStatus; label: string }> = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'Por Hacer' },
  { value: 'in-progress', label: 'En Proceso' },
  { value: 'review', label: 'Revision' },
  { value: 'done', label: 'Completado' },
];

export const normalizeStatus = (value?: string): TaskStatus => {
  const input = (value ?? '').trim().toLowerCase();
  if (input === 'backlog') return 'backlog';
  if (input === 'todo' || input === 'to-do' || input === 'por hacer') return 'todo';
  if (input === 'in-progress' || input === 'in progress' || input === 'en proceso') return 'in-progress';
  if (input === 'review' || input === 'revision') return 'review';
  if (input === 'done' || input === 'completado') return 'done';
  return 'backlog';
};

export const normalizePriority = (value?: string): TaskPriority => {
  const input = (value ?? '').trim().toLowerCase();
  if (input === 'high' || input === 'alta') return 'high';
  if (input === 'medium' || input === 'media') return 'medium';
  return 'low';
};

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export const createTask = (seed: Partial<Task>): Task => ({
  id: seed.id ?? createId(),
  title: seed.title?.trim() || 'Nueva tarea',
  description: seed.description?.trim() || '',
  category: seed.category?.trim() || 'general',
  priority: seed.priority ?? 'medium',
  estimated: seed.estimated?.trim() || '1h',
  status: seed.status ?? 'backlog',
  notes: seed.notes?.trim() || undefined,
});

export const safeReadTasks = (): Task[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TASKS;
    const parsed = JSON.parse(raw) as Task[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_TASKS;
  } catch {
    return DEFAULT_TASKS;
  }
};

export const persistTasks = (tasks: Task[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // Mantiene funcionalidad en memoria si localStorage no esta disponible.
  }
};

const csvToRows = (content: string): string[][] => {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(current.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }

  return rows;
};

const textToTasks = (content: string): Task[] => {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  return lines.map((line) => {
    const sanitized = line.replace(/^[-*]\s*/, '');
    const [title, description = '', status = 'backlog', category = 'general', priority = 'medium', estimated = '1h'] =
      sanitized.split('|').map((part) => part.trim());

    return createTask({
      title,
      description,
      status: normalizeStatus(status),
      category,
      priority: normalizePriority(priority),
      estimated,
    });
  });
};

export const mapTaskLikeArray = (input: unknown, fallbackStatus: TaskStatus): Task[] => {
  if (!Array.isArray(input)) return [];

  return input
    .map((entry) => {
      if (typeof entry === 'string') {
        return createTask({ title: entry, status: fallbackStatus });
      }

      const task = entry as Partial<Task>;
      return createTask({
        ...task,
        status: task.status ? normalizeStatus(task.status) : fallbackStatus,
        priority: task.priority ? normalizePriority(task.priority) : 'medium',
      });
    })
    .filter((task) => task.title.trim().length > 0);
};

export const parseImportContent = (content: string, extension?: string): Task[] => {
  let imported: Task[] = [];

  if (extension === 'json') {
    const parsed = JSON.parse(content) as
      | Task[]
      | { cards?: unknown[]; tasks?: unknown[]; backlog?: TaskLike[]; sprintlog?: TaskLike[]; sprintLog?: TaskLike[] }
      | { board?: unknown };

    if (Array.isArray(parsed)) {
      imported = parsed.map((item) => createTask(item as Partial<Task>));
    } else if (Array.isArray((parsed as { cards?: unknown[] }).cards)) {
      imported = ((parsed as { cards?: Partial<Task>[] }).cards || []).map((card) =>
        createTask({
          ...card,
          title: card.title || (card as { name?: string }).name,
          status: normalizeStatus(card.status as string),
          priority: normalizePriority(card.priority as string),
        }),
      );
    } else if (Array.isArray((parsed as { tasks?: unknown[] }).tasks)) {
      imported = ((parsed as { tasks?: Partial<Task>[] }).tasks || []).map((task) => createTask(task));
    } else if (
      Array.isArray((parsed as { backlog?: TaskLike[] }).backlog) ||
      Array.isArray((parsed as { sprintlog?: TaskLike[] }).sprintlog) ||
      Array.isArray((parsed as { sprintLog?: TaskLike[] }).sprintLog)
    ) {
      const backlogTasks = mapTaskLikeArray((parsed as { backlog?: TaskLike[] }).backlog, 'backlog');
      const sprintTasks = mapTaskLikeArray(
        (parsed as { sprintlog?: TaskLike[]; sprintLog?: TaskLike[] }).sprintlog ??
          (parsed as { sprintlog?: TaskLike[]; sprintLog?: TaskLike[] }).sprintLog,
        'todo',
      );
      imported = [...backlogTasks, ...sprintTasks];
    }
  }

  if (extension === 'csv') {
    const rows = csvToRows(content);
    const [header, ...body] = rows;
    const map = new Map((header || []).map((key, index) => [key.toLowerCase(), index]));

    imported = body.map((row) => {
      const labels = row[map.get('labels') ?? -1] || 'general,medium';
      const [category = 'general', priority = 'medium'] = labels.split(',').map((cell) => cell.trim());

      return createTask({
        title: row[map.get('name') ?? -1] || 'Nueva tarea',
        description: row[map.get('description') ?? -1] || '',
        status: normalizeStatus(row[map.get('list') ?? -1]),
        category,
        priority: normalizePriority(priority),
        estimated: '1h',
      });
    });
  }

  if (extension === 'txt' || extension === 'toon') {
    try {
      const parsed = JSON.parse(content) as
        | Task[]
        | {
            cards?: Partial<Task>[];
            tasks?: Partial<Task>[];
            backlog?: TaskLike[];
            sprintlog?: TaskLike[];
            sprintLog?: TaskLike[];
          };

      if (Array.isArray(parsed)) {
        imported = parsed.map((item) => createTask(item));
      } else if (Array.isArray(parsed.cards)) {
        imported = parsed.cards.map((item) => createTask(item));
      } else if (Array.isArray(parsed.tasks)) {
        imported = parsed.tasks.map((item) => createTask(item));
      } else if (Array.isArray(parsed.backlog) || Array.isArray(parsed.sprintlog) || Array.isArray(parsed.sprintLog)) {
        imported = [
          ...mapTaskLikeArray(parsed.backlog, 'backlog'),
          ...mapTaskLikeArray(parsed.sprintlog ?? parsed.sprintLog, 'todo'),
        ];
      }
    } catch {
      imported = textToTasks(content);
    }
  }

  return imported;
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

const inferSmartFromTasks = (tasks: Task[]): SmartMetrics => {
  if (tasks.length === 0) {
    return { specific: 0, measurable: 0, achievable: 0, relevant: 0, timeBound: 0, coverage: 0 };
  }

  const specific = tasks.filter((task) => task.title.trim().length > 0 && task.description.trim().length > 10).length;
  const measurable = tasks.filter((task) => /\d/.test(task.estimated) || /kpi|metric|medir|indicador/i.test(task.description)).length;
  const achievable = tasks.filter((task) => task.priority !== 'high' || /mvp|fase|incremental/i.test(task.description)).length;
  const relevant = tasks.filter((task) => task.category.trim().length > 0).length;
  const timeBound = tasks.filter((task) => /\d/.test(task.estimated) || /semana|sprint|fecha|dia/i.test(task.description)).length;

  const completion = specific + measurable + achievable + relevant + timeBound;
  const coverage = Math.round((completion / (tasks.length * 5)) * 100);

  return {
    specific: Math.round((specific / tasks.length) * 100),
    measurable: Math.round((measurable / tasks.length) * 100),
    achievable: Math.round((achievable / tasks.length) * 100),
    relevant: Math.round((relevant / tasks.length) * 100),
    timeBound: Math.round((timeBound / tasks.length) * 100),
    coverage,
  };
};

export const buildPlanningAnalysis = (tasks: Task[]): PlanningAnalysis => {
  const smart = inferSmartFromTasks(tasks);
  const foda = inferFodaFromTasks(tasks);

  const suggestions = [
    'Asegurar que cada tarea tenga criterio de aceptacion medible.',
    'Separar backlog estrategico de sprint log operativo.',
    'Agregar dependencia y riesgo por tarea de alta prioridad.',
  ];

  const summary =
    tasks.length === 0
      ? 'No hay tareas para analizar.'
      : `Analisis generado sobre ${tasks.length} tareas. SMART ${smart.coverage}% de cobertura estimada.`;

  return { summary, smart, foda, suggestions };
};

export const mergePlanningAnalysis = (
  inferred: PlanningAnalysis,
  metrics?: { smart?: Partial<SmartMetrics>; foda?: Partial<FodaMetrics>; summary?: string; suggestions?: string[] },
): PlanningAnalysis => ({
  ...inferred,
  summary: metrics?.summary || inferred.summary,
  smart: {
    ...inferred.smart,
    ...metrics?.smart,
  },
  foda: {
    fortalezas: metrics?.foda?.fortalezas || inferred.foda.fortalezas,
    oportunidades: metrics?.foda?.oportunidades || inferred.foda.oportunidades,
    debilidades: metrics?.foda?.debilidades || inferred.foda.debilidades,
    amenazas: metrics?.foda?.amenazas || inferred.foda.amenazas,
  },
  suggestions: metrics?.suggestions || inferred.suggestions,
});

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
    ['Name', 'Description', 'List', 'Labels'],
    ...tasks.map((task) => [
      task.title,
      `${task.description}${task.notes ? ` | Notas: ${task.notes}` : ''} | Estimado: ${task.estimated}`,
      task.status,
      `${task.category},${task.priority}`,
    ]),
  ];

  return rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
};

export const buildKanbanExportJson = (tasks: Task[]) => ({
  board: { name: 'Kanban General', exportedAt: new Date().toISOString() },
  lists: COLUMNS,
  cards: tasks,
});
