# Services

Side-effectful adapters (network, storage, auth, third-party APIs). Today
these live in `src/lib/` (`auth.ts`, `photos.ts`, Supabase clients in
`src/integrations/supabase/*`). New cross-product service wrappers should
land here so `src/core/*` stays pure.
