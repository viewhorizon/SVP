import { useEffect, useMemo, useState } from "react";
import { castVote, checkApiHealth, creditPoints, getSpvBootstrapState, transferPoints } from "../services/spvApi";
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
};

const DEMO_USER_ID = "11111111-1111-1111-1111-111111111111";
const MAX_DAILY_VOTES = 5;
const MAX_AVAILABLE_POINTS = 100;

const INITIAL_ACTIVITIES: ActivityItem[] = [
  { id: "act-global-001", name: "Peluquerias", type: "global", pointsPerHour: 1.03, votes: 50234, context: "Actividad global" },
  { id: "act-local-001", name: "EligeStyle", type: "local", pointsPerHour: 1.44, votes: 14502, context: "Actividad local" },
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
      { id: buildId(), text: "@carlos -> tu (+5 pts)", createdAt: formatDate() },
      { id: buildId(), text: "Voto global en Peluquerias", createdAt: formatDate() },
    ]);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const bootstrap = await getSpvBootstrapState(DEMO_USER_ID);
        setPointsAvailable(bootstrap.available);
        setTotalPointsAccumulated(bootstrap.historical);
        setDailyVotesLeft(bootstrap.remainingVotes);
      } catch {
        // Fallback local.
      }
    };
    void load();
  }, []);

  const runHealthCheck = async () => {
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
  };

  useEffect(() => {
    void runHealthCheck();
  }, []);

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

  const addHistory = (text: string) => {
    setHistory((prev) => [{ id: buildId(), text, createdAt: formatDate() }, ...prev].slice(0, 12));
  };

  const handleVote = async (activityId: string) => {
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
      addHistory(`Voto ${activity.type} en ${activity.name} (+${result.pointsGranted} pts)`);
      setMessage("Voto registrado.");
    } catch {
      const localPoints = Math.max(1, Math.round(activity.pointsPerHour * 2));
      setDailyVotesLeft((prev) => prev - 1);
      setPointsAvailable((prev) => Math.min(MAX_AVAILABLE_POINTS, prev + localPoints));
      setTotalPointsAccumulated((prev) => prev + localPoints);
      setActivities((prev) => prev.map((entry) => (entry.id === activityId ? { ...entry, votes: entry.votes + 1 } : entry)));
      addHistory(`Voto ${activity.type} en ${activity.name} (+${localPoints} pts)`);
      setMessage("Voto registrado en modo local.");
    }
  };

  const handleTransfer = async () => {
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
    addHistory(`Tu -> ${user} (-${amount} pts)`);
    setMessage(`Transferencia realizada a ${user}.`);
  };

  const handleReceive = async () => {
    const incoming = 8;
    try {
      await creditPoints({ userId: DEMO_USER_ID, amount: incoming, reason: "manual_receive_simulation", requestId: buildId() });
    } catch {
      // Fallback local
    }
    setPointsAvailable((prev) => Math.min(MAX_AVAILABLE_POINTS, prev + incoming));
    setTotalPointsAccumulated((prev) => prev + incoming);
    addHistory(`@laura -> tu (+${incoming} pts)`);
    setMessage(`Recibiste ${incoming} puntos.`);
  };

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
    },
    actions: {
      handleReceive,
      handleTransfer,
      handleVote,
      runHealthCheck,
      setAmount,
      setReceiver,
    },
  };
}
