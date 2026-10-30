# -*- coding: utf-8 -*-
"""Докачка металла и вставки для каждого изделия со страниц товаров."""
import json, os, re, time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE = "https://cassiopea.ru"
ROOT = "/home/z/my-project"
P = os.path.join(ROOT, "src/data/catalog.json")
d = json.load(open(P))

S = requests.Session()
S.headers.update({"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36"})

def unesc(s):
    return (s.replace('\\"', '"').replace("\\\\", "\\")
             .replace("&#x27;", "'").replace("&quot;", '"').strip())

SEC = {"Кольца": "koltsa", "Серьги": "sergi", "Подвески": "podveski", "Браслеты": "braslety"}

def scrape(args):
    slug, section = args
    path = SEC.get(section, "koltsa")
    for attempt in range(3):
        try:
            r = S.get(f"{BASE}/catalog/{path}/{slug}", timeout=25)
            if r.status_code == 200 and len(r.content) > 1000:
                html = r.text
                break
        except Exception:
            pass
        time.sleep(1.5 * (attempt + 1))
    else:
        return slug, None, None
    # рендер-блок характеристик: <h3 class="product-desc__title...">ЗНАЧЕНИЕ</h3><p class="product-desc__text...">ПОЛЕ</p>
    pairs = {}
    for m in re.finditer(r'<h3 class="product-desc__title[^"]*">(.*?)</h3>\s*<p class="product-desc__text[^"]*">(.*?)</p>', html, re.S):
        val = re.sub(r"<!-- -->", "", m.group(1))
        val = re.sub(r"<[^>]+>", "", val)
        val = re.sub(r"\s+", " ", val).strip()
        label = re.sub(r"<[^>]+>", "", m.group(2)).strip()
        if label and val:
            pairs.setdefault(label, val)
    stone = pairs.get("Вставка")
    metal = pairs.get("Металл")
    if metal:
        metal = re.sub(r"\s*750\s*$", "", metal).strip()
    return slug, metal, stone

slugs = [(p["slug"], p.get("section") or "Кольца") for p in d["products"]]
results = {}
with ThreadPoolExecutor(max_workers=8) as ex:
    futs = [ex.submit(scrape, s) for s in slugs]
    for i, f in enumerate(as_completed(futs)):
        slug, metal, stone = f.result()
        results[slug] = (metal, stone)
        if (i + 1) % 40 == 0:
            print(f"  {i+1}/{len(slugs)}")

ok = 0
for p in d["products"]:
    metal, stone = results.get(p["slug"], (None, None))
    if metal and not p.get("metal"):
        p["metal"] = metal; ok += 1
    if stone and not p.get("stone"):
        p["stone"] = stone
json.dump(d, open(P, "w"), ensure_ascii=False)
print("metal fixed:", ok)
left = sum(1 for p in d["products"] if not p.get("metal"))
print("still without metal:", left)
