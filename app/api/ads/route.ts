import { NextRequest, NextResponse } from "next/server";
import FirecrawlApp from "@mendable/firecrawl-js";

export async function POST(req: NextRequest) {
  try {
    const { companyName } = await req.json();
    if (!companyName || typeof companyName !== "string") {
      return NextResponse.json({ error: "companyName is required" }, { status: 400 });
    }

    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "FIRECRAWL_API_KEY not configured" }, { status: 500 });
    }

    const client = new FirecrawlApp({ apiKey });

    const libraryUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=FI&q=${encodeURIComponent(companyName)}&search_type=keyword_unordered`;

    const result = await client.scrapeUrl(libraryUrl, {
      formats: ["markdown"],
      waitFor: 4000,
    });

    if (!result.success || !result.markdown) {
      return NextResponse.json({ ads: [], error: "Could not load Meta Ad Library page" }, { status: 200 });
    }

    // Extract ad blocks from the scraped markdown
    const markdown = result.markdown;
    const ads: { page_name?: string; ad_creative_body?: string; ad_creative_link_title?: string }[] = [];

    // Look for sponsored content patterns in the scraped text
    const lines = markdown.split("\n").filter(l => l.trim());
    let currentAd: typeof ads[0] = {};

    for (const line of lines) {
      if (line.toLowerCase().includes("sponsoroitu") || line.toLowerCase().includes("sponsored")) {
        if (currentAd.page_name) ads.push(currentAd);
        currentAd = {};
      } else if (!currentAd.page_name && line.length > 2 && line.length < 80 && !line.startsWith("http")) {
        currentAd.page_name = line.replace(/^#+\s*/, "").trim();
      } else if (currentAd.page_name && !currentAd.ad_creative_body && line.length > 20) {
        currentAd.ad_creative_body = line.trim();
      }
    }
    if (currentAd.page_name) ads.push(currentAd);

    return NextResponse.json({ ads: ads.slice(0, 5) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, ads: [] }, { status: 200 });
  }
}
