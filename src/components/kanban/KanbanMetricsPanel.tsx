import { useMemo } from "react";
import { Activity, BarChart3, BrainCircuit, Sparkles } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PlanningAnalysis, Task, TaskPriority, TaskStatus } from "../../services/kanbanService";
import { ProjectBaselinePanel } from "./ProjectBaselinePanel";
import { TraceabilityPanel, type TraceabilityEntry } from "./TraceabilityPanel";

interface KanbanMetricsPanelProps {
  analysis: PlanningAnalysis;
  tasks: Task[];
  roadmapLabel: string;
  roadmapProgress: Array<{ id: string; label: string; done: number; total: number }>;
  traces: TraceabilityEntry[];
  baseline: {
    elapsedMs: number;
    isRunning: boolean;
    totalEstimatedHours: number;
    doneEstimatedHours: number;
    weeklyTargetHours: number;
    tasksDone: number;
    tasksTotal: number;
    onStart: () => void;
    onPause: () => void;
    onReset: () => void;
  };
}

const statusLabelMap: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "Por Hacer / Pendiente",
  "in-progress": "En Proceso",
  review: "Revision",
  done: "Completado",
};

const priorityLabelMap: Record<TaskPriority, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

const priorityPalette = ["#fb7185", "#f59e0b", "#22c55e"];

function CleanTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number | string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded border border-cyan-400/40 bg-slate-900/95 px-2 py-1 text-xs text-slate-100 shadow-[0_0_0_1px_rgba(34,211,238,0.15)]">
      {label ? <p className="font-semibold text-cyan-200">{label}</p> : null}
      {payload.map((item, index) => (
        <p key={`${item.name ?? "value"}-${index}`}>
          {item.name ?? "Valor"}: {String(item.value ?? 0)}
        </p>
      ))}
    </div>
  );
}

