import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promises as fsp, accessSync, constants as fsConstants } from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { edgeTtsSynthesize, resolveVoiceName, KIOSK_VOICE } from "@/lib/edge-tts";

export const runtime = "nodejs";
export const maxDuration = 120;

// Провайдер озвучки: "edge" (нейроголоса Microsoft — русский и английский,
// выбранный заказчиком голос en-US-EmmaMultilingualNeural) или "zai" (legacy z-ai SDK).
const TTS_PROVIDER = process.env.TTS_PROVIDER || "edge";
const TTS_VOICE = resolveVoiceName(process.env.TTS_VOICE || KIOSK_VOICE);
// Темп речи: "+0%" — естественный, можно замедлить ("-6%") для мягкости
const TTS_RATE = process.env.TTS_RATE || "+0%";

function splitChunks(text: string, max = 900): string[] {
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

// Аварийный резерв: python-бинарник edge-tts (если WebSocket-путь недоступен).
// Бинарь может лежать вне PATH процесса dev-сервера — ищем по кандидатам.
const EDGE_CANDIDATES = [
  process.env.EDGE_TTS_BIN,
  "/home/z/.venv/bin/edge-tts",
  "/usr/local/bin/edge-tts",
  "/usr/bin/edge-tts",
].filter(Boolean) as string[];

function edgeBinPath(): string | null {
  for (const c of EDGE_CANDIDATES) {
    try {
      accessSync(c, fsConstants.X_OK);
      return c;
    } catch {}
  }
  return null;
}

async function edgeTtsCli(text: string, voice: string, rate: string): Promise<Buffer> {
  const bin = edgeBinPath();
  if (!bin) throw new Error("edge-tts binary not found");
  const tmp = path.join(os.tmpdir(), `tts_${randomUUID()}.mp3`);
  try {
    await new Promise<void>((resolve, reject) => {
      execFile(
        bin,
        ["--voice", voice, "--rate", rate, "--text", text, "--write-media", tmp],
        { timeout: 60_000 },
        (err) => (err ? reject(err) : resolve()),
      );
    });
    return await fsp.readFile(tmp);
  } finally {
    fsp.unlink(tmp).catch(() => {});
  }
}

// Основной путь — WebSocket-клиент (работает на любом Node-хосте),
// при сбое — python-бинарник как резерв.
async function edgeTts(text: string, voice: string, rate: string): Promise<Buffer> {
  try {
    const ab = await edgeTtsSynthesize(text, voice, { rate });
    return Buffer.from(ab);
  } catch (err) {
    if (edgeBinPath()) return edgeTtsCli(text, voice, rate);
    throw err;
  }
}

async function zaiTts(text: string, voice: string): Promise<Buffer> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();
  const res = await zai.audio.tts.create({
    input: text,
    voice: voice.replace(/^zai_/, ""),
    speed: 1.0,
    response_format: "wav",
    stream: false,
  });
  const ab = await res.arrayBuffer();
  return Buffer.from(new Uint8Array(ab));
}

export async function POST(req: NextRequest) {
  try {
    const { text, voice, rate } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }
    const chunks = splitChunks(text.trim());
    const buffers: Buffer[] = [];
    const useZai = TTS_PROVIDER === "zai" || (typeof voice === "string" && voice.startsWith("zai_"));

    if (useZai) {
      const v = typeof voice === "string" && voice ? voice : "zai_tongtong";
      for (const chunk of chunks) {
        buffers.push(await zaiTts(chunk, v));
      }
      return new NextResponse(new Uint8Array(Buffer.concat(buffers)), {
        status: 200,
        headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
      });
    }

    // Edge neural voices (default)
    const v =
      typeof voice === "string" && voice && !voice.startsWith("zai_")
        ? resolveVoiceName(voice)
        : TTS_VOICE;
    const r = typeof rate === "string" && /^[-+]\d+%$/.test(rate) ? rate : TTS_RATE;
    for (const chunk of chunks) {
      buffers.push(await edgeTts(chunk, v, r));
    }
    return new NextResponse(new Uint8Array(Buffer.concat(buffers)), {
      status: 200,
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "tts error" },
      { status: 502 },
    );
  }
}
