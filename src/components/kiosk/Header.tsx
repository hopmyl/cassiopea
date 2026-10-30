"use client";

import { Sparkle } from "./Sparkle";
import { Heart, Mic, Camera } from "lucide-react";

export type ViewName = "home" | "collections" | "collection" | "catalog" | "product" | "about";

export default function Header({
  view,
  favoritesCount,
  onNavigate,
  onAssistant,
  onTryOn,
  onFavorites,
}: {
  view: ViewName;
  favoritesCount: number;
  onNavigate: (v: ViewName) => void;
  onAssistant: () => void;
  onTryOn: () => void;
  onFavorites: () => void;
}) {
  const items: Array<{ key: ViewName; label: string }> = [
    { key: "home", label: "Главная" },
    { key: "collections", label: "Коллекции" },
    { key: "catalog", label: "Каталог" },
    { key: "about", label: "О доме" },
  ];

  return (
    <header className="no-select glass-soft relative z-40 flex h-16 items-center justify-between gap-3 border-b border-white/8 px-5">
      <nav className="flex items-center gap-1" aria-label="Основная навигация">
        {items.map((it) => {
          const active =
            view === it.key ||
            (it.key === "catalog" && view === "product") ||
            (it.key === "collections" && view === "collection");
          return (
            <button
              key={it.key}
              onClick={() => onNavigate(it.key)}
              aria-current={active ? "page" : undefined}
              className={`tracked rounded-full px-4 py-2.5 text-[11px] font-semibold transition-colors min-h-11 ${
                active
                  ? "bg-[rgba(233,215,167,0.12)] text-[#f7ecc9]"
                  : "text-white/60 hover:text-white"
              }`}
            >
              {it.label}
            </button>
          );
        })}
      </nav>

      <button
        onClick={() => onNavigate("home")}
        className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2.5"
        aria-label="Cassiopea — на главную"
      >
        <Sparkle size={18} className="shimmer" color="#f7ecc9" />
        <span className="font-display text-[26px] font-semibold tracking-[0.32em] text-[#f3ead2]">
          CASSIOPEA
        </span>
        <Sparkle size={18} className="shimmer" color="#f7ecc9" />
      </button>

      <div className="flex items-center gap-1.5">
        <button
          onClick={onFavorites}
          className="relative flex min-h-11 min-w-11 items-center justify-center rounded-full text-white/70 transition-colors hover:text-[#f7ecc9]"
          aria-label={`Избранное, отмечено ${favoritesCount}`}
        >
          <Heart size={19} className={favoritesCount ? "fill-[#e9d7a7] text-[#e9d7a7]" : ""} />
          {favoritesCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[#e9d7a7] px-1 text-[10px] font-bold text-[#05070f]">
              {favoritesCount}
            </span>
          )}
        </button>
        <button
          onClick={onTryOn}
          className="flex min-h-11 items-center gap-2 rounded-full border border-[rgba(233,215,167,0.3)] px-4 text-[11px] font-semibold tracking-[0.18em] text-[#f7ecc9] uppercase transition-colors hover:bg-[rgba(233,215,167,0.1)]"
          aria-label="Виртуальная примерка"
        >
          <Camera size={16} />
          <span className="hidden lg:inline">Примерка</span>
        </button>
        <button
          onClick={onAssistant}
          className="flex min-h-11 items-center gap-2 rounded-full bg-gradient-to-r from-[#1b2c6e] to-[#000d44] px-4 text-[11px] font-semibold tracking-[0.18em] text-white uppercase shadow-[0_0_20px_rgba(27,44,110,0.5)] transition-transform active:scale-95"
          aria-label="Голосовой ассистент"
        >
          <Mic size={16} />
          <span className="hidden lg:inline">Ассистент</span>
        </button>
      </div>
    </header>
  );
}
