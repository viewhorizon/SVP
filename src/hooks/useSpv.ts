import { useEffect, useMemo, useState, useCallback } from "react";
import { 
  castVote, 
  creditPoints, 
  getSpvBootstrapState, 
  transferPoints,
  getUsers,
  createActivity,
  updateActivity,
  deleteActivity,
  type User,
  type Activity,
  type Transaction 
} from "../services/spvApi";
import { getLastRequestTelemetry } from "../services/httpClient";
import * as neonClient from "../services/neonClient";

type ActivityItem = {
  id: string;
  name: string;
  type: "global" | "local";
  pointsPerHour: number;
  votes: number;
  context: string;
  linkedTaskId?: string | null;
};

type HistoryEntry = {
  id: string;
  text: string;
  createdAt: string;
  type?: "vote" | "transfer" | "credit";
  status?: "success" | "pending" | "error";
  amount?: number;
};

const DEMO_USER_ID = "11111111-1111-1111-1111-111111111111";
const MAX_DAILY_VOTES = 5;
const MAX_AVAILABLE_POINTS = 100;
const HISTORY_STORAGE_KEY = "spv.history.v1";

const INITIAL_ACTIVITIES: ActivityItem[] = [
  { id: "act-global-001", name: "Peluquerias", type: "global", pointsPerHour: 1.03, votes: 50234, context: "Actividad global" },
  { id: "act-local-001", name: "EligeStyle", type: "local", pointsPerHour: 1.44, votes: 14502, context: "Actividad local" },
  { id: "act-global-002", name: "Restaurantes", type: "global", pointsPerHour: 0.89, votes: 32100, context: "Actividad global" },
  { id: "act-local-002", name: "FitZone Gym", type: "local", pointsPerHour: 1.22, votes: 8745, context: "Actividad local" },
];

const buildId = () => crypto.randomUUID();
const formatDate = () =>
  new Date().toLocaleString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });

// Load history from localStorage
const loadHistoryFromStorage = (): HistoryEntry[] => {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    console.log("[v0] Error loading history from localStorage");
  }
  return [];
};

// Save history to localStorage
const saveHistoryToStorage = (history: HistoryEntry[]) => {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch {
    console.log("[v0] Error saving history to localStorage");
  }
};

