import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Мягкий женский голос (выбран по анализу тембра среди моделей SDK)
const TTS_VOICE = process.env.TTS_VOICE || "xiaochen";
const TTS_SPEED = Number(process.env.TTS_SPEED || "1.0");

function splitChunks(text: string, max = 950): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  const chunks: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + s).length <= max) cur += s;
    else {
      if (cur) chunks.push(cur.trim());
      cur = s;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

export async function POST(req: NextRequest) {
  try {
    const { text, voice, speed } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();
    const chunks = splitChunks(text.trim());
    const buffers: Buffer[] = [];
    for (const chunk of chunks) {
      const res = await zai.audio.tts.create({
        input: chunk,
        voice: typeof voice === "string" && voice ? voice : TTS_VOICE,
        speed: typeof speed === "number" && speed >= 0.5 && speed <= 2 ? speed : TTS_SPEED,
        response_format: "wav",
        stream: false,
      });
      const ab = await res.arrayBuffer();
      buffers.push(Buffer.from(new Uint8Array(ab)));
    }
    const out = Buffer.concat(buffers);
    return new NextResponse(new Uint8Array(out), {
      status: 200,
      headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "tts error" },
      { status: 500 },
    );
  }
}
