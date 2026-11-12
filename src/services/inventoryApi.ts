import { requestJSON } from "./httpClient";

export interface InventoryCatalogItem {
  itemId: string;
  scope: "global" | "local";
  parkId: string | null;
  sku: string;
  name: string;
  description: string | null;
  priceSpv: number;
  stock: number | null;
  metadata: Record<string, unknown>;
  isActive: boolean;
  updatedAt: string;
}

export interface OwnedInventoryItem {
  userId: string;
  itemId: string;
  quantity: number;
  scope: "global" | "local";
  parkId: string | null;
  name: string | null;
  description: string | null;
  sku: string | null;
  metadata: Record<string, unknown>;
  updatedAt: string;
}

export interface PointsBalance {
  userId: string;
  available: number;
  historical: number;
  updatedAt: string | null;
}

export interface InventoryCatalogResponse {
  items: InventoryCatalogItem[];
}

export interface OwnedInventoryResponse {
  userId: string;
  items: OwnedInventoryItem[];
}

export async function getInventoryCatalog(): Promise<InventoryCatalogResponse> {
  return requestJSON<InventoryCatalogResponse>("/api/inventory/catalog");
}

export async function getOwnedInventory(): Promise<OwnedInventoryResponse> {
  return requestJSON<OwnedInventoryResponse>("/api/inventory/me");
}

export async function getPointsBalance(): Promise<PointsBalance> {
  return requestJSON<PointsBalance>("/api/points/balance");
}

export async function purchaseInventoryItem(payload: {
  itemId: string;
  quantity: number;
  parkId?: string;
  requestId: string;
}): Promise<{ totalCost: number; balance: PointsBalance; idempotent: boolean }> {
  return requestJSON("/api/inventory/purchase", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
