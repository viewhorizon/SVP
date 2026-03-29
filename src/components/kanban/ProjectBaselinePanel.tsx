import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ProjectBaselinePanelProps {
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
}

const formatElapsed = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export function ProjectBaselinePanel({
  elapsedMs,
  isRunning,
  totalEstimatedHours,
  doneEstimatedHours,
  weeklyTargetHours,
  tasksDone,
  tasksTotal,
  onStart,
  onPause,
  onReset,
}: ProjectBaselinePanelProps) {
  const completion = tasksTotal === 0 ? 0 : Math.round((tasksDone / tasksTotal) * 100);
  const effortCompletion = totalEstimatedHours === 0 ? 0 : Math.round((doneEstimatedHours / totalEstimatedHours) * 100);
  const actualTrackedHours = elapsedMs / 3600000;
  const baselineTracked = actualTrackedHours > 0.01;
  const deviationPercent = weeklyTargetHours > 0 && baselineTracked ? Math.round(((actualTrackedHours - weeklyTargetHours) / weeklyTargetHours) * 100) : 0;
  const targetCompletion = weeklyTargetHours > 0 ? Math.min(100, Math.round((actualTrackedHours / weeklyTargetHours) * 100)) : 0;
  const targetOverrun = weeklyTargetHours > 0 ? Math.max(0, Math.round((actualTrackedHours / weeklyTargetHours) * 100) - 100) : 0;
  const deviationTone = deviationPercent > 20 ? "text-red-300" : deviationPercent > 10 ? "text-amber-300" : "text-emerald-300";
  const deviationLabel = `${deviationPercent >= 0 ? "+" : ""}${deviationPercent}%`;
  const baselineLineData = [
    { checkpoint: "Inicio", objetivo: 0, real: 0 },
    { checkpoint: "Mitad", objetivo: Number((weeklyTargetHours / 2).toFixed(2)), real: Number((actualTrackedHours / 2).toFixed(2)) },
    { checkpoint: "Cierre", objetivo: Number(weeklyTargetHours.toFixed(2)), real: Number(actualTrackedHours.toFixed(2)) },
  ];

  return (
    <section className="metrics-neon-panel mb-3 rounded-xl border border-cyan-400/30 bg-slate-950/80 p-3 text-slate-100 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-cyan-200">Cronometro y baseline</h3>
          <p className="text-xs text-slate-300">Seguimiento operativo del sprint y desvio de estimaciones.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-2 py-1 text-xs font-semibold text-cyan-200">
            <Timer size={14} />
            {formatElapsed(elapsedMs)}
          </span>
          {isRunning ? (
            <button type="button" onClick={onPause} className="rounded-lg border border-violet-400/40 bg-violet-500/10 px-2 py-1 text-xs font-semibold text-violet-100">
              <Pause size={14} className="inline-block" /> Pausar
            </button>
          ) : (
            <button type="button" onClick={onStart} className="rounded-lg bg-cyan-400/90 px-2 py-1 text-xs font-semibold text-slate-950">
              <Play size={14} className="inline-block" /> Iniciar
            </button>
          )}
          <button type="button" onClick={onReset} className="rounded-lg border border-slate-500/60 bg-slate-900/50 px-2 py-1 text-xs font-semibold text-slate-200">
            <RotateCcw size={14} className="inline-block" /> Reiniciar
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-slate-100 md:grid-cols-6">
        <p className="rounded-lg bg-slate-900/60 px-2 py-2">Meta semanal: <span className="font-semibold">{weeklyTargetHours.toFixed(1)}h</span></p>
        <p className="rounded-lg bg-slate-900/60 px-2 py-2">Horas reales: <span className="font-semibold">{actualTrackedHours.toFixed(1)}h</span></p>
        <p className={`rounded-lg bg-slate-900/60 px-2 py-2 ${deviationTone}`}>Desvio baseline: <span className="font-semibold">{deviationLabel}</span></p>
        <p className="rounded-lg bg-slate-900/60 px-2 py-2">Estimado total: <span className="font-semibold">{totalEstimatedHours.toFixed(1)}h</span></p>
        <p className="rounded-lg bg-slate-900/60 px-2 py-2">Estimado completado: <span className="font-semibold">{doneEstimatedHours.toFixed(1)}h</span></p>
        <p className="rounded-lg bg-slate-900/60 px-2 py-2">Avance por tareas: <span className="font-semibold">{completion}%</span></p>
        <p className="rounded-lg bg-slate-900/60 px-2 py-2">Avance por esfuerzo: <span className="font-semibold">{effortCompletion}%</span></p>
      </div>

      <div className="mt-3 grid gap-2 text-xs md:grid-cols-2">
        <div className="rounded-lg bg-slate-900/60 px-2 py-2">
          <p className="mb-1 text-slate-300">Grafico baseline (cumplimiento meta semanal)</p>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${targetCompletion}%` }} />
          </div>
          <p className="mt-1 text-slate-200">{targetCompletion}% de la meta semanal</p>
        </div>
        <div className="rounded-lg bg-slate-900/60 px-2 py-2">
          <p className="mb-1 text-slate-300">Exceso sobre meta (si aplica)</p>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-rose-400 transition-all" style={{ width: `${Math.min(100, targetOverrun)}%` }} />
          </div>
          <p className="mt-1 text-slate-200">{targetOverrun}% sobre la meta</p>
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-slate-900/60 px-2 py-2">
        <p className="mb-2 text-slate-300">Grafico lineal baseline (objetivo vs real)</p>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={baselineLineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="checkpoint" stroke="#cbd5e1" fontSize={11} />
              <YAxis stroke="#cbd5e1" fontSize={11} />
              <Tooltip
                cursor={false}
                wrapperStyle={{ outline: "none" }}
                contentStyle={{ borderRadius: 8, border: "1px solid rgba(56, 189, 248, 0.35)", background: "rgba(2, 6, 23, 0.96)", color: "#e2e8f0" }}
              />
              <Line type="monotone" dataKey="objetivo" stroke="#22d3ee" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 4 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="real" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 4 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {deviationPercent > 20 ? (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
          Alerta: el tiempo real supera en mas de 20% la meta semanal de este sprint.
        </p>
      ) : null}
    </section>
  );
}
