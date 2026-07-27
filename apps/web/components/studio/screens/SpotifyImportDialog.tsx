"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircledIcon,
  CrossCircledIcon,
  ExternalLinkIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { playlistHref } from "@/components/studio/shell/routes";
import { useMockStudio } from "./MockStudioProvider";
import type { MockCollection } from "./mock-data";
import {
  SPOTIFY_IMPORT_OAUTH_KEY,
  SPOTIFY_IMPORT_TOKEN_KEY,
  createSpotifyOAuthRequest,
  exchangeSpotifyCode,
  fetchSpotifyImportSources,
  fetchSpotifyLikedSongsTracks,
  fetchSpotifyPlaylistTracks,
  pickBestSpotifyMatch,
  spotifySearchQuery,
  type SpotifyImportToken,
  type SpotifyOAuthSession,
  type SpotifyPlaylistSummary,
  type SpotifySourceTrack,
  type SpotifyTrackMatch,
} from "@/lib/spotify/import";

type Phase =
  | "intro"
  | "connecting"
  | "loading-playlists"
  | "playlists"
  | "matching"
  | "review"
  | "importing"
  | "success"
  | "error";

type ProgressState = {
  current: number;
  total: number;
};

type ErrorRecovery = "intro" | "playlists" | "selected" | "import";

interface SpotifyImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function readValidToken(): SpotifyImportToken | null {
  const token = readJson<SpotifyImportToken>(SPOTIFY_IMPORT_TOKEN_KEY);
  if (!token?.accessToken || token.expiresAt <= Date.now()) {
    window.sessionStorage.removeItem(SPOTIFY_IMPORT_TOKEN_KEY);
    return null;
  }
  return token;
}

function cleanCallbackUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  url.searchParams.delete("error");
  url.searchParams.delete("spotifyImport");
  window.history.replaceState({}, "", `${url.pathname}${url.hash}`);
}

function ProgressFeedback({
  progress,
  status,
}: {
  progress: ProgressState;
  status: string;
}) {
  const percent =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;
  return (
    <div className="space-y-3 py-5" aria-live="polite">
      <div className="flex items-center gap-3">
        <ReloadIcon className="h-5 w-5 shrink-0 animate-spin text-primary" />
        <p className="text-sm">{status}</p>
      </div>
      {progress.total > 0 ? (
        <>
          <div
            role="progressbar"
            aria-label="Spotify playlist import progress"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.current}
            aria-valuetext={`${progress.current} of ${progress.total}`}
            className="h-2 overflow-hidden rounded-full bg-secondary"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {progress.current} of {progress.total} tracks · {percent}%
          </p>
        </>
      ) : null}
    </div>
  );
}

function SpotifyAttributionLink({
  href,
  label = "Open in Spotify",
}: {
  href: string;
  label?: string;
}) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs text-[#1DB954] hover:underline"
    >
      {label}
      <ExternalLinkIcon className="h-3 w-3" />
    </a>
  );
}

