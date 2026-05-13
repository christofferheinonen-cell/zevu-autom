import { NextRequest, NextResponse } from "next/server";

const META_API_BASE = "https://graph.facebook.com/v21.0/ads_archive";

export async function POST(req: NextRequest) {
  try {
    const { companyName, pageId } = await req.json();
    if (!companyName || typeof companyName !== "string") {
      return NextResponse.json({ error: "companyName is required" }, { status: 400 });
    }

    const token = process.env.META_ACCESS_TOKEN;
    if (!token) {
      return NextResponse.json({ ads: [] }, { status: 200 });
    }

    const params = new URLSearchParams({
      search_terms: companyName,
      ad_reached_countries: JSON.stringify(["FI"]),
      ad_active_status: "ALL",
      fields: "ad_creative_body,ad_creative_link_title,ad_snapshot_url,impressions,page_name,page_id",
      limit: "25",
      access_token: token,
    });

    if (pageId) {
      params.set("search_page_ids", JSON.stringify([pageId]));
    }

    const res = await fetch(`${META_API_BASE}?${params.toString()}`);
    const json = await res.json();

    if (json.error) {
      return NextResponse.json({ ads: [], debug: { error: json.error, searchTerm: companyName } }, { status: 200 });
    }

    // Filter to ads where page_name closely matches the search term
    const needle = companyName.toLowerCase();
    const all: { page_name?: string }[] = json.data ?? [];
    const filtered = all.filter(ad =>
      ad.page_name && ad.page_name.toLowerCase().includes(needle)
    );

    // Fall back to all results if no close match found
    const ads = (filtered.length > 0 ? filtered : all).slice(0, 5);
    return NextResponse.json({ ads, debug: { total: all.length, filtered: filtered.length, searchTerm: companyName, pageNames: all.map((a: { page_name?: string }) => a.page_name) } });
  } catch {
    return NextResponse.json({ ads: [] }, { status: 200 });
  }
}
