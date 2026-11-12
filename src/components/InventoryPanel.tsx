import { useRef, useState } from "react";
import useSWR from "swr";
import { AlertCircle, Coins, Package, RefreshCw, ShoppingBag } from "lucide-react";
import {
  getInventoryCatalog,
  getOwnedInventory,
  getPointsBalance,
  purchaseInventoryItem,
  type InventoryCatalogItem,
} from "../services/inventoryApi";

const formatPoints = (points: number) => `${points.toLocaleString("es-ES")} pts`;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error inesperado al conectar con el inventario.";
}

export function InventoryPanel() {
  const {
    data: catalog,
    error: catalogError,
    isLoading: isCatalogLoading,
    mutate: refreshCatalog,
  } = useSWR("/api/inventory/catalog", getInventoryCatalog);
  const {
    data: ownedInventory,
    error: inventoryError,
    isLoading: isInventoryLoading,
    mutate: refreshInventory,
  } = useSWR("/api/inventory/me", getOwnedInventory);
  const {
    data: balance,
    error: balanceError,
    isLoading: isBalanceLoading,
    mutate: refreshBalance,
  } = useSWR("/api/points/balance", getPointsBalance);

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [purchasingItemId, setPurchasingItemId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const retryRequest = useRef<{ signature: string; requestId: string } | null>(null);

  const refreshAll = async () => {
    try {
      await Promise.all([refreshCatalog(), refreshInventory(), refreshBalance()]);
      setNotice(null);
    } catch {
      setNotice({ type: "error", text: "No se pudieron actualizar los datos. Inténtalo de nuevo." });
    }
  };

  const handlePurchase = async (item: InventoryCatalogItem, quantity: number) => {
    const parkId = item.scope === "local" ? item.parkId ?? undefined : undefined;
    const signature = `${item.itemId}:${quantity}:${parkId ?? ""}`;
    const requestId = retryRequest.current?.signature === signature
      ? retryRequest.current.requestId
      : crypto.randomUUID();
    retryRequest.current = { signature, requestId };
    setPurchasingItemId(item.itemId);
    setNotice(null);

    try {
      const result = await purchaseInventoryItem({ itemId: item.itemId, quantity, parkId, requestId });
      retryRequest.current = null;
      setNotice({
        type: "success",
        text: `Compra registrada: ${quantity} ${quantity === 1 ? "unidad" : "unidades"}. Se descontaron ${formatPoints(result.totalCost)}.`,
      });
      await Promise.all([refreshCatalog(), refreshInventory(), refreshBalance()]);
    } catch (error) {
      setNotice({ type: "error", text: getErrorMessage(error) });
    } finally {
      setPurchasingItemId(null);
    }
  };

  const items = catalog?.items ?? [];
  const ownedItems = ownedInventory?.items ?? [];
  const hasLoadError = Boolean(catalogError || inventoryError || balanceError);
  const isLoading = isCatalogLoading || isInventoryLoading || isBalanceLoading;

  return (
    <section className="mt-5 space-y-5" aria-labelledby="inventory-heading">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <h3 id="inventory-heading" className="inline-flex items-center gap-2 text-lg font-bold text-slate-900">
            <Package size={20} className="text-blue-600" /> Inventario de objetos
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Las compras usan el precio del catálogo y descuentan puntos del wallet SVP mediante el ledger.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3">
          <Coins size={18} className="text-emerald-700" />
          <div>
            <p className="text-xs font-medium text-emerald-800">Saldo disponible</p>
            <p className="text-lg font-bold text-emerald-900">
              {balance ? formatPoints(balance.available) : isBalanceLoading ? "Cargando…" : "No disponible"}
            </p>
          </div>
        </div>
      </div>

      {notice && (
        <div
          role={notice.type === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`rounded-xl border px-4 py-3 text-sm ${notice.type === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
        >
          {notice.text}
        </div>
      )}

      {hasLoadError && !isLoading && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <span className="inline-flex items-center gap-2"><AlertCircle size={16} /> No se pudieron cargar todos los datos reales del inventario y el saldo.</span>
          <button type="button" onClick={() => void refreshAll()} className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-semibold hover:bg-amber-100">
            Reintentar
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="catalog-heading">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h4 id="catalog-heading" className="text-base font-bold text-slate-900">Catálogo disponible</h4>
              <p className="mt-1 text-xs text-slate-500">Precios y stock consultados directamente desde el backend.</p>
            </div>
            <button type="button" onClick={() => void refreshAll()} aria-label="Actualizar inventario y saldo" className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50">
              <RefreshCw size={16} />
            </button>
          </div>

          {isCatalogLoading ? (
            <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Cargando catálogo…</p>
          ) : catalogError ? (
            <p className="rounded-xl bg-amber-50 px-4 py-8 text-center text-sm text-amber-800">El catálogo no está disponible.</p>
          ) : items.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">El catálogo no tiene objetos activos.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {items.map((item) => {
                const quantity = quantities[item.itemId] ?? 1;
                const total = item.priceSpv * quantity;
                const outOfStock = item.stock !== null && item.stock < quantity;
                const missingPark = item.scope === "local" && !item.parkId;
                const canPurchase = Boolean(balance)
                  && !balanceError
                  && Number.isInteger(quantity)
                  && quantity >= 1
                  && quantity <= 50
                  && !outOfStock
                  && !missingPark
                  && total <= (balance?.available ?? 0);

                return (
                  <article key={item.itemId} className="flex flex-col rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h5 className="font-semibold text-slate-900">{item.name}</h5>
                        <p className="mt-1 text-xs text-slate-500">{item.scope === "global" ? "Global" : `Local${item.parkId ? ` · ${item.parkId}` : ""}`}</p>
                      </div>
                      <span className="whitespace-nowrap rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{formatPoints(item.priceSpv)} / unidad</span>
                    </div>
                    {item.description && <p className="mt-3 text-sm leading-5 text-slate-600">{item.description}</p>}
                    <p className="mt-3 text-xs text-slate-500">{item.stock === null ? "Stock sin límite" : `Stock: ${item.stock}`}</p>
                    <div className="mt-auto flex items-end gap-2 pt-4">
                      <label className="min-w-20 flex-1 text-xs font-medium text-slate-600">
                        Cantidad
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={quantity}
                          aria-label={`Cantidad de ${item.name}`}
                          onChange={(event) => {
                            const next = Number(event.target.value);
                            setQuantities((current) => ({ ...current, [item.itemId]: next }));
                          }}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void handlePurchase(item, quantity)}
                        disabled={!canPurchase || purchasingItemId !== null}
                        className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        <ShoppingBag size={15} /> {purchasingItemId === item.itemId ? "Comprando…" : "Comprar"}
                      </button>
                    </div>
                    <p className="mt-2 text-right text-xs text-slate-500">Total: {formatPoints(total)}</p>
                    {missingPark && <p className="mt-1 text-xs text-amber-700">Este objeto local no tiene un local asignado.</p>}
                    {outOfStock && <p className="mt-1 text-xs text-rose-700">Stock insuficiente para esa cantidad.</p>}
                    {!balanceError && balance && total > balance.available && <p className="mt-1 text-xs text-rose-700">Saldo SVP insuficiente.</p>}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="owned-heading">
          <div className="mb-4">
            <h4 id="owned-heading" className="text-base font-bold text-slate-900">Mis objetos</h4>
            <p className="mt-1 text-xs text-slate-500">Inventario asociado a la sesión actual.</p>
          </div>
          {isInventoryLoading ? (
            <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Cargando inventario…</p>
          ) : inventoryError ? (
            <p className="rounded-xl bg-amber-50 px-4 py-8 text-center text-sm text-amber-800">El inventario no está disponible.</p>
          ) : ownedItems.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">No hay objetos en el inventario.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {ownedItems.map((item) => (
                <li key={`${item.itemId}:${item.scope}:${item.parkId ?? "global"}`} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-medium text-slate-900">{item.name ?? item.sku ?? item.itemId}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.scope === "global" ? "Global" : `Local${item.parkId ? ` · ${item.parkId}` : ""}`}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-sm font-bold text-slate-700">×{item.quantity}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}
