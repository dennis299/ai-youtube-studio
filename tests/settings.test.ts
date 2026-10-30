import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useTempDirs } from "./helpers";
import { loadSettings, saveSettings } from "@/lib/settings";

let dirs: ReturnType<typeof useTempDirs>;
beforeEach(() => { dirs = useTempDirs(); });
afterEach(() => dirs.cleanup());

describe("settings", () => {
  it("returns defaults when no settings file exists", async () => {
    const s = await loadSettings();
    expect(s.aiMode).toBe("agent");
    expect(s.ffmpegPath).toBe("ffmpeg");
    expect(s.agentCommand).toBe('claude -p "Process all pending jobs in jobs/pending following AGENTS.md"');
    expect(s.google.audited).toBe(false);
    expect(s.quota.used).toBe(0);
  });

  it("merges a patch without dropping other fields", async () => {
    await saveSettings({ openMontagePath: "C:/tools/OpenMontage" });
    const s = await saveSettings({ aiMode: "openai" });
    expect(s.aiMode).toBe("openai");
    expect(s.openMontagePath).toBe("C:/tools/OpenMontage");
    expect((await loadSettings()).aiMode).toBe("openai");
  });
});
