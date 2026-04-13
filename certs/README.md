# Daraja certificates

B2C / Transaction Status / Account Balance / Reversal all require a
`SecurityCredential` — the initiator password encrypted with Safaricom's public
certificate (RSA / PKCS1 padding).

Download the relevant `.cer` file from the Daraja portal and drop it here:

- `SandboxCertificate.cer`    — for sandbox testing
- `ProductionCertificate.cer` — for production

Then point `MPESA_CERT_PATH` in `.env` at the file. The app will RSA-encrypt
your `MPESA_INITIATOR_PASSWORD` on every request automatically.

Alternatively, paste a pre-encrypted value into `MPESA_B2C_SECURITY_CREDENTIAL`
and the cert step will be skipped.
