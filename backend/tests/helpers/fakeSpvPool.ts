import { randomUUID } from 'node:crypto';

type QueryResult<T extends Record<string, unknown> = Record<string, unknown>> = {
  rowCount: number;
  rows: T[];
};

type Wallet = {
  userId: string;
  available: number;
  lifetime: number;
  updatedAt: string;
};

type VoteRow = {
  voteId: string;
  userId: string;
  activityId: string;
  requestId: string;
  eventId: string;
  pointsGenerated: number;
  createdAt: string;
};

type LedgerRow = {
  ledgerId: string;
  userId: string;
  requestId: string;
  operationType: string;
  amount: number;
  balanceAfter: number;
  createdAt: string;
};

type FakeClient = {
  query: (text: string, values?: unknown[]) => Promise<QueryResult>;
  release: () => void;
};

type FakePool = {
  connect: () => Promise<FakeClient>;
  query: (text: string, values?: unknown[]) => Promise<QueryResult>;
};

const DEFAULT_DAILY_LIMIT = 5;
const DEFAULT_RULE_FORMULA = { base_per_vote: 3, activity_multiplier: 1.25, max_bonus_multiplier: 2.5 };

export function createFakeSpvPool(): FakePool {
  const wallets = new Map<string, Wallet>();
  const votes: VoteRow[] = [];
  const ledgers: LedgerRow[] = [];

  const getNowIso = () => new Date().toISOString();

  const ensureWallet = (userId: string) => {
    const current = wallets.get(userId);
    if (current) return current;
    const created: Wallet = { userId, available: 0, lifetime: 0, updatedAt: getNowIso() };
    wallets.set(userId, created);
    return created;
  };

  const runQuery = async (text: string, values: unknown[] = []): Promise<QueryResult> => {
    const sql = text.replace(/\s+/g, ' ').trim().toLowerCase();

    if (sql === 'begin' || sql === 'commit' || sql === 'rollback') {
      return { rowCount: 0, rows: [] };
    }

    if (sql.startsWith('insert into points_wallet')) {
      const userId = String(values[0] ?? '');
      ensureWallet(userId);
      return { rowCount: 1, rows: [] };
    }

    if (sql.includes('from points_wallet') && sql.includes('for update')) {
      const userId = String(values[0] ?? '');
      const wallet = ensureWallet(userId);
      return {
        rowCount: 1,
        rows: [
          {
            user_id: wallet.userId,
            available_points: String(wallet.available),
            lifetime_points: String(wallet.lifetime),
          },
        ],
      };
    }

    if (sql.startsWith('update points_wallet set available_points')) {
      const userId = String(values[0] ?? '');
      const available = Number(values[1] ?? 0);
      const lifetime = Number(values[2] ?? 0);
      wallets.set(userId, { userId, available, lifetime, updatedAt: getNowIso() });
      return { rowCount: 1, rows: [] };
    }

    if (sql.includes('select user_id, available_points, lifetime_points, updated_at from points_wallet')) {
      const userId = String(values[0] ?? '');
      const wallet = wallets.get(userId);
      if (!wallet) {
        return { rowCount: 0, rows: [] };
      }
      return {
        rowCount: 1,
        rows: [
          {
            user_id: wallet.userId,
            available_points: String(wallet.available),
            lifetime_points: String(wallet.lifetime),
            updated_at: wallet.updatedAt,
          },
        ],
      };
    }

    if (sql.includes('select ledger_id, balance_after') && sql.includes('from points_ledger')) {
      const userId = String(values[0] ?? '');
      const requestId = String(values[1] ?? '');
      const operationType = sql.includes("operation_type = 'points_granted'") ? 'POINTS_GRANTED' : '';

      const existing = ledgers.find(
        (item) => item.userId === userId && item.requestId === requestId && item.operationType === operationType,
      );

      if (!existing) return { rowCount: 0, rows: [] };
      return {
        rowCount: 1,
        rows: [{ ledger_id: existing.ledgerId, balance_after: existing.balanceAfter }],
      };
    }

    if (sql.startsWith('insert into points_ledger')) {
      const requestId = String(values[0] ?? randomUUID());
      const userId = String(values[2] ?? '');
      const operationType = String(values[4] ?? 'POINTS_GRANTED');
      const amount = Number(values[5] ?? 0);
      const balanceAfter = Number(values[7] ?? 0);

      const conflict = ledgers.find(
        (item) => item.userId === userId && item.requestId === requestId && item.operationType === operationType,
      );
      if (conflict) {
        return { rowCount: 0, rows: [] };
      }

      const createdAt = getNowIso();
      const ledgerId = randomUUID();
      ledgers.push({
        ledgerId,
        userId,
        requestId,
        operationType,
        amount,
        balanceAfter,
        createdAt,
      });

      return { rowCount: 1, rows: [{ ledger_id: ledgerId, created_at: createdAt }] };
    }

    if (sql.includes('from points_ledger') && sql.includes('where user_id = $1 and request_id = $2 and operation_type = $3')) {
      const userId = String(values[0] ?? '');
      const requestId = String(values[1] ?? '');
      const operationType = String(values[2] ?? '');
      const existing = ledgers.find(
        (item) => item.userId === userId && item.requestId === requestId && item.operationType === operationType,
      );
      if (!existing) return { rowCount: 0, rows: [] };
      return {
        rowCount: 1,
        rows: [{ ledger_id: existing.ledgerId, balance_after: existing.balanceAfter, created_at: existing.createdAt }],
      };
    }

    if (sql.includes('from point_limits')) {
      return { rowCount: 1, rows: [{ max_value: DEFAULT_DAILY_LIMIT }] };
    }

    if (sql.includes('from point_rules')) {
      return {
        rowCount: 1,
        rows: [{ formula: DEFAULT_RULE_FORMULA, max_points_per_vote: 100 }],
      };
    }

    if (sql.startsWith('insert into votes')) {
      votes.push({
        voteId: String(values[0] ?? randomUUID()),
        userId: String(values[1] ?? ''),
        activityId: String(values[2] ?? ''),
        requestId: String(values[3] ?? randomUUID()),
        eventId: String(values[4] ?? randomUUID()),
        pointsGenerated: Number(values[5] ?? 0),
        createdAt: getNowIso(),
      });
      return { rowCount: 1, rows: [] };
    }

    if (sql.includes('from votes')) {
      const userId = String(values[0] ?? '');
      const maybeActivityId = values[1] ? String(values[1]) : null;
      const total = votes.filter((vote) => vote.userId === userId && (!maybeActivityId || vote.activityId === maybeActivityId)).length;

      if (sql.includes(' as total')) {
        return { rowCount: 1, rows: [{ total }] };
      }

      return { rowCount: 1, rows: [{ used: total }] };
    }

    if (sql.startsWith('insert into cross_system_transactions')) {
      return { rowCount: 1, rows: [] };
    }

    return { rowCount: 0, rows: [] };
  };

  const client: FakeClient = {
    query: (text, values) => runQuery(text, values),
    release: () => {},
  };

  return {
    connect: async () => client,
    query: (text, values) => runQuery(text, values),
  };
}