"use client";

import { useMemo, useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import {
  filterProducts,
  products,
  SECTIONS,
  METALS,
  STONES,
  sectionCount,
} from "@/lib/catalog";
import ProductCard from "./ProductCard";
import { Sparkles } from "./Sparkle";

const plural = (n: number) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (n === 1) return "изделие";
  if (m100 >= 11 && m100 <= 14) return "изделий";
  if (m10 === 0 || m10 >= 5) return "изделий";
  return "изделия";
};

type Sort = "price-desc" | "price-asc" | "name";

export default function CatalogView({
  initialSection,
  initialStone,
  onOpenProduct,
  favorites,
  onToggleFavorite,
}: {
  initialSection?: string;
  initialStone?: string;
  onOpenProduct: (slug: string) => void;
  favorites: string[];
  onToggleFavorite: (slug: string) => void;
}) {
  const [section, setSection] = useState<string | undefined>(initialSection);
  const [metal, setMetal] = useState<string | undefined>();
  const [stone, setStone] = useState<string | undefined>(initialStone);
  const [sort, setSort] = useState<Sort>("price-desc");
  const [q, setQ] = useState("");

  const list = useMemo(
    () =>
      filterProducts({
        section,
        metal,
        stone,
        q,
        sort,
      }),
    [section, metal, stone, q, sort],
  );

  const chip = (active: boolean) =>
    `min-h-11 rounded-full px-5 py-2.5 text-[12px] font-semibold tracking-[0.1em] uppercase transition-colors ${
      active
        ? "bg-[rgba(233,215,167,0.16)] text-[#f7ecc9] border border-[rgba(233,215,167,0.5)]"
        : "border border-white/10 text-white/55 hover:text-white"
    }`;

  const selectCls =
    "min-h-11 appearance-none rounded-full border border-white/10 bg-[rgba(8,12,26,0.7)] py-2.5 pl-5 pr-10 text-[12.5px] text-white/75 outline-none focus:border-[rgba(233,215,167,0.5)]";

  return (
    <div className="no-select relative px-8 py-10 lg:px-16">
      <Sparkles count={8} />
      <p className="tracked mb-2 text-[11px] text-[#e9d7a7]/70">Все творения дома</p>
      <h1 className="font-display mb-8 text-[44px] font-semibold text-[#f3ead2]">Каталог украшений</h1>

      {/* Фильтры */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button className={chip(!section && !initialSection)} onClick={() => { setSection(undefined); setStone(undefined); setMetal(undefined); }}>
          Все · {products.length}
        </button>
        {SECTIONS.map((s) => (
          <button key={s} className={chip(section === s)} onClick={() => setSection(section === s ? undefined : s)}>
            {s} · {sectionCount(s)}
          </button>
        ))}
        <div className="relative ml-auto">
          <select className={selectCls} value={metal || ""} onChange={(e) => setMetal(e.target.value || undefined)} aria-label="Металл">
            <option value="">Любой металл</option>
            {METALS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/40" />
        </div>
        <div className="relative">
          <select className={selectCls} value={stone || ""} onChange={(e) => setStone(e.target.value || undefined)} aria-label="Вставка">
            <option value="">Любая вставка</option>
            {STONES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/40" />
        </div>
        <div className="relative">
          <select className={selectCls} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Сортировка">
            <option value="price-desc">Дороже сначала</option>
            <option value="price-asc">Доступнее сначала</option>
            <option value="name">По названию</option>
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/40" />
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск: танзанит, Морзе…"
            className="min-h-11 w-56 rounded-full border border-white/10 bg-[rgba(8,12,26,0.7)] py-2.5 pl-10 pr-4 text-[13px] text-white/85 placeholder:text-white/30 outline-none focus:border-[rgba(233,215,167,0.5)]"
            aria-label="Поиск по каталогу"
          />
        </div>
      </div>

      <p className="mb-5 text-[12.5px] text-white/40">Найдено: {list.length} {plural(list.length)}</p>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {list.map((p) => (
          <ProductCard
            key={p.slug}
            product={p}
            onClick={() => onOpenProduct(p.slug)}
            isFavorite={favorites.includes(p.slug)}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>

      {list.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <p className="font-display text-[26px] text-white/60">Ничего не нашлось</p>
          <p className="text-[13.5px] text-white/40">Попробуйте изменить фильтры или спросите ассистента — он знает весь каталог наизусть.</p>
        </div>
      )}
    </div>
  );
}
