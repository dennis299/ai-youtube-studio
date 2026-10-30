# Google Cloud and YouTube API setup

AI YouTube Studio uses **your own** Google Cloud project, so every user brings their own
quota and keeps their own credentials. It takes about 10 minutes. Everything is free.

## 1. Create a project

1. Go to <https://console.cloud.google.com/> and sign in with the Google account that **owns your YouTube channel**.
2. Click the project picker at the top, then **New project**. Give it a name (e.g. `ai-youtube-studio`) and click **Create**.

## 2. Enable the APIs

In **APIs & Services → Library**, search for each of these and click **Enable**:

- **YouTube Data API v3** (research, uploads, stats)
- **YouTube Analytics API** (average view duration; optional but recommended)

## 3. Configure the OAuth consent screen

**APIs & Services → OAuth consent screen** (in newer consoles it's under **Google Auth Platform**):

1. User type: **External**. Click **Create**.
2. App name: `AI YouTube Studio`. Fill in the support and developer emails with your own address.
3. Scopes: you can skip this. The app requests them when you connect.
4. **Test users:** add the Google account that owns your channel. While the app is in *Testing*,
   only test users can connect.
5. Save.

> Refresh tokens from apps in *Testing* status expire after about 7 days. If the studio says your
> connection expired, click **Reconnect YouTube channel** in Settings. To avoid this, publish the
> consent screen ("In production"). For a personal tool you can use it unverified, and Google
> will show a warning screen that you click through.

## 4. Create the OAuth client

**APIs & Services → Credentials → Create credentials → OAuth client ID**

- Application type: **Web application**
- Authorized redirect URI: `http://localhost:3000/api/google/callback`
  (change the port if you run the studio on a different `PORT`)

Click **Create** and copy the **Client ID** and **Client secret**.

## 5. Connect in the studio

1. Open <http://localhost:3000/settings>.
2. Paste the client ID and secret under **YouTube** and click **Save settings**.
3. Click **Connect YouTube channel**. Sign in, pick the account or brand account that owns the channel, and allow access.
4. You'll land back in Settings with *Connected: <your channel>*.

The studio asks for these scopes:

| Scope | Used for |
|---|---|
| `youtube.readonly` | Niche research (search and video stats), reading your channel |
| `youtube.upload` | Uploading videos and thumbnails (API publishing mode only) |
| `yt-analytics.readonly` | Average view duration on the Stats page |

Tokens are stored in `data/settings.json`, which is gitignored and never leaves your machine.

## 6. (Later) Apply for the API audit

YouTube locks **every video uploaded through the API from an unaudited project to private**,
and you can't make those videos public afterwards. Until you're audited, use the default
**Studio upload kit** mode, which needs no audit.

When the channel is ready:

1. Fill in the [YouTube API Services audit and quota extension form](https://support.google.com/youtube/contact/yt_api_form).
2. Describe the use honestly: *"Personal tool that uploads my own channel's videos on a schedule after I review them."*
3. Once Google approves it, tick **My Google Cloud project passed YouTube's API audit** in
   Settings, and switch each channel to **API upload** on its Channel kit page.

## Quota

The default quota is **10,000 units per day** (it resets at midnight Pacific time):

| Call | Units |
|---|---|
| Search (research) | 100 |
| Video/channel details | 1 per 50 items |
| Upload | about 1,600 |
| Thumbnail | 50 |

One research run with 4 searches costs about 800–900 units and is cached for 7 days. Five uploads
a day fit comfortably. Settings shows how much quota is left today.
