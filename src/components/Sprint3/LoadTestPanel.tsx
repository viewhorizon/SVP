import { Activity, BarChart3, Play, StopCircle } from "lucide-react";
import { useState } from "react";
import { requestJSON } from "../../services/httpClient";

interface LoadTestMetrics {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  avgLatency: number;
  maxLatency: number;
  minLatency: number;
  throughput: number;
  status: "idle" | "running" | "completed";
}

export function LoadTestPanel() {
  const [metrics, setMetrics] = useState<LoadTestMetrics>({
    totalRequests: 0,
    successCount: 0,
    failureCount: 0,
    avgLatency: 0,
    maxLatency: 0,
    minLatency: 0,
    throughput: 0,
    status: "idle",
  });
  const [testConfig, setTestConfig] = useState({
    requestsPerSecond: 10,
    duration: 30,
    testType: "votes",
  });
  const [running, setRunning] = useState(false);

  const startLoadTest = async () => {
    setRunning(true);
    try {
      const response = await requestJSON<{ testId: string }>("/api/v1/load-test/start", {
        method: "POST",
        body: JSON.stringify(testConfig),
      });
      
      // Poll for results
      const pollInterval = setInterval(async () => {
        try {
          const result = await requestJSON<LoadTestMetrics>(`/api/v1/load-test/${response.testId}`);
          setMetrics(result);
          if (result.status === "completed") {
            clearInterval(pollInterval);
            setRunning(false);
          }
        } catch (error) {
          console.error("Error polling test results:", error);
          clearInterval(pollInterval);
          setRunning(false);
        }
      }, 1000);
    } catch (error) {
      console.error("Error starting load test:", error);
      setRunning(false);
    }
  };

  const stopLoadTest = async () => {
    try {
      await requestJSON("/api/v1/load-test/stop", { method: "POST" });
      setRunning(false);
    } catch (error) {
      console.error("Error stopping load test:", error);
    }
  };

  const successRate = metrics.totalRequests > 0 
    ? ((metrics.successCount / metrics.totalRequests) * 100).toFixed(2)
    : "0";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">Suite de Carga (Load Test)</h3>
        {running && <span className="animate-pulse text-xs font-semibold text-red-600">En ejecución...</span>}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
        <div>
          <label className="text-sm font-semibold text-slate-700">Solicitudes/seg</label>
          <input
            type="number"
            min={1}
            value={testConfig.requestsPerSecond}
            onChange={(e) => setTestConfig({ ...testConfig, requestsPerSecond: Number(e.target.value) })}
            disabled={running}
            className="mt-1 w-full rounded-full border border-slate-300 px-4 py-2 text-sm disabled:opacity-50"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700">Duracion (segundos)</label>
          <input
            type="number"
            min={1}
            value={testConfig.duration}
            onChange={(e) => setTestConfig({ ...testConfig, duration: Number(e.target.value) })}
            disabled={running}
            className="mt-1 w-full rounded-full border border-slate-300 px-4 py-2 text-sm disabled:opacity-50"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700">Tipo de prueba</label>
          <select
            value={testConfig.testType}
            onChange={(e) => setTestConfig({ ...testConfig, testType: e.target.value })}
            disabled={running}
            className="mt-1 w-full rounded-full border border-slate-300 px-4 py-2 text-sm disabled:opacity-50"
          >
            <option value="votes">Votos</option>
            <option value="points">Puntos</option>
            <option value="events">Eventos</option>
            <option value="mixed">Mixto</option>
          </select>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={startLoadTest}
            disabled={running}
            className="flex-1 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            <Play size={16} /> Iniciar
          </button>
          <button
            onClick={stopLoadTest}
            disabled={!running}
            className="flex-1 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            <StopCircle size={16} /> Detener
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="inline-flex items-center gap-2 text-xs text-slate-600">
            <BarChart3 size={14} /> Total
          </p>
          <p className="mt-2 text-2xl font-bold">{metrics.totalRequests}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="inline-flex items-center gap-2 text-xs text-slate-600">
            <Activity size={14} /> Éxito
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{successRate}%</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
        <p className="text-sm font-semibold text-slate-700">Latencia (ms)</p>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <p className="text-xs text-slate-600">Promedio</p>
            <p className="font-bold">{metrics.avgLatency.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-600">Máximo</p>
            <p className="font-bold text-red-600">{metrics.maxLatency.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-600">Mínimo</p>
            <p className="font-bold text-emerald-600">{metrics.minLatency.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-700">Throughput</p>
        <p className="mt-2 text-2xl font-bold">{metrics.throughput.toFixed(2)} req/s</p>
      </div>
    </div>
  );
}
