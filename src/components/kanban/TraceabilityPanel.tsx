import { Clock3, Fingerprint, Link2 } from "lucide-react";

export interface TraceabilityEntry {
  id: string;
  timestamp: string;
  action: string;
  source: "ui" | "api";
  status: "ok" | "error";
  requestId?: string;
  eventId?: string;
  detail?: string;
}

interface TraceabilityPanelProps {
  entries: TraceabilityEntry[];
}

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export function TraceabilityPanel({ entries }: TraceabilityPanelProps) {
  return (
    <section className="metrics-neon-panel rounded-xl border border-cyan-400/30 bg-slate-950/80 p-4 text-slate-100 backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 text-sm font-bold text-cyan-200">
          <Fingerprint size={16} />
          Trazabilidad requestId/eventId
        </h3>
        <p className="text-xs text-slate-300">Ultimos eventos para soporte y auditoria operativa.</p>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
          Aun no hay trazas en esta sesion.
        </p>
      ) : (
        <div className="hide-scrollbar max-h-72 overflow-y-auto rounded-lg border border-slate-700">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-300">
              <tr>
                <th className="px-3 py-2 font-semibold">Fecha</th>
                <th className="px-3 py-2 font-semibold">Accion</th>
                <th className="px-3 py-2 font-semibold">Fuente</th>
                <th className="px-3 py-2 font-semibold">Estado</th>
                <th className="px-3 py-2 font-semibold">IDs</th>
                <th className="px-3 py-2 font-semibold">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t border-slate-800/80 bg-slate-950/60">
                  <td className="px-3 py-2 text-slate-300">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 size={12} />
                      {formatTimestamp(entry.timestamp)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-100">{entry.action}</td>
                  <td className="px-3 py-2 uppercase tracking-wide text-slate-300">{entry.source}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${entry.status === "ok" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {entry.requestId ? <p>requestId: {entry.requestId}</p> : null}
                    {entry.eventId ? (
                      <p className="inline-flex items-center gap-1">
                        <Link2 size={12} />
                        eventId: {entry.eventId}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-slate-300">{entry.detail ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}