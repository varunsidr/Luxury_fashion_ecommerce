# Security Policy

## Reporting a vulnerability

Please do not report security vulnerabilities in a public GitHub issue. Use GitHub's private security advisory feature or contact the repository owner through their GitHub profile with a clear description, reproduction steps and potential impact. Do not include real credentials or customer data in a public report.

## Server and browser boundaries

- Public Supabase URL/anon settings are intended for browser use under applied RLS. Service role, admin password hashes/signing secret, shared-limiter secret, Groq key, mail and helper secrets stay server-side.
- Customer APIs verify Supabase bearer tokens. Admin APIs verify the separate signed `admin_token` cookie; browser `admin_auth` state is not authorization.
- Admin login in every environment uses named `ADMIN_CREDENTIALS` scrypt hashes and an independent `ADMIN_SESSION_SECRET` of at least 32 characters. Cookies are HttpOnly/SameSite=Lax and Secure in production. The dev-helper key cannot authenticate admins or sign cookies.
- `/api/dev/create-user` always rejects production requests. In nonproduction it requires a configured, nonblank `DEV_CREATE_USER_KEY` and matching `x-dev-key` before processing account input or accessing Supabase. Missing configuration returns 503; missing/wrong request keys return 401. Never expose this key to the browser.
- Catalog mutation/upload handlers check admin identity, request origin, shared limits and payloads before service-role writes. The catalog migration restricts direct browser product/size/product-image writes. Applied grants still need environment verification.
- Checkout's service-only transaction owns authoritative INR prices, configured option checks, inventory changes and account-scoped replay records. Browser and assistant bag additions do not reserve inventory.

## Deployment requirements

1. Apply the current [ordered migrations](README.md#database-schema), including security hardening, purchase safeguards and admin catalog last. Deploy matching application/schema versions; older checkout definitions must not replace the five-argument RPC.
2. Configure distinct admin credentials/signing secret and `RATE_LIMIT_SECRET` of at least 32 characters. The shared limiter also needs Supabase URL, server service role, `consume_api_rate_limit` and a proxy that overwrites/appends `x-forwarded-for`. Limiter keys are HMAC-hashed.
3. Production fails closed with 503 if the limiter is unavailable. This covers admin login, checkout, reviews/uploads, restock subscription, assistant chat/confirmation and protected catalog mutations/uploads. `npm run start` is production mode even on localhost; process liveness does not prove these integrations work.
4. Set `GROQ_API_KEY` only for server model requests; `GROQ_MODEL` is optional. No OpenAI credential fallback exists. Valid card interactions use no model key, but still require working rate limits and applicable customer authentication.
5. Keep real environment values out of Git, client bundles, logs and screenshots. [.env.example](.env.example) contains placeholders; `.env.local`, build output and test artifacts remain ignored.
6. Dev/test helpers are blocked in production by their guards. Keep helper secrets nonproduction-only and verify the deployed guards; do not change them to troubleshoot a local preview.
7. Run the read-only `npm run security:check-db` with an explicitly supplied staging `DATABASE_URL` after migrations. It checks current RPCs, RLS/grants, private attempts, catalog/storage guards and legacy invalid rows. Local SQL fixtures and the health route do not establish full applied-database security.

Local `npm run dev` permits a process-local limiter only when shared settings are incomplete. If complete shared settings point to a failing database/RPC, it still fails closed. Do not change production guards to obtain a development preview.

## Assistant data and safety controls

Free-text history and tool/reference facts are sent to Groq. The app stores conversations only in identity-scoped widget memory; that does not establish provider retention. The panel asks users not to share personal/payment details.

Catalog-authored descriptions are untrusted input. Tools validate arguments and reload catalog facts; the UI renders tool-composed copy and catalog-derived cards instead of raw model prose. Model intent/tool selection still needs evaluation. There are no order/account/checkout/payment tools.

Chat/card interactions have one 35-second server deadline; confirmation has 10 seconds. Supported provider/auth/catalog/limiter requests receive cancellation signals. Confirm performs fresh read-only identity/price/options/stock validation, and the client rechecks identity/bag before adding. These controls are not inventory reservation, a database-owned cart or proof of deployed disconnect handling.

## Storage and unresolved boundaries

Product images are public; validated uploads use a server-admin route. New review uploads use private `review-images` paths, with short-lived moderator URLs. Historical public review files and orphan retention/cleanup remain unresolved.

The browser bag remains shared across account changes (G-10). Review identity/replies, real cross-role/RLS verification, native-device/accessibility checks, live concurrent stock/replay behavior and provider retention remain open. See [architecture.md](architecture.md) and the [BRD gaps](docs/BRD.md#12-known-gaps-and-business-decisions); source controls and scoped tests are not full production acceptance.
