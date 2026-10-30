import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const TEXT = 'Добро пожаловать в ювелирный дом Кассиопея. Это кольцо украшено танзанитом.';

async function test(voice) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const zai = await ZAI.create();
      const res = await zai.audio.tts.create({
        input: TEXT,
        voice,
        speed: 1.0,
        response_format: 'wav',
        stream: false,
      });
      const ab = await res.arrayBuffer();
      const buf = Buffer.from(new Uint8Array(ab));
      fs.writeFileSync(`/tmp/voice_test/${voice}.wav`, buf);
      console.log(`${voice}: ${buf.length} bytes`);
      return;
    } catch (e) {
      if (e.message.includes('429') && attempt < 5) {
        console.log(`${voice}: rate-limited, retry ${attempt}...`);
        await new Promise(r => setTimeout(r, 20000 * attempt));
      } else {
        console.log(`${voice}: FAIL ${e.message}`);
        return;
      }
    }
  }
}

const voices = process.argv.slice(2);
for (const v of voices) {
  await test(v);
  await new Promise(r => setTimeout(r, 8000));
}
