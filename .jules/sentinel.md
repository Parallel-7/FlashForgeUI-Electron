## 2026-01-20 - Timing Attack in Authentication
**Vulnerability:** The application was using simple string comparison (`===` or `!==`) for checking passwords and validating HMAC signatures for session tokens. This exposes the application to timing attacks, where an attacker can deduce the correct password or signature by measuring the time it takes for the server to respond (the comparison fails faster if the first characters don't match).
**Learning:** In JavaScript/TypeScript, standard equality operators are optimized and fail-fast. For security-sensitive comparisons like cryptographic signatures or secrets, this optimization becomes a vulnerability.
**Prevention:** Always use `crypto.timingSafeEqual()` when comparing sensitive values like passwords, hashes, signatures, or API keys. Ensure both buffers are of the same length before comparison to avoid errors, while being aware that length checks themselves can leak information (though usually acceptable for fixed-length hashes).

## 2026-01-20 - Hardcoded Salt in Session Management
**Vulnerability:** The application used a hardcoded string ('ffui-webui-2025') as a salt for HMAC signatures on session tokens. This makes session tokens predictable if the password is known or weak, and allows rainbow table attacks if the source code is public.
**Learning:** Hardcoded salts in open-source projects defeat the purpose of salting. Even if combined with a password, they don't provide per-installation uniqueness.
**Prevention:** Use a random secret generated at runtime (or installation time) and persist it in the application configuration.
