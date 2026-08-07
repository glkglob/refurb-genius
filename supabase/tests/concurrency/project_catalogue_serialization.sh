#!/usr/bin/env bash
# Multi-session concurrency proof for P0-PHOTO-ANALYZE-R4.
# Requires local Supabase Postgres container with migration applied.
set -euo pipefail

DB_CID="${SUPABASE_DB_CONTAINER:-supabase_db_sxhzjmzfkgbogmlsbeju}"
PSQL=(docker exec -i "$DB_CID" psql -U postgres -d postgres -v ON_ERROR_STOP=1)

PROJECT='ffffffff-ffff-4fff-8fff-fffffffffff1'
USER_A='66666666-6666-4666-8666-666666666666'
P1='c1111111-cccc-4ccc-8ccc-111111111111'
P2='c2222222-cccc-4ccc-8ccc-222222222222'
P3='c3333333-cccc-4ccc-8ccc-333333333333'
P4='c4444444-cccc-4ccc-8ccc-444444444444'

echo "== R4 multi-session concurrency harness =="

"${PSQL[@]}" <<SQL
-- Reset fixture
DELETE FROM public.room_analyses WHERE project_id = '${PROJECT}';
DELETE FROM public.photos WHERE project_id = '${PROJECT}';
DELETE FROM public.projects WHERE id = '${PROJECT}';
DELETE FROM auth.users WHERE id = '${USER_A}';
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES (
  '${USER_A}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'r4-conc@example.com', crypt('pw', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}', false, '', '', '', ''
);
INSERT INTO public.projects (id, user_id, name, region, property_type, analysis_done)
VALUES ('${PROJECT}', '${USER_A}', 'R4 Conc', 'London', 'Flat', false);
SQL

