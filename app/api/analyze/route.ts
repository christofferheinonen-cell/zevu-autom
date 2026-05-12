import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const SYSTEM = `You are an expert digital advertising strategist specializing in Meta (Facebook/Instagram) ads.
Analyze the provided website content and ad data, then return ONLY valid JSON — no markdown, no code fences.`;

const SCHEMA = `{
  "targetAudience": "string — 1-2 sentences describing the likely target audience",
  "keyBenefits": ["string", "..."],
  "brandTone": "string — brief characterization of brand voice",
  "topWeaknesses": ["string — specific, actionable weakness", "..."],
  "biggestOpportunity": "string — the single highest-impact improvement opportunity",
  "improvedAdBrief": {
    "headline": "string — punchy, max 8 words",
    "subheadline": "string — supporting line, max 15 words",
    "bodyText": "string — 1-2 sentences of ad copy",
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
      ? `\n\nCurrent Meta ads found (${ads.length}):\n${JSON.stringify(ads, null, 2)}`
      : "\n\nNo Meta ads found for this company — analyse based on website only.";

    const prompt = `Analyse this company's digital advertising presence.

Website content:
${scrapedContent.slice(0, 8000)}
${adsSection}

Return analysis as JSON matching this exact schema:
${SCHEMA}

Return ONLY the JSON object, nothing else.`;

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1024,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";

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
