import { z } from 'zod';

const optionalId = z.string().trim().min(1).optional();
const positiveAmount = z.coerce.number().finite().positive();

export const votesCreateSchema = z.object({
  activityId: z.string().trim().min(1, 'activityId es requerido'),
  activityScope: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.enum(['local', 'global']))
    .optional(),
  requestId: optionalId,
  eventId: optionalId,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const votesCountQuerySchema = z.object({
  activityId: z.string().trim().optional(),
});

export const userIdParamsSchema = z.object({
  userId: z.string().trim().min(1, 'userId es requerido'),
});

export const pointsCreditSchema = z.object({
  userId: optionalId,
  amount: positiveAmount,
  requestId: optionalId,
  eventId: optionalId,
  reason: z.string().trim().optional(),
});

export const pointsDebitSchema = pointsCreditSchema;

export const pointsTransferSchema = z.object({
  toUserId: z.string().trim().min(1, 'toUserId es requerido'),
  amount: positiveAmount,
  requestId: optionalId,
});

export const pointsConvertSchema = z.object({
  parkId: z.string().trim().min(1, 'parkId es requerido'),
  itemId: z.string().trim().min(1, 'itemId es requerido'),
  amount: positiveAmount,
  rateId: z.string().trim().min(1, 'rateId es requerido'),
  requestId: optionalId,
  eventId: optionalId,
});

export const liveOpsConvertSchema = z.object({
  direction: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.enum(['POINTS_TO_LIVEOPS', 'LIVEOPS_TO_POINTS']))
    .optional(),
  parkId: z.string().trim().min(1, 'parkId es requerido'),
  amount: positiveAmount,
  requestId: optionalId,
  eventId: optionalId,
  rateId: optionalId,
});

export const inventoryCatalogQuerySchema = z.object({
  scope: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.enum(['global', 'local']))
    .optional(),
  parkId: z.string().trim().optional(),
});

export const inventoryLedgerVerifyQuerySchema = z.object({
  userId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(10000).optional(),
  sign: z.coerce.boolean().optional(),
});

export const inventoryPurchaseSchema = z.object({
  itemId: z.string().trim().min(1, 'itemId es requerido'),
  quantity: z.coerce.number().int().positive().max(50).default(1),
  parkId: z.string().trim().optional(),
  requestId: optionalId,
});

export const inventoryLifecycleTransferSchema = z.object({
  itemId: z.string().trim().uuid('itemId invalido'),
  toUserId: z.string().trim().uuid('toUserId invalido'),
  quantity: z.coerce.number().int().positive().max(100).default(1),
  parkId: z.string().trim().optional(),
  transferPoints: z.coerce.boolean().default(true),
  pointsValuePerItem: z.coerce.number().int().nonnegative().max(1_000_000).optional(),
  requestId: optionalId,
});

export const inventoryLifecycleDestroySchema = z.object({
  itemId: z.string().trim().uuid('itemId invalido'),
  quantity: z.coerce.number().int().positive().max(100).default(1),
  parkId: z.string().trim().optional(),
  pointsValuePerItem: z.coerce.number().int().nonnegative().optional(),
  requestId: optionalId,
});

export const inventoryLifecycleTransformSchema = z.object({
  fromItemId: z.string().trim().uuid('fromItemId invalido'),
  toItemId: z.string().trim().uuid('toItemId invalido'),
  quantity: z.coerce.number().int().positive().max(100).default(1),
  parkId: z.string().trim().optional(),
  pointsDelta: z.coerce.number().int().optional(),
  requestId: optionalId,
});

export const webhookPointsCreditSchema = z.object({
  userId: z.string().trim().min(1, 'userId es requerido'),
  amount: positiveAmount,
  sourceSystem: z.string().trim().optional(),
  requestId: optionalId,
  eventId: optionalId,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const aiPlanningAnalyzeSchema = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        category: z.string().optional(),
        estimated: z.string().optional(),
        priority: z.string().optional(),
      }),
    )
    .max(100)
    .optional(),
  document: z.string().max(200000).optional(),
});

