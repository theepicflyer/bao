/**
 * What the agent can recall from earlier conversations: the photos entries were logged from, and
 * the person's recent exchanges in other threads. Both read Warren's turns and change log.
 */
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { type Db, localTime, schema as warren, type User } from "warren/server";
import { formatDay } from "../dates.js";
import type { Entry } from "../schema.js";

type Block = Record<string, any>;

/** The ids of the photos sent with a turn, in order. */
export function turnPhotos(messages: unknown[]): number[] {
  const content = (messages[0] as Block | undefined)?.content;
  if (!Array.isArray(content)) return [];
  return content
    .filter((b: Block) => b?.type === "image" && b.source?.type === "file_ref")
    .map((b: Block) => b.source.file_id as number);
}

export interface EntryPhotos {
  fileIds: number[];
  /** When the photos were sent. */
  sentAt: Date | null;
}

/**
 * The photos each entry was logged from. An entry names its photo when it was logged from one; an
 * entry the agent logged without one (from words that followed a photo) gets the latest photos sent
 * in its thread up to the turn that logged it.
 */
export function entryPhotos(db: Db, entries: Entry[]): Map<number, EntryPhotos> {
  const out = new Map<number, EntryPhotos>();
  const named = entries.filter((e) => e.photo_id !== null);
  if (named.length) {
    const sent = new Map(
      db
        .select({ id: warren.files.id, createdAt: warren.files.createdAt })
        .from(warren.files)
        .where(inArray(warren.files.id, named.map((e) => e.photo_id!)))
        .all()
        .map((f) => [f.id, f.createdAt]),
    );
    for (const e of named) out.set(e.id, { fileIds: [e.photo_id!], sentAt: sent.get(e.photo_id!) ?? null });
  }

  const rest = entries.filter((e) => e.photo_id === null && e.origin === "agent");
  if (!rest.length) return out;
  const created = db
    .select({ rowId: warren.changes.rowId, turnId: warren.changes.turnId, threadId: warren.turns.threadId })
    .from(warren.changes)
    .innerJoin(warren.turns, eq(warren.turns.id, warren.changes.turnId))
    .where(
      and(
        eq(warren.changes.table, "entries"),
        eq(warren.changes.action, "create"),
        inArray(warren.changes.rowId, rest.map((e) => e.id)),
      ),
    )
    .all();
  const byTurn = new Map<number, EntryPhotos | null>();
  for (const c of created) {
    if (!byTurn.has(c.turnId)) {
      const earlier = db
        .select({ messages: warren.turns.messages, createdAt: warren.turns.createdAt })
        .from(warren.turns)
        .where(and(eq(warren.turns.threadId, c.threadId), lte(warren.turns.id, c.turnId)))
        .orderBy(desc(warren.turns.id))
        .all();
      const withPhotos = earlier.find((t) => turnPhotos(t.messages).length);
      byTurn.set(c.turnId, withPhotos ? { fileIds: turnPhotos(withPhotos.messages), sentAt: withPhotos.createdAt } : null);
    }
    const photos = byTurn.get(c.turnId);
    if (photos) out.set(c.rowId, photos);
  }
  return out;
}

export function clock(at: Date, timezone: string): string {
  const local = localTime(at, timezone);
  const time = `${String(local.hour).padStart(2, "0")}:${String(local.minute).padStart(2, "0")}`;
  return `${formatDay(local.date).replace(/ \(.*\)$/, "")} ${time}`;
}

const clip = (text: string, max: number) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

export const RECENT_HOURS = 24;
export const RECENT_TURNS = 6;

/**
 * The person's last few exchanges with the agent, in any thread, from the last day: what they
 * said, what the agent replied, and which entries it changed. A new thread gets these so a reply
 * to a question asked in an earlier conversation still makes sense.
 */
export function recentExchanges(db: Db, user: User, now: Date, timezone: string): string[] {
  const since = new Date(now.getTime() - RECENT_HOURS * 3_600_000);
  const rows = db
    .select({ turn: warren.turns, scope: warren.threads.scope })
    .from(warren.turns)
    .innerJoin(warren.threads, eq(warren.threads.id, warren.turns.threadId))
    .where(and(eq(warren.threads.userId, user.id), gte(warren.turns.createdAt, since)))
    .orderBy(desc(warren.turns.id))
    .limit(RECENT_TURNS)
    .all()
    .reverse();
  if (!rows.length) return [];
  const changed = db
    .select()
    .from(warren.changes)
    .where(and(inArray(warren.changes.turnId, rows.map((r) => r.turn.id)), eq(warren.changes.table, "entries")))
    .orderBy(asc(warren.changes.id))
    .all();

  const lines: string[] = [];
  for (const { turn, scope } of rows) {
    const photos = turnPhotos(turn.messages).length;
    const said = [photos ? `(${photos === 1 ? "a photo" : `${photos} photos`})` : "", clip(turn.userText, 300)]
      .filter(Boolean)
      .join(" ");
    const touched = new Map<number, string>();
    for (const c of changed.filter((c) => c.turnId === turn.id)) {
      const name = (c.after?.name ?? c.before?.name ?? "?") as string;
      touched.set(c.rowId, `#${c.rowId} ${name}${c.action === "delete" ? " (deleted)" : ""}`);
    }
    const status = turn.undoneAt ? " (undone)" : turn.status === "ok" ? "" : ` (${turn.status})`;
    lines.push(`- ${clock(turn.createdAt, timezone)}, app on ${scope}${status}`);
    lines.push(`  User: ${said || "(nothing)"}`);
    lines.push(`  You: ${clip(turn.replyText, 500) || "(no reply)"}`);
    if (touched.size) lines.push(`  Changed: ${[...touched.values()].join(", ")}`);
  }
  return lines;
}
