import { DEFAULT_SETUP, RULES_VERSION } from "@gaffer/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { contextOf, flush, queued, submit } from "../src/feedback/submit";

/*
 * These run with the multiplayer flag off, which is the offline-fallback path:
 * `send` cannot reach a client, so everything queues. That is the case worth
 * pinning hardest — a tester on a bad connection is the one whose note is most
 * easily lost, and losing it is worse than any other failure here.
 */

describe("feedback that cannot be sent yet", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps a note rather than dropping it", async () => {
    expect(queued()).toBe(0);

    const sent = await submit({ kind: "note", body: "too many 0% options", meta: {} });

    expect(sent, "there is no client in this build, so it cannot have gone").toBe(false);
    expect(queued(), "the note is waiting rather than gone").toBe(1);
  });

  it("keeps them in order and keeps them all", async () => {
    for (const body of ["one", "two", "three"]) {
      await submit({ kind: "note", body, meta: {} });
    }
    expect(queued()).toBe(3);
  });

  it("holds the queue until it can actually be sent", async () => {
    await submit({ kind: "note", body: "held", meta: {} });

    /* A flush that cannot send must not empty the outbox — the failure mode
       this guards against is "tried once, silently threw it away". */
    expect(await flush()).toBe(0);
    expect(queued()).toBe(1);
  });

  it("survives a corrupted outbox rather than throwing", () => {
    /* Storage is shared with the rest of the browser and a tester may have
       anything in it. Feedback failing is bad; the app failing to start
       because feedback failed is worse. */
    localStorage.setItem("gaffer:feedback:outbox", "{not an array}");
    expect(queued()).toBe(0);
  });
});

describe("what is captured for the tester", () => {
  it("records the match without anybody typing it", () => {
    const meta = contextOf({
      setup: { ...DEFAULT_SETUP, seed: 4242, mode: "7v7" },
      turn: 12,
      score: "1–0",
      actionIndex: 47,
    });

    expect(meta["seed"]).toBe(4242);
    expect(meta["mode"]).toBe("7v7");
    expect(meta["turn"]).toBe(12);
    expect(meta["score"]).toBe("1–0");
    expect(meta["actionIndex"]).toBe(47);
  });

  it("records which rules and which build it was", () => {
    /* A report is worth much less without these: "the board was invisible" is
       a different conversation depending on the freeze somebody was holding. */
    const meta = contextOf({ setup: DEFAULT_SETUP });

    expect(meta["rulesVersion"]).toBe(RULES_VERSION);
    expect(meta["build"]).toBeTruthy();
  });

  it("names the online match when there is one, and does not invent one", () => {
    expect(contextOf({ setup: DEFAULT_SETUP, matchId: "abc" })["matchId"]).toBe("abc");
    expect(contextOf({ setup: DEFAULT_SETUP })).not.toHaveProperty("matchId");
  });
});
