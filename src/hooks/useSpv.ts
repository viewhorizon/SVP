import { useEffect, useMemo, useState, useCallback } from "react";
import { 
  castVote, 
  checkApiHealth, 
  creditPoints, 
  getSpvBootstrapState, 
  transferPoints,
  getUsers,
  getActivities,
  getTransactions,
  createActivity,
  updateActivity,
  deleteActivity,
  type User,
  type Activity,
  type Transaction 
} from "../services/spvApi";
import { getLastRequestTelemetry } from "../services/httpClient";

type ActivityItem = {
  id: string;
  name: string;
  type: "global" | "local";
  pointsPerHour: number;
  votes: number;
  context: string;
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem("auth.token")) {
        localStorage.setItem("auth.token", `dev:${DEMO_USER_ID}`);
      }
    } catch {
      // No bloquea modo local.
    }
  }, []);

  useEffect(() => {
    setHistory([
      { id: buildId(), text: "@carlos -> tu (+5 pts)", createdAt: formatDate(), type: "transfer", status: "success", amount: 5 },
      { id: buildId(), text: "Voto global en Peluquerias", createdAt: formatDate(), type: "vote", status: "success", amount: 2 },
    ]);
  }, []);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
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
    void load();
  }, []);

  const runHealthCheck = useCallback(async () => {
    setHealthState("checking");
    setHealthLabel("Verificando API...");
    try {
      const health = await checkApiHealth();
      if (health.ok) {
        setHealthState("online");
        setHealthLabel(`Disponible (${health.service ?? "spv-api"})`);
        return;
      }
      setHealthState("offline");
      setHealthLabel("No disponible");
    } catch {
      setHealthState("offline");
      setHealthLabel("No disponible");
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
      { id: buildId(), text, createdAt: formatDate(), type, status: "success", amount }, 
      ...prev
    ].slice(0, 50));
  }, []);

  // CREATE - Votar
  const handleVote = useCallback(async (activityId: string) => {
    if (dailyVotesLeft <= 0) {
      setMessage("No te quedan votos hoy.");
      return;
    }
    const activity = activities.find((entry) => entry.id === activityId);
    if (!activity) return;

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
  }, [dailyVotesLeft, activities, addHistory]);

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
    },
  };
}
