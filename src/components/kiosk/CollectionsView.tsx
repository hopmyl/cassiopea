"use client";

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { collections, collectionPriceRange, fmtPrice } from "@/lib/catalog";
import { Sparkles } from "./Sparkle";

export default function CollectionsView({
  onOpenCollection,
  onBack,
}: {
  onOpenCollection: (slug: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="no-select relative px-8 py-10 lg:px-16">
      <Sparkles count={12} />
      <button
        onClick={onBack}
        className="mb-6 flex min-h-11 items-center gap-2 text-[12px] font-semibold tracking-[0.16em] text-white/50 uppercase transition-colors hover:text-[#f7ecc9]"
      >
        <ArrowLeft size={15} /> На главную
      </button>
      <p className="tracked mb-2 text-[11px] text-[#e9d7a7]/70">Девять языков символов</p>
      <h1 className="font-display mb-3 text-[44px] font-semibold text-[#f3ead2]">Коллекции дома Cassiopea</h1>
      <p className="mb-10 max-w-2xl text-[15px] leading-relaxed text-white/55">
        Каждая коллекция — отдельная вселенная смысла: тайные шифры, карты
        созвездий, обереги и орбиты свободы. Выберите линию и попросите
        ассистента рассказать её историю.
      </p>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {collections.map((c, i) => {
          const range = collectionPriceRange(c.slug);
          return (
            <motion.button
              key={c.slug}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}
              onClick={() => onOpenCollection(c.slug)}
              className="group relative h-64 overflow-hidden rounded-2xl border border-white/8 text-left transition-colors hover:border-[rgba(233,215,167,0.45)]"
              aria-label={`Коллекция ${c.name}`}
            >
              {c.cover ? (
                 
                <img
                  src={c.cover}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover opacity-60 transition-all duration-700 group-hover:scale-105 group-hover:opacity-75"
                />
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(27,44,110,0.4),rgba(1,3,7,1))]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[rgba(1,3,7,0.96)] via-[rgba(1,3,7,0.4)] to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6">
                <h2 className="font-display text-[28px] leading-tight font-semibold text-[#f3ead2]">
                  {c.name}
                </h2>
                {c.tagline && (
                  <p className="mt-1 line-clamp-2 text-[13px] text-white/60">{c.tagline}</p>
                )}
                <p className="mt-3 text-[11.5px] font-semibold tracking-[0.16em] text-[#e9d7a7]/85 uppercase">
                  {c.products.length} изделий
                  {range ? ` · от ${fmtPrice(range[0])}` : ""}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
