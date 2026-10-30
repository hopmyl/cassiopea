import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { audioBase64 } = await req.json();
    if (!audioBase64 || typeof audioBase64 !== "string") {
      return NextResponse.json({ error: "audioBase64 required" }, { status: 400 });
    }
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();
    const res = await zai.audio.asr.create({
      file_base64: audioBase64.replace(/^data:[^;]+;base64,/, ""),
    });
    return NextResponse.json({ text: res.text || "" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "asr error" },
      { status: 500 },
    );
  }
}
