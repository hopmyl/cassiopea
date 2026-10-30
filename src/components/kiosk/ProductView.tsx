"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Mic, Camera, Heart, MapPin } from "lucide-react";
import {
  bySlug,
  fmtPrice,
  similarProducts,
  collections as allCollections,
} from "@/lib/catalog";
import ProductCard from "./ProductCard";
import { Sparkle } from "./Sparkle";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function ProductView({
  slug,
  onBack,
  onOpenProduct,
  onOpenCollection,
  onAssistant,
  onTryOn,
  favorites,
  onToggleFavorite,
}: {
  slug: string;
  onBack: () => void;
  onOpenProduct: (slug: string) => void;
  onOpenCollection: (slug: string) => void;
  onAssistant: () => void;
  onTryOn: (productSlug: string) => void;
  favorites: string[];
  onToggleFavorite: (slug: string) => void;
}) {
  const p = bySlug.get(slug);
  const [photoIdx, setPhotoIdx] = useState(0);
  const { toast } = useToast();

  if (!p) return null;
  const photos = [p.preview, ...p.photos].filter(Boolean) as string[];
  const active = photos[Math.min(photoIdx, photos.length - 1)];
  const isFav = favorites.includes(p.slug);
  const similar = similarProducts(p, 4);
  const tryable = p.section === "Серьги" || p.section === "Подвески";
  const cols = allCollections.filter((c) => p.collections.includes(c.slug));

  const chEntries = Object.entries(p.characteristics || {});

  return (
    <div className="no-select relative px-8 py-8 lg:px-16">
      <button
        onClick={onBack}
        className="mb-6 flex min-h-11 items-center gap-2 text-[12px] font-semibold tracking-[0.16em] text-white/50 uppercase transition-colors hover:text-[#f7ecc9]"
      >
        <ArrowLeft size={15} /> Назад
      </button>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        {/* Галерея */}
        <div>
          <div className="relative flex h-[480px] items-center justify-center overflow-hidden rounded-3xl border border-white/8 bg-[radial-gradient(ellipse_at_center,rgba(27,44,110,0.35),rgba(1,3,7,0)_72%)]">
            <Sparkle size={20} className="sparkle-anim absolute left-8 top-8" />
            <Sparkle size={14} className="sparkle-anim absolute right-12 top-16" style={{ animationDelay: "1s" }} />
            <Sparkle size={16} className="sparkle-anim absolute bottom-10 right-24" style={{ animationDelay: "1.8s" }} />
            <AnimatePresence mode="wait">
              <motion.img
                key={active}
                src={active}
                alt={p.name}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="jewel-glow float-y max-h-full max-w-full object-contain p-8"
              />
            </AnimatePresence>
          </div>
          {photos.length > 1 && (
            <div className="mt-4 flex gap-3">
              {photos.map((ph, i) => (
                <button
                  key={ph}
                  onClick={() => setPhotoIdx(i)}
                  className={`h-20 w-20 overflow-hidden rounded-xl border transition-colors ${
                    i === photoIdx
                      ? "border-[rgba(233,215,167,0.6)]"
                      : "border-white/10 hover:border-white/30"
                  }`}
                  aria-label={`Фото ${i + 1}`}
                >
                  { }
                  <img src={ph} alt="" loading="lazy" className="h-full w-full object-contain p-1.5" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Инфо */}
        <div>
          {cols.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {cols.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => onOpenCollection(c.slug)}
                  className="rounded-full border border-[rgba(233,215,167,0.35)] px-4 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[#f7ecc9] uppercase transition-colors hover:bg-[rgba(233,215,167,0.1)]"
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <h1 className="font-display text-[42px] leading-tight font-semibold text-[#f3ead2]">{p.name}</h1>
          <p className="mt-2 text-[14px] text-white/50">
            {[p.metal, p.stone].filter(Boolean).join(" · ")}
          </p>
          <p className="gold-text mt-5 text-[34px] font-bold tracking-wide">{fmtPrice(p.price)}</p>

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              onClick={onAssistant}
              className="flex min-h-13 items-center gap-2.5 rounded-full bg-gradient-to-r from-[#1b2c6e] to-[#000d44] px-6 text-[12px] font-bold tracking-[0.14em] text-white uppercase shadow-[0_0_28px_rgba(27,44,110,0.55)] transition-transform active:scale-95"
            >
              <Mic size={17} />
              Рассказать голосом
            </button>
            {tryable && (
              <button
                onClick={() => onTryOn(p.slug)}
                className="gold-border flex min-h-13 items-center gap-2.5 rounded-full px-6 text-[12px] font-bold tracking-[0.14em] text-[#f7ecc9] uppercase transition-colors hover:bg-[rgba(233,215,167,0.1)]"
              >
                <Camera size={17} />
                Примерить
              </button>
            )}
            <button
              onClick={() => onToggleFavorite(p.slug)}
              className="flex min-h-13 items-center gap-2.5 rounded-full border border-white/15 px-6 text-[12px] font-bold tracking-[0.14em] text-white/70 uppercase transition-colors hover:text-white"
            >
              <Heart size={17} className={isFav ? "fill-[#e9d7a7] text-[#e9d7a7]" : ""} />
              {isFav ? "В избранном" : "В избранное"}
            </button>

            <Dialog>
              <DialogTrigger asChild>
                <button className="flex min-h-13 items-center gap-2.5 rounded-full border border-white/15 px-6 text-[12px] font-bold tracking-[0.14em] text-white/70 uppercase transition-colors hover:text-white">
                  <MapPin size={17} />
                  Записаться в бутик
                </button>
              </DialogTrigger>
              <DialogContent className="glass border-[rgba(233,215,167,0.25)] text-white">
                <DialogHeader>
                  <DialogTitle className="font-display text-[26px] text-[#f3ead2]">
                    Просмотр в бутике
                  </DialogTitle>
                </DialogHeader>
                <BoutiqueForm productName={p.name} />
              </DialogContent>
            </Dialog>
          </div>

          {/* Характеристики */}
          <div className="mt-9">
            <h2 className="tracked mb-4 text-[12px] text-[#e9d7a7]/80">Характеристики</h2>
            <dl className="overflow-hidden rounded-2xl border border-white/8">
              <div className="grid grid-cols-2 gap-4 bg-white/[0.03] px-5 py-3.5 text-[13.5px]">
                <dt className="text-white/45">Категория</dt>
                <dd className="text-white/85">{p.section}</dd>
              </div>
              {p.metal && (
                <div className="grid grid-cols-2 gap-4 border-t border-white/6 px-5 py-3.5 text-[13.5px]">
                  <dt className="text-white/45">Металл</dt>
                  <dd className="text-white/85">{p.metal}{p.characteristics["Проба"] ? `, проба ${p.characteristics["Проба"]}` : ""}</dd>
                </div>
              )}
              {p.stone && (
                <div className="grid grid-cols-2 gap-4 border-t border-white/6 px-5 py-3.5 text-[13.5px]">
                  <dt className="text-white/45">Вставка</dt>
                  <dd className="text-white/85">{p.stone}</dd>
                </div>
              )}
              {chEntries.map(([k, v]) => (
                <div key={k} className="grid grid-cols-2 gap-4 border-t border-white/6 px-5 py-3.5 text-[13.5px]">
                  <dt className="text-white/45">{k}</dt>
                  <dd className="text-white/85">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* Похожие */}
      {similar.length > 0 && (
        <div className="mt-16">
          <h2 className="font-display mb-6 text-[30px] font-semibold text-[#f3ead2]">
            Гармонирует по стилю
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {similar.map((s) => (
              <ProductCard
                key={s.slug}
                product={s}
                onClick={() => {
                  setPhotoIdx(0);
                  onOpenProduct(s.slug);
                }}
                isFavorite={favorites.includes(s.slug)}
                onToggleFavorite={onToggleFavorite}
                compact
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BoutiqueForm({ productName }: { productName: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const { toast } = useToast();

  return (
    <div className="space-y-4">
      <p className="text-[13.5px] leading-relaxed text-white/60">
        Консультант дома подготовит <span className="text-[#f7ecc9]">«{productName}»</span> к вашему
        визиту и подтвердит время по телефону.
      </p>
      <Input
        placeholder="Ваше имя"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="border-white/15 bg-black/30 text-white placeholder:text-white/30"
      />
      <Input
        placeholder="Телефон"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="border-white/15 bg-black/30 text-white placeholder:text-white/30"
      />
      <Button
        disabled={!name.trim() || phone.trim().length < 6}
        onClick={() => {
          toast({
            title: "Заявка отправлена",
            description: "Консультант Cassiopea свяжется с вами в течение 15 минут.",
          });
          setName("");
          setPhone("");
        }}
        className="min-h-12 w-full bg-gradient-to-r from-[#1b2c6e] to-[#000d44] text-[12px] font-bold tracking-[0.16em] uppercase hover:opacity-90"
      >
        Отправить заявку
      </Button>
    </div>
  );
}
