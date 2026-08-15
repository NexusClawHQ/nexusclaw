/**
 * RequestContextMiddleware — Nest-flavored adapter around the existing
 * Express-style `createRequestContextMiddleware()`.
 *
 * Why a separate file?
 *   - `app.module.ts`'s `configure(consumer)` API expects either a
 *     class implementing `NestMiddleware` or a function. The existing
 *     `createRequestContextMiddleware()` factory in
 *     `common/request-context/request-context.ts` returns a vanilla
 *     Express handler (used today via `app.use(...)` in `main.ts`).
 *   - To wire this into module-level routes (task 2.18) we want a
 *     class that NestJS can resolve through DI without touching the
 *     canonical request-context module (¬C(X) 3.13 forbids modifying
 *     its API).
 *
 * Design:
 *   This middleware is a *thin delegating wrapper* — it lazily builds
 *   the underlying Express handler on construction and forwards every
 *   call to it. No new context logic lives here; the AsyncLocalStorage
 *   binding, header parsing, and response-header echoing all remain in
 *   `request-context.ts`.
 *
 * Idempotency contract (task 2.18, ¬C(X) 3.13):
 *   `main.ts` already mounts `createRequestContextMiddleware()` via
 *   `app.use(...)` so every HTTP request enters Nest with a context
 *   already bound. Re-running the underlying handler from
 *   `AppModule.configure()` would consume the same `x-trace-id`
 *   header again, but more importantly it would push a NEW
 *   AsyncLocalStorage frame on top of the existing one — risking
 *   regressions in modules that read trace IDs from the outer frame
 *   (permission / agent / api-key / audit / agent-runtime /
 *   source-tracking / outcome). To stay safe we short-circuit when a
 *   context is already bound — the outer frame wins and module-level
 *   middleware becomes a no-op. This makes the module-level wiring a
 *   defence-in-depth safety net for routes that might in the future
 *   bypass `app.use` (e.g. test harnesses that build a Nest app
 *   without re-mounting Express middleware).
 */
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import {
  createRequestContextMiddleware,
  getRequestContext,
} from '../request-context/request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly handler = createRequestContextMiddleware();

  use(req: Request, res: Response, next: NextFunction): void {
    // Skip when a request context is already bound by an outer
    // middleware (the canonical path: `main.ts` `app.use(...)`).
    // Re-binding here would create a nested ALS frame with a
    // freshly minted traceId in some edge cases and is not worth
    // the regression risk vs. ¬C(X) 3.13.
    if (getRequestContext() !== null) {
      next();
      return;
    }
    this.handler(req, res, next);
  }
}
