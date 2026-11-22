import { eq } from "drizzle-orm";
import { saveImage, schema as warren } from "warren/server";
import sharp from "sharp";
import { expect, test } from "vitest";
import { buildContext } from "../src/agent/context.js";
import { recentExchanges } from "../src/agent/recall.js";
import { labelProblems } from "../src/agent/tools.js";
import { SYSTEM_PROMPT } from "../src/agent/systemPrompt.js";
import * as foodSvc from "../src/foods.js";
import * as logSvc from "../src/log.js";
import { entries } from "../src/schema.js";
import { FakeClaude, say, testBao, turn, use } from "./helpers.js";

const DAY = "2026-03-03";

test("a turn logs through the tools, and the next turn replays it byte for byte", async () => {
  const claude = new FakeClaude([
    use("tu_1", "log_entries", { entries: [{ meal: "breakfast", food_id: 0 }] }),
    say("Logged kopi C."),
    say("You had 108 kcal."),
  ]);
  const bao = testBao({ anthropic: claude });
  (claude as any).responses[0].content[0].input.entries[0].food_id = bao.foodId("Kopi C");
  const alice = await bao.as("Alice");

  const events = await turn(bao, alice, "kopi c for breakfast");
  const done = events.at(-1);
  expect(done.turn.reply_text).toBe("Logged kopi C.");
  expect(done.turn.changes).toEqual([{ table: "entries", action: "create", row_id: 1, name: "Kopi C", kcal: 107.5 }]);
  expect(events.find((e) => e.type === "changed")).toEqual({ type: "changed", touched: [DAY] });

  const first = claude.requests[0]!;
  expect(first.system).toEqual([{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }]);
  expect(first.tools.map((t: any) => t.name)).toEqual([
    "delete_entries", "delete_food", "get_entries", "log_entries", "save_food", "search_foods", "update_entries", "view_photos",
  ]);
  expect(first.messages[0].content.at(-1).text).toContain("<context>");
  // the tool result the model read
  expect(claude.requests[1]!.messages[2].content[0].content).toBe(
    `Logged ${DAY} #1 breakfast: Kopi C — 1 × cup (250 g) — 108 kcal, P3 C18 F3\nDay total ${DAY}: 108 kcal, P3 C18 F3`,
  );

  await turn(bao, alice, "how many calories?", { threadId: events[0].thread_id });
  const previous = claude.requests[1]!.messages;
  expect(JSON.stringify(claude.requests[2]!.messages.slice(0, previous.length))).toBe(JSON.stringify(previous));
  const stored = bao.db.select().from(warren.turns).all()[0]!;
  expect([stored.usage.cache_read, stored.costUsd > 0, stored.appVersion]).toEqual([200, true, "9.9.9"]);
  expect((await alice.get("/api/usage")).turns).toBe(2);
});

test("the search tool's schema keeps its guidance for the model", async () => {
  const claude = new FakeClaude([say("Hi.")]);
  const bao = testBao({ anthropic: claude });
  await turn(bao, await bao.as("Alice"), "hi");
  const tools = Object.fromEntries(claude.requests[0]!.tools.map((t: any) => [t.name, t]));
  expect(tools.search_foods.input_schema).toEqual({
    type: "object",
    properties: {
      queries: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 15, description: "One short food name per item." },
      limit: { type: "integer", minimum: 1, maximum: 10, default: 5, description: "Matches per query, default 5." },
    },
    required: ["queries", "limit"],
    additionalProperties: false,
  });
  const item = tools.log_entries.input_schema.properties.entries.items;
  expect(item.required).toEqual(["meal"]);
  expect(item.properties.meal.enum).toEqual(["breakfast", "lunch", "dinner", "snacks"]);
  expect(item.properties.grams.description).toContain("Total weight eaten");
  expect(item.additionalProperties).toBe(false);
});

test("each time Bao is opened is a new thread, kept to its person and day", async () => {
  const claude = new FakeClaude(Array.from({ length: 5 }, (_, i) => say(String(i))));
  const bao = testBao({ anthropic: claude });
  const alice = await bao.as("Alice");
  const first = (await turn(bao, alice, "hi"))[0].thread_id;
  expect((await turn(bao, alice, "and?", { threadId: first }))[0].thread_id).toBe(first);
  expect(claude.requests[1]!.messages).toHaveLength(3);
  const fresh = (await turn(bao, alice, "hello again"))[0].thread_id;
  expect(fresh).not.toBe(first);
  expect(claude.requests[2]!.messages).toHaveLength(1);
  const otherDay = (await turn(bao, alice, "x", { threadId: first, day: "2026-03-04" }))[0].thread_id;
  const otherUser = (await turn(bao, await bao.as("Bob"), "x", { threadId: first }))[0].thread_id;
  expect([first, fresh]).not.toContain(otherDay);
  expect([first, fresh]).not.toContain(otherUser);
});