export function useSpv() {
  const [dailyVotesLeft, setDailyVotesLeft] = useState(MAX_DAILY_VOTES);
  const [pointsAvailable, setPointsAvailable] = useState(42);
  const [totalPointsAccumulated, setTotalPointsAccumulated] = useState(1240);
  const [activities, setActivities] = useState(INITIAL_ACTIVITIES);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [receiver, setReceiver] = useState("");
  const [amount, setAmount] = useState(5);
  const [message, setMessage] = useState("");
  const [lastRequestId, setLastRequestId] = useState("");
  const [healthState, setHealthState] = useState<"checking" | "online" | "offline">("checking");
  const [healthLabel, setHealthLabel] = useState("Verificando API...");
  
  // Nuevos estados para CRUD completo
  const [registeredUsers, setRegisteredUsers] = useState<User[]>([]);
  const [transactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [useNeon, setUseNeon] = useState(false);

  // Trazabilidad: items estrategicos, tareas y notificaciones de impacto
  const [strategicItems, setStrategicItems] = useState<neonClient.NeonStrategicItem[]>([]);
  const [tasks, setTasks] = useState<neonClient.NeonTask[]>([]);
  const [impactNotifications, setImpactNotifications] = useState<
    (neonClient.VoteImpact & { id: string })[]
  >([]);

  useEffect(() => {
    try {
      if (!localStorage.getItem("auth.token")) {
        localStorage.setItem("auth.token", `dev:${DEMO_USER_ID}`);
      }
    } catch {
      // No bloquea modo local.
    }
  }, []);

  // Cargar historial desde localStorage al inicio
  useEffect(() => {
    const storedHistory = loadHistoryFromStorage();
    if (storedHistory.length > 0) {
      setHistory(storedHistory);
    }
  }, []);

  // Guardar historial en localStorage cuando cambie
  useEffect(() => {
    if (history.length > 0) {
      saveHistoryToStorage(history);
    }
  }, [history]);

  // Cargar datos iniciales (usuarios, actividades)
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Intentar cargar desde Neon primero
        const [neonUsers, neonActivities, neonHistory] = await Promise.all([
          neonClient.fetchUsers(),
          neonClient.fetchActivities(),
          neonClient.fetchHistory(),
        ]);

        if (neonUsers.length > 0) {
          setUseNeon(true);
          // Convertir usuarios de Neon al formato User
          setRegisteredUsers(neonUsers.map(u => ({
            id: u.id,
            username: u.username,
            displayName: u.name,
            pointsBalance: u.points_balance,
          })));

          // Cargar trazabilidad: items estrategicos y tareas
          const [neonStrategic, neonTasks] = await Promise.all([
            neonClient.fetchStrategicItems(),
            neonClient.fetchTasks(),
          ]);
          setStrategicItems(neonStrategic);
          setTasks(neonTasks);

          // Convertir actividades de Neon al formato ActivityItem (preserva linked_task_id)
          if (neonActivities.length > 0) {
            setActivities(neonActivities.map(a => ({
              id: a.id,
              name: a.name,
              type: a.type,
              pointsPerHour: a.points_reward / 10,
              votes: a.votes_count,
              context: a.type === "global" ? "Actividad global" : "Actividad local",
              linkedTaskId: a.linked_task_id ?? null,
            })));
          }

          // Cargar historial desde Neon si hay datos, sino desde localStorage
          if (neonHistory.length > 0) {
            setHistory(neonHistory.map(h => ({
              id: h.id,
              text: h.description,
              createdAt: new Date(h.created_at).toLocaleString("es-ES", {
                hour: "2-digit",
                minute: "2-digit",
                day: "2-digit",
                month: "2-digit",
              }),
              type: h.type as "vote" | "transfer" | "credit",
              status: h.status as "success" | "pending" | "error",
              amount: h.amount,
            })));
          }
          return;
        }
      } catch (err) {
        console.log("[v0] Neon not available, using fallback:", err);
      }

      // Fallback: cargar desde API o usar mock
      try {
        const [bootstrap, users] = await Promise.all([
          getSpvBootstrapState(DEMO_USER_ID),
          getUsers(),
        ]);
        setPointsAvailable(bootstrap.available);
        setTotalPointsAccumulated(bootstrap.historical);
        setDailyVotesLeft(bootstrap.remainingVotes);
        setRegisteredUsers(users);
      } catch {
        // Fallback local con usuarios mock
        setRegisteredUsers([
          { id: "user-001", username: "carlos", displayName: "Carlos Garcia", pointsBalance: 150 },
          { id: "user-002", username: "laura", displayName: "Laura Martinez", pointsBalance: 230 },
          { id: "user-003", username: "miguel", displayName: "Miguel Lopez", pointsBalance: 89 },
          { id: "user-004", username: "ana", displayName: "Ana Rodriguez", pointsBalance: 320 },
          { id: "user-005", username: "pedro", displayName: "Pedro Sanchez", pointsBalance: 175 },
        ]);
      } finally {
        setIsLoading(false);
      }
    };
    void loadData();
  }, []);

  const runHealthCheck = useCallback(async () => {
    setHealthState("checking");
    setHealthLabel("Verificando...");
    try {
      // Intentar conectar al backend (que tiene acceso a Neon)
      const neonHealth = await neonClient.checkNeonHealth();
      if (neonHealth.ok) {
        setHealthState("online");
        setHealthLabel("Disponible");
        setUseNeon(true);
        return;
      }
      setHealthState("offline");
      setHealthLabel(neonHealth.status === "database_unavailable" ? "Base de datos no disponible" : "Backend no disponible");
    } catch {
      setHealthState("offline");
      setHealthLabel("Backend no disponible");
    }
  }, []);

  useEffect(() => {
    void runHealthCheck();
  }, [runHealthCheck]);

  useEffect(() => {
    const initial = getLastRequestTelemetry();
    if (initial?.requestId) setLastRequestId(initial.requestId);

    const listener = (event: Event) => {
      const customEvent = event as CustomEvent<{ requestId?: string }>;
      const requestId = String(customEvent.detail?.requestId ?? "").trim();
      if (requestId) setLastRequestId(requestId);
    };

    window.addEventListener("spv:request", listener);
    return () => window.removeEventListener("spv:request", listener);
  }, []);

  const todayVotesUsed = MAX_DAILY_VOTES - dailyVotesLeft;

  const groupedActivities = useMemo(
    () => ({
      global: activities.filter((activity) => activity.type === "global"),
      local: activities.filter((activity) => activity.type === "local"),
    }),
    [activities],
  );

  const addHistory = useCallback((text: string, type: HistoryEntry["type"] = "vote", amount = 0) => {
    setHistory((prev) => [
      { id: buildId(), text, createdAt: formatDate(), type, status: "success" as const, amount }, 
      ...prev
    ].slice(0, 50));
  }, []);

  // Aplicar el impacto de trazabilidad en el estado local (tarea + estrategico)
  const applyImpact = useCallback((impact: neonClient.VoteImpact) => {
    // Actualizar la tarea afectada
    setTasks((prev) =>
      prev.map((t) =>
        t.id === impact.taskId
          ? { ...t, progress: impact.taskProgress, status: impact.taskStatus }
          : t,
      ),
    );
    // Actualizar el item estrategico afectado
    if (impact.strategicId && impact.strategicProgress !== null) {
      setStrategicItems((prev) =>
        prev.map((s) =>
          s.id === impact.strategicId
            ? { ...s, progress: impact.strategicProgress as number, computed_progress: impact.strategicProgress as number }
            : s,
        ),
      );
    }
    // Emitir notificacion de impacto (auto-expira via el componente)
    const notif = { ...impact, id: buildId() };
    setImpactNotifications((prev) => [notif, ...prev].slice(0, 4));
    // Emitir evento global para que el Kanban pueda refrescar
    window.dispatchEvent(new CustomEvent("spv:impact", { detail: impact }));
  }, []);

  const dismissImpact = useCallback((id: string) => {
    setImpactNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // CREATE - Votar
  const handleVote = useCallback(async (activityId: string) => {
    if (dailyVotesLeft <= 0) {
      setMessage("No te quedan votos hoy.");
      return;
    }
    const activity = activities.find((entry) => entry.id === activityId);
    if (!activity) return;

    // Camino Neon: captura impacto de trazabilidad
    if (useNeon) {
      try {
        const result = await neonClient.castVote(activityId, DEMO_USER_ID);
        if (result.success) {
          setDailyVotesLeft((prev) => prev - 1);
          setPointsAvailable((prev) => Math.min(MAX_AVAILABLE_POINTS, prev + result.pointsGranted));
          setTotalPointsAccumulated((prev) => prev + result.pointsGranted);
          setActivities((prev) => prev.map((entry) => (entry.id === activityId ? { ...entry, votes: entry.votes + 1 } : entry)));
          addHistory(`Voto ${activity.type} en ${activity.name} (+${result.pointsGranted} pts)`, "vote", result.pointsGranted);
          if (result.impact) {
            applyImpact(result.impact);
            setMessage(`Voto registrado. Tarea "${result.impact.taskTitle}" avanzo a ${result.impact.taskProgress}%.`);
          } else {
            setMessage("Voto registrado.");
          }
          return;
        }
      } catch (err) {
        console.log("[v0] Neon vote failed, fallback local:", err);
      }
    }

    // Camino API/local original
    try {
      const result = await castVote(activityId, buildId());
      setDailyVotesLeft(result.remainingVotes);
      setPointsAvailable((prev) => Math.min(MAX_AVAILABLE_POINTS, prev + result.pointsGranted));
      setTotalPointsAccumulated((prev) => prev + result.pointsGranted);
      setActivities((prev) => prev.map((entry) => (entry.id === activityId ? { ...entry, votes: entry.votes + 1 } : entry)));
      addHistory(`Voto ${activity.type} en ${activity.name} (+${result.pointsGranted} pts)`, "vote", result.pointsGranted);
      setMessage("Voto registrado.");
    } catch {
      const localPoints = Math.max(1, Math.round(activity.pointsPerHour * 2));
      setDailyVotesLeft((prev) => prev - 1);
      setPointsAvailable((prev) => Math.min(MAX_AVAILABLE_POINTS, prev + localPoints));
      setTotalPointsAccumulated((prev) => prev + localPoints);
      setActivities((prev) => prev.map((entry) => (entry.id === activityId ? { ...entry, votes: entry.votes + 1 } : entry)));
      addHistory(`Voto ${activity.type} en ${activity.name} (+${localPoints} pts)`, "vote", localPoints);
      setMessage("Voto registrado en modo local.");
    }
  }, [dailyVotesLeft, activities, addHistory, useNeon, applyImpact]);

  // CREATE - Transferir
  const handleTransfer = useCallback(async () => {
    const user = receiver.trim();
    if (!user || amount <= 0 || amount > pointsAvailable) {
      setMessage("Datos de transferencia invalidos.");
      return;
    }
    try {
      await transferPoints({ fromUserId: DEMO_USER_ID, toUserId: user, amount, requestId: buildId() });
    } catch {
      // Fallback local
    }
    setPointsAvailable((prev) => prev - amount);
    addHistory(`Tu -> @${user} (-${amount} pts)`, "transfer", amount);
    setMessage(`Transferencia realizada a ${user}.`);
    setReceiver("");
    setAmount(5);
  }, [receiver, amount, pointsAvailable, addHistory]);

  // CREATE - Recibir
  const handleReceive = useCallback(async () => {
    const incoming = 8;
    try {
      await creditPoints({ userId: DEMO_USER_ID, amount: incoming, reason: "manual_receive_simulation", requestId: buildId() });
    } catch {
      // Fallback local
    }
    setPointsAvailable((prev) => Math.min(MAX_AVAILABLE_POINTS, prev + incoming));
    setTotalPointsAccumulated((prev) => prev + incoming);
    addHistory(`@laura -> tu (+${incoming} pts)`, "credit", incoming);
    setMessage(`Recibiste ${incoming} puntos.`);
  }, [addHistory]);

  // CREATE - Nueva actividad
  const handleCreateActivity = useCallback(async (name: string, type: "global" | "local", context: string) => {
    const newActivity: ActivityItem = {
      id: `act-${type}-${Date.now()}`,
      name,
      type,
      pointsPerHour: Math.random() * 2 + 0.5,
      votes: 0,
      context,
    };
    
    try {
      await createActivity(newActivity);
    } catch {
      // Fallback local
    }
    
    setActivities((prev) => [...prev, newActivity]);
    setMessage(`Actividad "${name}" creada.`);
  }, []);

  // UPDATE - Actualizar actividad
  const handleUpdateActivity = useCallback(async (id: string, updates: Partial<ActivityItem>) => {
    try {
      await updateActivity(id, updates as Partial<Activity>);
    } catch {
      // Fallback local
    }
    
    setActivities((prev) => prev.map((act) => act.id === id ? { ...act, ...updates } : act));
    setMessage("Actividad actualizada.");
  }, []);

  // DELETE - Eliminar actividad
  const handleDeleteActivity = useCallback(async (id: string) => {
    try {
      await deleteActivity(id);
    } catch {
      // Fallback local
    }
    
    setActivities((prev) => prev.filter((act) => act.id !== id));
    setMessage("Actividad eliminada.");
  }, []);

  // UPDATE - Editar entrada de historial
  const handleUpdateHistoryEntry = useCallback((id: string, newText: string) => {
    setHistory((prev) => prev.map((entry) => entry.id === id ? { ...entry, text: newText } : entry));
    setMessage("Entrada actualizada.");
  }, []);

  // DELETE - Eliminar entrada de historial
  const handleDeleteHistoryEntry = useCallback((id: string) => {
    setHistory((prev) => prev.filter((entry) => entry.id !== id));
    setMessage("Entrada eliminada.");
  }, []);

  // Limpiar mensaje
  const clearMessage = useCallback(() => setMessage(""), []);

  return {
    constants: { MAX_DAILY_VOTES, MAX_AVAILABLE_POINTS },
    state: {
      activities,
      amount,
      dailyVotesLeft,
      groupedActivities,
      healthLabel,
      healthState,
      history,
      lastRequestId,
      message,
      pointsAvailable,
      receiver,
      totalPointsAccumulated,
      todayVotesUsed,
      registeredUsers,
      transactions,
      isLoading,
      useNeon,
      // Trazabilidad
      strategicItems,
      tasks,
      impactNotifications,
    },
    actions: {
      // READ implícito en bootstrap
      handleReceive,
      handleTransfer,
      handleVote,
      runHealthCheck,
      setAmount,
      setReceiver,
      // CRUD completo
      handleCreateActivity,
      handleUpdateActivity,
      handleDeleteActivity,
      handleUpdateHistoryEntry,
      handleDeleteHistoryEntry,
      clearMessage,
      // Trazabilidad
      dismissImpact,
    },
  };
}
