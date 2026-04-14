import { 
  Activity, Coins, History, Vote, Settings, Play, Pause, RotateCcw, Send, Download, 
  Users, TrendingUp, Clock, CheckCircle2, XCircle, AlertTriangle, Plus, Pencil, Trash2, 
  Search, Filter, Table, RefreshCw, Copy, Check
} from "lucide-react";
import { useState, useMemo } from "react";
import { useSpv } from "./hooks/useSpv";
import { DeadLetterPanel } from "./components/Sprint3/DeadLetterPanel";
import { AlertsPanel } from "./components/Sprint3/AlertsPanel";
import { LoadTestPanel } from "./components/Sprint3/LoadTestPanel";
import { ReconciliationPanel } from "./components/Sprint3/ReconciliationPanel";

type TabId = "activities" | "points" | "history" | "operations";

interface SimulationEvent {
  id: string;
  type: "vote" | "transfer" | "credit" | "integration" | "system";
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
  const [userFilter, setUserFilter] = useState("");
  const [historyFilter, setHistoryFilter] = useState("");
  const [showDataTable, setShowDataTable] = useState(false);
  const [editingActivity, setEditingActivity] = useState<string | null>(null);
  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null);
  const [newActivityName, setNewActivityName] = useState("");
  const [newActivityType, setNewActivityType] = useState<"global" | "local">("local");
  const [showCreateActivity, setShowCreateActivity] = useState(false);
  const [copiedConsole, setCopiedConsole] = useState(false);
  
  const { actions, constants, state } = useSpv();
  const {
    activities,
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
    registeredUsers,
    isLoading,
  } = state;

  // Filtrar usuarios por búsqueda
  const filteredUsers = useMemo(() => {
    if (!userFilter.trim()) return registeredUsers;
    const search = userFilter.toLowerCase();
    return registeredUsers.filter(
      (u) => u.username.toLowerCase().includes(search) || u.displayName.toLowerCase().includes(search)
    );
  }, [registeredUsers, userFilter]);

  // Filtrar historial por búsqueda
  const filteredHistory = useMemo(() => {
    if (!historyFilter.trim()) return history;
    const search = historyFilter.toLowerCase();
    return history.filter((h) => h.text.toLowerCase().includes(search));
  }, [history, historyFilter]);

  // Evitar duplicados en eventos de simulación usando Set de IDs
  const addSimulationEvent = (event: Omit<SimulationEvent, "id" | "timestamp">) => {
    const eventId = `evt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const newEvent: SimulationEvent = {
      ...event,
      id: eventId,
      timestamp: new Date().toLocaleTimeString("es-ES"),
    };
    setSimulationEvents((prev) => {
      // Evitar duplicados verificando descripción en los últimos 2 segundos
      const twoSecondsAgo = Date.now() - 2000;
      const recentDuplicate = prev.find(
        (e) => e.description === newEvent.description && 
        new Date(`1970-01-01 ${e.timestamp}`).getTime() > twoSecondsAgo
      );
      if (recentDuplicate) return prev;
      return [newEvent, ...prev].slice(0, 100);
    });
  };

  const handleVoteWithSimulation = async (activityId: string) => {
    const activity = [...groupedActivities.global, ...groupedActivities.local].find((a) => a.id === activityId);
    if (simulationMode && activity) {
      addSimulationEvent({
        type: "vote",
        description: `Voto en "${activity.name}"`,
        status: "success",
        details: `+${Math.round(activity.pointsPerHour * 2)} pts otorgados`,
      });
    }
    await actions.handleVote(activityId);
  };

  const handleTransferWithSimulation = async () => {
    if (simulationMode) {
      addSimulationEvent({
        type: "transfer",
        description: `Transferencia de ${amount} pts a @${receiver}`,
        status: "pending",
        details: "Procesando en ledger...",
      });
    }
    await actions.handleTransfer();
    if (simulationMode) {
      setTimeout(() => {
        addSimulationEvent({
          type: "transfer",
          description: `Transferencia completada: ${amount} pts`,
          status: "success",
          details: `Destinatario: @${receiver}`,
        });
      }, 800);
    }
  };

  const simulateExternalEvent = () => {
    const eventTypes = [
      { type: "integration" as const, desc: `Evento de ${selectedIntegration} recibido`, details: "SKU-12345 actualizado" },
      { type: "credit" as const, desc: "Puntos acreditados por compra", details: "+50 pts por pedido #9821" },
      { type: "system" as const, desc: "Sincronizacion completada", details: "150 registros procesados" },
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

  const exportHistoryCSV = () => {
    const headers = ["ID", "Descripcion", "Tipo", "Monto", "Estado", "Fecha"];
    const rows = history.map((h) => [
      h.id,
      h.text,
      h.type || "general",
      h.amount?.toString() || "0",
      h.status || "success",
      h.createdAt,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historial-svp-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const copyConsoleToClipboard = () => {
    const consoleText = simulationEvents.map(evt => 
      `[${evt.timestamp}] ${evt.type.toUpperCase()} - ${evt.description}${evt.details ? ' - ' + evt.details : ''}`
    ).join('\n');
    
    navigator.clipboard.writeText(consoleText || "No events to copy").then(() => {
      setCopiedConsole(true);
      setTimeout(() => setCopiedConsole(false), 2000);
    });
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Sistema de Votos y Puntos</h2>
          <p className="text-sm text-slate-600">MVP conectado para integracion con aplicaciones externas</p>
        </div>
      </div>

      {/* Metricas principales con Health API y Modo Simulacion */}
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
        
        {/* Health API con boton de simulacion debajo */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="inline-flex items-center gap-2 text-sm text-slate-500"><Activity size={16} /> Health API</p>
          <p className={`text-sm font-semibold ${healthState === "online" ? "text-emerald-600" : healthState === "offline" ? "text-rose-600" : "text-amber-600"}`}>
            {healthState === "online" ? <CheckCircle2 size={14} className="mr-1 inline" /> : healthState === "offline" ? <XCircle size={14} className="mr-1 inline" /> : <Clock size={14} className="mr-1 inline" />}
            {healthLabel}
          </p>
          <button type="button" onClick={() => void actions.runHealthCheck()} className="mt-2 w-full rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            Verificar
          </button>
          
          {/* Boton de simulacion debajo del Health API */}
          <button
            type="button"
            onClick={() => setSimulationMode(!simulationMode)}
            className={`mt-2 w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              simulationMode 
                ? "bg-amber-600 text-white hover:bg-amber-700" 
                : "border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
            }`}
          >
            {simulationMode ? <Pause size={14} /> : <Play size={14} />}
            {simulationMode ? "Detener Simulacion" : "Modo Simulacion"}
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

      {/* Panel de eventos de simulacion en tiempo real */}
      {simulationMode && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center justify-between">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-amber-900">
              <Activity size={16} /> Eventos de Simulacion en Tiempo Real
            </p>
            <div className="flex gap-2">
              <select
                value={selectedIntegration}
                onChange={(e) => setSelectedIntegration(e.target.value)}
                className="rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs"
              >
                <option value="inventory">Inventario</option>
                <option value="ecommerce">E-commerce</option>
                <option value="crm">CRM</option>
                <option value="custom">Personalizado</option>
              </select>
              <button
                type="button"
                onClick={simulateExternalEvent}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
              >
                <Send size={14} /> Simular Evento
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
          
          {/* Consola de eventos con boton copy */}
          <div className="mt-3 rounded-lg bg-slate-900 overflow-hidden">
            <div className="flex items-center justify-between bg-slate-800 px-3 py-2">
              <span className="text-xs font-semibold text-slate-300">Consola de Eventos</span>
              <button
                type="button"
                onClick={copyConsoleToClipboard}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700"
              >
                {copiedConsole ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                {copiedConsole ? "Copiado" : "Copiar"}
              </button>
            </div>
            <div className="max-h-40 space-y-1 overflow-y-auto p-3 font-mono text-xs">
              {simulationEvents.length === 0 ? (
                <p className="text-slate-400">Esperando eventos... Realiza acciones para ver la simulacion.</p>
              ) : (
                simulationEvents.map((evt) => (
                  <div key={evt.id} className="flex items-start gap-2 text-slate-300">
                    <span className={`mt-0.5 inline-block h-2 w-2 flex-shrink-0 rounded-full ${evt.status === "success" ? "bg-emerald-400" : evt.status === "error" ? "bg-rose-400" : "bg-amber-400"}`} />
                    <span className="text-slate-500">[{evt.timestamp}]</span>
                    <span className={`${evt.status === "success" ? "text-emerald-400" : evt.status === "error" ? "text-rose-400" : "text-amber-400"}`}>
                      {evt.type.toUpperCase()}
                    </span>
                    <span className="text-white">{evt.description}</span>
                    {evt.details && <span className="text-slate-400">- {evt.details}</span>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contenido de pestana: Actividades */}
      {activeTab === "activities" && (
        <div className="mt-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-slate-900">Actividades Disponibles</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">{activities.length} actividades</span>
              <button
                type="button"
                onClick={() => setShowCreateActivity(!showCreateActivity)}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <Plus size={14} /> Nueva
              </button>
            </div>
          </div>

          {/* Formulario crear actividad */}
          {showCreateActivity && (
            <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="mb-3 text-sm font-semibold text-blue-900">Crear Nueva Actividad</p>
              <div className="flex flex-wrap gap-3">
                <input
                  value={newActivityName}
                  onChange={(e) => setNewActivityName(e.target.value)}
                  placeholder="Nombre de actividad"
                  className="flex-1 rounded-lg border border-blue-300 px-3 py-2 text-sm"
                />
                <select
                  value={newActivityType}
                  onChange={(e) => setNewActivityType(e.target.value as "global" | "local")}
                  className="rounded-lg border border-blue-300 px-3 py-2 text-sm"
                >
                  <option value="local">Local</option>
                  <option value="global">Global</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (newActivityName.trim()) {
                      void actions.handleCreateActivity(newActivityName, newActivityType, `Actividad ${newActivityType}`);
                      setNewActivityName("");
                      setShowCreateActivity(false);
                      if (simulationMode) {
                        addSimulationEvent({ type: "system", description: `Actividad "${newActivityName}" creada`, status: "success" });
                      }
                    }
                  }}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Crear
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateActivity(false)}
                  className="rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-700"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {activities.map((activity) => (
              <article key={activity.id} className="group rounded-2xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${activity.type === "global" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                    {activity.type}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => setEditingActivity(editingActivity === activity.id ? null : activity.id)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void actions.handleDeleteActivity(activity.id);
                        if (simulationMode) {
                          addSimulationEvent({ type: "system", description: `Actividad "${activity.name}" eliminada`, status: "success" });
                        }
                      }}
                      className="rounded p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                
                {editingActivity === activity.id ? (
                  <div className="mt-2 space-y-2">
                    <input
                      defaultValue={activity.name}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      onBlur={(e) => {
                        if (e.target.value !== activity.name) {
                          void actions.handleUpdateActivity(activity.id, { name: e.target.value });
                          if (simulationMode) {
                            addSimulationEvent({ type: "system", description: `Actividad actualizada: "${e.target.value}"`, status: "success" });
                          }
                        }
                        setEditingActivity(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") setEditingActivity(null);
                      }}
                    />
                  </div>
                ) : (
                  <>
                    <h4 className="mt-2 text-lg font-bold text-slate-900">{activity.name}</h4>
                    <p className="mt-1 text-sm text-slate-600">{activity.context}</p>
                  </>
                )}
                
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
            <p className="mt-1 text-sm text-slate-500">Envia puntos a usuarios registrados</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">Destinatario</label>
                <div className="relative mt-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={userFilter}
                    onChange={(event) => {
                      setUserFilter(event.target.value);
                      if (!event.target.value) setReceiver("");
                    }}
                    placeholder="Buscar usuario..."
                    className="w-full rounded-lg border border-slate-300 pl-9 pr-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                
                {/* Lista de usuarios filtrados */}
                {userFilter && filteredUsers.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          setReceiver(user.username);
                          setUserFilter("");
                        }}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        <div>
                          <span className="font-medium text-slate-900">@{user.username}</span>
                          <span className="ml-2 text-slate-500">{user.displayName}</span>
                        </div>
                        <span className="text-xs text-slate-400">{user.pointsBalance} pts</span>
                      </button>
                    ))}
                  </div>
                )}
                
                {receiver && !userFilter && (
                  <p className="mt-1 text-xs text-emerald-600">Destinatario seleccionado: @{receiver}</p>
                )}
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
                  onClick={() => {
                    void actions.handleReceive();
                    if (simulationMode) {
                      addSimulationEvent({ type: "credit", description: "Puntos recibidos", status: "success", details: "+8 pts" });
                    }
                  }}
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

            {/* Usuarios registrados */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Usuarios Registrados</p>
                <span className="text-xs text-slate-500">{registeredUsers.length} usuarios</span>
              </div>
              <div className="mt-3 max-h-32 space-y-1 overflow-y-auto">
                {registeredUsers.slice(0, 5).map((user) => (
                  <div key={user.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <span className="font-medium text-slate-700">@{user.username}</span>
                    <span className="text-slate-500">{user.pointsBalance} pts</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Contenido de pestana: Historial */}
      {activeTab === "history" && (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-slate-900">Historial de Transacciones</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={historyFilter}
                  onChange={(e) => setHistoryFilter(e.target.value)}
                  placeholder="Filtrar..."
                  className="rounded-lg border border-slate-300 pl-9 pr-4 py-1.5 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowDataTable(!showDataTable)}
                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium ${showDataTable ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-300 bg-white text-slate-600"}`}
              >
                <Table size={14} /> Tabla
              </button>
              <button type="button" onClick={exportHistoryCSV} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                <Download size={14} className="mr-1 inline" /> CSV
              </button>
            </div>
          </div>

          {/* Vista tabla de datos */}
          {showDataTable && (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">Descripcion</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Monto</th>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredHistory.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          No hay transacciones registradas.
                        </td>
                      </tr>
                    ) : (
                      filteredHistory.map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <CheckCircle2 size={16} className="text-emerald-500" />
                          </td>
                          <td className="px-4 py-3">
                            {editingHistoryId === entry.id ? (
                              <input
                                defaultValue={entry.text}
                                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                                autoFocus
                                onBlur={(e) => {
                                  actions.handleUpdateHistoryEntry(entry.id, e.target.value);
                                  setEditingHistoryId(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                  if (e.key === "Escape") setEditingHistoryId(null);
                                }}
                              />
                            ) : (
                              <span className="text-slate-700">{entry.text}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                              entry.type === "vote" ? "bg-blue-100 text-blue-700" : 
                              entry.type === "transfer" ? "bg-amber-100 text-amber-700" : 
                              "bg-emerald-100 text-emerald-700"
                            }`}>
                              {entry.type || "general"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-700">
                            {entry.amount ? `${entry.amount} pts` : "-"}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{entry.createdAt}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingHistoryId(entry.id)}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => actions.handleDeleteHistoryEntry(entry.id)}
                                className="rounded p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Vista lista (default) */}
          {!showDataTable && (
            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="divide-y divide-slate-100">
                {filteredHistory.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">
                    No hay transacciones. Realiza votos o transferencias para ver el historial.
                  </div>
                ) : (
                  filteredHistory.map((entry) => (
                    <div key={entry.id} className="group flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 size={16} className="text-emerald-500" />
                        <div>
                          <p className="text-sm text-slate-700">{entry.text}</p>
                          <p className="text-xs text-slate-400">{entry.createdAt}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                          entry.type === "vote" ? "bg-blue-100 text-blue-700" : 
                          entry.type === "transfer" ? "bg-amber-100 text-amber-700" : 
                          "bg-emerald-100 text-emerald-700"
                        }`}>
                          {entry.amount ? `${entry.amount} pts` : entry.type || "general"}
                        </span>
                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => setEditingHistoryId(entry.id)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => actions.handleDeleteHistoryEntry(entry.id)}
                            className="rounded p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Consola de eventos de simulacion en historial */}
          {simulationMode && simulationEvents.length > 0 && (
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <Activity size={16} /> Eventos de Simulacion
                </p>
                <button
                  type="button"
                  onClick={() => setSimulationEvents([])}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Limpiar
                </button>
              </div>
              <div className="max-h-32 space-y-1 overflow-y-auto font-mono text-xs">
                {simulationEvents.slice(0, 10).map((evt) => (
                  <div key={evt.id} className="flex items-center gap-2 text-slate-300">
                    <span className={`h-1.5 w-1.5 rounded-full ${evt.status === "success" ? "bg-emerald-400" : "bg-amber-400"}`} />
                    <span className="text-slate-500">{evt.timestamp}</span>
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
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Settings size={18} /> Centro de Operaciones
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Herramientas avanzadas para monitoreo, pruebas de carga y conciliacion.
                </p>
              </div>
              {!simulationMode && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <AlertTriangle size={16} className="text-amber-600" />
                  <span className="text-xs text-amber-700">Activa el modo simulacion para probar</span>
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
