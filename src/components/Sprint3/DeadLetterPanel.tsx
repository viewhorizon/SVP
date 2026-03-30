import { AlertCircle, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { requestJSON } from "../../services/httpClient";

interface DeadLetterEvent {
  id: string;
  eventType: string;
  sourceApp: string;
  payload: Record<string, unknown>;
  error: string;
  retryCount: number;
  lastError: string;
  createdAt: string;
}

export function DeadLetterPanel() {
  const [events, setEvents] = useState<DeadLetterEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const loadDeadLetterEvents = async () => {
    setLoading(true);
    try {
      const data = await requestJSON<{ events: DeadLetterEvent[] }>("/api/v1/dead-letter/events");
      setEvents(data.events || []);
    } catch (error) {
      console.error("Error loading dead-letter events:", error);
    } finally {
      setLoading(false);
    }
  };

  const retryEvent = async (eventId: string) => {
    try {
      await requestJSON(`/api/v1/dead-letter/retry/${eventId}`, { method: "POST" });
      setEvents(events.filter(e => e.id !== eventId));
    } catch (error) {
      console.error("Error retrying event:", error);
    }
  };

  const deleteEvent = async (eventId: string) => {
    try {
      await requestJSON(`/api/v1/dead-letter/${eventId}`, { method: "DELETE" });
      setEvents(events.filter(e => e.id !== eventId));
    } catch (error) {
      console.error("Error deleting event:", error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">Dead-Letter Queue</h3>
        <button
          onClick={loadDeadLetterEvents}
          disabled={loading}
          className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Cargando..." : "Recargar"}
        </button>
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <AlertCircle className="mx-auto mb-3 text-slate-400" size={32} />
          <p className="text-slate-600">Sin eventos en dead-letter</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div
              key={event.id}
              onClick={() => setSelectedEventId(selectedEventId === event.id ? null : event.id)}
              className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">{event.eventType}</p>
                  <p className="text-xs text-slate-600">{event.sourceApp}</p>
                  <p className="mt-1 text-xs text-red-600">Reintentos: {event.retryCount}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      retryEvent(event.id);
                    }}
                    className="rounded-full bg-green-600 p-2 text-white hover:bg-green-700"
                    title="Reintentar"
                  >
                    <RefreshCw size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteEvent(event.id);
                    }}
                    className="rounded-full bg-red-600 p-2 text-white hover:bg-red-700"
                    title="Eliminar"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {selectedEventId === event.id && (
                <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                  <p className="text-xs font-semibold text-slate-700">Error:</p>
                  <p className="text-xs text-slate-600">{event.lastError}</p>
                  <p className="text-xs font-semibold text-slate-700 mt-2">Payload:</p>
                  <pre className="text-xs bg-slate-50 p-2 rounded overflow-auto max-h-32">
                    {JSON.stringify(event.payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
