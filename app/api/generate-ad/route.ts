import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  try {
    const { companyName, analysis } = await req.json();
    if (!analysis) {
      return NextResponse.json({ error: "analysis is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
    }

    const client = new OpenAI({ apiKey });

    const prompt = `You are a senior Meta ads creative director at Zevu, a Finnish ads agency.

Based on the following analysis of a prospect's Meta ad strategy, create one high-converting Meta ad concept.

Company: ${companyName}
Target audience: ${analysis.targetAudience}
Key benefits: ${analysis.keyBenefits?.join(", ")}
Brand tone: ${analysis.brandTone}
Top weaknesses: ${analysis.topWeaknesses?.join(", ")}
Biggest opportunity: ${analysis.biggestOpportunity}

Create a complete Meta ad that directly addresses their weaknesses and capitalises on the opportunity.

Return ONLY valid JSON in this exact format — no markdown, no code fences:
{
  "headline": "Pääotsikko — max 8 sanaa, iskevä ja konvertoiva",
  "subheadline": "Alaotsikko — max 15 sanaa, tukee pääotsikkoa",
  "primaryText": "Mainosteksti — 3-5 lausetta, puhuttelee kohderyhmää suoraan, sisältää kipupisteet ja hyödyt",
  "cta": "CTA-painike — max 4 sanaa",
  "geminiPrompt": "Detailed English prompt for Gemini image generation. Describe: the scene, people (if any), mood, colors, style, composition, lighting. Be very specific. The image must look like a real Meta ad creative. Do NOT include any text overlays in the image."
}

Write headline, subheadline, primaryText and cta in Finnish. Write geminiPrompt in English.`;

    const message = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.choices[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Model returned non-JSON response" }, { status: 502 });
    }

    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
