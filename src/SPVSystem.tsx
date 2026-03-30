import { Activity, Coins, History, Vote, AlertCircle, Zap, BarChart3 } from "lucide-react";
import { useState } from "react";
import { useSpv } from "./hooks/useSpv";
import { DeadLetterPanel } from "./components/Sprint3/DeadLetterPanel";
import { AlertsPanel } from "./components/Sprint3/AlertsPanel";
import { LoadTestPanel } from "./components/Sprint3/LoadTestPanel";
import { ReconciliationPanel } from "./components/Sprint3/ReconciliationPanel";

export default function SPVSystem() {
  const [activeTab, setActiveTab] = useState<"activities" | "points" | "history" | "sprint3">("activities");
  const { actions, constants, state } = useSpv();
  const {
    amount,
    groupedActivities,
    healthLabel,
    healthState,
    history,
    lastRequestId,
    message,
    pointsAvailable,
    receiver,
    todayVotesUsed,
    totalPointsAccumulated,
  } = state;

  return (
    <section className="mx-auto max-w-7xl px-4 py-6">
      <h2 className="text-2xl font-bold text-slate-900">Sistema de Votos y Puntos</h2>
      <p className="text-sm text-slate-600">SPV conectado para integracion con inventario</p>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="inline-flex items-center gap-2 text-sm text-slate-500"><Vote size={16} /> Votos de hoy</p><p className="text-2xl font-bold">{todayVotesUsed}<span className="text-base text-slate-500"> / {constants.MAX_DAILY_VOTES}</span></p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="inline-flex items-center gap-2 text-sm text-slate-500"><Coins size={16} /> Puntos disponibles</p><p className="text-2xl font-bold">{pointsAvailable}<span className="text-base text-slate-500"> / {constants.MAX_AVAILABLE_POINTS}</span></p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="inline-flex items-center gap-2 text-sm text-slate-500"><History size={16} /> Puntos historicos</p><p className="text-2xl font-bold">{totalPointsAccumulated.toLocaleString("es-ES")}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="inline-flex items-center gap-2 text-sm text-slate-500"><Activity size={16} /> Health API</p>
          <p className={`text-sm font-semibold ${healthState === "online" ? "text-emerald-600" : healthState === "offline" ? "text-rose-600" : "text-amber-600"}`}>{healthLabel}</p>
          <button type="button" onClick={() => void actions.runHealthCheck()} className="mt-2 rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700">Revisar</button>
        </div>
      </div>

      <div className="mt-4 inline-flex rounded-full border border-slate-300 bg-white p-1 text-sm overflow-x-auto">
        <button type="button" onClick={() => setActiveTab("activities")} className={`rounded-full px-3 py-1 whitespace-nowrap ${activeTab === "activities" ? "bg-blue-600 text-white" : "text-slate-600"}`}>Actividades</button>
        <button type="button" onClick={() => setActiveTab("points")} className={`rounded-full px-3 py-1 whitespace-nowrap ${activeTab === "points" ? "bg-blue-600 text-white" : "text-slate-600"}`}>Puntos</button>
        <button type="button" onClick={() => setActiveTab("history")} className={`rounded-full px-3 py-1 whitespace-nowrap ${activeTab === "history" ? "bg-blue-600 text-white" : "text-slate-600"}`}>Historial</button>
        <button type="button" onClick={() => setActiveTab("sprint3")} className={`rounded-full px-3 py-1 whitespace-nowrap inline-flex items-center gap-1 ${activeTab === "sprint3" ? "bg-blue-600 text-white" : "text-slate-600"}`}>
          <Zap size={14} /> Sprint 3
        </button>
      </div>

      {activeTab === "activities" ? (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[...groupedActivities.global, ...groupedActivities.local].map((activity) => (
            <article key={activity.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs uppercase text-slate-500">{activity.type}</p>
              <h3 className="text-xl font-bold text-slate-900">{activity.name}</h3>
              <p className="mt-1 text-sm text-slate-600">{activity.context}</p>
              <p className="mt-3 text-sm text-slate-700">Ratio: {activity.pointsPerHour.toFixed(2)} pts/hora</p>
              <p className="text-sm text-slate-700">Votos: {activity.votes.toLocaleString("es-ES")}</p>
              <button type="button" onClick={() => void actions.handleVote(activity.id)} className="mt-3 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Votar</button>
            </article>
          ))}
        </div>
      ) : null}

      {activeTab === "points" ? (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-bold">Transferir puntos</h3>
            <input value={receiver} onChange={(event) => actions.setReceiver(event.target.value)} placeholder="@usuario" className="mt-3 w-full rounded-full border border-slate-300 px-4 py-2 text-sm" />
            <input type="number" min={1} value={amount} onChange={(event) => actions.setAmount(Number(event.target.value))} className="mt-2 w-32 rounded-full border border-slate-300 px-4 py-2 text-sm" />
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => void actions.handleTransfer()} className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Transferir</button>
              <button type="button" onClick={() => void actions.handleReceive()} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Recibir</button>
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
            <p>Saldo actual: {pointsAvailable} pts</p>
            <p>Historico: {totalPointsAccumulated.toLocaleString("es-ES")} pts</p>
          </section>
        </div>
      ) : null}

      {activeTab === "history" ? (
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-bold text-slate-900">Historial reciente</h3>
          <div className="mt-3 space-y-2">
            {history.map((entry) => (
              <p key={entry.id} className="flex items-center justify-between text-sm">
                <span>{entry.text}</span>
                <span className="text-slate-500">{entry.createdAt}</span>
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "sprint3" ? (
        <section className="mt-5 space-y-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-amber-900">
              <AlertCircle size={18} /> Sprint 3: Operaciones avanzadas
            </p>
            <p className="mt-2 text-sm text-amber-800">
              Herramientas para gestionar colas de repetición, alertas operativas, pruebas de carga y conciliación contable.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <DeadLetterPanel />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <AlertsPanel />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
              <LoadTestPanel />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
              <ReconciliationPanel />
            </div>
          </div>
        </section>
      ) : null}

      {message && activeTab !== "sprint3" ? <p className="mt-4 text-sm font-medium text-blue-700">{message}</p> : null}
      {lastRequestId && activeTab !== "sprint3" ? <p className="mt-1 text-xs text-slate-500">Request ID: {lastRequestId}</p> : null}
    </section>
  );
}