test("household foods are sent once per thread, and again only when they change", async () => {
  const claude = new FakeClaude([
    say("a"), say("b"),
    use("tu_f", "save_food", { name: "Test Soy Milk", nutrients: { basis: "per_100g", kcal: 58 }, servings: [{ label: "glass", grams: 200, default: true }], aliases: ["test soy milk"] }),
    say("Saved."), say("d"),
  ]);
  const bao = testBao({ anthropic: claude });
  const alice = await bao.as("Alice");
  const context = (i: number) => claude.requests[i]!.messages.at(-1).content.at(-1).text as string;
  const thread = (await turn(bao, alice, "hi"))[0].thread_id;
  expect(context(0)).toContain("Household foods (Ours):\n- (none yet)");
  await turn(bao, alice, "again", { threadId: thread });
  expect(context(1)).not.toContain("Household foods");

  const saved = (await turn(bao, alice, "save this milk", { threadId: thread })).at(-1);
  expect(saved.turn.changes).toEqual([
    { table: "foods", action: "create", row_id: expect.any(Number), name: "Test Soy Milk", serving: "glass", kcal: 116, aliases: ["test soy milk"] },
  ]);
  await turn(bao, alice, "thanks", { threadId: thread });
  expect(context(4)).toContain("Household foods (Ours):\n- #");
  expect(context(4)).toContain("Test Soy Milk [Ours] 58 kcal/100g, P? C? F? · servings: glass=200g (116 kcal)* · aliases: test soy milk");
});

test("a batch keeps its good items and reports the bad ones", async () => {
  const claude = new FakeClaude([
    use("tu_3", "log_entries", { entries: [{ meal: "lunch", food_id: 999999 }, { meal: "lunch", name: "Teh", kcal: 80 }, { meal: "lunch", name: "No numbers" }] }),
    say("Logged the teh."),
    use("tu_4", "log_entries", { entries: [{ meal: "brunch" }] }),
    say("Sorry."),
  ]);
  const bao = testBao({ anthropic: claude });
  const alice = await bao.as("Alice");
  await turn(bao, alice, "lunch");
  const result = claude.requests[1]!.messages.at(-1).content[0];
  expect(result.is_error).toBeUndefined();
  expect(result.content.split("\n")).toEqual([
    `Logged ${DAY} #1 lunch: Teh (estimate) — portion n/a — 80 kcal, P? C? F?`,
    "Not logged — item 1: No food with id 999999",
    "Not logged — item 3: an item without a food_id needs kcal",
    `Day total ${DAY}: 80 kcal, P0 C0 F0`,
  ]);
  await turn(bao, alice, "brunch");
  const invalid = claude.requests[3]!.messages.at(-1).content[0];
  expect(invalid.is_error).toBe(true);
  expect(invalid.content).toContain("meal");
});

test("edits and deletes go through the tools, and the whole turn can be undone", async () => {
  const bao = testBao();
  const toast = bao.foodId("Kaya toast");
  const claude = new FakeClaude([
    use("tu_1", "log_entries", { entries: [{ meal: "snacks", food_id: toast, servings: 2, serving: "slice" }, { meal: "snacks", food_id: bao.foodId("Kopi C") }] }),
    use("tu_2", "update_entries", { updates: [{ entry_id: 1, servings: 3, date: "2026-03-02" }, { entry_id: 77, meal: "lunch" }] }),
    use("tu_3", "delete_entries", { entry_ids: [2, 78] }),
    use("tu_4", "get_entries", { date: "2026-03-02" }),
    use("tu_5", "search_foods", { queries: ["kaya toast", "zzz"] }),
    say("Done."),
  ]);
  const withAgent = testBao({ anthropic: claude });
  const alice = await withAgent.as("Alice");
  const events = await turn(withAgent, alice, "2 slices kaya toast and a kopi");
  const results = claude.requests.slice(1).map((r) => r.messages.at(-1).content[0].content as string);
  expect(results[1]).toContain("Updated 2026-03-02 #1 snacks: Kaya toast — 3 × slice (135 g) — 446 kcal");
  expect(results[1]).toContain("Not updated — #77: No entry with id 77");
  expect(results[2]!.split("\n").slice(0, 2)).toEqual(["Deleted #2 Kopi C", "Not deleted — No entry with id 78"]);
  expect(results[3]).toBe("Entries on 2026-03-02:\n#1 snacks: Kaya toast — 3 × slice (135 g) — 446 kcal, P8 C61 F19\nTotal: 446 kcal, P8 C61 F19");
  expect(results[4]).toContain('"kaya toast":\n  #');
  expect(results[4]).toContain('"zzz":\n  (no matches)');
  expect(events.at(-1).touched).toEqual(["2026-03-02", DAY]);
  expect(withAgent.db.select().from(entries).all().map((e) => [e.date, e.origin])).toEqual([["2026-03-02", "agent"]]);

  const undone = await alice.post(`/api/agent/turns/${events.at(-1).turn.id}/undo`);
  expect(undone.undone).toBe(true);
  expect(withAgent.db.select().from(entries).all()).toEqual([]);
});

