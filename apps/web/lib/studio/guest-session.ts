/** A device identity is retained on logout so returning guests recover their library. */
const ID_KEY = "yukirhythm:guest-id:v1";
const ACTIVE_KEY = "yukirhythm:guest-active:v1";
export const GUEST_SESSION_EVENT = "yukirhythm:guest-session";

export function activeGuestId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const id = localStorage.getItem(ID_KEY);
    return localStorage.getItem(ACTIVE_KEY) === "true" &&
      id?.startsWith("guest-")
      ? id
      : null;
  } catch {
    return null;
  }
}

export function startGuestSession(): void {
  // Verify writable storage before promising persistent guest access.
  if (!localStorage.getItem(ID_KEY))
    localStorage.setItem(ID_KEY, `guest-${crypto.randomUUID()}`);
  localStorage.setItem(ACTIVE_KEY, "true");
  window.dispatchEvent(new Event(GUEST_SESSION_EVENT));
}

export function endGuestSession(): void {
  localStorage.removeItem(ACTIVE_KEY);
  window.dispatchEvent(new Event(GUEST_SESSION_EVENT));
}
