# -*- coding: utf-8 -*-
"""Парсер сайта cassiopea.ru: каталог, коллекции, характеристики, изображения."""
import json, os, re, sys, time, io
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image

BASE = "https://cassiopea.ru"
ROOT = "/home/z/my-project"
IMG_PRODUCTS = os.path.join(ROOT, "public/images/products")
IMG_COLLECTIONS = os.path.join(ROOT, "public/images/collections")
DATA_DIR = os.path.join(ROOT, "src/data")
for d in (IMG_PRODUCTS, IMG_COLLECTIONS, DATA_DIR):
    os.makedirs(d, exist_ok=True)

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
    print(f"  !! FAIL {url}: {last}")
    return None

def unesc(s):
    return s.replace('\\"', '"').replace("\\\\", "\\").replace("\\/", "/").replace("\\u003c", "<").replace("\\u003e", ">").replace("\\u0026", "&").replace("&#x27;", "'").replace("&quot;", '"').strip()

# ---------- 1. sitemap -> product urls ----------
sm = get(f"{BASE}/sitemap-iblock-1.xml")
product_urls = sorted(set(re.findall(r"<loc>(https://cassiopea\.ru/catalog/[^<]+/[^<]+)</loc>", sm)))
print(f"product urls: {len(product_urls)}")

# ---------- 2. catalog/all -> base data ----------
def parse_products(html):
    """Достаёт объекты товаров из RSC payload."""
    out = {}
    pat = re.compile(
        r'\\"id\\":\\"(\d+)\\",\\"sort\\":\\"(\d+)\\",\\"code\\":\\"([^"\\]+)\\",'
        r'\\"section_id\\":\\"(\d+)\\",\\"section_name\\":\\"([^"\\]*)\\",'
        r'\\"name\\":\\"([^"\\]+)\\",\\"url\\":\\"([^"\\]+)\\"'
    )
    for m in pat.finditer(html):
        slug = m.group(3)
        if slug in out:
            continue
        start, end = m.start(), min(m.start() + 4000, len(html))
        region = html[start:end]
        rec = {
            "id": m.group(1), "slug": slug, "sort": int(m.group(2)),
            "section": unesc(m.group(5)), "name": unesc(m.group(6)),
        }
        mp = re.search(r'\\"base_price\\":(\d+),\\"price\\":(\d+),\\"discount_percent\\":(\d+),\\"discount_amount\\":(\d+)', region)
        if mp:
            rec["price"] = int(mp.group(2)) or int(mp.group(1))
            rec["discount"] = int(mp.group(3))
        # inline properties (на страницах каталога/коллекций)
        back = html[max(0, start - 3500):start + 400]
        ms = re.search(r'\\"stone\\":\{\\"name\\":\\"[^"\\]*\\",\\"value\\":\\"([^"\\]*)\\",\\"xml_id\\":\\"[^"\\]*\\"[^}]*\\"metal\\":\{\\"name\\":\\"[^"\\]*\\",\\"value\\":\\"([^"\\]*)\\"', back)
        if ms:
            rec["stone"] = unesc(ms.group(1)); rec["metal"] = unesc(ms.group(2))
        mi = re.search(r'\\"preview_image\\":\\"([^"\\]+)\\"', region)
        if mi:
            rec["preview"] = unesc(mi.group(1))
        mc = re.search(r'\\"collection_name\\":\\"([^"\\]*)\\"', region)
        if mc and mc.group(1):
            rec["collection_name"] = unesc(mc.group(1))
        out[slug] = rec
    return out

html_all = get(f"{BASE}/catalog/all")
products = parse_products(html_all)
print(f"parsed from catalog/all: {len(products)}")

# ---------- 3. collections ----------
COLLECTIONS = [
    ("sakralny-kod", "Сакральный код"), ("azbuka-morze", "Азбука Морзе"),
    ("tvoy-taynyy-shifr", "Твой тайный шифр"), ("zashchita", "Защита"),
    ("amore-fati", "Любовь к судьбе"), ("sozvezdiya-galaxy", "GALAXY Constellations"),
    ("ekspressiya", "Экспрессия"), ("i-m-cassiopea", "I'm Cassiopea"),
    ("svobodnaya-orbita", "Свободная орбита"),
]
collections = []
for slug, name in COLLECTIONS:
    html = get(f"{BASE}/collections/{slug}")
    if not html:
        continue
    c = {"slug": slug, "name": name, "products": []}
    mt = re.search(r'class="ui-title__title offer__title__title">([^<]+)<', html)
    if mt: c["name"] = mt.group(1).strip()
    mg = re.search(r'class="ui-title__desc[^"]*offer__title__desc[^"]*">([^<]+)<', html)
    if mg: c["tagline"] = mg.group(1).strip()
    paras = []
    for p in re.findall(r"<p[^>]*>(.*?)</p>", html, re.S):
        t = re.sub(r"<[^>]+>", "", p)
        t = re.sub(r"\s+", " ", t).strip()
        if len(t) >= 60 and "₽" not in t and not re.search(r"Смотреть|подписк", t, re.I):
            paras.append(t)
    seen = set(); c["description"] = []
    for p in paras:
        k = p[:60]
        if k not in seen:
            seen.add(k); c["description"].append(p)
    c["description"] = c["description"][:4]
    big = re.findall(r'https://cassiopea\.ru/upload/[^"\\s]+?1920_1080_1/[^"\\s]+?\.(?:jpg|jpeg|png|webp)', html)
    if big: c["cover"] = big[0]
    slugs = set(re.findall(r'href="(?:/ru)?/catalog/[^"]+/([^"/?#]+)"', html))
    slugs = {s for s in slugs if s not in ("koltsa", "sergi", "podveski", "braslety", "all")}
    c["products"] = sorted(slugs)
    collections.append(c)
    print(f"  collection {slug}: {len(c['products'])} products, desc {len(c['description'])}")