test("several photos are numbered, and each item is linked to the one it came from", async () => {
  const bao0 = testBao();
  const claude = new FakeClaude([
    use("tu_4", "log_entries", { entries: [{ meal: "lunch", food_id: bao0.foodId("Laksa"), photo: 2 }, { meal: "lunch", name: "Teh", kcal: 80 }] }),
    say("Logged."),
  ]);
  const bao = testBao({ anthropic: claude });
  const alice = await bao.as("Alice");
  const user = bao.user("Alice");
  const jpeg = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#888" } }).jpeg().toBuffer();
  const ids = [];
  for (let i = 0; i < 2; i++) ids.push((await saveImage(bao.db, bao.app.config.dataDir, { userId: user.id, data: jpeg })).id);
  const events = await turn(bao, alice, "lunch", { fileIds: ids });
  const content = claude.requests[0]!.messages.at(-1).content;
  expect(content.map((b: any) => b.type)).toEqual(["text", "image", "text", "image", "text"]);
  expect(content[2].text).toBe("Photo 2:");
  expect(events.at(-1).turn.file_ids).toEqual(ids);
  expect(bao.db.select().from(entries).all().map((e) => e.photo_id)).toEqual([ids[1], null]);
  expect((await alice.get("/api/days/2026-03-03")).meals.lunch[0].photo_id).toBe(ids[1]);
});

test("a rating never reaches the agent", async () => {
  const claude = new FakeClaude([say("Logged."), say("Sure.")]);
  const bao = testBao({ anthropic: claude });
  const alice = await bao.as("Alice");
  const first = await turn(bao, alice, "kopi c");
  const id = first.at(-1).turn.id;
  const url = `/api/agent/turns/${id}/rating`;
  const note = "zzz-rating-note-zzz";
  expect(await (await alice.req("PUT", url, { rating: -1, note: `  ${note} ` })).json()).toMatchObject({ rating: -1, rating_note: note });
  // thumbs down again without a note keeps the note; thumbs up drops it
  expect((await (await alice.req("PUT", url, { rating: -1 })).json()).rating_note).toBe(note);
  await turn(bao, alice, "and teh", { threadId: first[0].thread_id });
  const sent = JSON.stringify(claude.requests[1]);
  expect(sent).not.toContain(note);
  expect(sent).not.toContain("rating");
  expect((await (await alice.req("PUT", url, { rating: 1 })).json()).rating_note).toBeNull();
  expect((await alice.req("PUT", url, { rating: 2 })).status).toBe(400);
  expect((await (await bao.as("Bob")).req("PUT", url, { rating: 1 })).status).toBe(404);
  expect(bao.db.select().from(warren.turns).where(eq(warren.turns.id, id)).get()!.rating).toBe(1);
});