export const identityLinkSchema = z.object({
  sourceApp: z.string().trim().min(1, 'sourceApp es requerido').max(120),
  externalUserId: z.string().trim().min(1, 'externalUserId es requerido').max(190),
  svpUserId: z.string().trim().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const identityResolveQuerySchema = z.object({
  sourceApp: z.string().trim().min(1, 'sourceApp es requerido').max(120),
  externalUserId: z.string().trim().min(1, 'externalUserId es requerido').max(190),
});

const baseExternalEventSchema = z.object({
  eventId: z.string().trim().min(1, 'eventId es requerido').max(190),
  sourceApp: z.string().trim().min(1, 'sourceApp es requerido').max(120),
  sourceEnv: z.string().trim().max(50).optional(),
  svpUserId: z.string().trim().uuid().optional(),
  externalUserId: z.string().trim().min(1).max(190).optional(),
  activityType: z.string().trim().min(1, 'activityType es requerido').max(120),
  activityId: z.string().trim().min(1, 'activityId es requerido').max(190),
  // Score como senal de logro o resultado de gameplay.
  score: z.coerce.number().finite().nonnegative().optional(),
  // Modelo principal SVP: puntos base por horas * votos totales.
  activityHours: z.coerce.number().finite().nonnegative().optional(),
  totalVotes: z.coerce.number().int().nonnegative().optional(),
  localVotes: z.coerce.number().int().nonnegative().optional(),
  globalVotes: z.coerce.number().int().nonnegative().optional(),
  unit: z.string().trim().min(1, 'unit es requerido').max(80),
  requestId: z.string().trim().uuid().optional(),
  occurredAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).superRefine((data, ctx) => {
  const hasScore = typeof data.score === 'number';
  const hasHours = typeof data.activityHours === 'number';
  const hasTotalVotes = typeof data.totalVotes === 'number';
  const hasSplitVotes = typeof data.localVotes === 'number' && typeof data.globalVotes === 'number';

  if (!hasScore && !(hasHours && (hasTotalVotes || hasSplitVotes))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['score'],
      message:
          'Debe enviar score (senal de logro) o activityHours + totalVotes (o localVotes + globalVotes) para calcular puntos SVP',
    });
  }

  if (hasTotalVotes && hasSplitVotes && data.totalVotes !== (data.localVotes ?? 0) + (data.globalVotes ?? 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['totalVotes'],
      message: 'totalVotes debe coincidir con localVotes + globalVotes cuando ambos se envian',
    });
  }
});

export const externalEventValidateSchema = baseExternalEventSchema;

export const externalEventIngestSchema = baseExternalEventSchema.refine(
  (data) => Boolean(data.svpUserId || data.externalUserId),
  {
    message: 'Debe enviar svpUserId o externalUserId para resolver el usuario',
    path: ['svpUserId'],
  }
);

export const achievementListQuerySchema = z.object({
  activityId: z.string().trim().optional(),
  status: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.enum(['draft', 'voting', 'approved', 'rejected', 'archived']))
    .optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const achievementCreateSchema = z.object({
  activityId: z.string().trim().min(1, 'activityId es requerido').max(190),
  title: z.string().trim().min(3, 'title es requerido').max(180),
  description: z.string().trim().max(1500).optional(),
  rewardType: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.enum(['points', 'item', 'mixed']))
    .default('points'),
  rewardPoints: z.coerce.number().int().nonnegative().default(0),
  rewardItemId: z.string().trim().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const achievementIdParamsSchema = z.object({
  achievementId: z.string().trim().uuid('achievementId invalido'),
});

export const achievementVoteSchema = z.object({
  vote: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.enum(['up', 'down'])),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const achievementCloseSchema = z.object({
  status: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.enum(['approved', 'rejected', 'archived'])),
  note: z.string().trim().max(500).optional(),
});

export const outboxDispatchQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
});

export const policyRulesQuerySchema = z.object({
  domain: z.string().trim().min(1).max(120).optional(),
  sourceApp: z.string().trim().min(1).max(120).optional(),
  activityType: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

export const policyRuleVersionsQuerySchema = z.object({
  domain: z.string().trim().min(1, 'domain es requerido').max(120),
  sourceApp: z.string().trim().min(1).max(120).optional(),
  activityType: z.string().trim().min(1).max(120).optional(),
  includeInactive: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

const proposedMutationSchema = z.object({
  kind: z.enum(['points_multiplier', 'points_bonus', 'min_points_floor', 'tag']),
  value: z.coerce.number().finite().optional(),
  key: z.string().trim().min(1).max(120).optional(),
  label: z.string().trim().max(190).optional(),
});

export const policyRuleCreateSchema = z.object({
  domain: z.string().trim().min(1, 'domain es requerido').max(120),
  sourceApp: z.string().trim().min(1).max(120).optional(),
  activityType: z.string().trim().min(1).max(120).optional(),
  priority: z.coerce.number().int().min(1).max(9999).default(100),
  conditionJson: z.record(z.string(), z.unknown()).default({}),
  mutations: z.array(proposedMutationSchema).min(1, 'Debe enviar al menos una mutacion'),
  notes: z.string().trim().max(1000).optional(),
  activateNow: z.coerce.boolean().default(true),
  deactivatePrevious: z.coerce.boolean().default(true),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
});

export const policyRuleIdParamsSchema = z.object({
  ruleId: z.string().trim().uuid('ruleId invalido'),
});

export const policyRuleActivateSchema = z.object({
  deactivatePrevious: z.coerce.boolean().default(true),
});

export const policyEvaluateSchema = z.object({
  domain: z.string().trim().min(1, 'domain es requerido').max(120),
  sourceApp: z.string().trim().max(120).optional(),
  activityType: z.string().trim().max(120).optional(),
  basePoints: z.coerce.number().finite().nonnegative().optional(),
  context: z.record(z.string(), z.unknown()).default({}),
});

export const transactionsMonitorQuerySchema = z.object({
  userId: z.string().trim().uuid().optional(),
  status: z.string().trim().min(1).max(80).optional(),
  transactionType: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  intervalMs: z.coerce.number().int().min(1000).max(30000).optional(),
});