import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  castVote,
  getSpvBootstrapState,
  type User,
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

const buildId = () => crypto.randomUUID();
const formatDate = () =>
  new Date().toLocaleString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });


export function useSpv() {
  const [dailyVotesLeft, setDailyVotesLeft] = useState(0);
  const [isVoting, setIsVoting] = useState(false);
  const voteInFlightRef = useRef(false);
  const [pointsAvailable, setPointsAvailable] = useState(0);
  const [totalPointsAccumulated, setTotalPointsAccumulated] = useState(0);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [message, setMessage] = useState("");
  const [lastRequestId, setLastRequestId] = useState("");
  const [healthState, setHealthState] = useState<"checking" | "online" | "offline">("checking");
  const [healthLabel, setHealthLabel] = useState("Verificando API...");
  
  // Nuevos estados para CRUD completo
  const [registeredUsers, setRegisteredUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  // Cargar datos iniciales desde las fuentes persistidas; si fallan, no sustituirlas con mocks.
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [neonUsers, neonActivities, neonHistory, bootstrap, neonStrategic, neonTasks] = await Promise.all([
          neonClient.fetchUsers(),
          neonClient.fetchActivities(),
          neonClient.fetchHistory(),
          getSpvBootstrapState(),
          neonClient.fetchStrategicItems(),
          neonClient.fetchTasks(),
        ]);

        setUseNeon(true);
        setPointsAvailable(bootstrap.available);
        setTotalPointsAccumulated(bootstrap.historical);
        setDailyVotesLeft(Math.max(0, Math.min(MAX_DAILY_VOTES, bootstrap.remainingVotes)));
        setRegisteredUsers(neonUsers.map((user) => ({
          id: user.id,
          username: user.username,
          displayName: user.name,
          pointsBalance: user.points_balance,
        })));
        setStrategicItems(neonStrategic);
        setTasks(neonTasks);
        setActivities(neonActivities.map((activity) => ({
          id: activity.id,
          name: activity.name,
          type: activity.type,
          pointsPerHour: activity.points_reward / 10,
          votes: activity.votes_count,
          context: activity.description ?? (activity.type === "global" ? "Actividad global" : "Actividad local"),
          linkedTaskId: activity.linked_task_id ?? null,
        })));

        setHistory(neonHistory.map((entry) => ({
          id: entry.id,
          text: entry.description,
          createdAt: new Date(entry.created_at).toLocaleString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
          }),
          type: entry.type as "vote" | "transfer" | "credit",
          status: entry.status as "success" | "pending" | "error",
          amount: entry.amount,
        })));
      } catch {
        setUseNeon(false);
        setPointsAvailable(0);
        setTotalPointsAccumulated(0);
        setDailyVotesLeft(0);
        setRegisteredUsers([]);
        setActivities([]);
        setStrategicItems([]);
        setTasks([]);
        setMessage("No se pudieron cargar los datos persistidos. No se cargaron datos de demostración.");
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

  const todayVotesUsed = Math.min(MAX_DAILY_VOTES, Math.max(0, MAX_DAILY_VOTES - dailyVotesLeft));

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
  const handleVote = useCallback(async (activityId: string, externalContext?: { domain: string; reference: string }): Promise<boolean> => {
    if (voteInFlightRef.current) {
      setMessage("Ya hay un voto en proceso.");
      return false;
    }
    if (dailyVotesLeft <= 0) {
      setMessage("No te quedan votos hoy.");
      return false;
    }
    const activity = activities.find((entry) => entry.id === activityId);
    if (!activity) return false;

    voteInFlightRef.current = true;
    setIsVoting(true);
    try {
      const result = await castVote(activityId, buildId(), activity.type, externalContext);
      setDailyVotesLeft(Math.max(0, Math.min(MAX_DAILY_VOTES, result.remainingVotes)));
      setPointsAvailable((prev) => result.availableBalance ?? prev + result.pointsGranted);
      setTotalPointsAccumulated((prev) => result.historicalBalance ?? prev + result.pointsGranted);
      setActivities((prev) => prev.map((entry) => (entry.id === activityId ? { ...entry, votes: entry.votes + 1 } : entry)));
      addHistory(`Voto ${activity.type} en ${activity.name} (+${result.pointsGranted} pts)`, "vote", result.pointsGranted);
      if (result.impact) {
        applyImpact(result.impact);
        setMessage(`Voto registrado. Tarea "${result.impact.taskTitle}" avanzo a ${result.impact.taskProgress}%.`);
      } else {
        setMessage("Voto registrado.");
      }
      return true;
    } catch (error) {
      const apiError = error && typeof error === "object"
        ? error as { status?: number; payload?: { limits?: { remainingVotes?: unknown } } }
        : {};
      if (apiError.status === 429) {
        const remainingVotes = Number(apiError.payload?.limits?.remainingVotes ?? 0);
        setDailyVotesLeft(Number.isFinite(remainingVotes)
          ? Math.max(0, Math.min(MAX_DAILY_VOTES, remainingVotes))
          : 0);
        setMessage("Has alcanzado el límite diario de votos. No se registró otro voto.");
      } else {
        setMessage("No se pudo registrar el voto. No se actualizaron el contador ni los puntos.");
      }
      return false;
    } finally {
      voteInFlightRef.current = false;
      setIsVoting(false);
    }
  }, [dailyVotesLeft, activities, addHistory, applyImpact]);

  // CREATE - Nueva actividad
  const handleCreateActivity = useCallback(async (name: string, type: "global" | "local", context: string) => {
    const savedActivity = await neonClient.createActivity(name, type, 10, context);
    if (!savedActivity) {
      setMessage("No se pudo guardar la actividad. No se añadió al listado.");
      return;
    }

    setActivities((prev) => [...prev, {
      id: savedActivity.id,
      name: savedActivity.name,
      type: savedActivity.type,
      pointsPerHour: savedActivity.points_reward / 10,
      votes: savedActivity.votes_count,
      context: savedActivity.description ?? context,
      linkedTaskId: savedActivity.linked_task_id ?? null,
    }]);
    setMessage(`Actividad "${savedActivity.name}" guardada.`);
  }, []);

  // UPDATE - Actualizar actividad
  const handleUpdateActivity = useCallback(async (id: string, updates: Partial<ActivityItem>) => {
    const name = updates.name?.trim();
    if (!name) {
      setMessage("El nombre de la actividad no puede estar vacío.");
      return;
    }
    const updated = await neonClient.updateActivity(id, name);
    if (!updated) {
      setMessage("No se pudo guardar el cambio. La actividad no se modificó.");
      return;
    }

    setActivities((prev) => prev.map((activity) => activity.id === id ? { ...activity, name } : activity));
    setMessage("Actividad actualizada en el backend.");
  }, []);

  // DELETE - Eliminar actividad
  const handleDeleteActivity = useCallback(async (id: string) => {
    const deleted = await neonClient.deleteActivity(id);
    if (!deleted) {
      setMessage("No se pudo eliminar la actividad. El listado no se modificó.");
      return;
    }

    setActivities((prev) => prev.filter((activity) => activity.id !== id));
    setMessage("Actividad eliminada del backend.");
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
      dailyVotesLeft,
      isVoting,
      groupedActivities,
      healthLabel,
      healthState,
      history,
      lastRequestId,
      message,
      pointsAvailable,
      totalPointsAccumulated,
      todayVotesUsed,
      registeredUsers,
      isLoading,
      useNeon,
      // Trazabilidad
      strategicItems,
      tasks,
      impactNotifications,
    },
    actions: {
      handleVote,
      runHealthCheck,
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
