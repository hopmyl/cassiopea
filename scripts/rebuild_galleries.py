#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Пересборка галерей изделий: только собственные фото из блока product-offer.
Исправляет контаминацию галерей чужими фото из блоков you-might-like."""
import json, os, re, io, time, sys
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image

BASE = "https://cassiopea.ru"
ROOT = "/home/z/my-project"
IMG_PRODUCTS = os.path.join(ROOT, "public/images/products")
CATALOG = os.path.join(ROOT, "src/data/catalog.json")

S = requests.Session()
S.headers.update({"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36"})

def get(url, tries=3, timeout=25):
    last = None
    for i in range(tries):
        try:
            r = S.get(url, timeout=timeout)
            if r.status_code == 200 and len(r.content) > 1000:
                return r.text
            last = f"status {r.status_code}"
        except Exception as e:
            last = str(e)
        time.sleep(1.5 * (i + 1))
    return None

def ahash(path_or_img, size=16):
    try:
        if isinstance(path_or_img, Image.Image):
            im = path_or_img.convert("L").resize((size, size), Image.LANCZOS)
        else:
            im = Image.open(path_or_img).convert("L").resize((size, size), Image.LANCZOS)
        px = list(im.getdata())
        avg = sum(px) / len(px)
        return [p > avg for p in px]
    except Exception:
        return None

def hdist(a, b):
    return sum(x != y for x, y in zip(a, b)) / len(a)

def save_img(url, path, max_side=1000):
    try:
        r = S.get(url, timeout=30)
        if r.status_code != 200:
            return False
        im = Image.open(io.BytesIO(r.content))
        im.load()
        w, h = im.size
        if max(w, h) > max_side:
            k = max_side / max(w, h)
            im = im.resize((int(w * k), int(h * k)), Image.LANCZOS)
        im.save(path, "WEBP", quality=85, method=4)
        return True
    except Exception as e:
        print(f"  img fail ...{url[-40:]}: {e}")
        return False

def extract_offer_slides(html):
    """Только слайды собственной галереи товара (product-offer)."""
    i = html.find('product-offer__slide')
    if i == -1:
        return []
    # берём всю секцию product-offer до следующей top-секции
    start = html.rfind('<section', 0, i)
    end_m = re.search(r'<section class="(you-might-like|product-about|social-widget|footer)', html[start:])
    end = start + (end_m.start() if end_m else min(len(html), start + 60000))
    sec = html[start:end]
    imgs = re.findall(
        r'class="ui-picture__img[^"]*product-offer__img[^"]*"\s+(?:src="([^"]+)"|srcset="([^"]+)")',
        sec)
    out = []
    for s1, s2 in imgs:
        u = s1 or (s2.split(" ")[0] if s2 else "")
        if u:
            u = u.replace("&amp;", "&")
            if u.startswith("/"):
                u = BASE + u
            if u not in out:
                out.append(u)
    return out

def main():
    pass

if __name__ != "__main__":
    raise SystemExit(0)

if True:
    pass
# 1. sitemap
sm = get(f"{BASE}/sitemap-iblock-1.xml")
sitemap_urls = sorted(set(re.findall(r"<loc>(https://cassiopea\.ru/catalog/[^<]+/[^<]+)</loc>", sm)))
url_by_slug = {u.rstrip("/").split("/")[-1]: u for u in sitemap_urls}

with open(CATALOG) as f:
    data = json.load(f)
slugs = [p["slug"] for p in data["products"]]
print(f"products in catalog: {len(slugs)}; sitemap urls: {len(url_by_slug)}")

# 2. fetch pages -> slide urls
pages = {}
with ThreadPoolExecutor(max_workers=8) as ex:
    futs = {}
    for s in slugs:
        u = url_by_slug.get(s) or f"{BASE}/catalog/x/{s}"
        futs[ex.submit(get, u)] = s
    for i, f in enumerate(as_completed(futs)):
        s = futs[f]
        html = f.result()
        if html:
            pages[s] = extract_offer_slides(html)
        if (i + 1) % 30 == 0:
            print(f"  pages {i+1}/{len(slugs)}")

empty = [s for s in slugs if not pages.get(s)]
print(f"pages with 0 offer-slides: {len(empty)} {empty[:10]}")

# 3. download galleries in parallel + update catalog
download_jobs = []  # (slug, idx, url)
for p in data["products"]:
    slug = p["slug"]
    for idx, u in enumerate((pages.get(slug) or [])[:6]):
        download_jobs.append((slug, idx, u))
print(f"images to download: {len(download_jobs)}")
saved = {}
with ThreadPoolExecutor(max_workers=12) as ex:
    futs = {ex.submit(save_img, u, os.path.join(IMG_PRODUCTS, f"{s}.webp" if i == 0 else f"{s}_{i+1}.webp")): (s, i)
            for s, i, u in download_jobs}
    for n, f in enumerate(as_completed(futs)):
        s, i = futs[f]
        if f.result():
            saved.setdefault(s, []).append((i, f"{s}.webp" if i == 0 else f"{s}_{i+1}.webp"))
        if (n + 1) % 80 == 0:
            print(f"  images {n+1}/{len(download_jobs)}")
for s in saved:
    saved[s].sort()

changes, kept, replaced_prev = 0, 0, 0
for p in data["products"]:
    slug = p["slug"]
    ok_files = [fn for _, fn in saved.get(slug, [])]
    if not ok_files:
        p["photos"] = [ph for ph in p.get("photos", [])]  # keep old if site unreachable
        continue
    old_preview = p.get("preview") or ""
    old_preview_file = os.path.basename(old_preview) if old_preview else ""
    old_prev_hash = ahash(os.path.join(ROOT, "public", old_preview.lstrip("/"))) if old_preview_file and old_preview.startswith("/") and os.path.exists(os.path.join(ROOT, "public", old_preview.lstrip("/"))) else None
    # match old preview against new files
    match_idx = -1
    if old_prev_hash:
        for idx, fn in enumerate(ok_files):
            nh = ahash(os.path.join(IMG_PRODUCTS, fn))
            if nh and hdist(old_prev_hash, nh) < 0.15:
                match_idx = idx
                break
    if match_idx == -1:
        # preview was wrong/foreign -> use slide 1 as preview
        if old_preview and old_preview != f"/images/products/{ok_files[0]}":
            replaced_prev += 1
        p["preview"] = f"/images/products/{ok_files[0]}"
        p["photos"] = [f"/images/products/{fn}" for fn in ok_files[1:]]
    else:
        kept += 1
        p["preview"] = f"/images/products/{ok_files[match_idx]}"
        p["photos"] = [f"/images/products/{fn}" for i2, fn in enumerate(ok_files) if i2 != match_idx]
    changes += 1

print(f"galleries rebuilt: {changes}, previews kept: {kept}, previews replaced: {replaced_prev}")

# intermediate save
def dump():
    with open(CATALOG, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
dump()

# cleanup orphaned old photos (_N files no longer referenced)
referenced = set()
for p in data["products"]:
    if p.get("preview"):
        referenced.add(os.path.basename(p["preview"]))
    for ph in p.get("photos", []):
        referenced.add(os.path.basename(ph))
removed = 0
for fn in os.listdir(IMG_PRODUCTS):
    if fn.endswith(".webp") and fn not in referenced:
        os.remove(os.path.join(IMG_PRODUCTS, fn))
        removed += 1
print(f"orphaned images removed: {removed}")

with open(CATALOG, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=1)
print("catalog.json updated")