export function KanbanMetricsPanel({ analysis, tasks, roadmapLabel, roadmapProgress, traces, baseline }: KanbanMetricsPanelProps) {
  const statusData = useMemo(() => {
    const seed: TaskStatus[] = ["backlog", "todo", "in-progress", "review", "done"];
    return seed.map((status) => ({
      name: statusLabelMap[status],
      total: tasks.filter((task) => task.status === status).length,
    }));
  }, [tasks]);

  const priorityData = useMemo(() => {
    const seed: TaskPriority[] = ["high", "medium", "low"];
    return seed.map((priority) => ({
      name: priorityLabelMap[priority],
      value: tasks.filter((task) => task.priority === priority).length,
    }));
  }, [tasks]);

  const smartData = [
    { metric: "Specific", value: analysis.smart.specific },
    { metric: "Measurable", value: analysis.smart.measurable },
    { metric: "Achievable", value: analysis.smart.achievable },
    { metric: "Relevant", value: analysis.smart.relevant },
    { metric: "TimeBound", value: analysis.smart.timeBound },
  ];

  return (
    <div className="space-y-4">
      <ProjectBaselinePanel
        elapsedMs={baseline.elapsedMs}
        isRunning={baseline.isRunning}
        totalEstimatedHours={baseline.totalEstimatedHours}
        doneEstimatedHours={baseline.doneEstimatedHours}
        weeklyTargetHours={baseline.weeklyTargetHours}
        tasksDone={baseline.tasksDone}
        tasksTotal={baseline.tasksTotal}
        onStart={baseline.onStart}
        onPause={baseline.onPause}
        onReset={baseline.onReset}
      />

      <section className="metrics-neon-panel rounded-xl border border-cyan-400/30 bg-slate-950/80 p-4 text-slate-100 backdrop-blur">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="inline-flex items-center gap-2 text-sm font-bold text-cyan-200">
            <Activity size={16} />
            Estado del sprint visible: {roadmapLabel}
          </h3>
          <p className="text-xs text-slate-300">Backlog y sprints siempre visibles, con opacidad cuando estan cerrados.</p>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {roadmapProgress.map((page) => {
            const ratio = page.total > 0 ? Math.round((page.done / page.total) * 100) : 0;
            const completed = page.total > 0 && page.done >= page.total;
            return (
              <div key={page.id} className={`rounded-lg border px-3 py-2 text-xs ${completed ? "border-emerald-400/40 bg-emerald-500/10 opacity-75" : "border-slate-700 bg-slate-900/60"}`}>
                <p className="font-semibold text-slate-100">{page.label}</p>
                <p className="mt-1 text-slate-300">{page.done}/{page.total} completadas ({ratio}%)</p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="metrics-neon-panel rounded-xl border border-cyan-400/30 bg-slate-950/80 p-4 text-slate-100 backdrop-blur">
          <h3 className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-cyan-200">
            <BarChart3 size={16} />
            Distribucion por estado
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#cbd5e1" fontSize={11} />
                <YAxis stroke="#cbd5e1" fontSize={11} />
                <Tooltip cursor={{ fill: "rgba(34, 211, 238, 0.08)" }} content={<CleanTooltip />} />
                <Bar dataKey="total" fill="#22d3ee" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="metrics-neon-panel rounded-xl border border-violet-400/30 bg-slate-950/80 p-4 text-slate-100 backdrop-blur">
          <h3 className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-violet-200">
            <Sparkles size={16} />
            Prioridades
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart accessibilityLayer={false} tabIndex={-1}>
                <Pie
                  data={priorityData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={80}
                  labelLine={false}
                  stroke="none"
                  isAnimationActive={false}
                  label={({ name, percent }) => `${name} ${(((percent ?? 0) as number) * 100).toFixed(0)}%`}
                >
                  {priorityData.map((_, index) => (
                    <Cell key={`priority-cell-${index}`} fill={priorityPalette[index % priorityPalette.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip cursor={false} wrapperStyle={{ outline: "none" }} content={<CleanTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="metrics-neon-panel rounded-xl border border-fuchsia-400/30 bg-slate-950/80 p-4 text-slate-100 backdrop-blur">
          <h3 className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-fuchsia-200">
            <BrainCircuit size={16} />
            SMART radar
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={smartData} accessibilityLayer={false} tabIndex={-1}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "#cbd5e1", fontSize: 11 }} />
                <Radar dataKey="value" stroke="#f472b6" fill="#f472b6" fillOpacity={0.3} isAnimationActive={false} />
                <Tooltip cursor={false} wrapperStyle={{ outline: "none" }} content={<CleanTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="metrics-neon-panel rounded-xl border border-cyan-400/30 bg-slate-950/80 p-4 text-slate-100 backdrop-blur">
        <h3 className="text-sm font-bold text-cyan-200">FODA</h3>
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
          <p className="rounded-lg bg-slate-900/60 px-3 py-2">Fortalezas: <span className="font-semibold">{analysis.foda.fortalezas.length}</span></p>
          <p className="rounded-lg bg-slate-900/60 px-3 py-2">Oportunidades: <span className="font-semibold">{analysis.foda.oportunidades.length}</span></p>
          <p className="rounded-lg bg-slate-900/60 px-3 py-2">Debilidades: <span className="font-semibold">{analysis.foda.debilidades.length}</span></p>
          <p className="rounded-lg bg-slate-900/60 px-3 py-2">Amenazas: <span className="font-semibold">{analysis.foda.amenazas.length}</span></p>
        </div>
      </section>

      <section className="metrics-neon-panel rounded-xl border border-cyan-400/30 bg-slate-950/80 p-4 text-slate-100 backdrop-blur">
        <h3 className="text-sm font-bold text-cyan-200">Resumen y sugerencias</h3>
        <p className="mt-2 text-sm text-slate-200">{analysis.summary}</p>
        {analysis.suggestions.length > 0 ? (
          <ul className="mt-2 list-disc pl-5 text-sm text-slate-200">
            {analysis.suggestions.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <TraceabilityPanel entries={traces} />
    </div>
  );
}