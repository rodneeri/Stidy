# Local HTTPS (fix "Not secure" / certificate warning in Chrome)

When you run the dev server over plain HTTP, Chrome labels `localhost` **Not secure**,
and some browser APIs (secure cookies, service workers, clipboard, WebAuthn, etc.)
behave differently than in production. This sets up **trusted** local HTTPS so the
padlock is green and dev matches prod.

We use [mkcert](https://github.com/FiloSottile/mkcert), which creates a local
Certificate Authority and adds it to your OS trust store, then issues a cert for
`localhost`. Because the CA is trusted, Chrome shows a valid certificate — no warning.

## One-time setup (already done on Erick's machine — 2026-06-20)

```bash
# 1. Install mkcert
winget install FiloSottile.mkcert        # Windows
# brew install mkcert                      # macOS

# 2. Trust the local CA (pops a one-time OS confirmation dialog)
mkcert -install

# 3. Generate a cert for localhost into ./certificates/
mkdir certificates
cd certificates
mkcert -cert-file localhost.pem -key-file localhost-key.pem localhost 127.0.0.1 ::1
```

The generated `certificates/*.pem` are **git-ignored** (machine-local; the key is
private). Each developer / machine regenerates them with the steps above.

## Running the dev server with HTTPS

```bash
npm run dev:https      # https://localhost:3000  — trusted, green padlock
npm run dev            # http://localhost:3000   — plain HTTP (unchanged)
```

`dev:https` passes Next.js 16's `--experimental-https-key` / `--experimental-https-cert`
flags pointing at the mkcert files (see `package.json`).

## Notes

- **Production (Vercel) is unaffected** — Vercel terminates TLS with a real, publicly
  trusted certificate. This is purely for local development.
- If the cert expires (mkcert certs last ~2 years) or you see a warning again, re-run
  step 3 to regenerate `certificates/localhost*.pem`.
- To undo the trusted CA entirely: `mkcert -uninstall`.
- A teammate who clones the repo won't have `certificates/` (git-ignored) — they run
  the one-time setup above, or just use `npm run dev` over HTTP.