# ---------- 4. product pages: характеристики + галерея ----------
def scrape_product(url):
    html = get(url)
    if not html:
        return None
    slug = url.rstrip("/").split("/")[-1]
    rec = {"slug": slug}
    chars = {}
    for m in re.finditer(r'\{\\"name\\":\\"([^"\\]+)\\",\\"value\\":\\"([^"\\]*)\\"\}', html):
        k, v = unesc(m.group(1)), unesc(m.group(2))
        if v and k not in ("В наличии", "Новинка", "Пол", "Вставка", "Металл"):
            chars.setdefault(k, v)
    rec["characteristics"] = chars
    imgs = re.findall(r'https://cassiopea\.ru/upload/resize_cache/iblock/[^"\\s]+?(?:2400_2400_0|1360_1360_1)/[^"\\s]+?\.(?:png|jpg|jpeg|webp)', html)
    seen = set(); gal = []
    for i in imgs:
        key = i.split("/")[-1]
        if key not in seen:
            seen.add(key); gal.append(i)
    rec["gallery"] = gal[:5]
    return rec

details = {}
with ThreadPoolExecutor(max_workers=8) as ex:
    futs = {ex.submit(scrape_product, u): u for u in product_urls}
    for i, f in enumerate(as_completed(futs)):
        r = f.result()
        if r:
            details[r["slug"]] = r
        if (i + 1) % 30 == 0:
            print(f"  product pages {i+1}/{len(product_urls)}")

print(f"product details: {len(details)}")

# ---------- merge + image jobs ----------
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

merged = []
jobs = []
for slug, p in products.items():
    d = details.get(slug, {})
    rec = {
        "slug": slug, "id": p.get("id"), "name": p.get("name"),
        "section": p.get("section"), "price": p.get("price"),
        "discount": p.get("discount", 0),
        "stone": p.get("stone"), "metal": p.get("metal"),
        "isNew": False, "collections": [], "preview": None, "photos": [],
        "characteristics": d.get("characteristics", {}),
    }
    ch = rec["characteristics"]
    if not rec["stone"] and ch.get("Вставка"): rec["stone"] = ch["Вставка"]
    if not rec["metal"] and ch.get("Металл"): rec["metal"] = ch["Металл"]
    cnames = []
    for c in collections:
        if slug in c["products"]:
            rec["collections"].append(c["slug"])
            if c.get("name"): cnames.append(c["name"])
    if p.get("collection_name") and p["collection_name"] not in cnames:
        cnames.append(p["collection_name"])
    if cnames:
        rec["collection_names"] = sorted(set(cnames))
    gallery = d.get("gallery", [])
    main_url = p.get("preview") or (gallery[0] if gallery else None)
    photos = []
    if main_url:
        rec["preview"] = f"/images/products/{slug}.webp"
        jobs.append((main_url, os.path.join(IMG_PRODUCTS, f"{slug}.webp"), 1000))
    j = 0
    for g in gallery:
        if g == main_url: continue
        j += 1
        if j > 3: break
        fn = f"{slug}_{j+1}.webp"
        photos.append(f"/images/products/{fn}")
        jobs.append((g, os.path.join(IMG_PRODUCTS, fn), 1000))
    rec["photos"] = photos
    merged.append(rec)

merged.sort(key=lambda r: (r["section"], -(r["price"] or 0)))
print(f"merged products: {len(merged)}, image jobs: {len(jobs)}")

for c in collections:
    if c.get("cover"):
        fn = f"{c['slug']}.webp"
        jobs.append((c["cover"], os.path.join(IMG_COLLECTIONS, fn), 1400))
        c["cover"] = f"/images/collections/{fn}"

# ---------- download images ----------
ok = 0
with ThreadPoolExecutor(max_workers=10) as ex:
    futs = {ex.submit(save_img, u, p, m): (u, p) for u, p, m in jobs}
    for f in as_completed(futs):
        if f.result(): ok += 1
print(f"images saved: {ok}/{len(jobs)}")

saved = set(os.listdir(IMG_PRODUCTS))
for rec in merged:
    if rec["preview"] and os.path.basename(rec["preview"]) not in saved:
        rec["preview"] = None
    rec["photos"] = [ph for ph in rec["photos"] if os.path.basename(ph) in saved]

# ---------- company ----------
html_c = get(f"{BASE}/ru/company")
company_desc = []
if html_c:
    for p in re.findall(r"<p[^>]*>(.*?)</p>", html_c, re.S):
        t = re.sub(r"<[^>]+>", "", p)
        t = re.sub(r"\s+", " ", t).strip()
        if len(t) >= 80:
            company_desc.append(t)
    seen = set(); cd = []
    for p in company_desc:
        k = p[:50]
        if k not in seen:
            seen.add(k); cd.append(p)
    company_desc = cd[:8]
print(f"company paragraphs: {len(company_desc)}")
for p in company_desc: print("  CO:", p[:130])

data = {
    "fetchedAt": "2026-10-30",
    "collections": collections,
    "products": merged,
    "companyDescription": company_desc,
}
with open(os.path.join(DATA_DIR, "catalog.json"), "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False)

secs = {}
for r in merged:
    secs[r["section"]] = secs.get(r["section"], 0) + 1
print("SECTIONS:", secs)
prices = [r["price"] for r in merged if r.get("price")]
print("PRICE RANGE:", min(prices), "-", max(prices))
print("NO PREVIEW:", sum(1 for r in merged if not r["preview"]))
print("OK")
