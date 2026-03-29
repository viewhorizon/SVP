import type { PoolClient } from 'pg';

export type PolicyContext = Record<string, unknown>;

export type ProposedMutationKind = 'points_multiplier' | 'points_bonus' | 'min_points_floor' | 'tag';

export type ProposedMutation = {
  kind: ProposedMutationKind;
  value?: number;
  key?: string;
  label?: string;
};

type PolicyRule = {
  ruleId: string;
  domain: string;
  sourceApp: string | null;
  activityType: string | null;
  priority: number;
  condition: Record<string, unknown>;
  mutations: ProposedMutation[];
};

type PolicyRuleQuery = {
  domain: string;
  sourceApp?: string;
  activityType?: string;
  limit?: number;
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getPath = (ctx: PolicyContext, path: string): unknown => {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, ctx);
};

type ConditionNode = {
  all?: ConditionNode[];
  any?: ConditionNode[];
  not?: ConditionNode;
  eq?: { field: string; value: unknown };
  gte?: { field: string; value: number };
  lte?: { field: string; value: number };
  includes?: { field: string; value: string };
};

const evaluateCondition = (condition: ConditionNode | null | undefined, ctx: PolicyContext): boolean => {
  if (!condition || typeof condition !== 'object') return true;

  if (Array.isArray(condition.all)) {
    return condition.all.every((node) => evaluateCondition(node, ctx));
  }

  if (Array.isArray(condition.any)) {
    return condition.any.some((node) => evaluateCondition(node, ctx));
  }

  if (condition.not) {
    return !evaluateCondition(condition.not, ctx);
  }

  if (condition.eq) {
    const actual = getPath(ctx, condition.eq.field);
    return actual === condition.eq.value;
  }

  if (condition.gte) {
    const actual = toNumber(getPath(ctx, condition.gte.field));
    return actual >= condition.gte.value;
  }

  if (condition.lte) {
    const actual = toNumber(getPath(ctx, condition.lte.field));
    return actual <= condition.lte.value;
  }

  if (condition.includes) {
    const actual = String(getPath(ctx, condition.includes.field) ?? '').toLowerCase();
    return actual.includes(String(condition.includes.value).toLowerCase());
  }

  return true;
};

const parseMutations = (raw: unknown): ProposedMutation[] => {
  if (Array.isArray(raw)) {
    return raw
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const asRecord = entry as Record<string, unknown>;
        const kind = String(asRecord.kind ?? '').trim() as ProposedMutationKind;
        if (!kind) return null;
        return {
          kind,
          value: typeof asRecord.value === 'number' ? asRecord.value : undefined,
          key: typeof asRecord.key === 'string' ? asRecord.key : undefined,
          label: typeof asRecord.label === 'string' ? asRecord.label : undefined,
        } as ProposedMutation;
      })
      .filter(Boolean) as ProposedMutation[];
  }

  if (raw && typeof raw === 'object') {
    const single = raw as Record<string, unknown>;
    if (typeof single.kind === 'string') {
      return [
        {
          kind: single.kind as ProposedMutationKind,
          value: typeof single.value === 'number' ? single.value : undefined,
          key: typeof single.key === 'string' ? single.key : undefined,
          label: typeof single.label === 'string' ? single.label : undefined,
        },
      ];
    }
  }

  return [];
};

export async function readPolicyRules(client: PoolClient, query: PolicyRuleQuery) {
  const limit = Math.max(1, Math.min(query.limit ?? 50, 200));
  const result = await client.query(
    `SELECT rule_id, domain, source_app, activity_type, priority, condition_json, mutation_json
     FROM policy_rules
     WHERE is_active = TRUE
       AND domain = $1
       AND ($2::text IS NULL OR source_app IS NULL OR source_app = $2)
       AND ($3::text IS NULL OR activity_type IS NULL OR activity_type = $3)
       AND valid_from <= NOW()
       AND (valid_until IS NULL OR valid_until > NOW())
     ORDER BY priority DESC, created_at ASC
     LIMIT $4`,
    [query.domain, query.sourceApp ?? null, query.activityType ?? null, limit]
  );

  return result.rows.map((row) => ({
    ruleId: row.rule_id,
    domain: row.domain,
    sourceApp: row.source_app ?? null,
    activityType: row.activity_type ?? null,
    priority: Number(row.priority ?? 0),
    condition: (row.condition_json ?? {}) as Record<string, unknown>,
    mutations: parseMutations(row.mutation_json),
  })) as PolicyRule[];
}

export async function evaluatePolicies(client: PoolClient, query: PolicyRuleQuery, context: PolicyContext) {
  const rules = await readPolicyRules(client, query);
  const matchedRules: PolicyRule[] = [];
  const proposedMutations: ProposedMutation[] = [];

  for (const rule of rules) {
    if (evaluateCondition(rule.condition as ConditionNode, context)) {
      matchedRules.push(rule);
      proposedMutations.push(...rule.mutations);
    }
  }

  return {
    evaluatedRules: rules.length,
    matchedRuleIds: matchedRules.map((rule) => rule.ruleId),
    proposedMutations,
  };
}

export function applyPointMutations(basePoints: number, mutations: ProposedMutation[]) {
  let points = Math.max(0, Number(basePoints) || 0);
  let aggregateMultiplier = 1;
  let aggregateBonus = 0;
  let minFloor = 0;
  const tags: Array<{ key: string; label?: string }> = [];

  for (const mutation of mutations) {
    if (mutation.kind === 'points_multiplier') {
      const value = toNumber(mutation.value, 1);
      aggregateMultiplier *= value;
    } else if (mutation.kind === 'points_bonus') {
      aggregateBonus += toNumber(mutation.value, 0);
    } else if (mutation.kind === 'min_points_floor') {
      minFloor = Math.max(minFloor, toNumber(mutation.value, 0));
    } else if (mutation.kind === 'tag' && mutation.key) {
      tags.push({ key: mutation.key, label: mutation.label });
    }
  }

  points = points * aggregateMultiplier + aggregateBonus;
  points = Math.max(minFloor, Math.floor(points));

  return {
    points,
    policy: {
      multiplier: aggregateMultiplier,
      bonus: aggregateBonus,
      minFloor,
      tags,
    },
  };
}