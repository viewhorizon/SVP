import { Router } from 'express';
import { validateBody } from '../middleware/validate';
import { getSecret } from '../services/secrets';
import { aiPlanningAnalyzeSchema } from '../validation/schemas';

type InputTask = {
  title?: string;
  description?: string;
  category?: string;
  estimated?: string;
  priority?: string;
};

type AnalyzeRequest = {
  tasks?: InputTask[];
  document?: string;
};

type AnalyzeResponse = {
  summary: string;
  smart: {
    specific: number;
    measurable: number;
    achievable: number;
    relevant: number;
    timeBound: number;
    coverage: number;
  };
  foda: {
    fortalezas: string[];
    oportunidades: string[];
    debilidades: string[];
    amenazas: string[];
  };
  suggestions: string[];
  backlog?: InputTask[];
  sprintlog?: InputTask[];
};

const containsNumber = (value: string) => /\d/.test(value);

const normalizeTask = (task: InputTask): Required<InputTask> => ({
  title: String(task.title ?? '').trim(),
  description: String(task.description ?? '').trim(),
  category: String(task.category ?? 'general').trim() || 'general',
  estimated: String(task.estimated ?? '1h').trim() || '1h',
  priority: String(task.priority ?? 'medium').trim().toLowerCase() || 'medium',
});

const inferTasksFromDocument = (document: string): InputTask[] => {
  const lines = document
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => /^(\-|\*|\d+[.)])\s+/.test(line) || line.length > 20)
    .slice(0, 80);

  return lines.map((line, index) => {
    const cleaned = line.replace(/^(\-|\*|\d+[.)])\s+/, '').trim();
    return {
      title: cleaned.slice(0, 120),
      description: cleaned,
      category: index % 2 === 0 ? 'planning' : 'execution',
      estimated: '2h',
      priority: index < 5 ? 'high' : 'medium',
    };
  });
};

const buildLocalAnalysis = (rawTasks: InputTask[]): AnalyzeResponse => {
  const normalized = rawTasks.map(normalizeTask).filter((task) => task.title.length > 0);

  if (normalized.length === 0) {
    return {
      summary: 'No hay tareas para analizar.',
      smart: { specific: 0, measurable: 0, achievable: 0, relevant: 0, timeBound: 0, coverage: 0 },
      foda: { fortalezas: [], oportunidades: [], debilidades: [], amenazas: [] },
      suggestions: ['Agrega tareas para poder generar analisis.'],
      backlog: [],
      sprintlog: [],
    };
  }

  const specificCount = normalized.filter((task) => task.title && task.description.length > 10).length;
  const measurableCount = normalized.filter((task) => containsNumber(task.estimated)).length;
  const achievableCount = normalized.filter((task) => task.priority !== 'high').length;
  const relevantCount = normalized.filter((task) => task.category.length > 0).length;
  const timeBoundCount = normalized.filter((task) => containsNumber(task.estimated)).length;

  const coverage = Math.round(
    ((specificCount + measurableCount + achievableCount + relevantCount + timeBoundCount) / (normalized.length * 5)) * 100,
  );

  const foda = {
    fortalezas: [] as string[],
    oportunidades: [] as string[],
    debilidades: [] as string[],
    amenazas: [] as string[],
  };

  normalized.forEach((task) => {
    const source = `${task.title} ${task.description} ${task.category}`.toLowerCase();
    if (/fortaleza|strength/.test(source)) foda.fortalezas.push(task.title);
    if (/oportunidad|opportunity/.test(source)) foda.oportunidades.push(task.title);
    if (/debilidad|weakness/.test(source)) foda.debilidades.push(task.title);
    if (/amenaza|threat/.test(source)) foda.amenazas.push(task.title);
  });

  return {
    summary: `Analisis generado sobre ${normalized.length} tareas.`,
    smart: {
      specific: Math.round((specificCount / normalized.length) * 100),
      measurable: Math.round((measurableCount / normalized.length) * 100),
      achievable: Math.round((achievableCount / normalized.length) * 100),
      relevant: Math.round((relevantCount / normalized.length) * 100),
      timeBound: Math.round((timeBoundCount / normalized.length) * 100),
      coverage,
    },
    foda,
    suggestions: [
      'Asegurar criterio de aceptacion medible por tarea.',
      'Separar backlog estrategico de sprint log operativo.',
      'Marcar riesgos y dependencias en tareas de alta prioridad.',
    ],
    backlog: normalized.slice(0, Math.ceil(normalized.length * 0.6)),
    sprintlog: normalized.slice(Math.ceil(normalized.length * 0.6)),
  };
};

const parseJsonFromModel = (text: string): AnalyzeResponse | null => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i);
  const payload = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(payload) as AnalyzeResponse;
  } catch {
    return null;
  }
};

async function runOpenAiCompatibleAnalysis(tasks: InputTask[], document?: string): Promise<AnalyzeResponse | null> {
  const apiKey = getSecret('PLANNING_AI_API_KEY');
  const model = getSecret('PLANNING_AI_MODEL');
  const baseUrl = getSecret('PLANNING_AI_BASE_URL');

  if (!apiKey || !model || !baseUrl) return null;

  const prompt = [
    'Eres un analista de proyectos. Devuelve SOLO JSON valido.',
    'Campos requeridos: summary, smart, foda, suggestions, backlog, sprintlog.',
    'smart tiene: specific, measurable, achievable, relevant, timeBound, coverage (0-100).',
    'foda tiene arrays: fortalezas, oportunidades, debilidades, amenazas.',
    'backlog y sprintlog son arrays de tareas con title, description, category, estimated, priority.',
    'prioridad permitida: high|medium|low.',
  ].join(' ');

  const userInput = JSON.stringify({ tasks, document: document ?? '' });

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: userInput },
      ],
    }),
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return null;
  return parseJsonFromModel(content);
}

export function createAiPlanningRouter() {
  const router = Router();

  router.post('/ai/planning/analyze', validateBody(aiPlanningAnalyzeSchema), async (_req, res) => {
    const body = (res.locals.validatedBody ?? {}) as AnalyzeRequest;
    const document = String(body.document ?? '').trim();
    const bodyTasks = Array.isArray(body.tasks) ? body.tasks : [];
    const inferredTasks = bodyTasks.length > 0 ? bodyTasks : inferTasksFromDocument(document);

    const mode = (process.env.PLANNING_AI_MODE ?? 'local').toLowerCase();

    if (mode === 'openai_compatible') {
      try {
        const remote = await runOpenAiCompatibleAnalysis(inferredTasks, document);
        if (remote) return res.json(remote);
      } catch {
        // Fallback below to local deterministic analysis.
      }
    }

    return res.json(buildLocalAnalysis(inferredTasks));
  });

  return router;
}