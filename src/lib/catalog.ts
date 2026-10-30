import raw from "@/data/catalog.json";

export interface Product {
  slug: string;
  id: string;
  name: string;
  section: string;
  price: number | null;
  discount: number;
  stone: string | null;
  metal: string | null;
  isNew: boolean;
  collections: string[];
  collection_names?: string[];
  preview: string | null;
  photos: string[];
  characteristics: Record<string, string>;
}

export interface Collection {
  slug: string;
  name: string;
  tagline?: string;
  description: string[];
  cover?: string;
  products: string[];
}

export const products = raw.products as Product[];
export const collections = raw.collections as Collection[];
export const fetchedAt = raw.fetchedAt as string;

export const bySlug = new Map(products.map((p) => [p.slug, p]));

export const SECTIONS = ["Кольца", "Серьги", "Подвески", "Браслеты"] as const;

export const sectionCount = (section: string) =>
  products.filter((p) => p.section === section).length;

export const sectionIcon = (section: string): string => {
  switch (section) {
    case "Кольца": return "ring";
    case "Серьги": return "earrings";
    case "Подвески": return "pendant";
    case "Браслеты": return "bracelet";
    default: return "jewel";
  }
};

export const METALS = Array.from(
  new Set(products.map((p) => p.metal).filter((m): m is string => !!m)),
).sort();

export const STONES = Array.from(
  new Set(products.map((p) => p.stone).filter((s): s is string => !!s)),
).sort((a, b) => a.localeCompare(b, "ru"));

export function fmtPrice(n: number | null | undefined): string {
  if (!n) return "Цена по запросу";
  return `${n.toLocaleString("ru-RU")} ₽`;
}

export function fmtPriceSpoken(n: number | null | undefined): string {
  if (!n) return "цену уточнит консультант";
  return `${n.toLocaleString("ru-RU")} рублей`;
}

export function productsOfCollection(slug: string): Product[] {
  const c = collections.find((x) => x.slug === slug);
  if (!c) return [];
  return c.products.map((s) => bySlug.get(s)).filter((p): p is Product => !!p);
}

export function collectionPriceRange(slug: string): [number, number] | null {
  const ps = productsOfCollection(slug)
    .map((p) => p.price)
    .filter((n): n is number => !!n);
  if (!ps.length) return null;
  return [Math.min(...ps), Math.max(...ps)];
}

export interface CatalogFilters {
  section?: string;
  metal?: string;
  stone?: string;
  collection?: string;
  q?: string;
  sort?: "price-desc" | "price-asc" | "name";
}

export function filterProducts(f: CatalogFilters): Product[] {
  let list = products.slice();
  if (f.section) list = list.filter((p) => p.section === f.section);
  if (f.metal) list = list.filter((p) => p.metal === f.metal);
  if (f.stone) list = list.filter((p) => p.stone === f.stone);
  if (f.collection) list = list.filter((p) => p.collections.includes(f.collection!));
  if (f.q) {
    const q = normalize(f.q);
    list = list.filter(
      (p) => normalize(p.name).includes(q) || normalize(p.stone || "").includes(q) || normalize(p.metal || "").includes(q),
    );
  }
  if (f.sort === "price-desc") list.sort((a, b) => (b.price || 0) - (a.price || 0));
  else if (f.sort === "price-asc") list.sort((a, b) => (a.price || 0) - (b.price || 0));
  else if (f.sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  return list;
}

export function similarProducts(p: Product, max = 6): Product[] {
  const inCollections = p.collections.length
    ? products.filter((x) => x.slug !== p.slug && x.collections.some((c) => p.collections.includes(c)))
    : [];
  const sameSection = products.filter(
    (x) => x.slug !== p.slug && x.section === p.section && !inCollections.includes(x),
  );
  return [...inCollections, ...sameSection].slice(0, max);
}

export function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е").replace(/[«»"']/g, "").replace(/\s+/g, " ").trim();
}

export const COMPANY = raw.companyDescription as string[];
