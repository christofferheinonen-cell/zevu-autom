import { NextRequest, NextResponse } from "next/server";
import { FirecrawlClient } from "@mendable/firecrawl-js";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "FIRECRAWL_API_KEY not configured" }, { status: 500 });
    }

    const client = new FirecrawlClient({ apiKey });
    const result = await client.scrape(url, { formats: ["markdown"] });

    return NextResponse.json({
      markdown: result.markdown ?? "",
      metadata: result.metadata ?? {},
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
