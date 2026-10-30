#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Оценка основного тона (F0) и яркости голоса из WAV-образцов.
Женские голоса: F0 ~165-255 Гц; мужские: ~85-160 Гц.
Мягкий тембр: умеренный спектральный центроид, стабильная интонация."""
import sys, wave, numpy as np

def analyze(path):
    w = wave.open(path, "rb")
    sr = w.getframerate()
    n = w.getnframes()
    ch = w.getnchannels()
    sw = w.getsampwidth()
    raw = w.readframes(n)
    w.close()
    if sw == 2:
        x = np.frombuffer(raw, dtype=np.int16).astype(np.float64)
    elif sw == 4:
        x = np.frombuffer(raw, dtype=np.int32).astype(np.float64)
    else:
        x = np.frombuffer(raw, dtype=np.uint8).astype(np.float64) - 128
    if ch > 1:
        x = x[::ch]
    x /= (np.max(np.abs(x)) + 1e-9)
    dur = n / sr
    frame, hop = int(0.04 * sr), int(0.02 * sr)
    f0s = []
    centroids = []
    freqs = np.fft.rfftfreq(2048, 1 / sr)
    for i in range(0, len(x) - frame, hop):
        seg = x[i:i + frame] * np.hanning(frame)
        e = np.sqrt(np.mean(seg ** 2))
        if e < 0.02:  # тишина
            continue
        # autocorrelation F0 (60-400 Hz)
        ac = np.correlate(seg, seg, "full")[frame - 1:]
        lo, hi = int(sr / 400), int(sr / 60)
        if hi >= len(ac):
            continue
        seg_ac = ac[lo:hi]
        peak = np.argmax(seg_ac) + lo
        if ac[peak] > 0.3 * ac[0]:
            f0s.append(sr / peak)
        # spectral centroid
        sp = np.abs(np.fft.rfft(seg, 2048)) ** 2
        if sp.sum() > 0:
            centroids.append((freqs * sp).sum() / sp.sum())
    if not f0s:
        return None
    f0s = np.array(f0s)
    med = np.median(f0s)
    # keep octave-stable subset
    stable = f0s[(f0s > med / 1.5) & (f0s < med * 1.5)]
    return {
        "file": path.split("/")[-1],
        "dur_s": round(dur, 2),
        "F0_median": round(float(np.median(stable)), 1) if len(stable) else round(float(med), 1),
        "F0_p25": round(float(np.percentile(stable, 25)), 1) if len(stable) else None,
        "F0_p75": round(float(np.percentile(stable, 75)), 1) if len(stable) else None,
        "centroid": round(float(np.median(centroids)), 0) if centroids else None,
        "voiced_frames": len(stable),
    }

if __name__ == "__main__":
    for p in sys.argv[1:]:
        try:
            r = analyze(p)
            if r:
                gender = "FEMALE" if r["F0_median"] >= 165 else ("male" if r["F0_median"] <= 160 else "?")
                print(f'{r["file"]:24s} F0={r["F0_median"]:6.1f} Hz [{gender}]  '
                      f'range {r["F0_p25"]}-{r["F0_p75"]}  centroid={r["centroid"]} Hz  dur={r["dur_s"]}s')
            else:
                print(f"{p}: no voiced frames")
        except Exception as e:
            print(f"{p}: ERROR {e}")
