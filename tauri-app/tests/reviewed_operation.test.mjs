import test from "node:test";
import assert from "node:assert/strict";
import { ReviewedOperation } from "../src/features/transfers/reviewed_operation.ts";
import { emptyRecipient } from "../src/features/bithumb/withdrawal_contracts.ts";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture(overrides = {}) {
  const calls = { inspect: [], execute: [], busy: [], settled: [] };
  let now = 1000;
  const operation = new ReviewedOperation({
    inspect: async (request) => {
      calls.inspect.push(request);
      return { ticket: "one-use", request: structuredClone(request), expiresAt: now + 60_000 };
    },
    execute: async (review) => { calls.execute.push(review); return { id: "accepted", request: review.request, state: "PROCESSING" }; },
    failure: (e, mutation) => e?.kind ? e : { kind: mutation ? "uncertain" : "unknown", message: String(e) },
    onBusy: (busy) => calls.busy.push(busy),
    onSettled: (request) => calls.settled.push(request),
    ...overrides,
  }, () => now);
  return { operation, calls, expire: () => { now += 60_000; } };
}

for (const request of [
  { currency: "XRP", amount: "10", tag: "123", target: { exchange: "bithumb", details: emptyRecipient("personal") } },
  { currency: "BTC", amount: "0.001", tag: null, target: { exchange: "binance" } },
  { kind: "deposit", amount: "5000", twoFactorType: "kakao" },
  { kind: "withdraw", amount: "6000", twoFactorType: "kakao" },
]) {
  test(`review/confirm/execute preserves the accepted request: ${JSON.stringify(request)}`, async () => {
    const { operation: flow, calls } = fixture();
    await flow.inspect(request);
    await flow.execute();
    assert.equal(calls.execute.length, 0, "confirmation is required");
    flow.confirm(true);
    await Promise.all([flow.execute(), flow.execute()]);
    assert.equal(calls.execute.length, 1, "a second click cannot submit twice");
    assert.deepEqual(calls.settled, [request]);
    assert.deepEqual(flow.getSnapshot().result.request, request);
    assert.equal(flow.getSnapshot().review, undefined);
    assert.equal(flow.getSnapshot().result.state, "PROCESSING");
    await flow.inspect({ ...request, amount: "999" });
    assert.equal(calls.inspect.length, 1, "accepted request remains locked until reset");
    flow.reset();
    assert.equal(flow.locked, false);
  });
}

test("editing invalidates confirmation; an expired review cannot execute", async () => {
  const { operation: flow, calls, expire } = fixture();
  await flow.inspect({ amount: "1" });
  flow.confirm(true);
  flow.invalidate();
  await flow.execute();
  assert.equal(flow.getSnapshot().confirmed, false);
  assert.equal(calls.execute.length, 0);
  await flow.inspect({ amount: "2" });
  flow.confirm(true);
  expire();
  await flow.execute();
  assert.equal(calls.execute.length, 0);
});

test("execution and recovery use the reviewed snapshot rather than the current draft", async () => {
  const { operation: flow, calls } = fixture();
  const draft = { currency: "XRP", amount: "10", tag: "123" };
  await flow.inspect(draft);
  draft.amount = "999";
  draft.tag = "changed";
  flow.confirm(true);
  await flow.execute();
  assert.equal(flow.getSnapshot().result.request.amount, "10");
  assert.equal(flow.getSnapshot().attempt.tag, "123");
  assert.equal(calls.settled[0].amount, "10");
});

test("late review and late review failure cannot restore an obsolete draft", async () => {
  for (const reject of [false, true]) {
    const pending = deferred();
    const { operation: flow } = fixture({ inspect: () => pending.promise });
    const wait = flow.inspect({ amount: "1" });
    flow.invalidate();
    if (reject) pending.reject(new Error("old request"));
    else pending.resolve({ ticket: "old", request: { amount: "1" }, expiresAt: 60_000 });
    await wait;
    assert.equal(flow.getSnapshot().review, undefined);
    assert.equal(flow.getSnapshot().error, undefined);
    assert.equal(flow.getSnapshot().busy, false);
  }
});

test("unknown mutation failure locks retry and retains the exact attempt for recovery", async () => {
  const { operation: flow, calls } = fixture({ execute: async () => { throw new Error("IPC disconnected"); } });
  const request = { kind: "deposit", amount: "5000" };
  await flow.inspect(request);
  flow.confirm(true);
  await flow.execute();
  assert.equal(flow.getSnapshot().error.kind, "uncertain");
  assert.deepEqual(flow.getSnapshot().attempt, request);
  assert.deepEqual(calls.settled, [request]);
  flow.reset();
  await flow.inspect({ amount: "9000" });
  assert.equal(calls.inspect.length, 1);
  assert.equal(flow.locked, true);
});

test("explicit rejection permits a new review but never reuses the old ticket", async () => {
  const { operation: flow, calls } = fixture({ execute: async () => { throw { kind: "rejected", message: "denied" }; } });
  await flow.inspect({ amount: "1" });
  flow.confirm(true);
  await flow.execute();
  assert.equal(flow.getSnapshot().error.kind, "rejected");
  assert.equal(flow.getSnapshot().review, undefined);
  assert.equal(flow.locked, false);
  await flow.inspect({ amount: "2" });
  assert.equal(calls.inspect.length, 2);
});

test("pending review cannot issue another ticket and lookup failures remain retryable", async () => {
  const pending = deferred();
  let inspections = 0;
  const { operation: flow, calls } = fixture({ inspect: () => { inspections++; return pending.promise; } });
  const wait = flow.inspect({ amount: "1" });
  await flow.inspect({ amount: "2" });
  assert.equal(inspections, 1);
  pending.reject(new Error("lookup failed"));
  await wait;
  assert.equal(flow.getSnapshot().error.kind, "unknown");
  assert.equal(flow.locked, false);
  assert.deepEqual(calls.busy, [true, false]);
  assert.deepEqual(calls.settled, []);
});

test("changing Bithumb recipient kind removes fields owned by the previous kind", () => {
  assert.deepEqual(emptyRecipient("internal"), { type: "internal" });
  assert.deepEqual(Object.keys(emptyRecipient("whitelist")).sort(), ["exchange", "type"]);
  assert.deepEqual(Object.keys(emptyRecipient("personal")).sort(), ["english", "exchange", "korean", "type"]);
  assert.deepEqual(Object.keys(emptyRecipient("corporation")).sort(), ["corpEnglish", "corpKorean", "english", "exchange", "korean", "type"]);
});
