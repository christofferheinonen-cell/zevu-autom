import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Modality } from "@google/genai";
import { put } from "@vercel/blob";

export async function POST(req: NextRequest) {
  try {
    const { visualPrompt } = await req.json();
    if (!visualPrompt || typeof visualPrompt !== "string") {
      return NextResponse.json({ error: "visualPrompt is required" }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
      return NextResponse.json({ imageUrl: null, error: "BLOB_READ_WRITE_TOKEN not configured" });
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-preview-image-generation",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Create a high-quality advertising image for a Facebook/Meta ad. ${visualPrompt}.
Style: modern, clean, professional. 16:9 aspect ratio. No text overlays.`,
            },
          ],
        },
      ],
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find(
      (p): p is typeof p & { inlineData: { data: string; mimeType: string } } =>
        "inlineData" in p && p.inlineData != null
    );

    if (!imagePart) {
      return NextResponse.json({ imageUrl: null, reason: "No image returned by model" });
    }

    const { data: base64, mimeType } = imagePart.inlineData;
    const buffer = Buffer.from(base64, "base64");
    const ext = mimeType.split("/")[1] ?? "png";
    const filename = `zevu-ad-${Date.now()}.${ext}`;

    const blob = await put(filename, buffer, {
      access: "public",
      contentType: mimeType,
      token: blobToken,
    });

    return NextResponse.json({ imageUrl: blob.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    /* Image generation failures are non-fatal — return null imageUrl */
    return NextResponse.json({ imageUrl: null, error: message });
  }
}
