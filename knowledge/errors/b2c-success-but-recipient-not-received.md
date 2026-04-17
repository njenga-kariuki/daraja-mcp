# B2C Callback Shows Success But Recipient Says They Didn't Receive

**Symptom:** `mpesa.send()` completed. The callback fired with `ResultCode: 0` and a `TransactionID`. But the recipient says "I didn't get the money."

**What happened:** In 99% of cases, they did — and the confusion is about *how* to see it. In the remaining 1%, you have a wrong-number or settlement-lag problem that needs a reconciliation step.

---

## The four common causes

### 1. SMS notification lag

**Explanation:** The money reaches the recipient's M-Pesa wallet the moment your callback fires. The SMS notification is a separate event that can lag by minutes during high load — and sometimes fails to send at all due to carrier network issues.

**Signal:** Recipient hasn't received an SMS but also hasn't checked the M-Pesa app/USSD. Your callback shows success with a valid `TransactionID`.

**Fix:** Tell the recipient to dial `*334#` (M-Pesa menu) and select "My Account → Check Balance" — or open the M-Pesa app. The balance is the truth; the SMS is the notification.

Also include the `TransactionID` (format: `MEH...`) in your outgoing email/WhatsApp confirmation — recipients can cross-reference it with their M-Pesa statement once the SMS arrives.

### 2. Wrong MSISDN (typo)

**Explanation:** The send went through to the wrong number because your code had a typo, or the user mis-entered a recipient phone number in your UI.

**Signal:** The callback shows success for the MSISDN you sent to, but your user insists "that's not my phone." Check the last four digits of the MSISDN in your request vs. what the recipient reports.

**Fix:** The money went to someone else's M-Pesa. Options:
- Use `mpesa.reverse()` within 24 hours if the recipient is willing (or unknown).
- If Safaricom can identify the recipient and they cooperate, request a manual refund through Safaricom support.
- Going forward, confirm MSISDN with the user before sending — show the last 4 digits in a confirmation dialog.

```js
// Confirmation UI pattern
const lastFour = phone.slice(-4);
const confirmed = await confirm(`Send KES ${amount} to ...${lastFour}?`);
if (!confirmed) return;
await mpesa.send({ amount, phone, callbackUrl });
```

### 3. Phone number normalisation bug

**Explanation:** You passed `0712345678` or `+254712345678` to raw Daraja and it was silently rejected or interpreted differently. The SDK normalizes to `254712345678` automatically; raw API calls don't.

**Signal:** Using raw Daraja (not the SDK). Callback returns a `ResultCode` 10 (not registered) or 41 (invalid MSISDN) — not `0`. If callback actually shows `0` with the wrong MSISDN, see case 2.

**Fix:** Use `@daraja-kit/sdk`'s `mpesa.send()` which normalizes automatically. If calling raw, normalize before sending:

```js
function normalize(phone) {
  return phone.replace(/^\+/, '').replace(/^0/, '254');
}
```

### 4. Transaction was reversed mid-flight

**Explanation:** For B2C, Safaricom can auto-reverse in rare cases (e.g., if the receiving wallet is frozen between the commit and the notification). Your callback shows success, but a separate reversal callback fires seconds later.

**Signal:** Check the `TransactionID` via `mpesa.status({ transactionId })`. If the status is "reversed", you have this case.

**Fix:** Check status before declaring success in your UI. Use `mpesa.status()` within 30 seconds of the callback for any high-value B2C. Treat reversed-on-arrival as a failure — re-send after investigating why the wallet was flagged.

---

## Decision tree

**Step 1 — Query the transaction.**

```js
const status = await mpesa.status({ transactionId: 'MEH...' });
console.log(status);
```

Authoritative source.

**Step 2 — What did status return?**

- `reversed` → case 4
- `completed` with the intended MSISDN → case 1 (SMS lag). Have the recipient check their balance.
- `completed` with a different MSISDN → case 2 (typo). Reverse or escalate.
- Error → send failed at some layer; rely on the error description.

**Step 3 — Reconcile.**

Once you know what happened:
- Log the `TransactionID` against your DB record.
- Notify the sender with the truth (not just "success" or "failure").
- If case 2, initiate reversal or open a support ticket.

---

## Prevention

- **Confirm MSISDN before sending** — last-4-digit UI pattern above. Typos are 80% of "recipient didn't get it" cases.
- **Use `mpesa.send()`** — normalizes MSISDN, handles callback parsing.
- **Include `TransactionID` in every outgoing communication** — emails, SMS, WhatsApp. Recipients can verify.
- **Query status on any high-value B2C 30s after callback** — catches the rare mid-flight reversal.
- **Build a daily reconciliation** — compare your "sent" records vs. Safaricom statement exports. Catches any divergence before customers complain.

---

## Related

- [Send Money (B2C)](../capabilities/send-money.md)
- [Check Status](../capabilities/check-status.md)
- [Refunds / Reversals](../capabilities/refunds.md)
- [Top 20 Errors Index](top-20-index.md)
