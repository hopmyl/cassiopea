"use client";

import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { fmtPrice, type Product } from "@/lib/catalog";
import { Sparkle } from "./Sparkle";

export default function ProductCard({
  product,
  onClick,
  isFavorite,
  onToggleFavorite,
  compact = false,
}: {
  product: Product;
  onClick: () => void;
  isFavorite: boolean;
  onToggleFavorite: (slug: string) => void;
  compact?: boolean;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      onClick={onClick}
      className="no-select group relative flex flex-col rounded-2xl border border-white/8 bg-gradient-to-b from-[rgba(10,15,32,0.6)] to-[rgba(3,5,12,0.75)] p-4 text-left transition-colors hover:border-[rgba(233,215,167,0.35)]"
      aria-label={`${product.name}, ${fmtPrice(product.price)}`}
    >
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(product.slug);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
            onToggleFavorite(product.slug);
          }
        }}
        className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/30 transition-colors"
        aria-label={isFavorite ? "Убрать из избранного" : "В избранное"}
      >
        <Heart size={17} className={isFavorite ? "fill-[#e9d7a7] text-[#e9d7a7]" : "text-white/50"} />
      </span>

      <div className={`relative mb-3 flex ${compact ? "h-40" : "h-56"} items-center justify-center overflow-hidden rounded-xl bg-[radial-gradient(ellipse_at_center,rgba(27,44,110,0.35),rgba(1,3,7,0)_70%)]`}>
        {product.preview ? (
           
          <img
            src={product.preview}
            alt={product.name}
            loading="lazy"
            className="jewel-glow float-y max-h-full max-w-full object-contain p-3 transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <Sparkle size={40} color="rgba(233,215,167,0.4)" />
        )}
      </div>

      <h3 className="font-display mb-1 line-clamp-1 text-[19px] font-semibold text-[#f3ead2]">
        {product.name}
      </h3>
      <p className="mb-2 line-clamp-1 text-[12.5px] text-white/50">
        {[product.metal, product.stone].filter(Boolean).join(", ") || "Золото, бриллианты"}
      </p>
      <p className="gold-text mt-auto text-[16px] font-bold tracking-wide">{fmtPrice(product.price)}</p>
    </motion.button>
  );
}
