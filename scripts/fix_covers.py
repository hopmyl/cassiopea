# -*- coding: utf-8 -*-
"""Обложки коллекций: уникальное изображение из hero-секции перед заголовком."""
import json, os, io, re, time
import requests
from PIL import Image

BASE = "https://cassiopea.ru"
ROOT = "/home/z/my-project"
IMG = os.path.join(ROOT, "public/images/collections")
os.makedirs(IMG, exist_ok=True)

S = requests.Session()
S.headers.update({"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36"})

P = os.path.join(ROOT, "src/data/catalog.json")
d = json.load(open(P))

def fetch(url, tries=3):
    for i in range(tries):
        try:
            r = S.get(url, timeout=25)
            if r.status_code == 200 and len(r.content) > 1000:
                return r.text
        except Exception:
            pass
        time.sleep(2)
    return None

def save(url, path, max_side=1400):
    r = S.get(url, timeout=30)
    r.raise_for_status()
    im = Image.open(io.BytesIO(r.content)); im.load()
    if im.mode == "P":
        im = im.convert("RGBA")
    w, h = im.size
    if max(w, h) > max_side:
        k = max_side / max(w, h)
        im = im.resize((int(w * k), int(h * k)), Image.LANCZOS)
    if im.mode == "RGBA":
        im.save(path, "WEBP", quality=85, method=4)
    else:
        im.convert("RGB").save(path, "WEBP", quality=85, method=4)
    return True

GLOBAL = ["1c6/9yc7qs8dp3civygrq1oxn90f9vpa3x04", "b96/y01w0d54i42euhpvhzzl2umvko37iiw2"]

for c in d["collections"]:
    slug = c["slug"]
    html = fetch(f"{BASE}/collections/{slug}")
    if not html:
        print("NO PAGE", slug); continue
    i = html.find("offer__title")
    frag = html[max(0, i - 12000): i] if i > 0 else html
    imgs = re.findall(r'https://cassiopea\.ru/upload/iblock/([0-9a-f]{3})/([a-z0-9]+)\.(?:png|jpg|jpeg|webp)', frag)
    pick = None
    for folder, fn in reversed(imgs):
        if f"{folder}/{fn.split('.')[0][:20]}" in " ".join(GLOBAL) or fn.startswith("9yc7") or fn.startswith("y01w"):
            continue
        pick = f"https://cassiopea.ru/upload/iblock/{folder}/{fn}.png" if fn in [x[1] for x in imgs if x[0] == folder and x[1].endswith('.png')] else None
        # восстановим расширение корректно
        break
    if not pick:
        # берём последний уникальный с правильным расширением
        raw = re.findall(r'https://cassiopea\.ru/upload/iblock/[0-9a-f]{3}/[a-z0-9]+\.(?:png|jpg|jpeg|webp)', frag)
        raw = [u for u in raw if not any(g in u for g in ["9yc7qs8dp3civygrq1oxn90f9vpa3x04", "y01w0d54i42euhpvhzzl2umvko37iiw2"])]
        pick = raw[-1] if raw else None
    if not pick:
        print("NO COVER", slug); continue
    # расширение из исходного URL
    m = re.search(r'\.(png|jpe?g|webp)$', pick)
    fn_webp = f"{slug}.webp"
    try:
        save(pick, os.path.join(IMG, fn_webp))
        c["cover"] = f"/images/collections/{fn_webp}"
        print("OK", slug, "←", pick[-52:])
    except Exception as e:
        print("FAIL", slug, e)

json.dump(d, open(P, "w"), ensure_ascii=False)
print("saved")