export default function SpotifyImportDialog({
  open,
  onOpenChange,
}: SpotifyImportDialogProps) {
  const router = useRouter();
  const { searchTracks, createCollectionAsync } = useMockStudio();
  const [phase, setPhase] = useState<Phase>("intro");
  const [status, setStatus] = useState("Connect Spotify to choose a playlist.");
  const [error, setError] = useState("");
  const [token, setToken] = useState<SpotifyImportToken | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylistSummary[]>([]);
  const [selected, setSelected] = useState<SpotifyPlaylistSummary | null>(null);
  const [matches, setMatches] = useState<SpotifyTrackMatch[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [progress, setProgress] = useState<ProgressState>({
    current: 0,
    total: 0,
  });
  const [retrying, setRetrying] = useState<string | null>(null);
  const [created, setCreated] = useState<MockCollection | null>(null);
  const [errorRecovery, setErrorRecovery] = useState<ErrorRecovery>("intro");
  const callbackHandled = useRef(false);
  const runId = useRef(0);

  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? "";

  const showError = useCallback(
    (message: string, recovery: ErrorRecovery = "intro") => {
      setError(message);
      setErrorRecovery(recovery);
      setStatus(message);
      setPhase("error");
    },
    []
  );

  const loadPlaylists = useCallback(
    async (activeToken: SpotifyImportToken) => {
      const thisRun = ++runId.current;
      setPhase("loading-playlists");
      setError("");
      setStatus("Loading your Spotify playlists…");
      setProgress({ current: 0, total: 0 });
      try {
        const next = await fetchSpotifyImportSources(activeToken.accessToken);
        if (runId.current !== thisRun) return;
        setPlaylists(next);
        setPhase("playlists");
        setStatus(
          next.length
            ? `Loaded ${next.length} Spotify playlist${next.length === 1 ? "" : "s"}.`
            : "Spotify returned no playlists for this account."
        );
      } catch (reason) {
        if (runId.current !== thisRun) return;
        showError(
          reason instanceof Error
            ? reason.message
            : "Could not load Spotify playlists.",
          "playlists"
        );
      }
    },
    [showError]
  );

  // OAuth callback and "open from rail" handling live only on /library, so
  // desktop never mounts two code exchangers for the same one-use auth code.
  useEffect(() => {
    if (callbackHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const returnedState = params.get("state");
    const oauthError = params.get("error");
    const requested = params.get("spotifyImport") === "1";
    if (!code && !oauthError && !requested) return;

    callbackHandled.current = true;
    onOpenChange(true);

    if (oauthError) {
      cleanCallbackUrl();
      // URL search params are the external OAuth response this effect hydrates.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      showError(
        oauthError === "access_denied"
          ? "Spotify connection was canceled. Nothing was imported."
          : `Spotify connection failed: ${oauthError}`
      );
      return;
    }

    if (!code) return;
    const oauth = readJson<SpotifyOAuthSession>(SPOTIFY_IMPORT_OAUTH_KEY);
    if (!clientId || !oauth || !returnedState) {
      cleanCallbackUrl();
      showError("Spotify connection expired. Start the connection again.");
      return;
    }
    if (oauth.state !== returnedState) {
      cleanCallbackUrl();
      window.sessionStorage.removeItem(SPOTIFY_IMPORT_OAUTH_KEY);
      showError("Spotify connection could not be verified. Please reconnect.");
      return;
    }

    setPhase("connecting");
    setStatus("Finishing your secure Spotify connection…");
    void exchangeSpotifyCode({ clientId, code, session: oauth }).then(
      (nextToken) => {
        window.sessionStorage.setItem(
          SPOTIFY_IMPORT_TOKEN_KEY,
          JSON.stringify(nextToken)
        );
        window.sessionStorage.removeItem(SPOTIFY_IMPORT_OAUTH_KEY);
        cleanCallbackUrl();
        setToken(nextToken);
        void loadPlaylists(nextToken);
      },
      (reason) => {
        cleanCallbackUrl();
        window.sessionStorage.removeItem(SPOTIFY_IMPORT_OAUTH_KEY);
        showError(
          reason instanceof Error
            ? reason.message
            : "Spotify could not finish connecting."
        );
      }
    );
  }, [clientId, loadPlaylists, onOpenChange, showError]);

  // Reuse an unexpired one-time import token within this browser tab. Tokens
  // never go to Firestore and disappear when the tab/session closes.
  useEffect(() => {
    if (!open || callbackHandled.current || phase !== "intro") return;
    const saved = readValidToken();
    if (!saved) return;
    // sessionStorage is the external tab-scoped token source this effect hydrates.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(saved);
    void loadPlaylists(saved);
  }, [loadPlaylists, open, phase]);

  const connect = async () => {
    if (!clientId) {
      showError(
        "Spotify import is not configured yet. The site administrator must add a Spotify Client ID."
      );
      return;
    }
    setError("");
    setPhase("connecting");
    setStatus("Preparing a secure Spotify connection…");
    try {
      const configuredRedirect =
        process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI?.trim();
      const redirectUri =
        configuredRedirect || `${window.location.origin}/library`;
      const request = await createSpotifyOAuthRequest({
        clientId,
        redirectUri,
      });
      window.sessionStorage.setItem(
        SPOTIFY_IMPORT_OAUTH_KEY,
        JSON.stringify(request.session)
      );
      setStatus("Redirecting to Spotify for permission…");
      window.location.assign(request.url);
    } catch (reason) {
      showError(
        reason instanceof Error
          ? reason.message
          : "Could not start Spotify connection."
      );
    }
  };

  const selectPlaylist = async (playlist: SpotifyPlaylistSummary) => {
    if (!token) {
      showError("Your Spotify connection expired. Reconnect it.");
      return;
    }
    const thisRun = ++runId.current;
    setSelected(playlist);
    setMatches([]);
    setSkipped(0);
    setError("");
    setPhase("matching");
    setStatus(`Reading “${playlist.name}” from Spotify…`);
    setProgress({ current: 0, total: playlist.itemCount });

    try {
      const source =
        playlist.source === "liked-songs"
          ? await fetchSpotifyLikedSongsTracks(token.accessToken)
          : await fetchSpotifyPlaylistTracks(playlist.id, token.accessToken);
      if (runId.current !== thisRun) return;
      setSkipped(source.skipped);
      setProgress({ current: 0, total: source.tracks.length });
      if (source.tracks.length === 0) {
        setMatches([]);
        setPhase("review");
        setStatus(
          source.skipped
            ? `No transferable music tracks found; ${source.skipped} unavailable, local, or non-music items were skipped.`
            : "This Spotify playlist is empty."
        );
        return;
      }

      const results = new Array<SpotifyTrackMatch | undefined>(
        source.tracks.length
      );
      let cursor = 0;
      let completed = 0;
      const worker = async () => {
        while (cursor < source.tracks.length) {
          const index = cursor++;
          const spotifyTrack = source.tracks[index];
          if (!spotifyTrack || runId.current !== thisRun) return;
          setStatus(`Finding a playable match for “${spotifyTrack.title}”…`);
          const candidates = await searchTracks(
            spotifySearchQuery(spotifyTrack)
          );
          if (runId.current !== thisRun) return;
          const best = pickBestSpotifyMatch(spotifyTrack, candidates);
          results[index] = {
            source: spotifyTrack,
            track: best.track,
            score: best.score,
            included: Boolean(best.track),
          };
          completed += 1;
          setMatches(
            results.filter(
              (result): result is SpotifyTrackMatch => result !== undefined
            )
          );
          setProgress({ current: completed, total: source.tracks.length });
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(3, source.tracks.length) }, () =>
          worker()
        )
      );
      if (runId.current !== thisRun) return;

      const complete = results.filter(
        (result): result is SpotifyTrackMatch => result !== undefined
      );
      const matched = complete.filter((result) => result.track).length;
      setMatches(complete);
      setPhase("review");
      setStatus(
        `Matched ${matched} of ${source.tracks.length} tracks.` +
          (source.skipped
            ? ` Skipped ${source.skipped} unsupported items.`
            : "")
      );
    } catch (reason) {
      if (runId.current !== thisRun) return;
      showError(
        reason instanceof Error
          ? reason.message
          : "Could not read and match this Spotify playlist.",
        "selected"
      );
    }
  };

  const retryMatch = async (source: SpotifySourceTrack) => {
    const key = `${source.position}:${source.id}`;
    setRetrying(key);
    setStatus(`Retrying “${source.title}”…`);
    try {
      const candidates = await searchTracks(spotifySearchQuery(source));
      const best = pickBestSpotifyMatch(source, candidates, 0.4);
      setMatches((current) =>
        current.map((result) =>
          result.source.position === source.position
            ? {
                ...result,
                track: best.track,
                score: best.score,
                included: Boolean(best.track),
              }
            : result
        )
      );
      setStatus(
        best.track
          ? `Found “${best.track.title}” for “${source.title}”.`
          : `Still could not confidently match “${source.title}”.`
      );
    } catch (reason) {
      setStatus(
        reason instanceof Error
          ? reason.message
          : `Could not retry “${source.title}”.`
      );
    } finally {
      setRetrying(null);
    }
  };

  const toggleIncluded = (source: SpotifySourceTrack) => {
    const willInclude = !matches.find(
      (result) => result.source.position === source.position
    )?.included;
    setMatches((current) =>
      current.map((result) =>
        result.source.position === source.position
          ? { ...result, included: !result.included }
          : result
      )
    );
    setStatus(
      `${willInclude ? "Added" : "Removed"} “${source.title}” ${
        willInclude ? "to" : "from"
      } this import.`
    );
  };

  const importPlaylist = async () => {
    if (!selected) return;
    const included = matches.filter(
      (result) => result.track && result.included
    );
    if (included.length === 0) {
      setStatus("Choose at least one matched track before importing.");
      return;
    }
    setPhase("importing");
    setError("");
    setStatus(
      `Creating “${selected.name}” and saving ${included.length} tracks…`
    );
    setProgress({ current: 0, total: included.length });
    try {
      const collection = await createCollectionAsync({
        title: selected.name,
        desc: selected.description || "Imported from Spotify.",
        tags: ["spotify-import"],
        kind: "music",
        cover: included.length ? "mosaic" : "texture",
        trackIds: included.flatMap((result) =>
          result.track ? [result.track.id] : []
        ),
      });
      setProgress({ current: included.length, total: included.length });
      setCreated(collection);
      setPhase("success");
      setStatus(
        `Imported “${selected.name}” with ${included.length} tracks successfully.`
      );
      toast.success(`Imported “${selected.name}”`);
    } catch (reason) {
      const message =
        reason instanceof Error
          ? `Could not save the playlist: ${reason.message}`
          : "Could not save the imported playlist.";
      toast.error("Spotify playlist import failed");
      showError(message, "import");
    }
  };

  const retryAfterError = () => {
    if (errorRecovery === "import") {
      void importPlaylist();
      return;
    }
    if (errorRecovery === "selected" && selected) {
      void selectPlaylist(selected);
      return;
    }
    if (errorRecovery === "playlists" && token) {
      void loadPlaylists(token);
      return;
    }
    setPhase("intro");
    setError("");
    setStatus("Connect Spotify to choose a playlist.");
  };

  const disconnect = () => {
    ++runId.current;
    window.sessionStorage.removeItem(SPOTIFY_IMPORT_TOKEN_KEY);
    window.sessionStorage.removeItem(SPOTIFY_IMPORT_OAUTH_KEY);
    setToken(null);
    setPlaylists([]);
    setSelected(null);
    setMatches([]);
    setCreated(null);
    setError("");
    setPhase("intro");
    setStatus("Spotify disconnected. Nothing was deleted from either service.");
  };

  const chooseAnother = () => {
    setSelected(null);
    setMatches([]);
    setSkipped(0);
    setPhase("playlists");
    setStatus("Choose another Spotify playlist.");
  };

  const requestOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && phase === "importing") {
      setStatus("Finishing the playlist save—this dialog will stay open.");
      return;
    }
    if (!nextOpen && phase === "matching") {
      ++runId.current;
      setPhase(token ? "playlists" : "intro");
      setStatus("Matching canceled. Nothing was imported.");
    }
    onOpenChange(nextOpen);
  };

  const includedCount = matches.filter(
    (result) => result.track && result.included
  ).length;
  const unmatchedCount = matches.filter((result) => !result.track).length;

  return (
    <Dialog open={open} onOpenChange={requestOpenChange}>
      <DialogContent className="grid max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-2xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Import Spotify playlist</DialogTitle>
          <DialogDescription>
            Spotify metadata is matched to playable music in Yukirhythm. No
            Spotify audio is copied.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto pr-1">
          <p
            role="status"
            aria-live="polite"
            className={cn(
              "mb-4 rounded-md border px-3 py-2 text-sm",
              phase === "error"
                ? "border-destructive/50 text-destructive"
                : "border-border text-muted-foreground"
            )}
          >
            {status}
          </p>

          {phase === "intro" ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="font-ui font-semibold">Connect Spotify</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  You’ll approve read-only access to Liked Songs, private
                  playlists, and collaborative playlists. Yukirhythm never
                  receives your Spotify password.
                </p>
              </div>
              <Button className="w-full" onClick={() => void connect()}>
                Connect Spotify
              </Button>
            </div>
          ) : null}

          {phase === "connecting" ? (
            <ProgressFeedback progress={progress} status={status} />
          ) : null}

          {phase === "loading-playlists" ? (
            <ProgressFeedback progress={progress} status={status} />
          ) : null}

          {phase === "playlists" ? (
            <div className="flex min-h-0 flex-col gap-3">
              <div
                role="list"
                aria-label="Spotify playlists"
                className="max-h-[min(50dvh,28rem)] min-h-0 space-y-3 overflow-y-auto overscroll-contain pr-1"
              >
                {playlists.length ? (
                  playlists.map((playlist) => (
                    <div
                      role="listitem"
                      key={`${playlist.source}:${playlist.id}`}
                      className={cn(
                        "rounded-lg border bg-card p-3",
                        playlist.source === "liked-songs"
                          ? "border-[#1DB954]/60"
                          : "border-border"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => void selectPlaylist(playlist)}
                        className="w-full max-w-full text-left"
                      >
                        <span className="block font-ui font-medium break-words">
                          {playlist.name}
                        </span>
                        <span className="block text-xs text-muted-foreground break-words">
                          {playlist.itemCount} items · Select to match tracks
                        </span>
                      </button>
                      <SpotifyAttributionLink href={playlist.externalUrl} />
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No playlists were returned for this Spotify account.
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => token && void loadPlaylists(token)}
                  disabled={!token}
                >
                  <ReloadIcon className="mr-2 h-4 w-4" />
                  Reload playlists
                </Button>
                <Button variant="ghost" onClick={disconnect}>
                  Disconnect Spotify
                </Button>
              </div>
            </div>
          ) : null}

          {phase === "matching" ? (
            <div className="space-y-4">
              <ProgressFeedback progress={progress} status={status} />
              {matches.length ? (
                <p className="text-xs text-muted-foreground">
                  {matches.filter((result) => result.track).length} matches
                  found so far ·{" "}
                  {matches.filter((result) => !result.track).length} still
                  unmatched
                </p>
              ) : null}
              <Button
                variant="outline"
                onClick={() => requestOpenChange(false)}
              >
                Cancel matching
              </Button>
            </div>
          ) : null}

          {phase === "review" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-secondary p-2">
                  <span className="block text-lg font-semibold">
                    {includedCount}
                  </span>
                  <span className="text-xs text-muted-foreground">Ready</span>
                </div>
                <div className="rounded-md bg-secondary p-2">
                  <span className="block text-lg font-semibold">
                    {unmatchedCount}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Unmatched
                  </span>
                </div>
                <div className="rounded-md bg-secondary p-2">
                  <span className="block text-lg font-semibold">{skipped}</span>
                  <span className="text-xs text-muted-foreground">Skipped</span>
                </div>
              </div>

              <div className="space-y-2">
                {matches.map((result) => {
                  const retryKey = `${result.source.position}:${result.source.id}`;
                  return (
                    <div
                      key={retryKey}
                      className="rounded-lg border border-border bg-card p-3"
                    >
                      <div className="flex items-start gap-3">
                        {result.track ? (
                          <CheckCircledIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                        ) : (
                          <CrossCircledIcon className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium break-words">
                            {result.source.title}
                          </p>
                          <p className="text-xs text-muted-foreground break-words">
                            {result.source.artists.join(", ")}
                          </p>
                          <SpotifyAttributionLink
                            href={result.source.externalUrl}
                            label="Source on Spotify"
                          />
                          {result.track ? (
                            <p className="mt-1 text-xs">
                              Match: {result.track.title} ·{" "}
                              {result.track.artist}
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-destructive">
                              No confident playable match found.
                            </p>
                          )}
                        </div>
                        {result.track ? (
                          <Button
                            size="sm"
                            variant={result.included ? "outline" : "ghost"}
                            onClick={() => toggleIncluded(result.source)}
                          >
                            {result.included ? "Remove" : "Add back"}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void retryMatch(result.source)}
                            disabled={retrying === retryKey}
                            aria-busy={retrying === retryKey}
                          >
                            {retrying === retryKey ? (
                              <ReloadIcon className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            Retry
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="sticky bottom-0 space-y-2 border-t border-border bg-background pt-3">
                <Button
                  className="w-full"
                  onClick={() => void importPlaylist()}
                  disabled={includedCount === 0}
                >
                  Import {includedCount} matched track
                  {includedCount === 1 ? "" : "s"}
                </Button>
                <Button
                  className="w-full"
                  variant="ghost"
                  onClick={chooseAnother}
                >
                  Choose another playlist
                </Button>
              </div>
            </div>
          ) : null}

          {phase === "importing" ? (
            <ProgressFeedback progress={progress} status={status} />
          ) : null}

          {phase === "success" && created ? (
            <div className="space-y-4 text-center">
              <CheckCircledIcon className="mx-auto h-12 w-12 text-primary" />
              <div>
                <h3 className="font-ui text-lg font-semibold">
                  Import complete
                </h3>
                <p className="text-sm text-muted-foreground">
                  “{created.title}” now has {created.trackIds.length} tracks.
                </p>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  onOpenChange(false);
                  router.push(playlistHref(created.id));
                }}
              >
                Open playlist
              </Button>
              <Button
                className="w-full"
                variant="outline"
                onClick={chooseAnother}
              >
                Import another
              </Button>
            </div>
          ) : null}

          {phase === "error" ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive">{error}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button className="flex-1" onClick={retryAfterError}>
                  {errorRecovery === "import"
                    ? "Retry save"
                    : errorRecovery === "selected"
                      ? "Retry playlist"
                      : errorRecovery === "playlists"
                        ? "Retry"
                        : "Start again"}
                </Button>
                {errorRecovery === "import" ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPhase("review");
                      setError("");
                      setStatus("Review the matched tracks and try again.");
                    }}
                  >
                    Back to review
                  </Button>
                ) : token ? (
                  <Button variant="outline" onClick={disconnect}>
                    Reconnect Spotify
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
