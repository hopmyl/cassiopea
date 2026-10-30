#!/usr/bin/env python3
"""Find product gallery photos that actually depict a different product
(different section / another product's preview) via perceptual hashing."""
import json, os, sys
from PIL import Image

ROOT = "/home/z/my-project/public/images/products"
CATALOG = "/home/z/my-project/src/data/catalog.json"

def ahash(path, size=16):
    try:
        im = Image.open(path).convert("L").resize((size, size), Image.LANCZOS)
        px = list(im.getdata())
        avg = sum(px) / len(px)
        bits = [(p > avg) for p in px]
        return bits
    except Exception:
        return None

def hamming(a, b):
    return sum(x != y for x, y in zip(a, b))

def dist(a, b, size=16):
    # normalized hamming distance 0..1
    return hamming(a, b) / (size * size)

with open(CATALOG) as f:
    data = json.load(f)

products = {p["slug"]: p for p in data["products"]}

# hash every image file
hashes = {}  # fname -> bits
for fn in os.listdir(ROOT):
    if fn.endswith(".webp"):
        bits = ahash(os.path.join(ROOT, fn))
        if bits:
            hashes[fn] = bits

# registry: which files are a product's preview
preview_of = {}
photos_of = {}
for slug, p in products.items():
    if p.get("preview"):
        preview_of[os.path.basename(p["preview"])] = slug
    for ph in p.get("photos", []):
        photos_of.setdefault(os.path.basename(ph), []).append(slug)

print(f"images: {len(hashes)}, previews: {len(preview_of)}, photo-refs: {len(photos_of)}")

# For every photo of product X, find the closest preview among other products.
# If photo ~ (dist<0.12) preview of product Y != X -> contamination.
suspects = []
for fname, owners in photos_of.items():
    if fname not in hashes:
        continue
    bits = hashes[fname]
    best, bestd = None, 1.0
    for pf, pslug in preview_of.items():
        if pf in hashes:
            d = dist(bits, hashes[pf])
            if d < bestd:
                bestd, best = d, (pf, pslug)
    if best and bestd < 0.15:
        pf, pslug = best
        for owner in owners:
            sec_x = products[owner]["section"]
            sec_y = products[pslug]["section"]
            same_slug = owner == pslug
            if not same_slug:
                suspects.append((owner, sec_x, fname, pslug, sec_y, pf, round(bestd, 3)))

print("\n=== CONTAMINATION SUSPECTS (photo ~ another product's preview) ===")
for s in sorted(suspects):
    print(f"product={s[0]} [{s[1]}]  photo={s[2]}  ~=  preview of {s[3]} [{s[4]}]  d={s[6]}")

# Also: photos that are ~ duplicate of ANOTHER product's photo with different slug prefix
print("\n=== PHOTO-PHOTO CROSS-SLUG DUPLICATES ===")
by_file = sorted(hashes.keys())
seen_pairs = set()
for i, f1 in enumerate(by_file):
    for f2 in by_file[i+1:]:
        s1, s2 = f1.rsplit("_", 1)[0] if "_" in f1 else f1[:-5], f2.rsplit("_", 1)[0] if "_" in f2 else f2[:-5]
        base1 = f1.split("_")[0].replace(".webp", "")
        base2 = f2.split("_")[0].replace(".webp", "")
        if base1 == base2:
            continue
        d = dist(hashes[f1], hashes[f2])
        if d < 0.10 and (f2, f1) not in seen_pairs:
            seen_pairs.add((f1, f2))
            print(f"{f1}  ~=  {f2}  d={round(d,3)}")

# sanity: preview/section mismatch check — preview of product X ~= preview of product Y
print("\n=== PREVIEW-PREVIEW NEAR DUPLICATES (different slugs) ===")
prevs = list(preview_of.items())
for i, (f1, s1) in enumerate(prevs):
    for f2, s2 in prevs[i+1:]:
        if s1 == s2 or f1 not in hashes or f2 not in hashes:
            continue
        d = dist(hashes[f1], hashes[f2])
        if d < 0.12:
            print(f"preview {s1} ~= preview {s2}  d={round(d,3)}")
