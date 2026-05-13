import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const SYSTEM = `You are an expert Meta (Facebook/Instagram) ads strategist working for Zevu, a Finnish ads agency.
Your job is to identify weaknesses in a prospect's Meta ad strategy so Zevu can pitch them better ads.
Return ONLY valid JSON — no markdown, no code fences.`;

const SCHEMA = `{
  "targetAudience": "string — 1-2 sentences describing who they should be targeting",
  "keyBenefits": ["string — benefits they have but aren't communicating well in ads", "..."],
  "brandTone": "string — how their current brand/ads come across",
  "topWeaknesses": ["string — specific weakness in their Meta ad strategy or absence of ads", "..."],
  "biggestOpportunity": "string — the single highest-impact Meta ads opportunity for this company",
  "improvedAdBrief": {
    "headline": "string — punchy Meta ad headline, max 8 words",
    "subheadline": "string — supporting line, max 15 words",
    "bodyText": "string — 1-2 sentences of Meta ad copy",
    "cta": "string — call-to-action button text, max 4 words",
    "visualPrompt": "string — detailed prompt for AI image generation"
  }
}`;

export async function POST(req: NextRequest) {
  try {
    const { scrapedContent, ads } = await req.json();
    if (!scrapedContent || typeof scrapedContent !== "string") {
      return NextResponse.json({ error: "scrapedContent is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
    }

    const client = new OpenAI({ apiKey });

    const adsSection = ads && ads.length > 0
      ? `\n\nACTIVE META ADS FOUND (${ads.length}):\n${JSON.stringify(ads, null, 2)}`
      : "\n\nNO META ADS FOUND — this company has no visible Meta ads running. This is itself a major weakness and opportunity.";

    const prompt = `Analyse this company's Meta advertising strategy. Your goal is to identify weaknesses in their paid social approach so we can pitch them better ads.

Focus on:
- Are they running Meta ads? If not, why is that a missed opportunity?
- If they are running ads: what's weak about the creative, targeting, messaging, or offer?
- What would a high-converting Meta ad look like for this company?

Website (for context on their product/brand):
${scrapedContent.slice(0, 6000)}
${adsSection}

Return analysis as JSON matching this exact schema:
${SCHEMA}

Return ONLY the JSON object, nothing else.`;

    const message = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1024,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
    });

    const text = message.choices[0]?.message?.content ?? "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Model returned non-JSON response" }, { status: 502 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
