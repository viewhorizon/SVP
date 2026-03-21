import { requestJSON } from './httpClient';

export interface SpvBootstrapState {
  available: number;
  historical: number;
  remainingVotes: number;
}

export interface VoteResult {
  pointsGranted: number;
  remainingVotes: number;
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

export async function getSpvBootstrapState(userId: string): Promise<SpvBootstrapState> {
  const [balance, voteCount, voteLimits] = await Promise.all([
    requestJSON<BalanceResponse>(`/api/points/balance/${userId}`),
    requestJSON<VoteCountResponse>('/api/votes/count'),
    requestJSON<VoteLimitsResponse>('/api/votes/limits'),
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
      asNumber(voteLimits.dailyLimit, MAX_DAILY_VOTES) -
        asNumber(voteCount.votesToday ?? voteCount.usedToday ?? voteLimits.usedVotes, 0),
      0,
    );

  return {
    available,
    historical,
    remainingVotes,
  };
}

type VotePayload = {
  pointsGranted?: number;
  limits?: {
    remainingVotes?: number;
  };
};

export async function castVote(activityId: string, requestId: string): Promise<VoteResult> {
  const payload = await requestJSON<VotePayload>('/api/votes', {
    method: 'POST',
    body: JSON.stringify({
      activityId,
      requestId,
      request_id: requestId,
    }),
  });

  return {
    pointsGranted: Math.max(0, asNumber(payload.pointsGranted, 0)),
    remainingVotes: Math.max(0, asNumber(payload.limits?.remainingVotes, 0)),
  };
}

type TransferPayload = {
  fromUserId: string;
  toUserId: string;
  amount: number;
  requestId: string;
};

export async function transferPoints(payload: TransferPayload): Promise<void> {
  await requestJSON('/api/points/transfer', {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      request_id: payload.requestId,
    }),
  });
}

type CreditPayload = {
  userId: string;
  amount: number;
  reason: string;
  requestId: string;
};

export async function creditPoints(payload: CreditPayload): Promise<void> {
  await requestJSON('/api/points/credit', {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      request_id: payload.requestId,
    }),
  });
}
