## 2026-01-20 - Timing Attack in Authentication
**Vulnerability:** The application was using simple string comparison (`===` or `!==`) for checking passwords and validating HMAC signatures for session tokens. This exposes the application to timing attacks, where an attacker can deduce the correct password or signature by measuring the time it takes for the server to respond (the comparison fails faster if the first characters don't match).
**Learning:** In JavaScript/TypeScript, standard equality operators are optimized and fail-fast. For security-sensitive comparisons like cryptographic signatures or secrets, this optimization becomes a vulnerability.
**Prevention:** Always use `crypto.timingSafeEqual()` when comparing sensitive values like passwords, hashes, signatures, or API keys. Ensure both buffers are of the same length before comparison to avoid errors, while being aware that length checks themselves can leak information (though usually acceptable for fixed-length hashes).

## 2026-01-20 - Hardcoded Salt in Session Management
**Vulnerability:** The application used a hardcoded string ('ffui-webui-2025') as a salt for HMAC signatures on session tokens. This makes session tokens predictable if the password is known or weak, and allows rainbow table attacks if the source code is public.
**Learning:** Hardcoded salts in open-source projects defeat the purpose of salting. Even if combined with a password, they don't provide per-installation uniqueness.
**Prevention:** Use a random secret generated at runtime (or installation time) and persist it in the application configuration.

## 2026-01-22 - Path Traversal in API Schemas
**Vulnerability:** The `JobStartRequestSchema` validated filenames only by length (`min(1)`), allowing path traversal characters (e.g., `../../etc/passwd`). If the backend naively concatenates this filename to a path, it allows arbitrary file read/write.
**Learning:** Zod's string validation is basic. For file paths, explicit validation against directory traversal (e.g., forbidding `..`) is essential, especially when inputs are passed to filesystem operations.
**Prevention:** Use `.refine()` in Zod schemas to reject strings containing `..` path segments: `/(^|[\/])\.\.([\/]|$)/`.

## 2026-01-24 - Missing Security Headers
**Vulnerability:** The WebUI server was missing standard HTTP security headers (X-Frame-Options, X-Content-Type-Options, Content-Security-Policy, etc.), potentially exposing it to clickjacking, MIME-sniffing, and XSS attacks.
**Learning:** Express.js does not include security headers by default. Explicit middleware is required to set them.
**Prevention:** Always include security headers middleware in the Express app setup pipeline to set X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and Content-Security-Policy headers.

## 2026-02-05 - Plaintext Password Migration Pattern
**Vulnerability:** The application stored the WebUI password in plaintext in `config.json`, allowing anyone with file access to read it.
**Learning:** Security upgrades often require migration strategies for existing data. A dual-strategy works best:
1. **Startup Migration:** Check and migrate data when the service initializes.
2. **Opportunistic Migration:** If startup migration is bypassed (e.g., config hot-reload), migrate when the legacy data is successfully used (e.g., on successful login).
**Prevention:** Always store passwords hashed (e.g., PBKDF2, Argon2). When upgrading, ensure backward compatibility by detecting the data format (plaintext vs hash) and upgrading it transparently.

## 2026-01-26 - PBKDF2 Iterations Hardening
**Improvement:** Increased PBKDF2-SHA512 iterations from 10,000 to 210,000 (OWASP recommended minimum) before initial release to protect against offline brute-force attacks.
**Learning:** Security constants (like iteration counts) degrade over time as hardware improves. When starting a new project, always use current OWASP recommendations rather than outdated defaults.
**Prevention:** Reference OWASP Password Storage Cheat Sheet for current iteration recommendations when implementing password hashing.

## 2026-02-17 - Optional Auth Middleware Gap
**Vulnerability:** The `/api/auth/logout` endpoint was registered before the global authentication middleware in Express to allow "optional" authentication. However, this meant the `req.auth` property, which the handler relied on to revoke the token, was never populated, rendering the logout ineffective.
**Learning:** Middleware application order in Express is critical. If a route is registered before a middleware, that middleware does not run for it. "Optional" auth often leads to logic gaps if the handler assumes the middleware ran.
**Prevention:** For endpoints needing optional auth, either apply the auth middleware specifically to that route (allowing failure/pass-through) or manually handle token extraction within the route handler, as was done for the fix.

## 2026-02-18 - Stored XSS in Theme Profile Name
**Vulnerability:** The application was vulnerable to Stored XSS in the theme profile management. The profile name was being interpolated directly into `innerHTML` when rendering profile cards: `<span class="profile-name">${profile.name}</span>`. This allows an attacker (or a compromised account) to create a profile with a name containing malicious scripts (e.g., `<img src=x onerror=alert(1)>`) which would execute when any user views the list of theme profiles.
**Learning:** Even when inputs are validated on the server or come from authenticated sources, rendering them unsafely using `innerHTML` creates vulnerabilities. String interpolation into HTML is almost always unsafe for user data.
**Prevention:** Always use safe DOM manipulation methods like `textContent` or `innerText` when rendering untrusted text. If HTML rendering is required, use a sanitizer library (like DOMPurify). In this case, refactoring to use `textContent` for the name field completely eliminates the vector.

## 2026-02-19 - Unvalidated Discriminated Unions
**Vulnerability:** The application was casting `req.body` directly to a discriminated union type (`ThemeProfileOperationRequestBody`) without validation. This allows attackers to send malformed data (e.g., missing fields, invalid types) that matches the TypeScript type structure only superficially, potentially causing backend crashes or logic errors.
**Learning:** TypeScript types disappear at runtime. Trusting that incoming JSON matches a TS interface is a common source of bugs and vulnerabilities. Discriminated unions (like `operation: 'add' | 'update'`) are particularly prone to this if not validated, as the logic flow depends entirely on the discriminator field.
**Prevention:** Always use a runtime validation library like Zod to parse and validate payloads, especially for complex structures like discriminated unions. Use `z.discriminatedUnion` to strictly enforce the relationship between the discriminator and the data shape.
