import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const file = process.argv[2];
const b64 = fs.readFileSync(file).toString('base64');
const zai = await ZAI.create();
try {
  const result = await zai.audio.asr.create({ file_base64: b64 });
  console.log(result.text || '(empty)');
} catch (e) {
  console.log('ASR_FAIL: ' + e.message.slice(0, 100));
}
