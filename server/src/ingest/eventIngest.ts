import { Request, Response } from "express";
import { z } from "zod";
import { getDb } from "../db/sqlite.js";
import { aggregateTrackEnd, aggregateTrackStart } from "./aggregate.js";

const EventSchema = z.object({
  ts_ms: z.number().int(),
  session_id: z.string().min(6),
  event_type: z.enum(["start", "end", "action", "pos"]),
  track_id: z.string().optional(),
  prev_track_id: z.string().optional(),
  position_ms: z.number().int().nonnegative().optional(),
  reason: z.enum(["finished", "skip_next", "skip_prev", "pause_stop", "unknown"]).optional(),
  device_id: z.string().optional(),
  payload: z.record(z.unknown()).optional()
});

export type LoggedEvent = z.infer<typeof EventSchema>;

export async function ingestEvent(req: Request, res: Response): Promise<void> {
  const parsed = EventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const ev = parsed.data;
  const db = getDb();

  db.prepare(`
    INSERT INTO events(ts_ms, session_id, event_type, track_id, prev_track_id, position_ms, reason, device_id, payload_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    ev.ts_ms,
    ev.session_id,
    ev.event_type,
    ev.track_id ?? null,
    ev.prev_track_id ?? null,
    ev.position_ms ?? null,
    ev.reason ?? null,
    ev.device_id ?? null,
    ev.payload ? JSON.stringify(ev.payload) : null
  );

  // Aggregation hooks:
  if (ev.event_type === "start" && ev.track_id) {
    aggregateTrackStart({
      track_id: ev.track_id,
      prev_track_id: ev.prev_track_id,
      ts_ms: ev.ts_ms
    });
  }

  if (ev.event_type === "end" && ev.track_id) {
    const listened = ev.payload?.listened_ms;
    const listened_ms = typeof listened === "number" ? listened : 0;

    await aggregateTrackEnd({
      track_id: ev.track_id,
      prev_track_id: ev.prev_track_id,
      listened_ms,
      reason: (ev.reason ?? "unknown"),
      ts_ms: ev.ts_ms
    });
  }

  res.json({ ok: true });
}
