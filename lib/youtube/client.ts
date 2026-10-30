import { google, type youtube_v3, type youtubeAnalytics_v2 } from "googleapis";
import { loadSettings, saveSettings } from "../settings";
import { toYouTubeError, YouTubeError } from "./errors";

export const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];

export const redirectUri = () => `http://localhost:${process.env.PORT ?? 3000}/api/google/callback`;

export async function getOAuthClient() {
  const { google: g } = await loadSettings();
  if (!g.clientId || !g.clientSecret) {
    throw new YouTubeError("Add your Google OAuth client ID and secret in Settings first.", "notConfigured");
  }
  const client = new google.auth.OAuth2(g.clientId, g.clientSecret, redirectUri());
  if (g.tokens) client.setCredentials(g.tokens);
  // Persist refreshed access tokens so the next request does not refresh again.
  client.on("tokens", async (tokens) => {
    const current = (await loadSettings()).google.tokens ?? {};
    await saveSettings({ google: { ...(await loadSettings()).google, tokens: { ...current, ...tokens } } });
  });
  return client;
}

export async function getAuthUrl(): Promise<string> {
  const client = await getOAuthClient();
  return client.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: SCOPES });
}

/** Exchange the OAuth code, store tokens, and remember which channel was connected. */
export async function handleCallback(code: string): Promise<{ channelTitle: string }> {
  const client = await getOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  const yt = google.youtube({ version: "v3", auth: client });
  const res = await yt.channels.list({ part: ["snippet"], mine: true });
  const ch = res.data.items?.[0];
  const g = (await loadSettings()).google;
  await saveSettings({
    google: { ...g, tokens: tokens as Record<string, unknown>, channelId: ch?.id ?? undefined, channelTitle: ch?.snippet?.title ?? undefined },
  });
  return { channelTitle: ch?.snippet?.title ?? "(no channel on this account)" };
}

export async function disconnectGoogle(): Promise<void> {
  const g = (await loadSettings()).google;
  await saveSettings({ google: { ...g, tokens: undefined, channelId: undefined, channelTitle: undefined } });
}

type Clients = { yt: youtube_v3.Youtube; analytics: youtubeAnalytics_v2.Youtubeanalytics };

/** Run YouTube calls with the user's credentials; refresh once on 401; readable errors. */
export async function withYouTube<T>(fn: (c: Clients) => Promise<T>): Promise<T> {
  const settings = await loadSettings();
  if (!settings.google.tokens) throw new YouTubeError("Connect your YouTube channel in Settings first.", "notConnected");
  const auth = await getOAuthClient();
  const clients = () => ({
    yt: google.youtube({ version: "v3", auth }),
    analytics: google.youtubeAnalytics({ version: "v2", auth }),
  });
  try {
    return await fn(clients());
  } catch (err) {
    const e = toYouTubeError(err);
    if (e.reason !== "authError") throw e;
    try {
      await auth.refreshAccessToken();
      return await fn(clients());
    } catch (retryErr) {
      throw toYouTubeError(retryErr);
    }
  }
}
