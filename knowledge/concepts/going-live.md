# Going Live

Complete guide to moving your Daraja integration from sandbox to production.

## Prerequisites

Before you can go live, you need:

1. **A registered business** in Kenya (sole proprietorship, partnership, or company).
2. **An M-Pesa shortcode** (PayBill number) or **Till Number** (Buy Goods). Apply through Safaricom Business if you do not have one.
3. **A working sandbox integration** that you have tested end-to-end.
4. **Callback URLs** hosted on a publicly reachable HTTPS server with a valid SSL certificate.

## Steps

### 1. Create a Production App on the Developer Portal

1. Log in to [developer.safaricom.co.ke](https://developer.safaricom.co.ke).
2. Go to "My Apps" and click "Add a New App".
3. Name the app (e.g., "MyApp Production").
4. Select the APIs you need (same ones you tested in sandbox).
5. Note: This production app will not have usable credentials yet. Credentials are sent separately after the go-live letter is processed.

### 2. Submit the Go-Live Letter

Send an email to **m-pesabusiness@safaricom.co.ke** with your go-live request.

**Subject:** Go-Live Request - [Your Company Name] - [Your Shortcode]

**What to include in the letter:**

| Item | Details |
|------|---------|
| Company name | Your registered business name |
| Business registration number | Certificate of incorporation number |
| Shortcode or Till Number | Your M-Pesa PayBill or Till Number |
| APIs needed | List all APIs: Lipa Na M-Pesa (STK Push), B2C, Transaction Status, Account Balance, Reversal, etc. |
| Callback URLs | Production callback URLs for each API |
| Contact person | Name, phone number, and email of the technical contact |
| Developer portal email | The email used to create the production app |

**Sample go-live letter:**

```
Dear M-Pesa Business Team,

We are requesting production API credentials for our Daraja integration.

Company Name: Acme Solutions Limited
Registration Number: CPR/2020/123456
Shortcode: 123456 (PayBill)

APIs Required:
- Lipa Na M-Pesa Online (STK Push)
- B2C Payment
- Transaction Status Query
- Account Balance Query
- Reversal

Callback URLs:
- STK Push: https://api.acme.co.ke/mpesa/stk/callback
- B2C: https://api.acme.co.ke/mpesa/b2c/callback
- Status: https://api.acme.co.ke/mpesa/status/callback
- Balance: https://api.acme.co.ke/mpesa/balance/callback
- Reversal: https://api.acme.co.ke/mpesa/reversal/callback

Technical Contact:
Name: John Doe
Phone: +254712345678
Email: john@acme.co.ke

Developer Portal Email: dev@acme.co.ke

We have completed sandbox testing and are ready for production.

Regards,
John Doe
Acme Solutions Limited
```

### 3. Wait for Processing

Safaricom typically processes go-live requests in **1-3 business days**. During peak periods, it may take longer.

You will receive an email with:
- Production Consumer Key and Consumer Secret
- Production passkey (for STK Push)
- Initiator credentials (name and password, for B2C/Status/Balance/Reversal)

### 4. Update Your Configuration

Once you receive production credentials, update your environment:

```bash
# .env.production
DARAJA_CONSUMER_KEY=your_production_consumer_key
DARAJA_CONSUMER_SECRET=your_production_consumer_secret

# These are used internally by the SDK for the correct shortcode and passkey:
# DARAJA_SHORTCODE=your_production_shortcode
# DARAJA_PASSKEY=your_production_passkey
# DARAJA_INITIATOR_NAME=your_production_initiator
# DARAJA_INITIATOR_PASSWORD=your_production_initiator_password
```

### Config Changes Summary

| Setting | Sandbox Value | Production Value |
|---------|--------------|------------------|
| Environment | `sandbox` | `production` |
| Consumer Key | Sandbox key from portal | Production key from email |
| Consumer Secret | Sandbox secret from portal | Production secret from email |
| Certificate | `SandboxCertificate.cer` | `ProductionCertificate.cer` |
| Shortcode | `174379` (STK), `600000` (B2C/C2B) | Your real shortcode |
| Passkey | Sandbox passkey | Production passkey from email |
| Initiator | `testapi` | Your production initiator name |
| Initiator Password | `Safaricom999!*!` | Your production initiator password |
| Base URL | `sandbox.safaricom.co.ke` | `api.safaricom.co.ke` |

## IP Whitelisting

Safaricom may require you to whitelist specific server IPs for production access. If so:

- Provide the static IP addresses of your production servers.
- If using a cloud provider (AWS, GCP, Railway, etc.), use a static/elastic IP.
- IP whitelisting is typically required for B2C and other sensitive APIs.

## Post-Go-Live Testing

After updating to production credentials:

1. **Test with small amounts first.** Send a KES 1 STK Push to your own phone.
2. **Verify callbacks arrive.** Confirm your production callback URLs receive results.
3. **Test each API.** Do not assume all APIs work just because one does.
4. **Monitor error rates.** Watch for unexpected errors in the first few hours.
5. **Keep sandbox credentials.** Do not delete your sandbox app -- you will need it for future development and testing.

## Common Go-Live Issues

| Issue | Fix |
|-------|-----|
| Still hitting sandbox URL | Verify your `env` config is set to `production` |
| "Invalid credentials" after switching | Double-check you are using production (not sandbox) credentials |
| B2C fails with security credential error | Ensure you are using `ProductionCertificate.cer`, not sandbox cert |
| STK Push shows wrong merchant name | Merchant name comes from your registered shortcode, not from API params |
| Callbacks not arriving | Verify production callback URLs are reachable, HTTPS, and correct |
| "IP not whitelisted" errors | Contact Safaricom to whitelist your production server IPs |

## Timeline

| Step | Duration |
|------|----------|
| Sandbox development and testing | Depends on your project |
| Submit go-live letter | 5 minutes |
| Safaricom processing | 1-3 business days |
| Update config and test | 1-2 hours |
| **Total go-live process** | **2-4 business days** |