test("the context names today, yesterday and the log date", () => {
  const { db, user, foodId } = testBao();
  const alice = user("Alice");
  logSvc.addEntry(db, alice, { day: "2026-10-20", meal: "dinner", food_id: foodId("Laksa") });
  logSvc.addEntry(db, alice, { day: "2026-10-20", meal: "breakfast", food_id: foodId("Kopi C") });
  const at = (iso: string) =>
    buildContext(db, alice, { now: new Date(iso), timezone: "Asia/Singapore", logDate: "2026-10-20", includeFoods: false, includeFrequent: true, includeRecent: false });

  const text = at("2026-10-21T01:40:00Z"); // 09:40 in Singapore
  expect(text).toContain("Today: Wed 21 Oct 2026 (2026-10-21), 09:40 Singapore time.");
  expect(text).toContain("Yesterday: Tue 20 Oct 2026 (2026-10-20).");
  expect(text).toContain("showing): Tue 20 Oct 2026 (2026-10-20), yesterday.");
  expect(text).toContain("Entries on 2026-10-21 (today):\n- (nothing logged yet)");
  // meals in the order of the day, whatever order they were logged in
  expect(text).toContain(
    "Entries on 2026-10-20 (yesterday):\n- #2 breakfast: Kopi C — 1 × cup (250 g) — 108 kcal, P3 C18 F3\n- #1 dinner: Laksa — 1 × bowl (604 g) — 417 kcal, P20 C42 F18\n- Total: 524 kcal, P23 C59 F21",
  );
  expect(text).toContain("This user's frequent foods (food_id, usual portion):\n- #");
  expect(text).not.toContain("just after midnight");
  expect(text.startsWith("<context>\n") && text.endsWith("\n</context>")).toBe(true);

  // 00:40 on the 21st: "today" still means the 20th
  expect(at("2026-10-20T16:40:00Z")).toContain('"today" and "tonight" mean Tue 20 Oct 2026 (2026-10-20).');
  expect(foodSvc.oursFingerprint([])).toHaveLength(16);
});

