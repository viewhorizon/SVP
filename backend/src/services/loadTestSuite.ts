/**
 * sp3-05: Suite de pruebas de carga automatizada para votos y eventos
 * Simula picos de tráfico, fallos y escenarios de concurrencia
 */

import { randomUUID } from 'node:crypto';

export type LoadTestScenario =
  | 'normal'
  | 'peak'
  | 'burst'
  | 'degraded'
  | 'recovery';

export type LoadTestResult = {
  scenario: LoadTestScenario;
  duration: number; // ms
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number; // ms
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number; // req/s
  errors: string[];
};

export type LoadTestMetrics = {
  timestamp: string;
  scenario: LoadTestScenario;
  rpsTarget: number; // Requests per second
  durationSeconds: number;
  parallelWorkers: number;
};

/**
 * sp3-05: Simulador de votos bajo carga
 */
export class VoteLoadTester {
  private responseTimes: number[] = [];
  private errors: string[] = [];

  async runScenario(
    baseUrl: string,
    metrics: LoadTestMetrics,
    authToken: string
  ): Promise<LoadTestResult> {
    const startTime = Date.now();
    let successCount = 0;
    let failureCount = 0;

    const itemId = randomUUID();
    const userId = randomUUID();

    // Calcular delays entre requests para lograr RPS target
    const delayBetweenRequests = 1000 / metrics.rpsTarget;
    const totalDuration = metrics.durationSeconds * 1000;
    const requestsToMake = Math.floor(
      (metrics.rpsTarget * metrics.durationSeconds) / metrics.parallelWorkers
    );

    // Distribuir requests entre workers
    const promises = Array(metrics.parallelWorkers)
      .fill(null)
      .map((_, workerId) =>
        this.workerLoop(
          baseUrl,
          authToken,
          itemId,
          userId,
          requestsToMake,
          delayBetweenRequests,
          totalDuration,
          workerId
        )
      );

    await Promise.allSettled(promises);

    const totalRequests = metrics.parallelWorkers * requestsToMake;
    successCount = this.responseTimes.length;
    failureCount = totalRequests - successCount;
    const duration = Date.now() - startTime;

    // Calcular percentiles
    const sorted = this.responseTimes.sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
    const avgTime = sorted.reduce((a, b) => a + b, 0) / sorted.length || 0;

    return {
      scenario: metrics.durationSeconds > 10 ? 'normal' : 'burst',
      duration,
      totalRequests,
      successfulRequests: successCount,
      failedRequests: failureCount,
      avgResponseTime: avgTime,
      p95ResponseTime: p95,
      p99ResponseTime: p99,
      throughput: successCount / (duration / 1000),
      errors: this.errors.slice(0, 10), // Primeros 10 errores
    };
  }

  private async workerLoop(
    baseUrl: string,
    authToken: string,
    itemId: string,
    userId: string,
    requests: number,
    delayBetweenRequests: number,
    totalDuration: number,
    workerId: number
  ) {
    const startTime = Date.now();

    for (let i = 0; i < requests; i++) {
      // Verificar si hemos excedido la duración total
      if (Date.now() - startTime > totalDuration) break;

      const requestStartTime = Date.now();

      try {
        const response = await fetch(`${baseUrl}/api/v1/votes/cast`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            itemId,
            userId,
            decision: Math.random() > 0.5 ? 'upvote' : 'downvote',
            weight: Math.floor(Math.random() * 10) + 1,
          }),
        });

        const responseTime = Date.now() - requestStartTime;
        this.responseTimes.push(responseTime);

