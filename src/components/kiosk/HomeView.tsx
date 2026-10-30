"use client";

import { motion } from "framer-motion";
import { Mic, Camera, ArrowRight } from "lucide-react";
import {
  collections,
  products,
  productsOfCollection,
  sectionCount,
  fmtPrice,
  SECTIONS,
  bySlug,
} from "@/lib/catalog";
import { Sparkle, Sparkles, Constellation } from "./Sparkle";
import ProductCard from "./ProductCard";
import type { ViewName } from "./Header";

const SECTION_META: Record<string, { hint: string }> = {
  Кольца: { hint: "от обручальных до звёздных перстней" },
  Серьги: { hint: "пусеты, каффы, вечерние пары" },
  Подвески: { hint: "шифры, знаки, обереги" },
  Браслеты: { hint: "орбитальные композиции" },
};

export default function HomeView({
  onNavigate,
  onOpenProduct,
  onOpenCollection,
  onAssistant,
  onTryOn,
  favorites,
  onToggleFavorite,
}: {
  onNavigate: (v: ViewName) => void;
  onOpenProduct: (slug: string) => void;
  onOpenCollection: (slug: string) => void;
  onAssistant: () => void;
  onTryOn: () => void;
  favorites: string[];
  onToggleFavorite: (slug: string) => void;
}) {
  const featured = bySlug.get("koltso-i-m-cassiopea") || products[0];
  const topPrices = products.slice().sort((a, b) => (b.price || 0) - (a.price || 0)).slice(0, 4);
  const letters = productsOfCollection("azbuka-morze").slice(0, 4);

  return (
    <div className="no-select">
      {/* ---------- HERO ---------- */}
      <section className="relative flex min-h-[calc(100vh-4rem)] items-center overflow-hidden px-8 lg:px-16">
        <Sparkles count={18} />
        <div className="absolute -right-40 top-1/4 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(27,44,110,0.5),rgba(1,3,7,0)_65%)]" />
        <div className="absolute -left-32 bottom-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(0,13,68,0.55),rgba(1,3,7,0)_65%)]" />

        <div className="relative z-10 grid w-full grid-cols-1 items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <div className="mb-5 flex items-center gap-3">
              <Constellation size={70} />
              <p className="tracked text-[11px] text-white/50">
                Ювелирный дом · Россия · с 2024
              </p>
            </div>
            <h1 className="font-display text-[56px] leading-[1.02] font-semibold text-[#f3ead2] lg:text-[76px]">
              Ближе к звёздам.
              <br />
              <span className="gold-text">Украшения</span> с&nbsp;личным
              <br />
              смыслом
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/60">
              Девять коллекций, 136 изделий из золота 750 пробы и природных
              бриллиантов. Попросите ассистента рассказать о любом украшении —
              или примерьте его прямо здесь, с фронтальной камерой.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={onAssistant}
                className="group flex min-h-14 items-center gap-3 rounded-full bg-gradient-to-r from-[#1b2c6e] to-[#000d44] px-7 text-[13px] font-bold tracking-[0.18em] text-white uppercase shadow-[0_0_36px_rgba(27,44,110,0.6)] transition-transform active:scale-95"
              >
                <Mic size={18} className="transition-transform group-hover:scale-110" />
                Спросить ассистента
              </button>
              <button
                onClick={onTryOn}
                className="gold-border flex min-h-14 items-center gap-3 rounded-full px-7 text-[13px] font-bold tracking-[0.18em] text-[#f7ecc9] uppercase transition-colors hover:bg-[rgba(233,215,167,0.1)] active:scale-95"
              >
                <Camera size={18} />
                Виртуальная примерка
              </button>
              <button
                onClick={() => onNavigate("collections")}
                className="flex min-h-14 items-center gap-2 rounded-full px-6 text-[13px] font-semibold tracking-[0.14em] text-white/60 uppercase transition-colors hover:text-white"
              >
                Все коллекции
                <ArrowRight size={16} />
              </button>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-10 gap-y-3">
              {[
                ["9", "коллекций"],
                ["136", "изделий"],
                ["750", "проба золота"],
                ["2024", "бренд года по версии Fashion TV"],
              ].map(([n, label]) => (
                <div key={label} className="flex items-baseline gap-2">
                  <span className="font-display text-[30px] font-semibold text-[#f7ecc9]">{n}</span>
                  <span className="max-w-36 text-[11px] leading-tight text-white/45">{label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Плавающее изделие */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
            className="relative hidden items-center justify-center lg:flex"
          >
            <div className="absolute h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(27,44,110,0.4),rgba(1,3,7,0)_62%)]" />
            <Sparkle size={30} className="sparkle-anim absolute -left-4 top-8" />
            <Sparkle size={18} className="sparkle-anim absolute right-6 top-24" style={{ animationDelay: "1.2s" }} />
            <Sparkle size={22} className="sparkle-anim absolute bottom-10 left-16" style={{ animationDelay: "2s" }} />
            {featured?.preview && (
              <button
                onClick={() => onOpenProduct(featured.slug)}
                className="group relative"
                aria-label={`Открыть ${featured.name}`}
              >
                { }
                <img
                  src={featured.preview}
                  alt={featured.name}
                  className="jewel-glow float-y max-h-[430px] object-contain transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-[rgba(233,215,167,0.3)] bg-black/50 px-5 py-2 text-[12px] tracking-wide text-[#f7ecc9] backdrop-blur">
                  {featured.name} · {fmtPrice(featured.price)}
                </span>
              </button>
            )}
          </motion.div>
        </div>
      </section>

      {/* ---------- КАТЕГОРИИ ---------- */}
      <section className="relative px-8 py-14 lg:px-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="tracked mb-2 text-[11px] text-[#e9d7a7]/70">Творения дома</p>
            <h2 className="font-display text-[36px] font-semibold text-[#f3ead2]">Категории украшений</h2>
          </div>
          <button
            onClick={() => onNavigate("catalog")}
            className="flex min-h-11 items-center gap-2 text-[12px] font-semibold tracking-[0.16em] text-white/50 uppercase transition-colors hover:text-[#f7ecc9]"
          >
            Весь каталог <ArrowRight size={15} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {SECTIONS.map((s, i) => (
            <motion.button
              key={s}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
              onClick={() => onNavigate("catalog")}
              className="group relative overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-b from-[rgba(10,15,32,0.65)] to-[rgba(2,4,10,0.8)] p-6 text-left transition-colors hover:border-[rgba(233,215,167,0.4)]"
            >
              <Sparkle
                size={44}
                className="mb-6 opacity-80 transition-transform duration-500 group-hover:rotate-45 group-hover:scale-110"
                color="#e9d7a7"
              />
              <h3 className="font-display text-[26px] font-semibold text-[#f3ead2]">{s}</h3>
              <p className="mt-1 text-[12.5px] text-white/45">{SECTION_META[s]?.hint}</p>
              <p className="mt-4 text-[12px] font-semibold tracking-[0.14em] text-[#e9d7a7]/80 uppercase">
                {sectionCount(s)} изделий
              </p>
            </motion.button>
          ))}
        </div>
      </section>

      {/* ---------- КОЛЛЕКЦИИ ---------- */}
      <section className="relative px-8 pb-14 lg:px-16">
        <div className="mb-8">
          <p className="tracked mb-2 text-[11px] text-[#e9d7a7]/70">Языки символов</p>
          <h2 className="font-display text-[36px] font-semibold text-[#f3ead2]">Коллекции дома</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.slice(0, 6).map((c, i) => (
            <motion.button
              key={c.slug}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: (i % 3) * 0.08 }}
              onClick={() => onOpenCollection(c.slug)}
              className="group relative h-52 overflow-hidden rounded-2xl border border-white/8 text-left transition-colors hover:border-[rgba(233,215,167,0.4)]"
            >
              {c.cover && (
                 
                <img
                  src={c.cover}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover opacity-55 transition-all duration-700 group-hover:scale-105 group-hover:opacity-70"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[rgba(1,3,7,0.95)] via-[rgba(1,3,7,0.35)] to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <h3 className="font-display text-[24px] font-semibold text-[#f3ead2]">{c.name}</h3>
                {c.tagline && <p className="mt-0.5 line-clamp-1 text-[12.5px] text-white/55">{c.tagline}</p>}
                <p className="mt-2 text-[11px] font-semibold tracking-[0.16em] text-[#e9d7a7]/80 uppercase">
                  {c.products.length} изделий →
                </p>
              </div>
            </motion.button>
          ))}
          <button
            onClick={() => onNavigate("collections")}
            className="group flex h-52 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[rgba(233,215,167,0.3)] transition-colors hover:bg-[rgba(233,215,167,0.06)]"
          >
            <Sparkle size={30} color="#e9d7a7" />
            <span className="text-[13px] font-semibold tracking-[0.18em] text-[#f7ecc9] uppercase">
              Все 9 коллекций
            </span>
          </button>
        </div>
      </section>

      {/* ---------- ТОП ЦЕНЫ ---------- */}
      <section className="relative px-8 pb-16 lg:px-16">
        <div className="mb-8">
          <p className="tracked mb-2 text-[11px] text-[#e9d7a7]/70">Высокое ювелирное искусство</p>
          <h2 className="font-display text-[36px] font-semibold text-[#f3ead2]">Звёзды каталога</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {topPrices.map((p) => (
            <ProductCard
              key={p.slug}
              product={p}
              onClick={() => onOpenProduct(p.slug)}
              isFavorite={favorites.includes(p.slug)}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      </section>

      {/* ---------- ЛЕНТА БУКВ ---------- */}
      <section className="relative overflow-hidden border-t border-white/6 px-8 py-14 lg:px-16">
        <Sparkles count={10} />
        <div className="relative z-10 flex flex-col items-center text-center">
          <p className="tracked mb-3 text-[11px] text-[#e9d7a7]/70">Новинка · драгоценный шифр</p>
          <h2 className="font-display text-[34px] font-semibold text-[#f3ead2]">
            «Азбука Морзе» — смысл без слов
          </h2>
          <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-white/55">
            Код из точек и тире, выложенный природными бриллиантами, хранит
            имя того, кого любишь, заветную мечту или часть души.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {letters.map((p) => (
              <button
                key={p.slug}
                onClick={() => onOpenProduct(p.slug)}
                className="group flex h-40 w-40 flex-col items-center justify-center rounded-2xl border border-white/8 bg-black/30 p-3 transition-colors hover:border-[rgba(233,215,167,0.4)]"
              >
                {p.preview && (
                   
                  <img
                    src={p.preview}
                    alt={p.name}
                    loading="lazy"
                    className="jewel-glow h-24 w-24 object-contain transition-transform duration-500 group-hover:scale-110"
                  />
                )}
                <span className="mt-2 line-clamp-1 text-[12px] text-white/55">{fmtPrice(p.price)}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => onOpenCollection("azbuka-morze")}
            className="gold-border mt-8 flex min-h-12 items-center gap-2 rounded-full px-7 text-[12px] font-bold tracking-[0.18em] text-[#f7ecc9] uppercase transition-colors hover:bg-[rgba(233,215,167,0.1)]"
          >
            Смотреть коллекцию <ArrowRight size={15} />
          </button>
        </div>
      </section>
    </div>
  );
}
