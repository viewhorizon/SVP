import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Coins, History, PlusCircle, Sparkles, Vote } from 'lucide-react';
import { castVote, creditPoints, getSpvBootstrapState, transferPoints } from './services/spvApi';

type ActivityType = 'global' | 'local';

interface Activity {
  id: string;
  type: ActivityType;
  name: string;
  votes: number;
  pointsPerHour: number;
  context: string;
}

interface HistoryEntry {
  id: string;
  type: 'vote' | 'transfer';
  text: string;
  createdAt: string;
}

interface LogEntry {
  id: string;
  level: 'info' | 'warn' | 'error';
  action: string;
  message: string;
  createdAt: string;
}

const MAX_DAILY_VOTES = 5;
const MAX_AVAILABLE_POINTS = 100;
const DEMO_USER_ID = 'demo-user-001';

const INITIAL_ACTIVITIES: Activity[] = [
  {
    id: 'a-global-hair',
    type: 'global',
    name: 'Peluquerias',
    votes: 1240320,
    pointsPerHour: 1.03,
    context: 'Total negocios: 1.2M',
  },
  {
    id: 'a-local-eligestyle',
    type: 'local',
    name: 'EligeStyle',
    votes: 12450,
    pointsPerHour: 0.82,
    context: 'Locales activos: 15200',
  },
];

const formatDate = (date = new Date()): string =>
  date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

