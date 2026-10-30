import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/youtube/client";

export async function GET(req: Request) {
  try {
    return NextResponse.redirect(await getAuthUrl());
  } catch (err) {
    const url = new URL("/settings", req.url);
    url.searchParams.set("error", (err as Error).message);
    return NextResponse.redirect(url);
  }
}
