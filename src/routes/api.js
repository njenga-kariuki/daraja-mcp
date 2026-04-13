import { Router } from 'express';
import { stkPush, stkPushQuery } from '../daraja/stkPush.js';
import { registerC2BUrls, simulateC2B } from '../daraja/c2b.js';
import { b2cPayment } from '../daraja/b2c.js';
import { transactionStatus } from '../daraja/transaction.js';
import { accountBalance } from '../daraja/balance.js';
import { reverseTransaction } from '../daraja/reversal.js';
import { getAccessToken } from '../daraja/client.js';
import { callbackUrl } from '../utils/config.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Tiny wrapper to forward Daraja errors cleanly to the client.
const h = (fn) => async (req, res) => {
  try {
    const data = await fn(req, res);
    res.json({ ok: true, data });
  } catch (err) {
    const status = err.response?.status ?? 500;
    const data = err.response?.data ?? { message: err.message };
    logger.error(`API ${req.method} ${req.path} failed:`, data);
    res.status(status).json({ ok: false, error: data });
  }
};

// ── Auth ─────────────────────────────────────────────────────────────────────
router.get(
  '/token',
  h(async () => ({ access_token: await getAccessToken({ force: true }) })),
);

// ── STK Push ─────────────────────────────────────────────────────────────────
router.post(
  '/stkpush',
  h(async (req) =>
    stkPush({
      amount: req.body.amount ?? 1,
      phone: req.body.phone,
      accountReference: req.body.accountReference,
      description: req.body.description,
      callbackUrl: callbackUrl('/callbacks/stkpush'),
    }),
  ),
);

router.post(
  '/stkpush/query',
  h(async (req) => stkPushQuery(req.body.checkoutRequestID)),
);

// ── C2B ──────────────────────────────────────────────────────────────────────
router.post(
  '/c2b/register',
  h(async () =>
    registerC2BUrls({
      validationUrl: callbackUrl('/callbacks/c2b/validation'),
      confirmationUrl: callbackUrl('/callbacks/c2b/confirmation'),
    }),
  ),
);

router.post(
  '/c2b/simulate',
  h(async (req) =>
    simulateC2B({
      amount: req.body.amount ?? 1,
      phone: req.body.phone,
      billRefNumber: req.body.billRefNumber,
    }),
  ),
);

// ── B2C ──────────────────────────────────────────────────────────────────────
router.post(
  '/b2c',
  h(async (req) =>
    b2cPayment({
      amount: req.body.amount ?? 10,
      phone: req.body.phone,
      commandID: req.body.commandID,
      remarks: req.body.remarks,
      occasion: req.body.occasion,
      resultUrl: callbackUrl('/callbacks/b2c/result'),
      queueTimeoutUrl: callbackUrl('/callbacks/b2c/timeout'),
    }),
  ),
);

// ── Transaction Status ───────────────────────────────────────────────────────
router.post(
  '/transaction/status',
  h(async (req) =>
    transactionStatus({
      transactionId: req.body.transactionId,
      partyA: req.body.partyA,
      identifierType: req.body.identifierType,
      resultUrl: callbackUrl('/callbacks/status/result'),
      queueTimeoutUrl: callbackUrl('/callbacks/status/timeout'),
    }),
  ),
);

// ── Account Balance ──────────────────────────────────────────────────────────
router.post(
  '/balance',
  h(async () =>
    accountBalance({
      resultUrl: callbackUrl('/callbacks/balance/result'),
      queueTimeoutUrl: callbackUrl('/callbacks/balance/timeout'),
    }),
  ),
);

// ── Reversal ─────────────────────────────────────────────────────────────────
router.post(
  '/reversal',
  h(async (req) =>
    reverseTransaction({
      transactionId: req.body.transactionId,
      amount: req.body.amount,
      resultUrl: callbackUrl('/callbacks/reversal/result'),
      queueTimeoutUrl: callbackUrl('/callbacks/reversal/timeout'),
    }),
  ),
);

export default router;
