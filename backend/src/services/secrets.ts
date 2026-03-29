type SecretName =
  | 'WEBHOOK_SHARED_SECRET'
  | 'WEBHOOK_SIGNING_SECRET'
  | 'LEDGER_AUDIT_SIGNING_SECRET'
  | 'PLANNING_AI_API_KEY'
  | 'PLANNING_AI_MODEL'
  | 'PLANNING_AI_BASE_URL';

const normalize = (value: string | undefined) => {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
};

// Local secret accessor. In production this can be swapped by a managed vault adapter.
export function getSecret(name: SecretName): string | null {
  return normalize(process.env[name]);
}

export function getNumberConfig(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
}