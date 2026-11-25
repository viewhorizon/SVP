import { useState } from "react";
import useSWR from "swr";
import { AlertTriangle, Package, Play, ShoppingBag } from "lucide-react";
import { requestJSON } from "../services/httpClient";

interface InventoryPanelProps {
  onOpenSimulation: () => void;
}

interface CatalogItem {
  itemId: string;
  name: string;
  description: string | null;
  priceSpv: number;
  stock: number | null;
  scope: "global" | "local";
  parkId: string | null;
}

interface OwnedItem {
  itemId: string;
  name: string | null;
  quantity: number;
  scope: "global" | "local";
}

interface Balance {
  available: number;
  historical: number;
}

const CATALOG_KEY = "/api/inventory/catalog";
const OWNED_KEY = "/api/inventory/me";
const BALANCE_KEY = "/api/points/balance";
const fetcher = <T,>(path: string) => requestJSON<T>(path);

export function InventoryPanel({ onOpenSimulation }: InventoryPanelProps) {
  const [purchaseError, setPurchaseError] = useState("");
  const [purchaseNotice, setPurchaseNotice] = useState("");
  const [purchasingItem, setPurchasingItem] = useState<string | null>(null);
  const { data: catalogData, error: catalogError, isLoading: catalogLoading, mutate: refreshCatalog } = useSWR<{ items: CatalogItem[] }>(CATALOG_KEY, fetcher);
  const { data: ownedData, error: ownedError, isLoading: ownedLoading, mutate: refreshOwned } = useSWR<{ items: OwnedItem[] }>(OWNED_KEY, fetcher);
  const { data: balance, error: balanceError, isLoading: balanceLoading, mutate: refreshBalance } = useSWR<Balance>(BALANCE_KEY, fetcher);

  const catalog = catalogData?.items ?? [];
  const owned = ownedData?.items ?? [];
  const loadError = catalogError ?? ownedError ?? balanceError;
  const hasError = Boolean(loadError);

  async function purchase(item: CatalogItem) {
    setPurchaseError("");
    setPurchaseNotice("");
    setPurchasingItem(item.itemId);
    try {
      const result = await requestJSON<{ quantity: number; totalCost: number; balance: Balance; idempotent: boolean }>("/api/inventory/purchase", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ itemId: item.itemId, quantity: 1, ...(item.parkId ? { parkId: item.parkId } : {}) }),
      });
      setPurchaseNotice(result.idempotent ? "La compra ya estaba registrada." : `Compra registrada: 1 unidad por ${result.totalCost} puntos SVP.`);
      await Promise.all([refreshCatalog(), refreshOwned(), refreshBalance()]);
    } catch (error) {
      setPurchaseError(error instanceof Error ? error.message : "No se pudo completar la compra.");
    } finally {
      setPurchasingItem(null);
    }
  }

  return (
    <section className="mt-5 space-y-5" aria-labelledby="inventory-heading">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 id="inventory-heading" className="inline-flex items-center gap-2 text-lg font-bold text-slate-900">
              <Package size={20} className="text-blue-600" /> Inventario del sistema
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Catálogo e inventario guardados en la base de datos del sistema. Las compras descuentan puntos SVP y actualizan el historial de inventario; no se sincronizan con una plataforma externa.
            </p>
          </div>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${hasError ? "border-rose-300 bg-rose-50 text-rose-900" : "border-emerald-300 bg-emerald-50 text-emerald-900"}`} role="status">
            <span className={`size-2 rounded-full ${hasError ? "bg-rose-500" : "bg-emerald-500"}`} aria-hidden="true" />
            {hasError ? "API no disponible" : "Inventario SVP"}
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">Saldo disponible</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{balanceLoading ? "…" : balance ? `${balance.available.toLocaleString("es-ES")} SVP` : "—"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-600">Artículos en tu inventario</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{ownedLoading ? "…" : owned.reduce((total, item) => total + item.quantity, 0).toLocaleString("es-ES")}</p>
          </div>
        </div>

        {(hasError || purchaseError) && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-950" role="alert">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-700" aria-hidden="true" />
            <p>{purchaseError || loadError?.message || "No se pudieron cargar los datos persistidos. Comprueba la conexión con la API y vuelve a intentarlo."}</p>
          </div>
        )}
        {purchaseNotice && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{purchaseNotice}</p>}

        <div className="mt-6">
          <h4 className="text-base font-semibold text-slate-900">Catálogo disponible</h4>
          {catalogLoading ? <p className="mt-3 text-sm text-slate-500" role="status">Cargando catálogo…</p> : catalog.length === 0 ? <p className="mt-3 text-sm text-slate-500">No hay artículos disponibles en el catálogo.</p> : (
            <ul className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200">
              {catalog.map((item) => {
                const outOfStock = item.stock !== null && item.stock < 1;
                const insufficientBalance = (balance?.available ?? 0) < item.priceSpv;
                return (
                  <li key={item.itemId} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      {item.description && <p className="mt-1 text-sm text-slate-600">{item.description}</p>}
                      <p className="mt-1 text-xs text-slate-500">{item.priceSpv.toLocaleString("es-ES")} puntos SVP · {item.scope === "global" ? "Global" : "Local"} · {item.stock === null ? "Existencias ilimitadas" : `${item.stock} disponibles`}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void purchase(item)}
                      disabled={Boolean(purchasingItem) || outOfStock || insufficientBalance || balanceLoading || Boolean(hasError)}
                      aria-label={`Comprar ${item.name} por ${item.priceSpv} puntos SVP`}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ShoppingBag size={15} aria-hidden="true" /> {purchasingItem === item.itemId ? "Procesando…" : "Comprar"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-6">
          <h4 className="text-base font-semibold text-slate-900">Tus artículos</h4>
          {owned.length === 0 ? <p className="mt-3 text-sm text-slate-500">Todavía no tienes artículos registrados.</p> : (
            <ul className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200">
              {owned.map((item) => <li key={`${item.itemId}:${item.scope}`} className="flex items-center justify-between gap-3 p-4 text-sm"><span className="font-medium text-slate-900">{item.name ?? item.itemId}</span><span className="text-slate-600">{item.quantity} · {item.scope === "global" ? "Global" : "Local"}</span></li>)}
            </ul>
          )}
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
          <p>La simulación de actividad SVP no representa una conexión con un proveedor externo ni sincroniza sus existencias.</p>
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
