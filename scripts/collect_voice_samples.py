#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Опрос TTS-роута, сбор образцов всех голосов, затем F0-анализ."""
import os, time, json, urllib.request

OUT = "/tmp/voice_test"
os.makedirs(OUT, exist_ok=True)
VOICES = ["xiaochen", "luodo", "douji", "kazi", "chuichui", "tongtong"]
TEXT = "Добро пожаловать в ювелирный дом Кассиопея. Это кольцо украшено танзанитом."

def try_voice(voice):
    path = f"{OUT}/{voice}.wav"
    if os.path.exists(path) and os.path.getsize(path) > 50000:
        return "cached"
    body = json.dumps({"text": TEXT, "voice": voice}).encode()
    req = urllib.request.Request(
        "http://localhost:3000/api/tts", data=body,
        headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()
        # route currently ignores voice param? check size + magic
        if data[:4] == b"RIFF" and len(data) > 50000:
            with open(path, "wb") as f:
                f.write(data)
            return f"saved {len(data)}"
        return f"bad response: {data[:80]}"
    except Exception as e:
        return f"error: {str(e)[:80]}"

status_path = f"{OUT}/status.txt"

def log(msg):
    with open(status_path, "a") as f:
        f.write(f"[{time.strftime('%H:%M:%S')}] {msg}\n")

for round_i in range(1, 13):  # до ~1 часа опроса
    remaining = [v for v in VOICES if not (os.path.exists(f"{OUT}/{v}.wav") and os.path.getsize(f"{OUT}/{v}.wav") > 50000)]
    log(f"round {round_i}: remaining={remaining}")
    if not remaining:
        break
    for v in remaining:
        res = try_voice(v)
        log(f"  {v}: {res}")
        if "saved" in res or "cached" in res:
            time.sleep(12)
        else:
            break  # 429 -> ждём до следующего раунда
    if all(os.path.exists(f"{OUT}/{v}.wav") and os.path.getsize(f"{OUT}/{v}.wav") > 50000 for v in VOICES):
        log("all samples collected")
        break
    time.sleep(300)

log("running analysis")
os.system(f"python3 /home/z/my-project/scripts/analyze_voice.py {OUT}/*.wav > {OUT}/analysis.txt 2>&1")
log("done")