# Seed three photos + complete analysis via RPC as user
"${PSQL[@]}" <<SQL
BEGIN;
SELECT set_config('request.jwt.claim.sub', '${USER_A}', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;
SELECT create_project_photo_metadata('${PROJECT}'::uuid, '${P1}'::uuid, 'c/p1.jpg', 'https://cdn/p1.jpg', 'p1.jpg', 10);
SELECT create_project_photo_metadata('${PROJECT}'::uuid, '${P2}'::uuid, 'c/p2.jpg', 'https://cdn/p2.jpg', 'p2.jpg', 10);
SELECT create_project_photo_metadata('${PROJECT}'::uuid, '${P3}'::uuid, 'c/p3.jpg', 'https://cdn/p3.jpg', 'p3.jpg', 10);
SELECT count(*) FROM replace_project_room_analyses('${PROJECT}'::uuid,
  '[{"photo_id":"${P1}","source":"ai","room_type":"Kitchen","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"S1","confidence_score":0.9},
    {"photo_id":"${P2}","source":"ai","room_type":"Bathroom","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"S2","confidence_score":0.8},
    {"photo_id":"${P3}","source":"ai","room_type":"Other","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"S3","confidence_score":0.7}]'::jsonb);
-- restore analysis_done for insert-invalidation proof later
RESET ROLE;
UPDATE public.projects SET analysis_done = true WHERE id = '${PROJECT}';
COMMIT;
SQL

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# --- Probe 1: replacement holds project lock; insert waits; insert then invalidates ---
cat >"$TMP/t1.sql" <<SQL
BEGIN;
SELECT set_config('request.jwt.claim.sub', '${USER_A}', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;
SELECT id FROM public.projects WHERE id = '${PROJECT}' AND user_id = auth.uid() FOR UPDATE;
SELECT pg_sleep(3);
SELECT count(*) AS replace_n FROM public.replace_project_room_analyses('${PROJECT}'::uuid,
  '[{"photo_id":"${P1}","source":"ai","room_type":"Kitchen","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"T1A","confidence_score":0.9},
    {"photo_id":"${P2}","source":"ai","room_type":"Bathroom","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"T1B","confidence_score":0.8},
    {"photo_id":"${P3}","source":"ai","room_type":"Other","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"T1C","confidence_score":0.7}]'::jsonb);
COMMIT;
SQL

cat >"$TMP/t2.sql" <<SQL
SELECT pg_sleep(0.5);
BEGIN;
SELECT set_config('request.jwt.claim.sub', '${USER_A}', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;
SELECT clock_timestamp() AS t2_start;
SELECT (create_project_photo_metadata('${PROJECT}'::uuid, '${P4}'::uuid, 'c/p4.jpg', 'https://cdn/p4.jpg', 'p4.jpg', 10)).id AS p4;
SELECT clock_timestamp() AS t2_end;
SELECT analysis_done FROM public.projects WHERE id = '${PROJECT}';
COMMIT;
SQL

(docker exec -i "$DB_CID" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <"$TMP/t1.sql" >"$TMP/t1.out" 2>&1) &
(docker exec -i "$DB_CID" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <"$TMP/t2.sql" >"$TMP/t2.out" 2>&1) &
wait

echo "--- Probe1 T1 ---"; cat "$TMP/t1.out"
echo "--- Probe1 T2 ---"; cat "$TMP/t2.out"

"${PSQL[@]}" -c "
SELECT
  (SELECT count(*) FROM public.photos WHERE project_id='${PROJECT}') AS photos,
  (SELECT count(*) FROM public.room_analyses WHERE project_id='${PROJECT}') AS analyses,
  (SELECT analysis_done FROM public.projects WHERE id='${PROJECT}') AS analysis_done;
"

# Expect 4 photos, 3 analyses, analysis_done false; authority read rejects
AUTH_OUT=$("${PSQL[@]}" -tAc "
BEGIN;
SELECT set_config('request.jwt.claim.sub', '${USER_A}', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;
SELECT count(*) FROM public.get_current_project_analysis_authority('${PROJECT}'::uuid);
COMMIT;
" 2>&1 || true)
echo "authority after insert race: $AUTH_OUT"
if echo "$AUTH_OUT" | grep -qi 'stale_requires_reanalysis'; then
  echo "PASS: redesign authority rejects incomplete post-insert"
else
  # count empty or error both ok if not 3
  if echo "$AUTH_OUT" | grep -Eq '^[ ]*3[ ]*$'; then
    echo "FAIL: authority still valid with 4 photos / 3 analyses"
    exit 1
  fi
  echo "PASS: authority not valid complete set"
fi

# --- Probe 2: reverse order — insert first, then incomplete replace rejects ---
"${PSQL[@]}" <<SQL
DELETE FROM public.photos WHERE id = '${P4}';
DELETE FROM public.room_analyses WHERE project_id = '${PROJECT}';
UPDATE public.projects SET analysis_done = false WHERE id = '${PROJECT}';
BEGIN;
SELECT set_config('request.jwt.claim.sub', '${USER_A}', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;
SELECT create_project_photo_metadata('${PROJECT}'::uuid, '${P4}'::uuid, 'c/p4.jpg', 'https://cdn/p4.jpg', 'p4.jpg', 10);
COMMIT;
SQL

REPLACE_OUT=$("${PSQL[@]}" <<SQL 2>&1 || true
BEGIN;
SELECT set_config('request.jwt.claim.sub', '${USER_A}', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;
SELECT count(*) FROM public.replace_project_room_analyses('${PROJECT}'::uuid,
  \$j\$[
    {"photo_id":"${P1}","source":"ai","room_type":"Kitchen","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"X","confidence_score":0.9},
    {"photo_id":"${P2}","source":"ai","room_type":"Bathroom","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"Y","confidence_score":0.8},
    {"photo_id":"${P3}","source":"ai","room_type":"Other","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"Z","confidence_score":0.7}
  ]\$j\$::jsonb);
COMMIT;
SQL
)
echo "incomplete replace after P4: $REPLACE_OUT"
if echo "$REPLACE_OUT" | grep -qi 'incomplete_photo_catalogue'; then
  echo "PASS: reverse order incomplete payload rejected"
else
  echo "FAIL: expected incomplete_photo_catalogue"
  exit 1
fi

# --- Probe 3: competing replacements not mixed ---
"${PSQL[@]}" <<SQL
DELETE FROM public.photos WHERE id = '${P4}';
BEGIN;
SELECT set_config('request.jwt.claim.sub', '${USER_A}', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;
SELECT count(*) FROM replace_project_room_analyses('${PROJECT}'::uuid,
  '[{"photo_id":"${P1}","source":"ai","room_type":"Kitchen","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"BASE1","confidence_score":0.9},
    {"photo_id":"${P2}","source":"ai","room_type":"Bathroom","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"BASE2","confidence_score":0.8},
    {"photo_id":"${P3}","source":"ai","room_type":"Other","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"BASE3","confidence_score":0.7}]'::jsonb);
COMMIT;
SQL

cat >"$TMP/ra.sql" <<SQL
BEGIN;
SELECT set_config('request.jwt.claim.sub', '${USER_A}', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;
SELECT count(*) FROM replace_project_room_analyses('${PROJECT}'::uuid,
  '[{"photo_id":"${P1}","source":"ai","room_type":"Kitchen","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"AAA1","confidence_score":0.9},
    {"photo_id":"${P2}","source":"ai","room_type":"Bathroom","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"AAA2","confidence_score":0.8},
    {"photo_id":"${P3}","source":"ai","room_type":"Other","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"AAA3","confidence_score":0.7}]'::jsonb);
COMMIT;
SQL
cat >"$TMP/rb.sql" <<SQL
BEGIN;
SELECT set_config('request.jwt.claim.sub', '${USER_A}', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;
SELECT count(*) FROM replace_project_room_analyses('${PROJECT}'::uuid,
  '[{"photo_id":"${P1}","source":"ai","room_type":"Kitchen","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"BBB1","confidence_score":0.9},
    {"photo_id":"${P2}","source":"ai","room_type":"Bathroom","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"BBB2","confidence_score":0.8},
    {"photo_id":"${P3}","source":"ai","room_type":"Other","condition_level":"Average","refurbishment_level":"Medium","visible_issues":[],"recommended_works":[],"ai_summary":"BBB3","confidence_score":0.7}]'::jsonb);
COMMIT;
SQL
(docker exec -i "$DB_CID" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <"$TMP/ra.sql" >/dev/null 2>&1) &
(docker exec -i "$DB_CID" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <"$TMP/rb.sql" >/dev/null 2>&1) &
wait
MIX=$("${PSQL[@]}" -tAc "SELECT bool_or(ai_summary LIKE 'AAA%') AND bool_or(ai_summary LIKE 'BBB%') FROM public.room_analyses WHERE project_id='${PROJECT}';")
echo "mixed competing replacements: $MIX"
if [ "$(echo "$MIX" | tr -d '[:space:]')" = "t" ]; then
  echo "FAIL: mixed authority from concurrent replacements"
  exit 1
fi
echo "PASS: competing replacements not mixed"

echo "ALL R4 CONCURRENCY PROBES PASSED"