const buildId = (): string =>
  `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const buildRequestId = (prefix: string): string => `${prefix}-${buildId()}`;

const parseError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return 'Error inesperado';
};

function SPVSystem() {
  const [dailyVotesLeft, setDailyVotesLeft] = useState<number>(MAX_DAILY_VOTES);
  const [pointsAvailable, setPointsAvailable] = useState<number>(42);
  const [totalPointsAccumulated, setTotalPointsAccumulated] = useState<number>(1240);
  const [activities, setActivities] = useState<Activity[]>(INITIAL_ACTIVITIES);
  const [history, setHistory] = useState<HistoryEntry[]>([
    {
      id: buildId(),
      type: 'transfer',
      text: '@carlos -> tu (+5 pts)',
      createdAt: formatDate(),
    },
    {
      id: buildId(),
      type: 'vote',
      text: 'Voto global en Peluquerias',
      createdAt: formatDate(),
    },
  ]);
  const [activeTab, setActiveTab] = useState<'activities' | 'points' | 'history'>('activities');
  const [receiver, setReceiver] = useState<string>('');
  const [amount, setAmount] = useState<number>(5);
  const [message, setMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState<boolean>(false);

  const todayVotesUsed = MAX_DAILY_VOTES - dailyVotesLeft;

  const groupedActivities = useMemo(
    () => ({
      global: activities.filter((activity) => activity.type === 'global'),
      local: activities.filter((activity) => activity.type === 'local'),
    }),
    [activities]
  );

  const pushHistory = (type: HistoryEntry['type'], text: string): void => {
    setHistory((prev) => [{ id: buildId(), type, text, createdAt: formatDate() }, ...prev].slice(0, 12));
  };

  const pushLog = (level: LogEntry['level'], action: string, logMessage: string): void => {
    const next: LogEntry = {
      id: buildId(),
      level,
      action,
      message: logMessage,
      createdAt: formatDate(),
    };

    if (level === 'error') {
      console.error(`[SPV][${action}] ${logMessage}`);
    } else if (level === 'warn') {
      console.warn(`[SPV][${action}] ${logMessage}`);
    } else {
      console.info(`[SPV][${action}] ${logMessage}`);
    }

    setLogs((prev) => [next, ...prev].slice(0, 20));
  };

  useEffect(() => {
    // Carga inicial: si backend no esta disponible, el modulo mantiene modo local.
    const loadInitialData = async (): Promise<void> => {
      try {
        const bootstrap = await getSpvBootstrapState(DEMO_USER_ID);
        setPointsAvailable(bootstrap.available);
        setTotalPointsAccumulated(bootstrap.historical);
        setDailyVotesLeft(bootstrap.remainingVotes);
        pushLog('info', 'bootstrap', 'Estado inicial cargado desde API');
      } catch (error) {
        pushLog('warn', 'bootstrap', `API no disponible, se usa modo local: ${parseError(error)}`);
      }
    };

    void loadInitialData();
  }, []);

  const handleVote = async (activityId: string): Promise<void> => {
    if (dailyVotesLeft <= 0) {
      setMessage('No te quedan votos hoy.');
      pushLog('warn', 'vote', 'Intento bloqueado por limite diario');
      return;
    }

    const activity = activities.find((entry) => entry.id === activityId);
    if (!activity) {
      setMessage('Actividad no encontrada.');
      pushLog('error', 'vote', `No existe actividad ${activityId}`);
      return;
    }

    setIsSubmitting(true);
    const requestId = buildRequestId('vote');
    try {
      const response = await castVote(activityId, requestId);

      const generatedPoints = Math.max(0, response.pointsGranted);
      setActivities((prev) => prev.map((entry) => (entry.id === activityId ? { ...entry, votes: entry.votes + 1 } : entry)));
      setDailyVotesLeft(response.remainingVotes);
      setPointsAvailable((prev) => Math.min(MAX_AVAILABLE_POINTS, prev + generatedPoints));
      setTotalPointsAccumulated((prev) => prev + generatedPoints);
      pushHistory('vote', `Voto ${activity.type} en ${activity.name} (+${generatedPoints} pts)`);
      setMessage(`Voto registrado. +${generatedPoints} puntos.`);
      pushLog('info', 'vote', `Voto registrado por API con request_id=${requestId}`);
    } catch (error) {
      // Fallback local para no bloquear la interfaz durante desarrollo.
      const generatedPoints = Math.max(1, Math.round(activity.pointsPerHour * 2));
      setActivities((prev) => prev.map((entry) => (entry.id === activityId ? { ...entry, votes: entry.votes + 1 } : entry)));
      setDailyVotesLeft((prev) => prev - 1);
      setPointsAvailable((prev) => Math.min(MAX_AVAILABLE_POINTS, prev + generatedPoints));
      setTotalPointsAccumulated((prev) => prev + generatedPoints);
      pushHistory('vote', `Voto ${activity.type} en ${activity.name} (+${generatedPoints} pts)`);
      setMessage(`Voto registrado (modo local). +${generatedPoints} puntos.`);
      pushLog('warn', 'vote', `Error API: ${parseError(error)}. Se aplico fallback local`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransfer = async (): Promise<void> => {
    const cleanedReceiver = receiver.trim();
    if (!cleanedReceiver || amount <= 0) {
      setMessage('Datos de transferencia invalidos.');
      pushLog('warn', 'transfer', 'Validacion local fallida');
      return;
    }
    if (amount > pointsAvailable) {
      setMessage('Saldo de puntos insuficiente.');
      pushLog('warn', 'transfer', 'Saldo insuficiente para transferir');
      return;
    }

    setIsSubmitting(true);
    const requestId = buildRequestId('transfer');
    try {
      await transferPoints({
        fromUserId: DEMO_USER_ID,
        toUserId: cleanedReceiver,
        amount,
        requestId,
      });

      setPointsAvailable((prev) => prev - amount);
      pushHistory('transfer', `Tu -> ${cleanedReceiver} (-${amount} pts)`);
      setMessage(`Transferencia realizada a ${cleanedReceiver}.`);
      pushLog('info', 'transfer', `Transferencia registrada por API con request_id=${requestId}`);
    } catch (error) {
      setPointsAvailable((prev) => prev - amount);
      pushHistory('transfer', `Tu -> ${cleanedReceiver} (-${amount} pts)`);
      setMessage(`Transferencia aplicada en modo local a ${cleanedReceiver}.`);
      pushLog('warn', 'transfer', `Error API: ${parseError(error)}. Se aplico fallback local`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceive = async (): Promise<void> => {
    const incoming = 8;
    const requestId = buildRequestId('credit');
    setIsSubmitting(true);
    try {
      await creditPoints({
        userId: DEMO_USER_ID,
        amount: incoming,
        reason: 'manual_receive_simulation',
        requestId,
      });

      setPointsAvailable((prev) => Math.min(MAX_AVAILABLE_POINTS, prev + incoming));
      setTotalPointsAccumulated((prev) => prev + incoming);
      pushHistory('transfer', `@laura -> tu (+${incoming} pts)`);
      setMessage(`Recibiste ${incoming} puntos de @laura.`);
      pushLog('info', 'credit', `Credito registrado por API con request_id=${requestId}`);
    } catch (error) {
      setPointsAvailable((prev) => Math.min(MAX_AVAILABLE_POINTS, prev + incoming));
      setTotalPointsAccumulated((prev) => prev + incoming);
      pushHistory('transfer', `@laura -> tu (+${incoming} pts)`);
      setMessage(`Recibiste ${incoming} puntos (modo local).`);
      pushLog('warn', 'credit', `Error API: ${parseError(error)}. Se aplico fallback local`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Sistema de Votos y Puntos</h2>
          <p className="text-sm text-slate-600">SPV conectado para integracion con inventario</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-500">
            <Vote size={16} />
            Votos de hoy
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {todayVotesUsed}
            <span className="ml-1 text-base font-medium text-slate-500">/ {MAX_DAILY_VOTES}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-500">
            <Coins size={16} />
            Puntos disponibles
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {pointsAvailable}
            <span className="ml-1 text-base font-medium text-slate-500">/ {MAX_AVAILABLE_POINTS}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-500">
            <History size={16} />
            Puntos historicos
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{totalPointsAccumulated.toLocaleString('es-ES')}</div>
        </div>
      </div>

      <div className="mt-5 inline-flex rounded-full border border-slate-300 bg-white p-1">
        {[
          { id: 'activities', label: 'Actividades', icon: Vote },
          { id: 'points', label: 'Puntos', icon: Coins },
          { id: 'history', label: 'Historial', icon: History },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <tab.icon size={15} />
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {activeTab === 'activities' && (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[...groupedActivities.global, ...groupedActivities.local].map((activity) => (
            <article key={activity.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                {activity.type}
              </div>
              <h3 className="text-xl font-bold text-slate-900">{activity.name}</h3>
              <p className="mt-2 text-sm text-slate-600">{activity.context}</p>
              <div className="mt-3 text-sm text-slate-600">Ratio: {activity.pointsPerHour.toFixed(2)} pts/hora</div>
              <div className="mt-1 text-sm font-semibold text-slate-800">Votos: {activity.votes.toLocaleString('es-ES')}</div>
              <button
                type="button"
                onClick={() => {
                  void handleVote(activity.id);
                }}
                disabled={isSubmitting}
                className="mt-4 rounded-full border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50"
              >
                <span className="inline-flex items-center gap-2">
                  <PlusCircle size={16} />
                  Registrar voto
                </span>
              </button>
            </article>
          ))}
        </div>
      )}

      {activeTab === 'points' && (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-bold text-slate-900">Transferir puntos</h3>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={receiver}
                onChange={(event) => setReceiver(event.target.value)}
                placeholder="@usuario"
                className="w-full rounded-full border border-slate-300 px-4 py-2 text-sm outline-none ring-blue-500 focus:ring"
              />
              <input
                type="number"
                value={amount}
                min={1}
                onChange={(event) => setAmount(Number(event.target.value))}
                className="w-full rounded-full border border-slate-300 px-4 py-2 text-sm outline-none ring-blue-500 focus:ring sm:max-w-36"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                void handleTransfer();
              }}
              disabled={isSubmitting}
              className="mt-4 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <span className="inline-flex items-center gap-2">
                <ArrowLeftRight size={16} />
                Transferir
              </span>
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-bold text-slate-900">Acciones rapidas</h3>
            <button
              type="button"
              onClick={() => {
                void handleReceive();
              }}
              disabled={isSubmitting}
              className="mt-4 rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
            >
              <span className="inline-flex items-center gap-2">
                <Sparkles size={16} />
                Simular recepcion de 8 puntos
              </span>
            </button>
            <div className="mt-4 text-sm text-slate-700">Saldo actual: {pointsAvailable} pts</div>
            <div className="text-sm text-slate-700">Historico: {totalPointsAccumulated.toLocaleString('es-ES')} pts</div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-lg font-bold text-slate-900">Historial reciente</h3>
          <div className="mt-4 space-y-2">
            {history.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 border-b border-dashed border-slate-200 pb-2 text-sm">
                <span className="text-slate-700">{entry.text}</span>
                <span className="shrink-0 text-slate-500">{entry.createdAt}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {message && <p className="mt-4 text-sm font-medium text-blue-700">{message}</p>}

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900">Diagnostico SPV</h3>
          <button
            type="button"
            onClick={() => setShowLogs((prev) => !prev)}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            {showLogs ? 'Ocultar logs' : 'Ver logs'}
          </button>
        </div>
        {isSubmitting && <p className="mt-2 text-xs font-medium text-amber-700">Procesando solicitud...</p>}
        {showLogs && (
          <div className="mt-3 space-y-2">
            {logs.length === 0 && <p className="text-xs text-slate-500">Sin eventos registrados aun.</p>}
            {logs.map((entry) => (
              <div key={entry.id} className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
                <span className="mr-2 font-semibold">[{entry.createdAt}]</span>
                <span className="mr-2 uppercase">{entry.level}</span>
                <span className="mr-2">{entry.action}:</span>
                <span>{entry.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default SPVSystem;