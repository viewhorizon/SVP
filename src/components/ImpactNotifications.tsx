import { CheckCircle2, X } from "lucide-react";
import { useEffect } from "react";
import type { VoteImpact } from "../services/neonClient";

type ImpactNotification = VoteImpact & { id: string };

interface ImpactNotificationsProps {
  notifications: ImpactNotification[];
  onDismiss: (id: string) => void;
}

export function ImpactNotifications({ notifications, onDismiss }: ImpactNotificationsProps) {
  useEffect(() => {
    const timers = notifications.map((notification) =>
      window.setTimeout(() => onDismiss(notification.id), 6000),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [notifications, onDismiss]);

  if (notifications.length === 0) return null;

  return (
    <aside className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3" aria-live="polite" aria-label="Impactos de votación">
      {notifications.map((notification) => (
        <div key={notification.id} className="pointer-events-auto rounded-xl border border-emerald-200 bg-white p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={20} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">Voto aplicado al backlog</p>
              <p className="mt-1 text-sm text-slate-600">{notification.taskTitle}</p>
              <p className="mt-2 text-xs text-slate-500">
                Tarea: {notification.taskProgress}% · Estado: {notification.taskStatus}
                {notification.strategicTitle ? ` · Estratégico: ${notification.strategicProgress}%` : ""}
              </p>
            </div>
            <button type="button" onClick={() => onDismiss(notification.id)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Cerrar notificación">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
    </aside>
  );
}
