import { neon } from "@neondatabase/serverless";

// Neon serverless connection
const DATABASE_URL = import.meta.env.VITE_DATABASE_URL || "";

let sql: ReturnType<typeof neon> | null = null;

function getSQL() {
  if (!sql && DATABASE_URL) {
    sql = neon(DATABASE_URL);
  }
  return sql;
}

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
  const db = getSQL();
  if (!db) return [];
  
  try {
    const result = await db`SELECT * FROM spv_users ORDER BY points_balance DESC`;
    return result as NeonUser[];
  } catch (error) {
    console.log("[v0] Error fetching users:", error);
    return [];
  }
}

export async function fetchActivities(): Promise<NeonActivity[]> {
  const db = getSQL();
  if (!db) return [];
  
  try {
    const result = await db`SELECT * FROM spv_activities WHERE is_active = true ORDER BY votes_count DESC`;
    return result as NeonActivity[];
  } catch (error) {
    console.log("[v0] Error fetching activities:", error);
    return [];
  }
}

export async function fetchHistory(limit = 50): Promise<NeonHistory[]> {
  const db = getSQL();
  if (!db) return [];
  
  try {
    const result = await db`SELECT * FROM spv_history ORDER BY created_at DESC LIMIT ${limit}`;
    return result as NeonHistory[];
  } catch (error) {
    console.log("[v0] Error fetching history:", error);
    return [];
  }
}

export async function fetchTransactions(limit = 50): Promise<NeonTransaction[]> {
  const db = getSQL();
  if (!db) return [];
  
  try {
    const result = await db`SELECT * FROM spv_transactions ORDER BY created_at DESC LIMIT ${limit}`;
    return result as NeonTransaction[];
  } catch (error) {
    console.log("[v0] Error fetching transactions:", error);
    return [];
  }
}

// =====================
// CREATE Operations
// =====================

export async function createActivity(name: string, type: "global" | "local" = "local", pointsReward = 10): Promise<NeonActivity | null> {
  const db = getSQL();
  if (!db) return null;
  
  try {
    const result = await db`
      INSERT INTO spv_activities (name, type, points_reward, votes_count)
      VALUES (${name}, ${type}, ${pointsReward}, 0)
      RETURNING *
    `;
    return result[0] as NeonActivity;
  } catch (error) {
    console.log("[v0] Error creating activity:", error);
    return null;
  }
}

export async function castVote(activityId: string, userId: string): Promise<{ success: boolean; pointsGranted: number }> {
  const db = getSQL();
  if (!db) return { success: false, pointsGranted: 0 };
  
  try {
    // Get activity to know points reward
    const activityResult = await db`SELECT points_reward FROM spv_activities WHERE id = ${activityId}`;
    const pointsReward = activityResult[0]?.points_reward || 10;
    
    // Increment votes
    await db`UPDATE spv_activities SET votes_count = votes_count + 1 WHERE id = ${activityId}`;
    
    // Credit points to user
    await db`UPDATE spv_users SET points_balance = points_balance + ${pointsReward} WHERE id = ${userId}`;
    
    // Record transaction
    await db`
      INSERT INTO spv_transactions (to_user_id, amount, type, status, description)
      VALUES (${userId}, ${pointsReward}, 'vote_reward', 'success', 'Puntos por voto')
    `;
    
    // Record in history
    await db`
      INSERT INTO spv_history (user_id, description, type, amount, status)
      VALUES (${userId}, 'Voto registrado', 'vote', ${pointsReward}, 'success')
    `;
    
    return { success: true, pointsGranted: pointsReward };
  } catch (error) {
    console.log("[v0] Error casting vote:", error);
    return { success: false, pointsGranted: 0 };
  }
}

export async function transferPoints(fromUserId: string, toUserId: string, amount: number): Promise<boolean> {
  const db = getSQL();
  if (!db) return false;
  
  try {
    // Check balance
    const balanceResult = await db`SELECT points_balance FROM spv_users WHERE id = ${fromUserId}`;
    const balance = balanceResult[0]?.points_balance || 0;
    
    if (balance < amount) return false;
    
    // Deduct from sender
    await db`UPDATE spv_users SET points_balance = points_balance - ${amount} WHERE id = ${fromUserId}`;
    
    // Credit to receiver
    await db`UPDATE spv_users SET points_balance = points_balance + ${amount} WHERE id = ${toUserId}`;
    
    // Record transaction
    await db`
      INSERT INTO spv_transactions (from_user_id, to_user_id, amount, type, status, description)
      VALUES (${fromUserId}, ${toUserId}, ${amount}, 'transfer', 'success', 'Transferencia de puntos')
    `;
    
    // Record in history for both users
    await db`
      INSERT INTO spv_history (user_id, description, type, amount, status)
      VALUES 
        (${fromUserId}, 'Transferencia enviada', 'transfer_out', ${-amount}, 'success'),
        (${toUserId}, 'Transferencia recibida', 'transfer_in', ${amount}, 'success')
    `;
    
    return true;
  } catch (error) {
    console.log("[v0] Error transferring points:", error);
    return false;
  }
}

export async function addHistory(userId: string | null, description: string, type: string, amount = 0): Promise<NeonHistory | null> {
  const db = getSQL();
  if (!db) return null;
  
  try {
    const result = await db`
      INSERT INTO spv_history (user_id, description, type, amount, status)
      VALUES (${userId}, ${description}, ${type}, ${amount}, 'success')
      RETURNING *
    `;
    return result[0] as NeonHistory;
  } catch (error) {
    console.log("[v0] Error adding history:", error);
    return null;
  }
}

// =====================
// UPDATE Operations
// =====================

export async function updateActivity(id: string, name: string): Promise<boolean> {
  const db = getSQL();
  if (!db) return false;
  
  try {
    await db`UPDATE spv_activities SET name = ${name}, updated_at = NOW() WHERE id = ${id}`;
    return true;
  } catch (error) {
    console.log("[v0] Error updating activity:", error);
    return false;
  }
}

export async function updateHistory(id: string, description: string): Promise<boolean> {
  const db = getSQL();
  if (!db) return false;
  
  try {
    await db`UPDATE spv_history SET description = ${description} WHERE id = ${id}`;
    return true;
  } catch (error) {
    console.log("[v0] Error updating history:", error);
    return false;
  }
}

// =====================
// DELETE Operations
// =====================

export async function deleteActivity(id: string): Promise<boolean> {
  const db = getSQL();
  if (!db) return false;
  
  try {
    await db`DELETE FROM spv_activities WHERE id = ${id}`;
    return true;
  } catch (error) {
    console.log("[v0] Error deleting activity:", error);
    return false;
  }
}

export async function deleteHistory(id: string): Promise<boolean> {
  const db = getSQL();
  if (!db) return false;
  
  try {
    await db`DELETE FROM spv_history WHERE id = ${id}`;
    return true;
  } catch (error) {
    console.log("[v0] Error deleting history:", error);
    return false;
  }
}

// =====================
// Health Check
// =====================

export async function checkNeonHealth(): Promise<{ ok: boolean; service: string }> {
  const db = getSQL();
  if (!db) return { ok: false, service: "neon-disconnected" };
  
  try {
    await db`SELECT 1`;
    return { ok: true, service: "neon" };
  } catch {
    return { ok: false, service: "neon-error" };
  }
}
