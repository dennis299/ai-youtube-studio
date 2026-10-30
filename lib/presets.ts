export type NichePreset = {
  id: string;
  label: string;
  niche: string;
  style: string;
  audience: string;
  exampleQueries: string[];
  rpm: string;
  note?: string;
};

// RPM ranges are rough 2026 estimates from public creator surveys (see README sources).
export const PRESETS: NichePreset[] = [
  {
    id: "business-stories",
    label: "Business stories",
    niche: "Business stories: how famous companies were built and how they broke",
    style: "Cinematic documentary narration, archive footage, maps and charts",
    audience: "Curious adults 18–45 who like business, history and entrepreneurship",
    exampleQueries: ["rise and fall of company", "why did nokia fail", "business documentary", "how ikea became huge"],
    rpm: "$6–15",
  },
  {
    id: "history-docs",
    label: "History documentaries",
    niche: "History explained: the surprising stories behind everyday things and big events",
    style: "Documentary narration over archive footage, maps and timelines",
    audience: "Adults who like learning, history and trivia",
    exampleQueries: ["history documentary", "how salt changed history", "history explained"],
    rpm: "~$10 (education median)",
  },
  {
    id: "tech-explainers",
    label: "Tech & AI explainers",
    niche: "How technology actually works: AI, chips, the internet, explained simply",
    style: "Clear explainer narration with motion graphics and diagrams",
    audience: "Tech-curious adults and students",
    exampleQueries: ["how ai works explained", "how chips are made", "tech explained"],
    rpm: "$6–15",
  },
  {
    id: "anime-what-if",
    label: "Anime what-if stories",
    niche: "Anime what-if stories: alternate endings and match-ups (e.g. what if L had the Death Note?)",
    style: "Dramatic storytelling narration with AI-generated anime-style illustrations",
    audience: "Anime fans 13–30",
    exampleQueries: ["anime what if", "what if anime story", "anime alternate ending"],
    rpm: "$2–4",
    note: "Low RPM and copyright-sensitive: use AI-generated visuals only, never screenshots or clips from the anime.",
  },
  {
    id: "true-story-motivation",
    label: "True-story motivation",
    niche: "Short true stories of people who came back from failure, with a lesson",
    style: "Warm storytelling narration, stock footage and AI illustrations",
    audience: "Adults looking for motivation and self-improvement",
    exampleQueries: ["inspiring true story", "comeback story", "motivational story"],
    rpm: "$4–8",
  },
];

export const getPreset = (id: string) => PRESETS.find((p) => p.id === id);
