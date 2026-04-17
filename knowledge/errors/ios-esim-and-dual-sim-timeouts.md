# iOS eSIM and Dual-SIM Timeouts (ResultCode 1037 variants)

**Symptom:** STK Push returns `ResultCode: 1037` (phone unreachable). The customer's phone is on, has signal, and works for calls and data. Specifically common with iPhone eSIM users and Android dual-SIM setups.

**What happened:** STK Push delivery goes through the Safaricom GSM network to the SIM that owns the M-Pesa account. On modern iOS eSIM and Android dual-SIM devices, the OS can park that SIM in a low-power state when data is running on another SIM — which silently drops the STK binary SMS Daraja sends.

---

## When this happens

- **iPhone eSIM + physical SIM** (iPhone XS or newer with dual-SIM active). M-Pesa lives on the eSIM, data runs through the physical SIM. iOS deprioritises the eSIM's signalling channel.
- **Android dual-SIM with "Primary for data" set to the non-Safaricom line.** Same mechanism.
- **Recent iOS update (usually within 2 weeks of a major version bump).** iOS sometimes reorders SIM priority silently.

The M-Pesa balance check (`*334#` USSD) often works because USSD uses a different signalling path. STK Push specifically fails because the STK binary SMS delivery requires the SIM to be fully attached to the network.

---

## Decision tree

**Step 1 — Confirm it's this class of issue.**

Ask the customer:
- "Are you using an iPhone, and do you have two SIM lines active?"
- "On your phone, which SIM is set as your default for data?"

If answers are "iPhone + eSIM + Safaricom is the eSIM" or "Android dual-SIM + Safaricom is secondary," this is almost certainly the issue.

**Step 2 — Offer the workaround.**

Three workarounds, in order of preference:

### Workaround A — Restart the phone

The simplest fix. A restart forces the OS to re-attach both SIMs. Tell the customer: "Please restart your phone, then tap Pay again." This fixes ~70% of cases on the first try.

### Workaround B — Switch primary SIM temporarily

iOS: Settings → Cellular → Default Voice Line → select Safaricom. Then retry STK Push. Switch back after the transaction if preferred.

Android: Settings → SIM cards → Data → select Safaricom. Retry. Switch back.

### Workaround C — Offer QR payment as a fallback

If STK keeps failing, offer a QR payment flow. QR doesn't rely on STK binary SMS — the customer scans the QR with the M-Pesa app, which uses data (not signalling) to authorize.

```js
try {
  const result = await mpesa.collect({ amount, phone });
  if (result.status === 'failed' && result.errorCode === '1037') {
    // Fall back to QR
    const { qrCode } = await mpesa.qr({ amount });
    return renderQr(qrCode);
  }
} catch (err) { /* ... */ }
```

**Step 3 — If workarounds don't help.**

The SIM may have a Safaricom-side issue (recently swapped, recently activated, or flagged for review). Tell the customer to call Safaricom care (dial 100 from their Safaricom line) or visit a Safaricom shop. You can't fix it from your code.

---

## Android specifics

Android's behavior is less consistent across manufacturers. Samsung, Xiaomi, and OnePlus each implement dual-SIM priority slightly differently. The workarounds above are correct for stock Android; vendor skins may have additional "battery saver" features that need disabling.

On Samsung specifically: Settings → Battery and device care → Battery → Background usage limits → ensure "Always sleeping apps" doesn't include the M-Pesa app.

---

## Prevention

- **Detect recurring 1037 for the same customer** — if a customer has seen 1037 twice in a session, proactively offer the QR fallback without making them retry.
- **Build a helpful error page.** Link to this doc (or paraphrase it) in your UI when 1037 fires. "Most common on iPhone eSIM — try restarting your phone or use the QR code below."
- **Offer QR as an option, not just a fallback.** Power users with dual-SIM setups may prefer scanning a QR directly. Show both options.
- **Track 1037 rates by device type if you have it.** If iOS users are 3× the 1037 rate of Android, that's your signal to lead with QR on iOS.

---

## Related

- [QR Payments](../capabilities/qr-payments.md)
- [Error Codes § 1037](error-codes.md)
- [Troubleshooting § 1037](troubleshooting.md)
- [Top 20 Errors Index](top-20-index.md)
