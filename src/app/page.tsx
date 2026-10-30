"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, Heart, Trash2 } from "lucide-react";
import StarField from "@/components/kiosk/StarField";
import Header, { type ViewName } from "@/components/kiosk/Header";
import HomeView from "@/components/kiosk/HomeView";
import CollectionsView from "@/components/kiosk/CollectionsView";
import CollectionView from "@/components/kiosk/CollectionView";
import CatalogView from "@/components/kiosk/CatalogView";
import ProductView from "@/components/kiosk/ProductView";
import AboutView from "@/components/kiosk/AboutView";
import AssistantOverlay from "@/components/kiosk/AssistantOverlay";
import TryOnView from "@/components/kiosk/TryOnView";
import { Sparkle } from "@/components/kiosk/Sparkle";
import type { AssistantAction } from "@/lib/assistant-engine";
import { bySlug, fmtPrice, collections } from "@/lib/catalog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const IDLE_MS = 180_000;

export default function Page() {
  const [view, setView] = useState<ViewName>("home");
  const [collectionSlug, setCollectionSlug] = useState<string | undefined>();
  const [productSlug, setProductSlug] = useState<string | undefined>();
  const [catalogSection, setCatalogSection] = useState<string | undefined>();
  const [catalogStone, setCatalogStone] = useState<string | undefined>();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [initialQuestion, setInitialQuestion] = useState<string | undefined>();
  const [tryOnOpen, setTryOnOpen] = useState(false);
  const [tryOnProduct, setTryOnProduct] = useState<string | undefined>();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favOpen, setFavOpen] = useState(false);
  const [clock, setClock] = useState("");
  const idleRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef(Date.now());
  const { toast } = useToast();

  // избранное
  useEffect(() => {
    try {
      const raw = localStorage.getItem("cassiopea-favs");
      if (raw) setFavorites(JSON.parse(raw));
    } catch {}
  }, []);
  const toggleFavorite = useCallback((slug: string) => {
    setFavorites((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug];
      try {
        localStorage.setItem("cassiopea-favs", JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // часы
  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  // kiosk: возврат на главную после простоя
  useEffect(() => {
    const reset = () => (lastActivityRef.current = Date.now());
    const events = ["pointerdown", "keydown", "wheel", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    const check = setInterval(() => {
      if (Date.now() - lastActivityRef.current > IDLE_MS) {
        lastActivityRef.current = Date.now();
        setAssistantOpen(false);
        setTryOnOpen(false);
        setFavOpen(false);
        setView("home");
        setProductSlug(undefined);
        setCollectionSlug(undefined);
      }
    }, 10_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      clearInterval(check);
    };
  }, []);

  const go = useCallback((v: ViewName) => {
    setView(v);
    if (v !== "product") setProductSlug(undefined);
    if (v !== "collection") setCollectionSlug(undefined);
    if (v === "catalog") {
      setCatalogSection(undefined);
      setCatalogStone(undefined);
    }
    window.scrollTo({ top: 0 });
  }, []);

  const openProduct = useCallback((slug: string) => {
    setView("product");
    setProductSlug(slug);
    window.scrollTo({ top: 0 });
  }, []);

  const openCollection = useCallback((slug: string) => {
    setView("collection");
    setCollectionSlug(slug);
    window.scrollTo({ top: 0 });
  }, []);

  const openCatalogFiltered = useCallback((section?: string, stone?: string) => {
    setCatalogSection(section);
    setCatalogStone(stone);
    setView("catalog");
    window.scrollTo({ top: 0 });
  }, []);

  const openAssistant = useCallback((question?: string) => {
    setInitialQuestion(question);
    setAssistantOpen(true);
  }, []);

  // действия ассистента → навигация
  const handleAssistantAction = useCallback(
    (a: AssistantAction) => {
      try {
        switch (a.type) {
          case "nav": {
            if (a.payload === "tryon") {
              setTryOnProduct(undefined);
              setTryOnOpen(true);
            } else if (a.payload === "favorites") {
              setFavOpen(true);
            } else if (a.payload && ["home", "collections", "catalog", "about"].includes(a.payload)) {
              go(a.payload as ViewName);
            }
            break;
          }
          case "collection":
            if (a.payload) openCollection(a.payload);
            break;
          case "product":
            if (a.payload) openProduct(a.payload);
            break;
          case "catalog": {
            const f = a.payload ? (JSON.parse(a.payload) as { section?: string; stone?: string }) : {};
            openCatalogFiltered(f.section, f.stone);
            break;
          }
        }
      } catch {}
    },
    [go, openCatalogFiltered, openCollection, openProduct],
  );

  return (
    <div className="relative min-h-screen bg-[#010307] text-[#e6e6e6]">
      {/* Космический фон */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <StarField />
        <div className="absolute left-1/2 top-[-10%] h-[60vh] w-[80vw] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(0,13,68,0.35),rgba(1,3,7,0)_60%)]" />
        <div className="absolute bottom-[-20%] left-[-10%] h-[50vh] w-[50vw] rounded-full bg-[radial-gradient(circle,rgba(0,13,68,0.22),rgba(1,3,7,0)_60%)]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <Header
          view={view}
          favoritesCount={favorites.length}
          onNavigate={go}
          onAssistant={() => openAssistant()}
          onTryOn={() => {
            setTryOnProduct(undefined);
            setTryOnOpen(true);
          }}
          onFavorites={() => setFavOpen(true)}
        />

        <main className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${view}-${collectionSlug || ""}-${productSlug || ""}-${catalogSection || ""}-${catalogStone || ""}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28 }}
            >
              {view === "home" && (
                <HomeView
                  onNavigate={go}
                  onOpenProduct={openProduct}
                  onOpenCollection={openCollection}
                  onAssistant={() => openAssistant()}
                  onTryOn={() => {
                    setTryOnProduct(undefined);
                    setTryOnOpen(true);
                  }}
                  favorites={favorites}
                  onToggleFavorite={toggleFavorite}
                />
              )}
              {view === "collections" && (
                <CollectionsView onOpenCollection={openCollection} onBack={() => go("home")} />
              )}
              {view === "collection" && collectionSlug && (
                <CollectionView
                  slug={collectionSlug}
                  onBack={() => go("collections")}
                  onOpenProduct={openProduct}
                  onAssistant={() =>
                    openAssistant(
                      `Расскажи о коллекции «${collections.find((c) => c.slug === collectionSlug)?.name || collectionSlug}»`,
                    )
                  }
                  favorites={favorites}
                  onToggleFavorite={toggleFavorite}
                />
              )}
              {view === "catalog" && (
                <CatalogView
                  initialSection={catalogSection}
                  initialStone={catalogStone}
                  onOpenProduct={openProduct}
                  favorites={favorites}
                  onToggleFavorite={toggleFavorite}
                />
              )}
              {view === "product" && productSlug && (
                <ProductView
                  slug={productSlug}
                  onBack={() => go("catalog")}
                  onOpenProduct={openProduct}
                  onOpenCollection={openCollection}
                  onAssistant={() => openAssistant("Расскажи об этом изделии подробно")}
                  onTryOn={(slug) => {
                    setTryOnProduct(slug);
                    setTryOnOpen(true);
                  }}
                  favorites={favorites}
                  onToggleFavorite={toggleFavorite}
                />
              )}
              {view === "about" && <AboutView onBack={() => go("home")} />}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="mt-auto border-t border-white/6 bg-black/30 px-8 py-4" style={{ marginTop: "auto" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Sparkle size={13} color="#e9d7a7" />
              <span className="text-[11px] tracking-[0.22em] text-white/40 uppercase">
                Ювелирный дом Cassiopea · интерактивный терминал зала
              </span>
            </div>
            <span className="text-[11px] tabular-nums tracking-widest text-white/35">{clock}</span>
          </div>
        </footer>
      </div>

      {/* Плавающая кнопка ассистента */}
      {!assistantOpen && !tryOnOpen && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.6, type: "spring", stiffness: 260, damping: 18 }}
          onClick={() => openAssistant()}
          className="no-select fixed bottom-6 right-6 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#1b2c6e] to-[#000d44] shadow-[0_0_36px_rgba(27,44,110,0.7)] transition-transform active:scale-95"
          aria-label="Спросить ассистента"
        >
          <span className="pulse-ring absolute inset-0 rounded-full border border-[#e9d7a7]/50" />
          <Mic size={24} className="text-white" />
        </motion.button>
      )}

      {/* Ассистент */}
      <AssistantOverlay
        open={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        onAction={handleAssistantAction}
        contextProductSlug={view === "product" ? productSlug : undefined}
        initialQuestion={initialQuestion}
      />

      {/* Примерка */}
      <TryOnView
        open={tryOnOpen}
        productSlug={tryOnProduct}
        onClose={() => setTryOnOpen(false)}
        onOpenProduct={openProduct}
      />

      {/* Избранное */}
      <Dialog open={favOpen} onOpenChange={setFavOpen}>
        <DialogContent className="glass max-h-[85vh] overflow-y-auto border-[rgba(233,215,167,0.25)] text-white">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-3 text-[28px] text-[#f3ead2]">
              <Heart size={22} className="fill-[#e9d7a7] text-[#e9d7a7]" />
              Избранное
            </DialogTitle>
          </DialogHeader>
          {favorites.length === 0 ? (
            <p className="py-8 text-center text-[14px] text-white/50">
              Отмечайте украшения сердечком — они соберутся здесь, и консультант подготовит их к вашему визиту.
            </p>
          ) : (
            <div className="space-y-3 py-2">
              {favorites.map((slug) => {
                const p = bySlug.get(slug);
                if (!p) return null;
                return (
                  <div key={slug} className="flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                    {p.preview && (
                       
                      <img src={p.preview} alt={p.name} className="h-16 w-16 rounded-xl object-contain" />
                    )}
                    <button onClick={() => { setFavOpen(false); openProduct(slug); }} className="min-w-0 flex-1 text-left">
                      <p className="font-display truncate text-[17px] text-[#f3ead2]">{p.name}</p>
                      <p className="text-[12px] text-white/50">{fmtPrice(p.price)}</p>
                    </button>
                    <button
                      onClick={() => toggleFavorite(slug)}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-white/40 hover:text-white"
                      aria-label="Убрать из избранного"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
              <BoutiqueRequest count={favorites.length} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BoutiqueRequest({ count }: { count: number }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const { toast } = useToast();
  return (
    <div className="rounded-2xl border border-[rgba(233,215,167,0.25)] bg-white/[0.04] p-5">
      <p className="mb-3 text-[13.5px] leading-relaxed text-white/65">
        Записаться на просмотр отобранных украшений ({count}) в бутике — консультант
        подтвердит время по телефону.
      </p>
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Имя"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-h-12 flex-1 border-white/15 bg-black/30 text-white placeholder:text-white/30"
        />
        <Input
          placeholder="Телефон"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="min-h-12 flex-1 border-white/15 bg-black/30 text-white placeholder:text-white/30"
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
          className="min-h-12 bg-gradient-to-r from-[#1b2c6e] to-[#000d44] px-6 text-[11px] font-bold uppercase tracking-[0.14em] hover:opacity-90"
        >
          Отправить
        </Button>
      </div>
    </div>
  );
}
