export class YouTubeError extends Error {
  constructor(message: string, public reason: string) {
    super(message);
  }
}

const MESSAGES: Record<string, string> = {
  quotaExceeded: "You've used today's daily YouTube API quota. It resets at midnight Pacific time.",
  uploadLimitExceeded: "YouTube says this channel hit its upload limit for now. Try again in 24 hours.",
  forbidden: "YouTube refused this request. Check that the connected Google account owns the channel.",
  insufficientPermissions: "The Google connection is missing a permission. Reconnect your channel in Settings.",
  authError: "Your Google connection expired. Reconnect your channel in Settings.",
  youtubeSignupRequired: "This Google account has no YouTube channel yet. Create one first.",
};

type GoogleLike = { code?: number; status?: number; message?: string; errors?: { reason?: string }[] };

/** Normalise a googleapis error into a YouTubeError with a readable message. */
export function toYouTubeError(err: unknown): YouTubeError {
  if (err instanceof YouTubeError) return err;
  const e = (err ?? {}) as GoogleLike & { response?: { data?: { error?: GoogleLike } } };
  const inner = e.response?.data?.error ?? e;
  const reason = inner.errors?.[0]?.reason ?? (inner.code === 401 || e.status === 401 ? "authError" : "unknown");
  const message = MESSAGES[reason] ?? `YouTube API error: ${inner.message ?? (err as Error)?.message ?? String(err)}`;
  return new YouTubeError(message, reason);
}
