import { Router } from 'express';
import { logger } from '../utils/logger.js';

const router = Router();

// In-memory ring buffer of the most recent N callbacks — enough for a POC.
const MAX_EVENTS = 100;
const events = [];

export function getRecentEvents() {
  return [...events].reverse();
}

function record(kind, body, req) {
  const entry = {
    id: events.length + 1,
    kind,
    receivedAt: new Date().toISOString(),
    sourceIp: req.ip,
    body,
  };
  events.push(entry);
  if (events.length > MAX_EVENTS) events.shift();
  logger.info(`Callback ← ${kind}`);
  logger.debug(JSON.stringify(body, null, 2));
  return entry;
}

// Daraja expects a `{ ResultCode: 0, ResultDesc: "Accepted" }` ACK for
// validation requests; the others just need 200 OK.
const ack = (res) => res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

// ── STK Push ─────────────────────────────────────────────────────────────────
router.post('/stkpush', (req, res) => {
  record('stkpush', req.body, req);
  ack(res);
});

// ── C2B ──────────────────────────────────────────────────────────────────────
router.post('/c2b/validation', (req, res) => {
  record('c2b.validation', req.body, req);
  ack(res);
});
router.post('/c2b/confirmation', (req, res) => {
  record('c2b.confirmation', req.body, req);
  ack(res);
});

// ── B2C ──────────────────────────────────────────────────────────────────────
router.post('/b2c/result', (req, res) => {
  record('b2c.result', req.body, req);
  ack(res);
});
router.post('/b2c/timeout', (req, res) => {
  record('b2c.timeout', req.body, req);
  ack(res);
});

// ── Transaction Status ───────────────────────────────────────────────────────
router.post('/status/result', (req, res) => {
  record('status.result', req.body, req);
  ack(res);
});
router.post('/status/timeout', (req, res) => {
  record('status.timeout', req.body, req);
  ack(res);
});

// ── Balance ──────────────────────────────────────────────────────────────────
router.post('/balance/result', (req, res) => {
  record('balance.result', req.body, req);
  ack(res);
});
router.post('/balance/timeout', (req, res) => {
  record('balance.timeout', req.body, req);
  ack(res);
});

// ── Reversal ─────────────────────────────────────────────────────────────────
router.post('/reversal/result', (req, res) => {
  record('reversal.result', req.body, req);
  ack(res);
});
router.post('/reversal/timeout', (req, res) => {
  record('reversal.timeout', req.body, req);
  ack(res);
});

export default router;
