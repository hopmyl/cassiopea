/**
 * Edge TTS (Microsoft Read-Aloud) — нейроголоса Microsoft на чистых Web-API.
 *
 * Один модуль для сервера и браузера: WebSocket + crypto.subtle есть и в Node ≥ 22,
 * и в любом современном браузере. Никаких Python-бинарников и npm-зависимостей —
 * значит, озвучка работает на любом хостинге (Vercel/Railway/kiosk) и даже
 * прямо из браузера, если сервер недоступен.
 *
 * Протокол повторяет python-библиотеку edge-tts:
 *   wss://speech.platform.bing.com/... + DRM-токен Sec-MS-GEC (SHA-256, окно 5 минут).
 */

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const SEC_MS_GEC_VERSION = "1-130.0.2849.68";
const WSS_BASE =
  "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";

/** Голос ассистента по умолчанию (выбран заказчиком). */
export const KIOSK_VOICE = "en-US-EmmaMultilingualNeural";

/** DRM-токен Microsoft: SHA256(token + unix-время, округлённое до 5 минут), hex uppercase. */
async function secMsGec(): Promise<string> {
  const ticks = Math.floor(Date.now() / 1000);
  const rounded = ticks - (ticks % 300);
  const data = new TextEncoder().encode(`${TRUSTED_CLIENT_TOKEN}${rounded}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** Дата в формате python edge-tts: "Sat Oct 31 2026 12:00:00 GMT+0000 (Coordinated Universal Time)". */
function wsDateString(d = new Date()): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const p = (n: number) => String(n).padStart(2, "0");
  return `${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${p(d.getUTCDate())} ${d.getUTCFullYear()} ${p(
    d.getUTCHours(),
  )}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} GMT+0000 (Coordinated Universal Time)`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&apos;" : "&quot;",
  );
}

function concatBuffers(chunks: ArrayBuffer[]): ArrayBuffer {
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(new Uint8Array(c), off);
    off += c.byteLength;
  }
  return out.buffer;
}

export interface EdgeTtsOptions {
  /** Темп: "+0%" естественно, "-6%" медленнее/мягче, "+10%" быстрее. */
  rate?: string;
  pitch?: string;
  timeoutMs?: number;
}

/**
 * Синтез речи → MP3 (audio-24khz-48kbitrate-mono-mp3) как ArrayBuffer.
 * Бросает ошибку, если рантайм без WebSocket/crypto.subtle или Microsoft недоступен.
 */
export async function edgeTtsSynthesize(
  text: string,
  voice: string,
  opts: EdgeTtsOptions = {},
): Promise<ArrayBuffer> {
  if (typeof WebSocket === "undefined") {
    throw new Error("WebSocket недоступен в этом рантайме (нужен Node ≥ 22 или браузер)");
  }
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("crypto.subtle недоступен (нужен secure context или Node ≥ 19)");
  }
  const { rate = "+0%", pitch = "+0Hz", timeoutMs = 30_000 } = opts;
  const lang = voice.split("-").slice(0, 2).join("-") || "en-US";
  const gec = await secMsGec();
  const url = `${WSS_BASE}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;

  return new Promise<ArrayBuffer>((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    const chunks: ArrayBuffer[] = [];
    let settled = false;

    const timer = setTimeout(() => {
      finish(new Error("edge-tts: таймаут ответа Microsoft"));
    }, timeoutMs);

    function finish(err: Error | null, buf?: ArrayBuffer) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {}
      if (err) reject(err);
      else resolve(buf as ArrayBuffer);
    }

    ws.onopen = () => {
      const config =
        `X-Timestamp:${wsDateString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: { sentenceBoundaryEnabled: "false", wordBoundaryEnabled: "false" },
                outputFormat: "audio-24khz-48kbitrate-mono-mp3",
              },
            },
          },
        });
      ws.send(config);
      const ssml =
        `X-RequestId:${crypto.randomUUID().replace(/-/g, "")}\r\nContent-Type:application/ssml+xml\r\n` +
        `X-Timestamp:${wsDateString()}Z\r\nPath:ssml\r\n\r\n` +
        `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'>` +
        `<voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='+0%'>${escapeXml(text)}</prosody></voice></speak>`;
      ws.send(ssml);
    };

    ws.onmessage = (ev: MessageEvent) => {
      const d = ev.data;
      if (typeof d === "string") {
        if (d.includes("Path:turn.end")) finish(null, concatBuffers(chunks));
        return;
      }
      const buf = d as ArrayBuffer;
      if (buf && buf.byteLength > 2) {
        const headerLen = new DataView(buf).getUint16(0);
        if (buf.byteLength > 2 + headerLen) chunks.push(buf.slice(2 + headerLen));
      }
    };

    ws.onerror = () => finish(new Error("edge-tts: ошибка соединения"));
    ws.onclose = () => finish(new Error("edge-tts: соединение закрыто до завершения синтеза"));
  });
}

/** Короткие имена голосов (edge_*) → полные названия Microsoft. */
const VOICE_ALIASES: Record<string, string> = {
  edge_EmmaMultilingual: "en-US-EmmaMultilingualNeural",
  edge_Emma: "en-US-EmmaNeural",
  edge_AvaMultilingual: "en-US-AvaMultilingualNeural",
  edge_Aria: "en-US-AriaNeural",
  edge_Jenny: "en-US-JennyNeural",
  edge_Svetlana: "ru-RU-SvetlanaNeural",
  edge_Dmitry: "ru-RU-DmitryNeural",
};

/** Принимает и короткие (edge_EmmaMultilingual), и полные имена голосов. */
export function resolveVoiceName(voice: string): string {
  if (VOICE_ALIASES[voice]) return VOICE_ALIASES[voice];
  if (voice.startsWith("edge_")) {
    const n = voice.slice(5);
    if (/^[a-z]{2}-[A-Z]{2}-/.test(n)) return n.endsWith("Neural") ? n : `${n}Neural`;
    return `en-US-${n}Neural`;
  }
  return voice;
}
