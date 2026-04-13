# Error Codes

Complete Daraja error code reference. Every known error code with its API context, meaning, cause, and fix.

## Result Codes (Transaction-Level)

These codes appear in `ResultCode` (callback responses) or `errorCode` (SDK collect results).

| Code | API | Meaning | Cause | Fix |
|------|-----|---------|-------|-----|
| 0 | All | Success | Transaction completed successfully | No action needed |
| 1 | All | Insufficient funds | Customer or business does not have enough M-Pesa balance | For STK Push: prompt customer to top up. For B2C: top up your business float. |
| 03 | STK Push | Amount below minimum | Amount is less than the minimum allowed (KES 1 for most APIs) | Increase amount to at least KES 1 |
| 04 | STK Push | Amount above maximum | Amount exceeds per-transaction limit (KES 150,000 for STK Push) | Reduce amount or split into multiple transactions |
| 05 | STK Push | Transaction timeout | Transaction took too long to process on Daraja's side | Retry the transaction. If persistent, wait a few minutes. |
| 06 | STK Push | Confirmation failed | M-Pesa could not confirm the transaction | Retry. Check that the phone number is valid and registered. |
| 08 | STK Push | Daily transaction limit | Customer has exceeded their daily M-Pesa transaction limit | Customer must wait until the next day or use a different payment method |
| 09 | STK Push | Store number not found | The shortcode or till number is not recognized | Verify your shortcode is correct and active |
| 10 | STK Push | Not registered on M-Pesa | The phone number is not registered for M-Pesa | Customer must register for M-Pesa first |
| 11 | All | System error | Internal Daraja system error | Retry after a short delay. If persistent, contact Safaricom support. |
| 12 | STK Push | Details mismatch | Transaction details do not match (e.g., wrong shortcode/passkey combination) | Verify your shortcode, passkey, and other parameters are correct |
| 29 | All | System downtime | Daraja is undergoing maintenance or experiencing an outage | Retry after a few minutes. Check Safaricom status page. |
| 30 | STK Push | Missing reference | AccountReference parameter is missing or empty | Provide a non-empty `reference` parameter |
| 31 | STK Push | Invalid amount | Amount is not a valid number or is zero | Ensure amount is a positive integer |
| 32 | STK Push | Service not activated | The API or feature is not activated for your shortcode | Contact Safaricom to activate the API on your shortcode |
| 33 | STK Push | Service not approved | Your go-live request has not been approved yet | Wait for go-live approval or contact Safaricom |
| 34 | STK Push | Processing delay | Transaction is being processed but is delayed | Wait and check status later. Do not retry immediately. |
| 35 | STK Push | Duplicate transaction | A transaction with the same parameters was just processed | Wait at least 30 seconds before retrying the same phone + amount combination |
| 36 | STK Push | Incorrect credentials | Wrong passkey or shortcode | Verify your passkey and shortcode match your environment |
| 40 | STK Push | Missing parameters | Required parameters are missing from the request | Check all required fields are provided |
| 41 | STK Push | Invalid MSISDN | Phone number format is invalid | Use format `254XXXXXXXXX` (12 digits, starting with 254) |
| 42 | STK Push | Passkey/paybill issue | Passkey does not match the shortcode | Ensure the passkey corresponds to your shortcode. For sandbox use the sandbox passkey. |
| 43 | STK Push | Duplicate merchant transaction | Your system sent a duplicate `MerchantRequestID` | Generate a unique MerchantRequestID per request (SDK handles this) |
| 99 | STK Push | No transaction found | STK Query could not find the transaction | Transaction may have expired. The STK prompt was likely not completed within 60 seconds. |
| 1001 | STK Push | USSD session in progress | Customer has an active USSD session (*334# or similar) blocking the STK prompt | Ask customer to cancel any active USSD dialogs and wait 2-3 minutes before retrying |
| 1025 | STK Push | STK delivery failed | STK prompt could not be delivered to the phone. Often caused by `description` exceeding 13 characters. | Shorten `description` to 13 characters or fewer. Retry. |
| 1032 | STK Push | Request cancelled by user | Customer dismissed the STK prompt or pressed Cancel | Prompt customer to retry. Add UX: "Payment cancelled. Tap Pay to try again." |
| 1037 | STK Push | DS timeout (phone unreachable) | Phone is off, in airplane mode, has no signal, or eSIM issue (common on iOS) | Ask customer to check phone is on and has signal. Restarting fixes eSIM issues. Retry. |
| 2001 | B2C, Status, Balance, Reversal | Invalid initiator credentials | Initiator name or password is wrong, or SecurityCredential is invalid | Verify initiator name and password. For sandbox: `testapi` / `Safaricom999!*!`. Ensure correct certificate. |
| 9999 | STK Push | STK delivery failed | Same as 1025 -- description/reference too long or temporary Daraja issue | Shorten `description` and `reference`. Retry once. |

## HTTP-Level Errors

These are HTTP status codes returned by the Daraja API endpoint itself (before any transaction is processed).

| HTTP Code | Meaning | Cause | Fix |
|-----------|---------|-------|-----|
| 400 | Bad Request | Malformed request body, missing required fields, or invalid JSON | Validate your request payload. Check all required fields are present and correctly typed. |
| 401 | Unauthorized | Invalid or expired access token, or invalid Basic auth credentials | Regenerate your OAuth token. If using Basic auth for token generation, verify consumer key/secret. |
| 403 | Forbidden | App not authorized for this API, or IP not whitelisted | Check API subscriptions on the portal. For production, verify IP whitelisting with Safaricom. |
| 404 | Not Found | Wrong API endpoint URL | Verify you are using the correct URL. Check environment (sandbox vs production). |
| 429 | Too Many Requests | Rate limit exceeded | Implement exponential backoff. Daraja rate limits vary by API. Wait and retry. |
| 500 | Internal Server Error | Daraja internal error | Retry after a short delay. If persistent, Daraja may be experiencing issues. |
| 503 | Service Unavailable | Daraja is down or overloaded | Retry after a few minutes. Check for scheduled maintenance. |

## STK Push Specific: ResultCode vs ResponseCode

STK Push has two different code fields:

- **ResponseCode** (in the initial STK Push response): `0` means the request was accepted and the STK prompt will be sent. Non-zero means the request itself failed.
- **ResultCode** (in the STK Query/callback result): `0` means the payment succeeded. Non-zero means the payment failed (see result codes table above).

```typescript
// ResponseCode is in the immediate response:
// { ResponseCode: "0", ResponseDescription: "Success. Request accepted for processing" }

// ResultCode is in the polling/callback result:
// { ResultCode: "0", ResultDesc: "The service request is processed successfully." }
// { ResultCode: "1032", ResultDesc: "Request cancelled by user" }
```

## Error Handling Best Practices

1. **Always check the result code**, not just the HTTP status. A 200 HTTP response can contain a failed transaction.
2. **Map error codes to user-friendly messages.** Do not show raw error codes to customers.
3. **Implement retries for transient errors** (11, 29, 34, 05, HTTP 500/503). Use exponential backoff.
4. **Do not retry user-driven failures** (1032 cancelled, 1 insufficient funds). These require user action.
5. **Log all error codes.** Some errors (like 35 duplicate) indicate issues in your retry logic.
6. **Handle unknown codes gracefully.** Daraja may return codes not documented here. Default to a generic "please try again" message.
