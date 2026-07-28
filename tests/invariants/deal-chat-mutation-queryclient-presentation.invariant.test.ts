/**
 * AO-1J1 — DealChat must not own mutation or mutation-oriented QueryClient.
 *
 * Progressive seal:
 * - useSendDealChatMessage owns send optimistic lifecycle
 * - useCreateDealThread owns create + threads invalidation
 * - useInvalidateDealMessages owns realtime message invalidation callback
 * - dealChatKeys is shared key authority
 * - C3 useDealMessagesChannel channel lifecycle remains approved
 *
 * Read useQuery, draft/voice UI, and rendering remain in DealChat.
 *
 * Strength: lexical (comment-stripped source scan). Known bypasses: alias
 * reassignment, wrapper functions, dynamic import string splits, computed
 * property names.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const COMPONENT = "src/components/deal-copilot/DealChat.tsx";
const KEYS = "src/core/dealCopilot/query/dealChatKeys.ts";
const SEND_HOOK = "src/core/dealCopilot/presentation/hooks/useSendDealChatMessage.ts";
const CREATE_HOOK = "src/core/dealCopilot/presentation/hooks/useCreateDealThread.ts";
const INVALIDATE_HOOK = "src/core/dealCopilot/presentation/hooks/useInvalidateDealMessages.ts";
const PRESENTATION = "src/core/dealCopilot/presentation/index.ts";
const REALTIME = "src/core/dealCopilot/realtime/useDealMessagesChannel.ts";

function stripLineComments(line: string): string {
  const idx = line.indexOf("//");
  if (idx === -1) return line;
  const before = line.slice(0, idx);
  if (before.endsWith(":")) return line;
  return before;
}

function stripBlockComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "");
}

function readSource(rel: string): string {
  const path = join(ROOT, rel);
  assert.ok(existsSync(path), `${rel} must exist`);
  const raw = readFileSync(path, "utf8");
  return stripBlockComments(raw).split("\n").map(stripLineComments).join("\n");
}

test("deal chat mutation QC — component calls canonical hooks", () => {
  const text = readSource(COMPONENT);
  assert.match(
    text,
    /useSendDealChatMessage\s*\(/,
    `${COMPONENT} must call useSendDealChatMessage(`,
  );
  assert.match(text, /useCreateDealThread\s*\(/, `${COMPONENT} must call useCreateDealThread(`);
  assert.match(
    text,
    /useInvalidateDealMessages\s*\(/,
    `${COMPONENT} must call useInvalidateDealMessages(`,
  );
  assert.match(
    text,
    /useDealMessagesChannel\s*\(/,
    `${COMPONENT} must retain useDealMessagesChannel(`,
  );
  assert.match(text, /dealChatKeys\.threads/, `${COMPONENT} must use dealChatKeys.threads`);
  assert.match(text, /dealChatKeys\.messages/, `${COMPONENT} must use dealChatKeys.messages`);
});

test("deal chat mutation QC — component imports presentation barrel, not deep hooks", () => {
  const text = readSource(COMPONENT);
  assert.match(
    text,
    /from\s+["']@\/core\/dealCopilot\/presentation["']/,
    `${COMPONENT} must import from @/core/dealCopilot/presentation`,
  );
  assert.doesNotMatch(
    text,
    /from\s+["']@\/core\/dealCopilot\/presentation\/hooks\//,
    `${COMPONENT} must not deep-import presentation hooks`,
  );
  assert.doesNotMatch(
    text,
    /from\s+["']@\/core\/dealCopilot\/query\/dealChatKeys["']/,
    `${COMPONENT} must not deep-import dealChatKeys`,
  );
});

test("deal chat mutation QC — component bans mutation and QueryClient ownership", () => {
  const text = readSource(COMPONENT);
  assert.doesNotMatch(text, /useMutation/, `${COMPONENT} must not use useMutation`);
  assert.doesNotMatch(text, /useQueryClient/, `${COMPONENT} must not use useQueryClient`);
  assert.doesNotMatch(text, /invalidateQueries/, `${COMPONENT} must not call invalidateQueries`);
  assert.doesNotMatch(text, /getQueryData/, `${COMPONENT} must not call getQueryData`);
  assert.doesNotMatch(text, /setQueryData/, `${COMPONENT} must not call setQueryData`);
  assert.doesNotMatch(text, /cancelQueries/, `${COMPONENT} must not call cancelQueries`);
  assert.doesNotMatch(text, /removeQueries/, `${COMPONENT} must not call removeQueries`);
  assert.doesNotMatch(text, /resetQueries/, `${COMPONENT} must not call resetQueries`);
  assert.doesNotMatch(
    text,
    /sendMessageServerFn/,
    `${COMPONENT} must not call sendMessageServerFn`,
  );
  assert.doesNotMatch(
    text,
    /createThreadServerFn/,
    `${COMPONENT} must not call createThreadServerFn`,
  );
  assert.doesNotMatch(
    text,
    /\[["']deal-threads["']/,
    `${COMPONENT} must not use raw deal-threads key literals`,
  );
  assert.doesNotMatch(
    text,
    /\[["']deal-messages["']/,
    `${COMPONENT} must not use raw deal-messages key literals`,
  );
  assert.doesNotMatch(
    text,
    /from\s+["']@\/lib\/analytics["']/,
    `${COMPONENT} must not import analytics when mutation analytics moved to hooks`,
  );
});

test("deal chat mutation QC — component retains reads and list serverFns", () => {
  const text = readSource(COMPONENT);
  assert.match(text, /useQuery\s*\(/, `${COMPONENT} must retain useQuery reads`);
  assert.match(text, /listThreadsServerFn/, `${COMPONENT} may use listThreadsServerFn`);
  assert.match(text, /listMessagesServerFn/, `${COMPONENT} may use listMessagesServerFn`);
});

test("deal chat mutation QC — shared keys factory shapes", () => {
  const text = readSource(KEYS);
  assert.match(text, /export const dealChatKeys/, `${KEYS} must export dealChatKeys`);
  assert.match(text, /\[["']deal-threads["']/, `${KEYS} must define deal-threads prefix`);
  assert.match(text, /\[["']deal-messages["']/, `${KEYS} must define deal-messages prefix`);
  assert.doesNotMatch(text, /useQueryClient/, `${KEYS} must not use QueryClient`);
  assert.doesNotMatch(text, /from\s+["']react["']/, `${KEYS} must not import react`);
});

test("deal chat mutation QC — send hook owns optimistic lifecycle", () => {
  const text = readSource(SEND_HOOK);
  assert.match(text, /useMutation/, `${SEND_HOOK} must use useMutation`);
  assert.match(text, /useQueryClient/, `${SEND_HOOK} must use useQueryClient`);
  assert.match(text, /cancelQueries/, `${SEND_HOOK} must cancelQueries`);
  assert.match(text, /getQueryData/, `${SEND_HOOK} must getQueryData`);
  assert.match(text, /setQueryData/, `${SEND_HOOK} must setQueryData`);
  assert.match(text, /sendMessageServerFn/, `${SEND_HOOK} must call sendMessageServerFn`);
  assert.match(text, /opt-\$\{Date\.now\(\)\}/, `${SEND_HOOK} must use opt-Date.now id`);
  assert.match(text, /deal_message_sent/, `${SEND_HOOK} must track deal_message_sent`);
  assert.doesNotMatch(text, /useDealMessagesChannel/, `${SEND_HOOK} must not own realtime`);
  assert.doesNotMatch(text, /createThreadServerFn/, `${SEND_HOOK} must not create threads`);
});

test("deal chat mutation QC — create hook owns threads invalidation", () => {
  const text = readSource(CREATE_HOOK);
  assert.match(text, /useMutation/, `${CREATE_HOOK} must use useMutation`);
  assert.match(text, /createThreadServerFn/, `${CREATE_HOOK} must call createThreadServerFn`);
  assert.match(text, /invalidateQueries/, `${CREATE_HOOK} must invalidateQueries`);
  assert.match(text, /dealChatKeys\.threads/, `${CREATE_HOOK} must use dealChatKeys.threads`);
  assert.match(text, /deal_thread_created/, `${CREATE_HOOK} must track deal_thread_created`);
  assert.doesNotMatch(text, /sendMessageServerFn/, `${CREATE_HOOK} must not send messages`);
  assert.doesNotMatch(text, /useDealMessagesChannel/, `${CREATE_HOOK} must not own realtime`);
});

test("deal chat mutation QC — invalidate hook is fire-and-forget messages only", () => {
  const text = readSource(INVALIDATE_HOOK);
  assert.match(text, /useQueryClient/, `${INVALIDATE_HOOK} must use useQueryClient`);
  assert.match(text, /invalidateQueries/, `${INVALIDATE_HOOK} must invalidateQueries`);
  assert.match(text, /void\s+/, `${INVALIDATE_HOOK} must fire-and-forget (void)`);
  assert.match(text, /dealChatKeys\.messages/, `${INVALIDATE_HOOK} must use messages key`);
  assert.doesNotMatch(text, /useMutation/, `${INVALIDATE_HOOK} must not use useMutation`);
  assert.doesNotMatch(text, /getQueryData/, `${INVALIDATE_HOOK} must not getQueryData`);
  assert.doesNotMatch(text, /setQueryData/, `${INVALIDATE_HOOK} must not setQueryData`);
  assert.doesNotMatch(text, /cancelQueries/, `${INVALIDATE_HOOK} must not cancelQueries`);
  assert.doesNotMatch(text, /sendMessageServerFn/, `${INVALIDATE_HOOK} must not send`);
});

test("deal chat mutation QC — presentation barrel exports hooks and keys", () => {
  const text = readSource(PRESENTATION);
  assert.match(
    text,
    /useSendDealChatMessage/,
    `${PRESENTATION} must export useSendDealChatMessage`,
  );
  assert.match(text, /useCreateDealThread/, `${PRESENTATION} must export useCreateDealThread`);
  assert.match(
    text,
    /useInvalidateDealMessages/,
    `${PRESENTATION} must export useInvalidateDealMessages`,
  );
  assert.match(text, /dealChatKeys/, `${PRESENTATION} must export dealChatKeys`);
  assert.doesNotMatch(text, /useQueryClient/, `${PRESENTATION} must not export QueryClient usage`);
});

test("deal chat mutation QC — C3 realtime owner unchanged", () => {
  const text = readSource(REALTIME);
  assert.match(text, /export function useDealMessagesChannel/, `${REALTIME} must export hook`);
  assert.match(text, /deal-messages-\$/, `${REALTIME} must retain channel name pattern`);
  assert.match(text, /postgres_changes/, `${REALTIME} must retain postgres_changes`);
  assert.match(text, /removeChannel/, `${REALTIME} must retain removeChannel`);
});
