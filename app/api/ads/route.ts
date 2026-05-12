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
      return NextResponse.json({ error: "META_ACCESS_TOKEN not configured" }, { status: 500 });
    }

    const params = new URLSearchParams({
      search_terms: companyName,
      ad_reached_countries: JSON.stringify(["FI"]),
      ad_active_status: "ALL",
      fields: "ad_creative_body,ad_creative_link_title,ad_snapshot_url,impressions,page_name",
      limit: "10",
      access_token: token,
    });

    if (pageId) {
      params.set("search_page_ids", JSON.stringify([pageId]));
    }

    const res = await fetch(`${META_API_BASE}?${params.toString()}`);
    const json = await res.json();

    if (json.error) {
      return NextResponse.json({ error: `Meta API: ${json.error.message ?? JSON.stringify(json.error)}`, ads: [] }, { status: 200 });
    }

    const ads = (json.data ?? []).slice(0, 5);
    return NextResponse.json({ ads, debug: { searchTerm: companyName, total: json.data?.length ?? 0 } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, ads: [] }, { status: 200 });
  }
}
