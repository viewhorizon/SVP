import { requestJSON } from "./httpClient";

export interface SpvBootstrapState {
  available: number;
  historical: number;
  remainingVotes: number;
}

export interface VoteResult {
  pointsGranted: number;
  remainingVotes: number;
}

export interface ApiHealth {
  ok: boolean;
  service?: string;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  pointsBalance: number;
}

export interface Activity {
  id: string;
  name: string;
  type: "global" | "local";
  pointsPerHour: number;
  votes: number;
  context: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Transaction {
  id: string;
  type: "vote" | "transfer" | "credit" | "debit";
  amount: number;
  description: string;
  status: "success" | "pending" | "error";
  fromUserId?: string;
  toUserId?: string;
  activityId?: string;
  createdAt: string;
}

const MAX_DAILY_VOTES = 5;

const asNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const pickFirstFinite = (...values: unknown[]): number | null => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

type BalanceResponse = {
  available?: number;
  historical?: number;
  points_available?: number;
  total_points_accumulated?: number;
};

type VoteCountResponse = {
  votesToday?: number;
  usedToday?: number;
  remainingVotes?: number;
  remaining?: number;
};

type VoteLimitsResponse = {
  dailyLimit?: number;
  remainingVotes?: number;
  remaining?: number;
  usedVotes?: number;
};

// =====================
// READ Operations
// =====================

export async function getSpvBootstrapState(userId: string): Promise<SpvBootstrapState> {
  const [balance, voteCount, voteLimits] = await Promise.all([
    requestJSON<BalanceResponse>(`/api/points/balance/${userId}`),
    requestJSON<VoteCountResponse>("/api/votes/count"),
    requestJSON<VoteLimitsResponse>("/api/votes/limits"),
  ]);

  const available = asNumber(balance.available ?? balance.points_available, 0);
  const historical = asNumber(balance.historical ?? balance.total_points_accumulated, 0);
  const remainingVotesValue = pickFirstFinite(
    voteCount.remainingVotes,
    voteCount.remaining,
    voteLimits.remainingVotes,
    voteLimits.remaining,
  );
  const remainingVotes =
    remainingVotesValue ??
    Math.max(
      asNumber(voteLimits.dailyLimit, MAX_DAILY_VOTES) - asNumber(voteCount.votesToday ?? voteCount.usedToday ?? voteLimits.usedVotes, 0),
      0,
    );

  return { available, historical, remainingVotes };
}

export async function checkApiHealth(): Promise<ApiHealth> {
  return requestJSON<ApiHealth>("/health");
}

export async function getUsers(): Promise<User[]> {
  try {
    return await requestJSON<User[]>("/api/users");
  } catch {
    // Fallback con usuarios mock para desarrollo
    return [
      { id: "user-001", username: "carlos", displayName: "Carlos Garcia", pointsBalance: 150 },
      { id: "user-002", username: "laura", displayName: "Laura Martinez", pointsBalance: 230 },
      { id: "user-003", username: "miguel", displayName: "Miguel Lopez", pointsBalance: 89 },
      { id: "user-004", username: "ana", displayName: "Ana Rodriguez", pointsBalance: 320 },
      { id: "user-005", username: "pedro", displayName: "Pedro Sanchez", pointsBalance: 175 },
    ];
  }
}

export async function getActivities(): Promise<Activity[]> {
  try {
    return await requestJSON<Activity[]>("/api/activities");
  } catch {
    return [];
  }
}

export async function getTransactions(userId?: string): Promise<Transaction[]> {
  try {
    const url = userId ? `/api/transactions?userId=${userId}` : "/api/transactions";
    return await requestJSON<Transaction[]>(url);
  } catch {
    return [];
  }
}

export async function getTableData(tableName: string): Promise<Record<string, unknown>[]> {
  try {
    return await requestJSON<Record<string, unknown>[]>(`/api/data/${tableName}`);
  } catch {
    return [];
  }
}

// =====================
// CREATE Operations
// =====================

type VotePayload = { pointsGranted?: number; limits?: { remainingVotes?: number } };

export async function castVote(activityId: string, requestId: string): Promise<VoteResult> {
  const payload = await requestJSON<VotePayload>("/api/votes", {
    method: "POST",
    body: JSON.stringify({ activityId, requestId, request_id: requestId }),
  });

  return {
    pointsGranted: Math.max(0, asNumber(payload.pointsGranted, 0)),
    remainingVotes: Math.max(0, asNumber(payload.limits?.remainingVotes, 0)),
  };
}

type TransferPayload = { fromUserId: string; toUserId: string; amount: number; requestId: string };

export async function transferPoints(payload: TransferPayload): Promise<void> {
  await requestJSON("/api/points/transfer", {
    method: "POST",
    body: JSON.stringify({ ...payload, request_id: payload.requestId }),
  });
}

type CreditPayload = { userId: string; amount: number; reason: string; requestId: string };

export async function creditPoints(payload: CreditPayload): Promise<void> {
  await requestJSON("/api/points/credit", {
    method: "POST",
    body: JSON.stringify({ ...payload, request_id: payload.requestId }),
  });
}

export async function createActivity(activity: Omit<Activity, "id" | "createdAt" | "updatedAt">): Promise<Activity> {
  try {
    return await requestJSON<Activity>("/api/activities", {
      method: "POST",
      body: JSON.stringify(activity),
    });
  } catch {
    // Fallback local
    return {
      ...activity,
      id: `act-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

// =====================
// UPDATE Operations
// =====================

export async function updateActivity(id: string, updates: Partial<Activity>): Promise<Activity> {
  try {
    return await requestJSON<Activity>(`/api/activities/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  } catch {
    // Fallback local
    return { id, ...updates } as Activity;
  }
}

export async function updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
  try {
    return await requestJSON<Transaction>(`/api/transactions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  } catch {
    return { id, ...updates } as Transaction;
  }
}

// =====================
// DELETE Operations
// =====================

export async function deleteActivity(id: string): Promise<void> {
  try {
    await requestJSON(`/api/activities/${id}`, { method: "DELETE" });
  } catch {
    // Fallback silencioso
  }
}

export async function deleteTransaction(id: string): Promise<void> {
  try {
    await requestJSON(`/api/transactions/${id}`, { method: "DELETE" });
  } catch {
    // Fallback silencioso
  }
}

export async function cancelTransfer(transactionId: string): Promise<void> {
  try {
    await requestJSON(`/api/points/transfer/${transactionId}/cancel`, { method: "POST" });
  } catch {
    // Fallback silencioso
  }
}
