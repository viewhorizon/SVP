import { Activity, Coins, History, Vote, Settings, Play, Pause, RotateCcw, Send, Download, Users, TrendingUp, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useSpv } from "./hooks/useSpv";
import { DeadLetterPanel } from "./components/Sprint3/DeadLetterPanel";
import { AlertsPanel } from "./components/Sprint3/AlertsPanel";
import { LoadTestPanel } from "./components/Sprint3/LoadTestPanel";
import { ReconciliationPanel } from "./components/Sprint3/ReconciliationPanel";

type TabId = "activities" | "points" | "history" | "operations";

interface SimulationEvent {
  id: string;
  type: "vote" | "transfer" | "credit" | "integration";
  description: string;
  timestamp: string;
  status: "success" | "pending" | "error";
  details?: string;
}

export default function SPVSystem() {
  const [activeTab, setActiveTab] = useState<TabId>("activities");
  const [simulationMode, setSimulationMode] = useState(false);
  const [simulationEvents, setSimulationEvents] = useState<SimulationEvent[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<string>("inventory");
  
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

  const addSimulationEvent = (event: Omit<SimulationEvent, "id" | "timestamp">) => {
    const newEvent: SimulationEvent = {
      ...event,
      id: `evt-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString("es-ES"),
    };
    setSimulationEvents((prev) => [newEvent, ...prev].slice(0, 50));
  };

  const handleVoteWithSimulation = async (activityId: string) => {
    if (simulationMode) {
      addSimulationEvent({
        type: "vote",
        description: `Voto simulado en actividad ${activityId}`,
        status: "success",
        details: "Puntos otorgados: +10",
      });
    }
    await actions.handleVote(activityId);
  };

  const handleTransferWithSimulation = async () => {
    if (simulationMode) {
      addSimulationEvent({
        type: "transfer",
        description: `Transferencia simulada de ${amount} pts a ${receiver}`,
        status: "pending",
        details: "Procesando en ledger...",
      });
    }
    await actions.handleTransfer();
    if (simulationMode) {
      setTimeout(() => {
        addSimulationEvent({
          type: "transfer",
          description: `Transferencia completada: ${amount} pts a ${receiver}`,
          status: "success",
        });
      }, 500);
    }
  };

  const simulateExternalEvent = () => {
    const eventTypes = [
      { type: "integration" as const, desc: "Evento de inventario recibido", details: "SKU-12345 actualizado" },
      { type: "credit" as const, desc: "Puntos acreditados por compra", details: "+50 pts por pedido #9821" },
      { type: "integration" as const, desc: "Sincronizacion con app externa", details: "150 registros procesados" },
    ];
    const randomEvent = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    addSimulationEvent({ ...randomEvent, status: "success" });
  };

  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode; description: string }> = [
    { id: "activities", label: "Actividades", icon: <Vote size={16} />, description: "Votar y gestionar actividades" },
    { id: "points", label: "Puntos", icon: <Coins size={16} />, description: "Transferir y recibir puntos" },
    { id: "history", label: "Historial", icon: <History size={16} />, description: "Ver transacciones y eventos" },
    { id: "operations", label: "Operaciones", icon: <Settings size={16} />, description: "Herramientas y monitoreo" },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-6">
      {/* Header con modo simulacion */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Sistema de Votos y Puntos</h2>
          <p className="text-sm text-slate-600">MVP conectado para integracion con aplicaciones externas</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`rounded-full px-3 py-1.5 text-xs font-semibold ${simulationMode ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
            {simulationMode ? "Modo Simulacion Activo" : "Modo Normal"}
          </div>
          <button
            type="button"
            onClick={() => setSimulationMode(!simulationMode)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              simulationMode 
                ? "bg-amber-600 text-white hover:bg-amber-700" 
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {simulationMode ? <Pause size={16} /> : <Play size={16} />}
            {simulationMode ? "Detener" : "Iniciar Simulacion"}
          </button>
        </div>
      </div>

      {/* Metricas principales */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="inline-flex items-center gap-2 text-sm text-slate-500"><Vote size={16} /> Votos de hoy</p>
          <p className="text-2xl font-bold">{todayVotesUsed}<span className="text-base text-slate-500"> / {constants.MAX_DAILY_VOTES}</span></p>
          <div className="mt-2 h-1.5 rounded-full bg-slate-100">
            <div className="h-1.5 rounded-full bg-blue-600 transition-all" style={{ width: `${(todayVotesUsed / constants.MAX_DAILY_VOTES) * 100}%` }} />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="inline-flex items-center gap-2 text-sm text-slate-500"><Coins size={16} /> Puntos disponibles</p>
          <p className="text-2xl font-bold">{pointsAvailable}<span className="text-base text-slate-500"> / {constants.MAX_AVAILABLE_POINTS}</span></p>
          <div className="mt-2 h-1.5 rounded-full bg-slate-100">
            <div className="h-1.5 rounded-full bg-emerald-600 transition-all" style={{ width: `${Math.min((pointsAvailable / constants.MAX_AVAILABLE_POINTS) * 100, 100)}%` }} />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="inline-flex items-center gap-2 text-sm text-slate-500"><TrendingUp size={16} /> Puntos historicos</p>
          <p className="text-2xl font-bold">{totalPointsAccumulated.toLocaleString("es-ES")}</p>
          <p className="mt-2 text-xs text-slate-500">Total acumulado en el sistema</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="inline-flex items-center gap-2 text-sm text-slate-500"><Activity size={16} /> Health API</p>
          <p className={`text-sm font-semibold ${healthState === "online" ? "text-emerald-600" : healthState === "offline" ? "text-rose-600" : "text-amber-600"}`}>
            {healthState === "online" ? <CheckCircle2 size={14} className="mr-1 inline" /> : healthState === "offline" ? <XCircle size={14} className="mr-1 inline" /> : <Clock size={14} className="mr-1 inline" />}
            {healthLabel}
          </p>
          <button type="button" onClick={() => void actions.runHealthCheck()} className="mt-2 rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            Verificar
          </button>
        </div>
      </div>

      {/* Tabs de navegacion */}
      <div className="mt-6 border-b border-slate-200">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Panel de eventos de simulacion (visible cuando modo simulacion activo) */}
      {simulationMode && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center justify-between">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-amber-900">
              <Activity size={16} /> Eventos de Simulacion en Tiempo Real
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={simulateExternalEvent}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
              >
                <Send size={14} /> Simular Evento Externo
              </button>
              <button
                type="button"
                onClick={() => setSimulationEvents([])}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
              >
                <RotateCcw size={14} /> Limpiar
              </button>
            </div>
          </div>
          <div className="mt-3 max-h-32 space-y-1 overflow-y-auto">
            {simulationEvents.length === 0 ? (
              <p className="text-sm text-amber-700">No hay eventos. Realiza acciones en cualquier pestana para ver los eventos simulados.</p>
            ) : (
              simulationEvents.map((evt) => (
                <div key={evt.id} className="flex items-center gap-2 rounded-lg bg-white/50 px-3 py-1.5 text-xs">
                  <span className={`inline-block h-2 w-2 rounded-full ${evt.status === "success" ? "bg-emerald-500" : evt.status === "error" ? "bg-rose-500" : "bg-amber-500"}`} />
                  <span className="text-slate-500">{evt.timestamp}</span>
                  <span className="font-medium text-slate-700">{evt.description}</span>
                  {evt.details && <span className="text-slate-500">- {evt.details}</span>}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Contenido de pestana: Actividades */}
      {activeTab === "activities" && (
        <div className="mt-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">Actividades Disponibles</h3>
            <p className="text-sm text-slate-500">{[...groupedActivities.global, ...groupedActivities.local].length} actividades</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[...groupedActivities.global, ...groupedActivities.local].map((activity) => (
              <article key={activity.id} className="group rounded-2xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${activity.type === "global" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                    {activity.type}
                  </span>
                  <span className="text-xs text-slate-400">ID: {activity.id}</span>
                </div>
                <h4 className="mt-2 text-lg font-bold text-slate-900">{activity.name}</h4>
                <p className="mt-1 text-sm text-slate-600">{activity.context}</p>
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <span className="inline-flex items-center gap-1 text-slate-700">
                    <TrendingUp size={14} /> {activity.pointsPerHour.toFixed(2)} pts/h
                  </span>
                  <span className="inline-flex items-center gap-1 text-slate-700">
                    <Users size={14} /> {activity.votes.toLocaleString("es-ES")} votos
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleVoteWithSimulation(activity.id)}
                  disabled={todayVotesUsed >= constants.MAX_DAILY_VOTES}
                  className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {todayVotesUsed >= constants.MAX_DAILY_VOTES ? "Sin votos disponibles" : "Votar"}
                </button>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* Contenido de pestana: Puntos */}
      {activeTab === "points" && (
        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-bold text-slate-900">Transferir Puntos</h3>
            <p className="mt-1 text-sm text-slate-500">Envia puntos a otro usuario del sistema</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">Destinatario</label>
                <input
                  value={receiver}
                  onChange={(event) => actions.setReceiver(event.target.value)}
                  placeholder="@usuario o ID"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Cantidad</label>
                <input
                  type="number"
                  min={1}
                  max={pointsAvailable}
                  value={amount}
                  onChange={(event) => actions.setAmount(Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => void handleTransferWithSimulation()}
                  disabled={!receiver || amount <= 0 || amount > pointsAvailable}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Send size={16} className="mr-2 inline" /> Transferir
                </button>
                <button
                  type="button"
                  onClick={() => void actions.handleReceive()}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Download size={16} className="mr-2 inline" /> Recibir
                </button>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-lg font-bold text-slate-900">Resumen de Balance</h3>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-3">
                  <span className="text-sm text-emerald-700">Saldo disponible</span>
                  <span className="text-xl font-bold text-emerald-700">{pointsAvailable} pts</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                  <span className="text-sm text-slate-600">Total historico</span>
                  <span className="text-xl font-bold text-slate-700">{totalPointsAccumulated.toLocaleString("es-ES")} pts</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-blue-50 p-3">
                  <span className="text-sm text-blue-700">Votos restantes hoy</span>
                  <span className="text-xl font-bold text-blue-700">{constants.MAX_DAILY_VOTES - todayVotesUsed}</span>
                </div>
              </div>
            </div>

            {simulationMode && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">Integracion Externa</p>
                <p className="mt-1 text-xs text-amber-700">Selecciona una app para simular eventos de puntos</p>
                <select
                  value={selectedIntegration}
                  onChange={(e) => setSelectedIntegration(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="inventory">Sistema de Inventario</option>
                  <option value="ecommerce">E-commerce</option>
                  <option value="crm">CRM</option>
                  <option value="custom">App Personalizada</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    addSimulationEvent({
                      type: "integration",
                      description: `Evento de ${selectedIntegration} recibido`,
                      status: "success",
                      details: "Puntos sincronizados correctamente",
                    });
                  }}
                  className="mt-2 w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  Simular Evento de {selectedIntegration}
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Contenido de pestana: Historial */}
      {activeTab === "history" && (
        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">Historial de Transacciones</h3>
            <div className="flex gap-2">
              <button type="button" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                Exportar CSV
              </button>
              <button type="button" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                Filtrar
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="grid grid-cols-12 gap-4 text-xs font-medium uppercase text-slate-500">
                <span className="col-span-1">Estado</span>
                <span className="col-span-5">Descripcion</span>
                <span className="col-span-2">Tipo</span>
                <span className="col-span-2">Monto</span>
                <span className="col-span-2">Fecha</span>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {history.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500">
                  No hay transacciones registradas. Realiza votos o transferencias para ver el historial.
                </div>
              ) : (
                history.map((entry) => (
                  <div key={entry.id} className="grid grid-cols-12 items-center gap-4 px-4 py-3 text-sm hover:bg-slate-50">
                    <span className="col-span-1">
                      <CheckCircle2 size={16} className="text-emerald-500" />
                    </span>
                    <span className="col-span-5 text-slate-700">{entry.text}</span>
                    <span className="col-span-2">
                      <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {entry.text.includes("voto") ? "Voto" : entry.text.includes("transf") ? "Transferencia" : "Credito"}
                      </span>
                    </span>
                    <span className="col-span-2 font-medium text-slate-700">
                      {entry.text.match(/\d+/)?.[0] || "-"} pts
                    </span>
                    <span className="col-span-2 text-slate-500">{entry.createdAt}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {simulationMode && simulationEvents.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <h4 className="text-sm font-semibold text-amber-900">Eventos Simulados</h4>
              <div className="mt-2 space-y-1">
                {simulationEvents.slice(0, 5).map((evt) => (
                  <div key={evt.id} className="flex items-center gap-2 text-xs text-amber-800">
                    <span className={`h-1.5 w-1.5 rounded-full ${evt.status === "success" ? "bg-emerald-500" : "bg-amber-500"}`} />
                    <span>{evt.timestamp}</span>
                    <span>{evt.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Contenido de pestana: Operaciones */}
      {activeTab === "operations" && (
        <section className="mt-5 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Settings size={18} /> Centro de Operaciones
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Herramientas avanzadas para monitoreo, pruebas de carga, gestion de errores y conciliacion.
                </p>
              </div>
              {!simulationMode && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <AlertTriangle size={16} className="text-amber-600" />
                  <span className="text-xs text-amber-700">Activa el modo simulacion para probar estas herramientas</span>
                </div>
              )}
            </div>
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
      )}

      {/* Mensajes de feedback */}
      {message && (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm font-medium text-blue-700">{message}</p>
          {lastRequestId && <p className="mt-1 text-xs text-blue-500">Request ID: {lastRequestId}</p>}
        </div>
      )}
    </section>
  );
}
