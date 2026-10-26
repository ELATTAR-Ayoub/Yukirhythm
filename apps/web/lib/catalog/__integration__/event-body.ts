import { randomUUID } from "node:crypto";

/** Supply the browser's required retry ID for older fixtures. */
export function withEventIds(body: unknown): unknown {
  if (!body || typeof body !== "object" || !("events" in body)) return body;
  const events = (body as { events: unknown }).events;
  if (!Array.isArray(events)) return body;
  return {
    ...body,
    events: events.map((event) =>
      event && typeof event === "object"
        ? { eventId: randomUUID(), ...event }
        : event
    ),
  };
}
