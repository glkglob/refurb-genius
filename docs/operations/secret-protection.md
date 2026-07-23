# Repository secret protection

Refurb Genius uses layered safeguards so credentials and server-only code never
land in git history or client bundles.

## Layers

| Layer | What it does |
|-------|----------------|
| **`.gitignore`** | Ignores `.env*`, `node_modules/`, build output |
| **Pre-commit (`.githooks/`)** | Blocks committing `.env` files; runs gitleaks on staged changes; runs server-only + auth-env invariants |
| **CI `Security` workflow** | Gitleaks on full history; tracked-`.env` guard; `pnpm audit`; server-only invariants; post-build client static scan |
| **Dependabot** | Weekly npm + GitHub Actions updates (`.github/dependabot.yml`) |
| **GitHub secret scanning + push protection** | Blocks known secret patterns at push time (enable in repo settings — see below) |
| **Invariant tests** | `auth-env` + `server-only-boundary` prevent `VITE_` private keys and static imports of `*.server` into client surfaces |

## Local setup

```bash
pnpm install          # runs prepare → configures core.hooksPath=.githooks
brew install gitleaks # recommended for pre-commit secret scan
pnpm security:boundary
pnpm security:audit
```

Hooks live in `.githooks/pre-commit` (tracked). Do not use sample hooks under
`.git/hooks/` for this policy.

## GitHub: push protection & scanning

Enabled for this public repo (2026-07-23):

- **Secret scanning** — on  
- **Push protection** — on (blocks known secret patterns at `git push`)  
- **Dependabot security updates** — on  

Confirm under **Settings → Code security and analysis**. Optional extras:

- Secret scanning **non-provider patterns**  
- Secret scanning **validity checks**  

Re-enable via API if needed:

```bash
gh api -X PATCH repos/glkglob/refurb-genius --input - <<'EOF'
{
  "security_and_analysis": {
    "secret_scanning": { "status": "enabled" },
    "secret_scanning_push_protection": { "status": "enabled" },
    "dependabot_security_updates": { "status": "enabled" }
  }
}
EOF

gh api -X PUT repos/glkglob/refurb-genius/vulnerability-alerts
```

## Rules of thumb

- **Never** prefix private keys with `VITE_` (`OPENAI_API_KEY`, service role, Resend, HF, Sentry auth).
- **Client-safe only:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PUBLIC_*`, `VITE_SENTRY_DSN`.
- Server logic belongs in `*.server.ts` or dynamic `import()` inside `createServerFn` handlers.
- Document templates in `.env.example` only — never real values.

## Related

- `gitleaks.toml` — allowlist for placeholders and docs  
- `.github/workflows/security.yml` — automated gates  
- `tests/invariants/server-only-boundary.invariant.test.ts`  
- `tests/invariants/auth-env.invariant.test.ts`  
