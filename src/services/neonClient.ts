/**
 * SPV MVP API Client
 * Conecta con el backend Express que tiene acceso a Neon
 * El backend corre en puerto 4000 y Vite hace proxy de /api y /health
 */

const API_BASE = '/api';

// =====================
// Types
// =====================

export interface NeonUser {
  id: string;
  username: string;
  name: string;
  email: string | null;
  points_balance: number;
  created_at: string;
}

export interface NeonActivity {
  id: string;
  name: string;
  description: string | null;
  type: "global" | "local";
  votes_count: number;
  points_reward: number;
  is_active: boolean;
  created_at: string;
}

export interface NeonTransaction {
  id: string;
  from_user_id: string | null;
  to_user_id: string | null;
  amount: number;
  type: string;
  status: string;
  description: string | null;
  created_at: string;
}

export interface NeonHistory {
  id: string;
  user_id: string | null;
  description: string;
  type: string;
  amount: number;
  status: string;
  created_at: string;
}

// =====================
// READ Operations
// =====================

export async function fetchUsers(): Promise<NeonUser[]> {
  try {
    const res = await fetch(`${API_BASE}/spv/users`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.ok ? data.data : [];
  } catch (error) {
    console.log("[v0] fetchUsers error:", error);
    return [];
  }
}

export async function fetchActivities(): Promise<NeonActivity[]> {
  try {
    const res = await fetch(`${API_BASE}/spv/activities`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.ok ? data.data : [];
  } catch (error) {
    console.log("[v0] fetchActivities error:", error);
    return [];
  }
}

export async function fetchHistory(limit = 50): Promise<NeonHistory[]> {
  try {
    const res = await fetch(`${API_BASE}/spv/history?limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.ok ? data.data : [];
  } catch (error) {
    console.log("[v0] fetchHistory error:", error);
    return [];
  }
}

export async function fetchTransactions(limit = 50): Promise<NeonTransaction[]> {
  try {
    const res = await fetch(`${API_BASE}/spv/transactions?limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.ok ? data.data : [];
  } catch (error) {
    console.log("[v0] fetchTransactions error:", error);
    return [];
  }
}

// =====================
// CREATE Operations
// =====================

export async function createActivity(name: string, type: "global" | "local" = "local", pointsReward = 10): Promise<NeonActivity | null> {
  try {
    const res = await fetch(`${API_BASE}/spv/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, pointsReward }),
    });
    const data = await res.json();
    return data.ok ? data.data : null;
  } catch (error) {
    console.log("[v0] createActivity error:", error);
    return null;
  }
}

export async function castVote(activityId: string, userId?: string): Promise<{ success: boolean; pointsGranted: number }> {
  try {
    const res = await fetch(`${API_BASE}/spv/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activityId, userId, points: 10 }),
    });
    const data = await res.json();
    return { success: data.ok, pointsGranted: data.ok ? 10 : 0 };
  } catch (error) {
    console.log("[v0] castVote error:", error);
    return { success: false, pointsGranted: 0 };
  }
}

export async function transferPoints(fromUserId: string | null, toUsername: string, amount: number): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_BASE}/spv/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromUserId, toUsername, amount }),
    });
    const data = await res.json();
    return { ok: data.ok, message: data.message || data.error };
  } catch (error) {
    console.log("[v0] transferPoints error:", error);
    return { ok: false, message: 'Error de conexion' };
  }
}

export async function addHistory(userId: string | null, description: string, type: string, amount = 0): Promise<NeonHistory | null> {
  try {
    const res = await fetch(`${API_BASE}/spv/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, description, type, amount }),
    });
    const data = await res.json();
    return data.ok ? data.data : null;
  } catch (error) {
    console.log("[v0] addHistory error:", error);
    return null;
  }
}

// =====================
// UPDATE Operations
// =====================

export async function updateActivity(id: string, name: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/spv/activities/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    return data.ok;
  } catch (error) {
    console.log("[v0] updateActivity error:", error);
    return false;
  }
}

export async function updateHistory(id: string, description: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/spv/history/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    });
    const data = await res.json();
    return data.ok;
  } catch (error) {
    console.log("[v0] updateHistory error:", error);
    return false;
  }
}

// =====================
// DELETE Operations
// =====================

export async function deleteActivity(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/spv/activities/${id}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    return data.ok;
  } catch (error) {
    console.log("[v0] deleteActivity error:", error);
    return false;
  }
}

export async function deleteHistory(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/spv/history/${id}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    return data.ok;
  } catch (error) {
    console.log("[v0] deleteHistory error:", error);
    return false;
  }
}

// =====================
// Health Check
// =====================

export async function checkNeonHealth(): Promise<{ ok: boolean; service: string }> {
  try {
    const res = await fetch('/health');
    if (!res.ok) return { ok: false, service: "backend-offline" };
    const data = await res.json();
    return { ok: data.ok, service: data.service || "spv-api" };
  } catch {
    return { ok: false, service: "backend-error" };
  }
}
