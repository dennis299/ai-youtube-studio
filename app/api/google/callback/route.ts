import { NextResponse } from "next/server";
import { handleCallback } from "@/lib/youtube/client";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const back = new URL("/settings", req.url);
  const code = params.get("code");
  if (!code) {
    back.searchParams.set("error", params.get("error") ?? "Google did not return an authorization code.");
    return NextResponse.redirect(back);
  }
  try {
    const { channelTitle } = await handleCallback(code);
    back.searchParams.set("connected", channelTitle);
  } catch (err) {
    back.searchParams.set("error", (err as Error).message);
  }
  return NextResponse.redirect(back);
}