test("a later conversation can look again at the photo an entry was logged from", async () => {
  const bao0 = testBao();
  const laksa = bao0.foodId("Laksa");
  const claude = new FakeClaude([
    use("tu_1", "log_entries", { entries: [{ meal: "lunch", food_id: laksa }] }),
    say("Logged."),
    use("tu_2", "log_entries", { entries: [{ meal: "lunch", name: "Tofu", kcal: 90, note: "Bowl beside the laksa, est. 150 g" }] }),
    say("Added the tofu."),
    use("tu_3", "get_entries", { name: "TOFU", to: "2026-03-04" }),
    use("tu_4", "view_photos", { entry_ids: [1, 2, 3] }),
    say("It was silken tofu."),
  ]);
  const bao = testBao({ anthropic: claude });
  const alice = await bao.as("Alice");
  const jpeg = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#888" } }).jpeg().toBuffer();
  const photo = (await saveImage(bao.db, bao.app.config.dataDir, { userId: bao.user("Alice").id, data: jpeg })).id;
  const first = await turn(bao, alice, "lunch", { fileIds: [photo] });
  // words after the photo, in the same conversation: the entry names no photo but came from it
  await turn(bao, alice, "and the tofu", { threadId: first[0].thread_id });
  logSvc.addEntry(bao.db, bao.user("Alice"), { day: DAY, meal: "snacks", food_id: bao0.foodId("Kopi C") });
  expect(bao.db.select().from(entries).all().map((e) => [e.id, e.photo_id])).toEqual([[1, photo], [2, null], [3, null]]);

  const later = await turn(bao, alice, "the tofu yesterday was silken, see the photo again", { day: "2026-03-04" });
  expect(later[0].thread_id).not.toBe(first[0].thread_id);
  const found = claude.requests[5]!.messages.at(-1).content[0].content as string;
  expect(found.split("\n")[0]).toBe('Entries named like "TOFU" from 2025-12-05 to 2026-03-04, newest first:');
  expect(found).toContain(`${DAY}:\n  #2 lunch: Tofu (estimate) (photo) — portion n/a — 90 kcal, P? C? F? — note: Bowl beside the laksa, est. 150 g`);
  const shown = claude.requests[6]!.messages.at(-1).content[0].content as any[];
  expect(shown.map((b) => b.type)).toEqual(["text", "text", "image"]);
  expect(shown[0].text).toBe("The photo below.\n#3 Kopi C: no photo");
  expect(shown[1].text).toMatch(/^Photo sent \w{3} \d{2} \w{3} 2026 \d{2}:\d{2}, logged as #1 Laksa, #2 Tofu:$/);
  expect(shown[2].source).toEqual({ type: "base64", media_type: "image/jpeg", data: expect.any(String) });
  // stored as a reference, like a message's photos
  const stored = bao.db.select().from(warren.turns).where(eq(warren.turns.id, later.at(-1).turn.id)).get()!;
  expect(JSON.stringify(stored.messages)).toContain(`{"type":"image","source":{"type":"file_ref","file_id":${photo}}}`);

  // someone else's entries stay theirs
  const bobClaude = new FakeClaude([use("tu_5", "view_photos", { entry_ids: [1] }), say("No.")]);
  const withBob = testBao({ anthropic: bobClaude });
  await turn(withBob, await withBob.as("Bob"), "show me");
  expect(bobClaude.requests[1]!.messages.at(-1).content[0]).toMatchObject({ is_error: true, content: "Error: No entry with id 1" });
});

test("get_entries reads a day, a range, or entries by name", async () => {
  const bao0 = testBao();
  const claude = new FakeClaude([
    use("tu_1", "get_entries", { from: "2026-03-01", to: "2026-03-02" }),
    use("tu_2", "get_entries", { name: "kopi", from: "2026-03-01", to: "2026-03-03" }),
    use("tu_3", "get_entries", { to: "2026-03-03" }),
    use("tu_4", "get_entries", { from: "2025-01-01", to: "2026-03-03" }),
    say("Ok."),
  ]);
  const bao = testBao({ anthropic: claude });
  const alice = bao.user("Alice");
  logSvc.addEntry(bao.db, alice, { day: "2026-03-01", meal: "dinner", food_id: bao0.foodId("Laksa") });
  logSvc.addEntry(bao.db, alice, { day: "2026-03-01", meal: "breakfast", food_id: bao0.foodId("Kopi C") });
  logSvc.addEntry(bao.db, alice, { day: "2026-03-02", meal: "breakfast", food_id: bao0.foodId("Kopi C") });
  await turn(bao, await bao.as("Alice"), "what did I have?");
  const result = (i: number) => claude.requests[i]!.messages.at(-1).content[0].content as string;
  expect(result(1)).toBe(
    "Entries from 2026-03-01 to 2026-03-02, newest first:\n2026-03-02:\n  #3 breakfast: Kopi C — 1 × cup (250 g) — 108 kcal, P3 C18 F3\n" +
      "2026-03-01:\n  #2 breakfast: Kopi C — 1 × cup (250 g) — 108 kcal, P3 C18 F3\n  #1 dinner: Laksa — 1 × bowl (604 g) — 417 kcal, P20 C42 F18",
  );
  expect(result(2).split("\n").filter((l) => l.startsWith("  #")).map((l) => l.slice(2, 4))).toEqual(["#3", "#2"]);
  expect(result(3)).toBe("Error: give a date, a from date, or a name");
  expect(result(4)).toBe("Error: a range can cover at most 92 days");
});

test("save_food says when a label's numbers don't add up", () => {
  // a misread soya beancurd label: 13 g sugar out of 1.9 g carbs
  expect(labelProblems({ kcal: 78, protein_g: 15, carb_g: 1.9, fat_g: 1.1, sugar_g: 13, sat_fat_g: 0.2 })).toEqual([
    "sugar (13 g) is more than carbs (1.9 g)",
  ]);
  expect(labelProblems({ kcal: 400, protein_g: 5, carb_g: 20, fat_g: 3, sat_fat_g: 4 })).toEqual([
    "saturated fat (4 g) is more than total fat (3 g)",
    "the macros make about 127 kcal per 100 g, not 400",
  ]);
  expect(labelProblems({ kcal: 58, protein_g: 3.5, carb_g: 4.8, fat_g: 1.9, sugar_g: 4.8 })).toEqual([]);
  expect(labelProblems({ kcal: 58 })).toEqual([]);
});

test("a new conversation is told the last exchanges from earlier ones", async () => {
  const claude = new FakeClaude([say("Which estimates look too high?"), say("Halved them."), say("Ok.")]);
  const bao = testBao({ anthropic: claude });
  const alice = await bao.as("Alice");
  const context = (i: number) => claude.requests[i]!.messages.at(-1).content.at(-1).text as string;
  await turn(bao, alice, "way over on the estimates.");
  expect(context(0)).not.toContain("earlier conversations");

  const next = await turn(bao, alice, "all of them");
  expect(context(1)).toMatch(
    /Your last exchanges with this user, in earlier conversations \(oldest first\):\n- \w{3} \d{2} \w{3} \d{4} \d{2}:\d{2}, app on 2026-03-03\n  User: way over on the estimates.\n  You: Which estimates look too high\?\n/,
  );
  // once per conversation
  await turn(bao, alice, "thanks", { threadId: next[0].thread_id });
  expect(context(2)).not.toContain("earlier conversations");

  // only the last day's
  const user = bao.user("Alice");
  expect(recentExchanges(bao.db, user, new Date(), "Asia/Singapore")).toHaveLength(9);
  bao.db.update(warren.turns).set({ createdAt: new Date(Date.now() - 25 * 3_600_000) }).run();
  expect(recentExchanges(bao.db, user, new Date(), "Asia/Singapore")).toEqual([]);
});