        if (!response.ok && this.errors.length < 10) {
          this.errors.push(
            `Worker ${workerId} Request ${i}: ${response.status} ${response.statusText}`
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (this.errors.length < 10) {
          this.errors.push(`Worker ${workerId} Request ${i}: ${message}`);
        }
      }

      // Respetar delay entre requests
      await this.sleep(delayBetweenRequests);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * sp3-05: Simulador de eventos de outbox
 */
export class EventLoadTester {
  private responseTimes: number[] = [];
  private errors: string[] = [];

  async runScenario(
    baseUrl: string,
    metrics: LoadTestMetrics,
    authToken: string
  ): Promise<LoadTestResult> {
    const startTime = Date.now();

    const sourceApp = 'load-test-app';
    const delayBetweenRequests = 1000 / metrics.rpsTarget;
    const totalDuration = metrics.durationSeconds * 1000;
    const requestsPerWorker = Math.floor(
      (metrics.rpsTarget * metrics.durationSeconds) / metrics.parallelWorkers
    );

    const promises = Array(metrics.parallelWorkers)
      .fill(null)
      .map((_, workerId) =>
        this.workerLoop(
          baseUrl,
          authToken,
          sourceApp,
          requestsPerWorker,
          delayBetweenRequests,
          totalDuration,
          workerId
        )
      );

    await Promise.allSettled(promises);

    const totalRequests = metrics.parallelWorkers * requestsPerWorker;
    const successCount = this.responseTimes.length;
    const failureCount = totalRequests - successCount;
    const duration = Date.now() - startTime;

    const sorted = this.responseTimes.sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
    const avgTime = sorted.reduce((a, b) => a + b, 0) / sorted.length || 0;

    return {
      scenario: 'burst',
      duration,
      totalRequests,
      successfulRequests: successCount,
      failedRequests: failureCount,
      avgResponseTime: avgTime,
      p95ResponseTime: p95,
      p99ResponseTime: p99,
      throughput: successCount / (duration / 1000),
      errors: this.errors.slice(0, 10),
    };
  }

  private async workerLoop(
    baseUrl: string,
    authToken: string,
    sourceApp: string,
    requests: number,
    delayBetweenRequests: number,
    totalDuration: number,
    workerId: number
  ) {
    const startTime = Date.now();

    for (let i = 0; i < requests; i++) {
      if (Date.now() - startTime > totalDuration) break;

      const requestStartTime = Date.now();

      try {
        const eventId = randomUUID();
        const response = await fetch(`${baseUrl}/api/v1/events/ingest`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${authToken}`,
            'x-event-id': eventId,
            'x-source-app': sourceApp,
          },
          body: JSON.stringify({
            eventType: ['vote_cast', 'achievement_unlocked', 'level_up'][
              Math.floor(Math.random() * 3)
            ],
            userId: randomUUID(),
            data: {
              itemId: randomUUID(),
              value: Math.random() * 100,
            },
          }),
        });

        const responseTime = Date.now() - requestStartTime;
        this.responseTimes.push(responseTime);

        if (!response.ok && this.errors.length < 10) {
          this.errors.push(
            `Worker ${workerId} Event ${i}: ${response.status} ${response.statusText}`
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (this.errors.length < 10) {
          this.errors.push(`Worker ${workerId} Event ${i}: ${message}`);
        }
      }

      await this.sleep(delayBetweenRequests);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * sp3-05: Ejecutor de suite completa
 */
export async function runLoadTestSuite(
  baseUrl: string,
  authToken: string,
  config: {
    scenarios?: LoadTestScenario[];
    verbose?: boolean;
  } = {}
): Promise<LoadTestResult[]> {
  const scenarios = config.scenarios || ['normal', 'peak', 'burst'];
  const results: LoadTestResult[] = [];

  const scenarioConfigs: Record<LoadTestScenario, LoadTestMetrics> = {
    normal: {
      durationSeconds: 30,
      rpsTarget: 10,
      parallelWorkers: 2,
      scenario: 'normal',
      timestamp: new Date().toISOString(),
    },
    peak: {
      durationSeconds: 20,
      rpsTarget: 50,
      parallelWorkers: 5,
      scenario: 'peak',
      timestamp: new Date().toISOString(),
    },
    burst: {
      durationSeconds: 10,
      rpsTarget: 100,
      parallelWorkers: 10,
      scenario: 'burst',
      timestamp: new Date().toISOString(),
    },
    degraded: {
      durationSeconds: 30,
      rpsTarget: 5,
      parallelWorkers: 1,
      scenario: 'degraded',
      timestamp: new Date().toISOString(),
    },
    recovery: {
      durationSeconds: 25,
      rpsTarget: 25,
      parallelWorkers: 3,
      scenario: 'recovery',
      timestamp: new Date().toISOString(),
    },
  };

  for (const scenario of scenarios) {
    const metrics = scenarioConfigs[scenario];
    if (!metrics) continue;

    if (config.verbose) {
      console.log(
        `[v0] Iniciando escenario: ${scenario} (${metrics.rpsTarget} RPS)`
      );
    }

    const voteTester = new VoteLoadTester();
    const voteResult = await voteTester.runScenario(baseUrl, metrics, authToken);
    results.push(voteResult);

    const eventTester = new EventLoadTester();
    const eventResult = await eventTester.runScenario(baseUrl, metrics, authToken);
    results.push(eventResult);

    if (config.verbose) {
      console.log(`[v0] Resultado ${scenario}:`, {
        votos: voteResult,
        eventos: eventResult,
      });
    }
  }

  return results;
}
