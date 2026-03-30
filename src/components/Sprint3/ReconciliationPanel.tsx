import { AlertTriangle, CheckCircle, DollarSign, TrendingDown } from "lucide-react";
import { useState } from "react";
import { requestJSON } from "../../services/httpClient";

interface ReconciliationReport {
  timestamp: string;
  totalTransactions: number;
  totalPoints: number;
  balanceChecks: Array<{
    account: string;
    expected: number;
    actual: number;
    discrepancy: number;
    status: "ok" | "mismatch";
  }>;
  invariants: Array<{
    rule: string;
    satisfied: boolean;
    details: string;
  }>;
  overallStatus: "healthy" | "warning" | "critical";
}

export function ReconciliationPanel() {
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [loading, setLoading] = useState(false);

  const runReconciliation = async () => {
    setLoading(true);
    try {
      const data = await requestJSON<ReconciliationReport>("/api/v1/reconciliation/run", {
        method: "POST",
      });
      setReport(data);
    } catch (error) {
      console.error("Error running reconciliation:", error);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async () => {
    if (!report) return;
    try {
      const csv = generateCSV(report);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reconciliation-${new Date().toISOString()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting report:", error);
    }
  };

  const generateCSV = (report: ReconciliationReport): string => {
    const lines = [
      "Reconciliation Report",
      `Timestamp,${report.timestamp}`,
      `Total Transactions,${report.totalTransactions}`,
      `Total Points,${report.totalPoints}`,
      "",
      "Balance Checks",
      "Account,Expected,Actual,Discrepancy,Status",
      ...report.balanceChecks.map(
        (b) => `${b.account},${b.expected},${b.actual},${b.discrepancy},${b.status}`
      ),
      "",
      "Invariants",
      "Rule,Satisfied,Details",
      ...report.invariants.map((i) => `${i.rule},${i.satisfied ? "Yes" : "No"},${i.details}`),
    ];
    return lines.join("\n");
  };

  const statusColor = report
    ? report.overallStatus === "healthy"
      ? "bg-emerald-100 border-emerald-300 text-emerald-800"
      : report.overallStatus === "warning"
        ? "bg-amber-100 border-amber-300 text-amber-800"
        : "bg-red-100 border-red-300 text-red-800"
    : "bg-slate-100 border-slate-300 text-slate-800";

  const statusIcon = report
    ? report.overallStatus === "healthy"
      ? <CheckCircle size={20} />
      : <AlertTriangle size={20} />
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">Panel de Conciliación Contable</h3>
        <button
          onClick={runReconciliation}
          disabled={loading}
          className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Procesando..." : "Ejecutar"}
        </button>
      </div>

      {report && (
        <div className={`rounded-2xl border p-4 ${statusColor}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {statusIcon}
              <div>
                <p className="font-semibold">
                  {report.overallStatus === "healthy"
                    ? "Sano"
                    : report.overallStatus === "warning"
                      ? "Advertencia"
                      : "Crítico"}
                </p>
                <p className="text-xs opacity-75">{report.timestamp}</p>
              </div>
            </div>
            <button
              onClick={exportReport}
              className="rounded-full bg-white bg-opacity-30 px-3 py-1 text-xs font-semibold hover:bg-opacity-50"
            >
              Exportar
            </button>
          </div>
        </div>
      )}

      {report && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="inline-flex items-center gap-2 text-sm text-slate-600">
              <DollarSign size={16} /> Transacciones
            </p>
            <p className="mt-2 text-2xl font-bold">{report.totalTransactions}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="inline-flex items-center gap-2 text-sm text-slate-600">
              <TrendingDown size={16} /> Puntos totales
            </p>
            <p className="mt-2 text-2xl font-bold">{report.totalPoints.toLocaleString("es-ES")}</p>
          </div>
        </div>
      )}

      {report && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h4 className="text-sm font-bold text-slate-900 mb-3">Verificación de Saldos</h4>
            <div className="space-y-2">
              {report.balanceChecks.map((check, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg p-3 ${
                    check.status === "ok"
                      ? "bg-emerald-50 border border-emerald-200"
                      : "bg-red-50 border border-red-200"
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-900">{check.account}</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Esperado: {check.expected} | Actual: {check.actual}
                  </p>
                  {check.discrepancy !== 0 && (
                    <p className="text-xs text-red-600 font-semibold">
                      Discrepancia: {check.discrepancy}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h4 className="text-sm font-bold text-slate-900 mb-3">Invariantes Verificadas</h4>
            <div className="space-y-2">
              {report.invariants.map((inv, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg p-3 flex items-start gap-3 ${
                    inv.satisfied
                      ? "bg-emerald-50 border border-emerald-200"
                      : "bg-red-50 border border-red-200"
                  }`}
                >
                  {inv.satisfied ? (
                    <CheckCircle size={16} className="mt-0.5 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <AlertTriangle size={16} className="mt-0.5 text-red-600 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{inv.rule}</p>
                    <p className="text-xs text-slate-600 mt-1">{inv.details}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!report && !loading && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 text-slate-400" size={32} />
          <p className="text-slate-600">Haz clic en "Ejecutar" para iniciar una conciliación</p>
        </div>
      )}
    </div>
  );
}
