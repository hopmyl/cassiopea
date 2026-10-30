"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Mic } from "lucide-react";
import { collections, productsOfCollection, fmtPrice, collectionPriceRange } from "@/lib/catalog";
import { Sparkle, Sparkles } from "./Sparkle";
import ProductCard from "./ProductCard";

export default function CollectionView({
  slug,
  onBack,
  onOpenProduct,
  onAssistant,
  favorites,
  onToggleFavorite,
}: {
  slug: string;
  onBack: () => void;
  onOpenProduct: (slug: string) => void;
  onAssistant: () => void;
  favorites: string[];
  onToggleFavorite: (slug: string) => void;
}) {
  const c = collections.find((x) => x.slug === slug);
  if (!c) return null;
  const ps = productsOfCollection(slug);
  const range = collectionPriceRange(slug);

  return (
    <div className="no-select relative pb-16">
      {/* Обложка */}
      <div className="relative h-72 overflow-hidden lg:h-80">
        {c.cover && (
           
          <img src={c.cover} alt="" className="h-full w-full object-cover opacity-70" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#010307] via-[rgba(1,3,7,0.45)] to-[rgba(1,3,7,0.25)]" />
        <Sparkles count={10} />
        <div className="absolute inset-x-0 bottom-0 px-8 pb-7 lg:px-16">
          <button
            onClick={onBack}
            className="mb-4 flex min-h-11 items-center gap-2 text-[12px] font-semibold tracking-[0.16em] text-white/60 uppercase transition-colors hover:text-[#f7ecc9]"
          >
            <ArrowLeft size={15} /> Все коллекции
          </button>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="font-display text-[46px] leading-tight font-semibold text-[#f3ead2]"
          >
            {c.name}
          </motion.h1>
          {c.tagline && <p className="mt-1 text-[15px] text-white/60">{c.tagline}</p>}
        </div>
      </div>

      {/* Описание */}
      <div className="relative z-10 px-8 lg:px-16">
        <div className="mb-10 flex flex-wrap items-center gap-x-8 gap-y-3">
          <p className="text-[12px] font-semibold tracking-[0.16em] text-[#e9d7a7]/85 uppercase">
            {ps.length} изделий
          </p>
          {range && (
            <p className="text-[12px] font-semibold tracking-[0.16em] text-white/45 uppercase">
              от {fmtPrice(range[0])} до {fmtPrice(range[1])}
            </p>
          )}
          <button
            onClick={onAssistant}
            className="ml-auto flex min-h-12 items-center gap-2 rounded-full bg-gradient-to-r from-[#1b2c6e] to-[#000d44] px-6 text-[12px] font-bold tracking-[0.16em] text-white uppercase shadow-[0_0_24px_rgba(27,44,110,0.5)] transition-transform active:scale-95"
          >
            <Mic size={16} />
            Рассказать голосом
          </button>
        </div>

        <div className="relative mb-10 max-w-3xl">
          <Sparkle size={22} className="absolute -left-8 top-0 hidden opacity-70 lg:block" color="#e9d7a7" />
          {c.description?.map((p, i) => (
            <p key={i} className="mb-4 text-[15.5px] leading-relaxed text-white/70">
              {p}
            </p>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {ps.map((p) => (
            <ProductCard
              key={p.slug}
              product={p}
              onClick={() => onOpenProduct(p.slug)}
              isFavorite={favorites.includes(p.slug)}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
