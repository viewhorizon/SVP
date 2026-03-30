import { AlertTriangle, Bell, TrendingUp } from "lucide-react";
import { useState } from "react";
import { requestJSON } from "../../services/httpClient";

interface OperationalAlert {
  id: string;
  severity: "info" | "warning" | "error" | "critical";
  message: string;
  metric: string;
  value: number;
  threshold: number;
  createdAt: string;
  resolved: boolean;
}

export function AlertsPanel() {
  const [alerts, setAlerts] = useState<OperationalAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ activeAlerts: 0, totalAlerts: 0 });

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await requestJSON<{
        alerts: OperationalAlert[];
        stats: { activeAlerts: number; totalAlerts: number };
      }>("/api/v1/alerts");
      setAlerts(data.alerts || []);
      setStats(data.stats || { activeAlerts: 0, totalAlerts: 0 });
    } catch (error) {
      console.error("Error loading alerts:", error);
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await requestJSON(`/api/v1/alerts/${alertId}/acknowledge`, { method: "POST" });
      setAlerts(alerts.map(a => a.id === alertId ? { ...a, resolved: true } : a));
    } catch (error) {
      console.error("Error acknowledging alert:", error);
    }
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      info: "bg-blue-100 text-blue-800 border-blue-300",
      warning: "bg-amber-100 text-amber-800 border-amber-300",
      error: "bg-red-100 text-red-800 border-red-300",
      critical: "bg-rose-100 text-rose-800 border-rose-300",
    };
    return colors[severity] || colors.info;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">Alertas Operativas</h3>
        <button
          onClick={loadAlerts}
          disabled={loading}
          className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Cargando..." : "Recargar"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="inline-flex items-center gap-2 text-sm text-slate-600">
            <Bell size={16} /> Activas
          </p>
          <p className="text-2xl font-bold text-slate-900">{stats.activeAlerts}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="inline-flex items-center gap-2 text-sm text-slate-600">
            <TrendingUp size={16} /> Totales
          </p>
          <p className="text-2xl font-bold text-slate-900">{stats.totalAlerts}</p>
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 text-slate-400" size={32} />
          <p className="text-slate-600">Sin alertas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-2xl border p-4 ${getSeverityColor(alert.severity)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-semibold">{alert.message}</p>
                  <p className="text-xs mt-1 opacity-75">
                    {alert.metric}: {alert.value} (umbral: {alert.threshold})
                  </p>
                  <p className="text-xs mt-1 opacity-60">{alert.createdAt}</p>
                </div>
                {!alert.resolved && (
                  <button
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="ml-2 rounded-full bg-white bg-opacity-30 px-3 py-1 text-xs font-semibold hover:bg-opacity-50"
                  >
                    Reconocer
                  </button>
                )}
                {alert.resolved && <span className="text-xs font-semibold">Resuelta</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
