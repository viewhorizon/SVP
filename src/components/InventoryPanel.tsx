import { AlertTriangle, Package, Play } from "lucide-react";

interface InventoryPanelProps {
  onOpenSimulation: () => void;
}

export function InventoryPanel({ onOpenSimulation }: InventoryPanelProps) {
  return (
    <section className="mt-5 space-y-5" aria-labelledby="inventory-heading">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 id="inventory-heading" className="inline-flex items-center gap-2 text-lg font-bold text-slate-900">
              <Package size={20} className="text-blue-600" /> Plataforma de inventario externa
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              No hay una conexión configurada con la plataforma externa de inventario. Esta app no consulta ni modifica sus artículos, existencias u objetos.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-900" role="status">
            <span className="size-2 rounded-full bg-amber-500" aria-hidden="true" />
            Sin conexión
          </span>
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
          <p>
            Puedes probar el contrato de votos SVP con un evento simulado. La simulación no se conecta ni sincroniza datos con la plataforma de inventario.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenSimulation}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <Play size={16} aria-hidden="true" /> Abrir simulación de contrato SVP
        </button>
      </div>
    </section>
  );
}
