import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI();

export async function POST(req: NextRequest) {
  try {
    const { companyName, url, analysis, improvedAd } = await req.json();
    if (!companyName || !analysis) {
      return NextResponse.json({ error: "companyName and analysis are required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
    }

    const topWeakness = analysis.topWeaknesses?.[0] ?? "vague messaging that doesn't convert";
    const opportunity = analysis.biggestOpportunity ?? "stronger ad creative";

    const prompt = `Write a cold outreach email from Christoffer at Zevu (a Finnish Meta ads agency) to a prospect.

Prospect company: ${companyName}
Website: ${url}
Key weakness found: ${topWeakness}
Biggest opportunity: ${opportunity}
Improved ad headline we built: "${improvedAd?.headline ?? ""}"

Rules:
- Under 130 words total
- Sharp and direct — no fluff, no "I hope this email finds you well"
- Reference the specific weakness found (make it clear we looked at their actual ads/site)
- Mention we built a free ad concept for them
- Natural Finnish/Nordic directness — no American-style hype
- Sign off as Christoffer from Zevu
- Return ONLY valid JSON: {"subject": "string", "body": "string"}
- No markdown, no code fences`;

    const message = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
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
