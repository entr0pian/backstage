import Router from 'express-promise-router';
import type { Router as ExpressRouter } from 'express';
import type { LoggerService } from '@backstage/backend-plugin-api';
import { isValidIdentity } from './ObservabilityQueries';
import {
  PrometheusUnavailableError,
  readObservabilitySummary,
} from './ObservabilitySummary';
import type { PrometheusQueryClient } from './PrometheusClient';

// The Metrics tab's one route. The only inputs are the two path segments;
// query-string parameters are ignored, so there is no way to hand this
// route PromQL, a metric name or a Prometheus API path. Guest-safe: the
// response is a handful of aggregate numbers per component/environment.
export function createObservabilityRouter(options: {
  prometheus: PrometheusQueryClient;
  logger: LoggerService;
}): ExpressRouter {
  const { prometheus, logger } = options;
  const router = Router();

  router.get(
    '/observability/components/:component/environments/:environment',
    async (req, res) => {
      const { component, environment } = req.params;
      if (!isValidIdentity(component) || !isValidIdentity(environment)) {
        res.status(400).json({ error: 'Invalid component or environment' });
        return;
      }
      try {
        // Polled every few seconds by the Metrics tab: never serve a cached copy.
        res.set('Cache-Control', 'no-store');
        res.json(await readObservabilitySummary(prometheus, component, environment));
      } catch (err) {
        if (err instanceof PrometheusUnavailableError) {
          logger.warn(`observability: Prometheus unavailable (${err.message})`);
          res.status(503).json({ error: 'Metrics are unavailable right now' });
          return;
        }
        throw err;
      }
    },
  );

  return router;
}
