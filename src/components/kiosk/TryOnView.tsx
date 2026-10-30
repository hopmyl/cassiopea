"use client";

/**
 * Виртуальная примерка Cassiopea: фронтальная камера + отслеживание лица
 * (MediaPipe FaceLandmarker) + наложение украшений с прозрачным фоном.
 * Если модель не загрузилась — ручной режим с ползунками и перетаскиванием.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Camera, CameraOff, RotateCcw, Download, Sparkles as SparklesIcon,
  Hand, Loader2, Move,
} from "lucide-react";
import { products, type Product } from "@/lib/catalog";
import { Sparkle } from "./Sparkle";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";

const MP_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const MP_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

type Mode = "picker" | "try" | "captured";
type TrackState = "off" | "loading" | "on" | "manual" | "error";

export default function TryOnView({
  open,
  productSlug,
  onClose,
  onOpenProduct,
}: {
  open: boolean;
  productSlug?: string;
  onClose: () => void;
  onOpenProduct: (slug: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("picker");
  const [selected, setSelected] = useState<Product | null>(null);
  const [track, setTrack] = useState<TrackState>("off");
  const [error, setError] = useState<string | null>(null);
  const [capture, setCapture] = useState<string | null>(null);
  const [manualScale, setManualScale] = useState(1);
  const [manualX, setManualX] = useState(0);
  const [manualY, setManualY] = useState(0.12);
  const [mpReady, setMpReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLImageElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<any>(null);
  const rafRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const posRef = useRef({ left: { x: 0.5, y: 0.6 }, right: { x: 0.5, y: 0.6 }, chin: { x: 0.5, y: 0.75 }, faceW: 0.28 });
  const { toast } = useToast();

  const tryable = products.filter(
    (p) => (p.section === "Серьги" || p.section === "Подвески") && p.preview,
  );

  // ---------- камера ----------
  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setTrack("off");
  }, []);

  const startCamera = useCallback(async () => {
    setTrack("loading");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setTrack("on");
    } catch (e: any) {
      const msg =
        e?.name === "NotAllowedError"
          ? "Доступ к камере запрещён. Разрешите камеру в настройках браузера и повторите."
          : e?.name === "NotFoundError"
            ? "Камера не найдена на этом устройстве."
            : "Камера недоступна. Попробуйте перезапустить терминал.";
      setError(msg);
      setTrack("error");
    }
  }, []);

  // ---------- MediaPipe ----------
  const ensureLandmarker = useCallback(async () => {
    if (landmarkerRef.current) return landmarkerRef.current;
    const vision = await import(/* webpackIgnore: true */ `${MP_CDN}/vision_bundle.mjs`);
    const fileset = await vision.FilesetResolver.forVisionTasks(`${MP_CDN}/wasm`);
    const fl = await vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MP_MODEL, delegate: "GPU" },
      runningMode: "VIDEO",
      numFaces: 1,
    });
    landmarkerRef.current = fl;
    setMpReady(true);
    return fl;
  }, []);

  // Перевод нормализованных координат видео (object-cover) в координаты контейнера
  const mapPoint = useCallback(
    (p: { x: number; y: number }) => {
      const video = videoRef.current;
      const box = containerRef.current;
      if (!video || !box) return p;
      const vw = video.videoWidth || 1280;
      const vh = video.videoHeight || 960;
      const bw = box.clientWidth;
      const bh = box.clientHeight;
      const scale = Math.max(bw / vw, bh / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      const ox = (bw - dw) / 2;
      const oy = (bh - dh) / 2;
      return { x: (p.x * dw + ox) / bw, y: (p.y * dh + oy) / bh };
    },
    [],
  );

  const loop = useCallback(async () => {
    const video = videoRef.current;
    const fl = landmarkerRef.current;
    if (video && fl && video.readyState >= 2) {
      if (video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;
        try {
          const res = fl.detectForVideo(video, performance.now());
          const lms = res?.faceLandmarks?.[0];
          if (lms && lms.length > 460) {
            // 177/401 — контур у ушей, 152 — подбородок, 234/454 — ширина лица
            posRef.current = {
              left: mapPoint(lms[177]),
              right: mapPoint(lms[401]),
              chin: mapPoint(lms[152]),
              faceW: Math.abs(mapPoint(lms[454]).x - mapPoint(lms[234]).x),
            };
          }
        } catch {}
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [mapPoint]);

  const enableTracking = useCallback(async () => {
    try {
      await ensureLandmarker();
      setTrack("on");
      setMpReady(true);
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(loop);
    } catch {
      setTrack("manual");
      toast({
        title: "Автоматическое отслеживание недоступно",
        description: "Включён ручной режим — украсьте образ ползунками и перетаскиванием.",
      });
    }
  }, [ensureLandmarker, loop, toast]);

  // ---------- жизненный цикл ----------
  useEffect(() => {
    if (!open) {
      stopCamera();
      setMode("picker");
      setSelected(null);
      setCapture(null);
      return;
    }
    if (productSlug) {
      const p = products.find((x) => x.slug === productSlug);
      if (p) {
        setSelected(p);
        setMode("try");
        startCamera().then(() => enableTracking());
      }
    }
     
  }, [open, productSlug]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // ---------- позиционирование оверлея ----------
  const overlayStyle = (): React.CSSProperties => {
    if (!selected) return {};
    const pos = posRef.current;
    if (track === "on" && mpReady) {
      if (selected.section === "Серьги") {
        const cx = (pos.left.x + pos.right.x) / 2;
        const cy = (pos.left.y + pos.right.y) / 2;
        const w = Math.max(0.16, pos.faceW * 1.55);
        return {
          left: `${cx * 100}%`,
          top: `${cy * 100}%`,
          width: `${w * 100}%`,
          transform: "translate(-50%, -38%)",
        };
      }
      // Подвеска — ниже подбородка
      const w = Math.max(0.12, pos.faceW * 1.05);
      return {
        left: `${pos.chin.x * 100}%`,
        top: `${pos.chin.y * 100}%`,
        width: `${w * 100}%`,
        transform: "translate(-50%, -12%)",
      };
    }
    // Ручной режим
    const w = selected.section === "Серьги" ? 0.34 : 0.2;
    return {
      left: `${(0.5 + manualX) * 100}%`,
      top: `${(0.55 + manualY) * 100}%`,
      width: `${w * manualScale * 100}%`,
      transform: "translate(-50%, -50%)",
    };
  };

  // ---------- снимок ----------
  const captureShot = useCallback(() => {
    const video = videoRef.current;
    const box = containerRef.current;
    const img = overlayRef.current;
    if (!video || !box) return;
    const w = box.clientWidth;
    const h = box.clientHeight;
    const canvas = document.createElement("canvas");
    canvas.width = w * 2;
    canvas.height = h * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(2, 2);
    // зеркалим как на экране
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 960;
    const scale = Math.max(w / vw, h / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    ctx.drawImage(video, (w - dw) / 2, (h - dh) / 2, dw, dh);
    if (img && img.complete && img.naturalWidth) {
      const st = overlayStyle();
      const width = (parseFloat(String(st.width)) / 100) * w;
      const left = (parseFloat(String(st.left)) / 100) * w;
      const top = (parseFloat(String(st.top)) / 100) * h;
      const height = width * (img.naturalHeight / img.naturalWidth);
      // совпадаем со смещением transform на экране
      let centerY = top;
      if (track === "on" && mpReady) {
        centerY = selected.section === "Серьги" ? top + height * 0.12 : top + height * 0.38;
      }
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, w - left - width / 2, centerY - height / 2, width, height);
      ctx.restore();
    }
    // водяной знак
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.fillStyle = "rgba(1,3,7,0.55)";
    ctx.fillRect(w - 250, h - 64, 230, 40);
    ctx.fillStyle = "#f7ecc9";
    ctx.font = "600 18px serif";
    ctx.fillText("CASSIOPEA", w - 234, h - 38);
    ctx.restore();
    setCapture(canvas.toDataURL("image/jpeg", 0.92));
    setMode("captured");
    stopCamera();
  }, [overlayStyle, stopCamera]);

  const closeCapture = () => {
    setCapture(null);
    setMode("try");
    startCamera().then(() => (mpReady ? setTrack("on") : enableTracking()));
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col bg-[rgba(1,2,6,0.92)] backdrop-blur-xl"
        role="dialog"
        aria-label="Виртуальная примерка"
      >
        {/* Шапка */}
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
          <div>
            <h2 className="font-display text-[26px] font-semibold text-[#f3ead2]">Виртуальная примерка</h2>
            <p className="text-[12px] text-white/45">
              {mode === "picker"
                ? "Выберите серьги или подвеску из каталога"
                : selected
                  ? `${selected.name} · ${selected.section}`
                  : ""}
            </p>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white/60 hover:text-white"
            aria-label="Закрыть примерку"
          >
            <X size={22} />
          </button>
        </div>

        {/* Выбор изделия */}
        {mode === "picker" && (
          <div className="chat-scroll flex-1 overflow-y-auto px-6 py-6">
            <div className="mx-auto max-w-5xl">
              <div className="mb-6 flex items-center gap-3 rounded-2xl border border-[rgba(233,215,167,0.25)] bg-white/[0.03] p-5">
                <Sparkle size={22} color="#e9d7a7" />
                <p className="text-[13.5px] leading-relaxed text-white/65">
                  Примерка работает с фронтальной камерой планшета: смотрите в экран — и
                  украшение появится на вас. Изображения не сохраняются и никуда не
                  передаются: снимок остаётся только на этом устройстве.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
                {tryable.map((p) => (
                  <button
                    key={p.slug}
                    onClick={() => {
                      setSelected(p);
                      setMode("try");
                      startCamera().then(() => enableTracking());
                    }}
                    className="group flex flex-col items-center rounded-2xl border border-white/8 bg-white/[0.03] p-4 transition-colors hover:border-[rgba(233,215,167,0.45)]"
                  >
                    <div className="flex h-28 items-center justify-center">
                      { }
                      <img
                        src={p.preview!}
                        alt={p.name}
                        loading="lazy"
                        className="jewel-glow max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-110"
                      />
                    </div>
                    <span className="mt-2 line-clamp-1 text-[12px] text-white/60">{p.name}</span>
                    <span className="text-[11px] text-[#e9d7a7]/70">{p.section}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Камера */}
        {mode === "try" && (
          <div className="relative flex flex-1 items-center justify-center overflow-hidden">
            <div
              ref={containerRef}
              className="relative h-full w-full"
              style={{ transform: "scaleX(-1)" }}
            >
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="h-full w-full object-cover"
              />
              {/* затемнение-виньетка */}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(1,3,7,0.55))]" />
              {selected?.preview && (
                <div style={{ transform: "scaleX(-1)" }} className="absolute inset-0">
                  { }
                  <img
                    ref={overlayRef}
                    src={selected.preview}
                    alt={selected.name}
                    className="pointer-events-none absolute jewel-glow"
                    style={overlayStyle()}
                    draggable={false}
                  />
                </div>
              )}
              {/* бренд */}
              <div
                className="pointer-events-none absolute bottom-5 right-6 flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 backdrop-blur"
                style={{ transform: "scaleX(-1)" }}
              >
                <Sparkle size={14} color="#f7ecc9" />
                <span className="text-[12px] font-semibold tracking-[0.22em] text-[#f7ecc9]">CASSIOPEA</span>
              </div>
            </div>

            {/* статус камеры */}
            {track === "loading" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
                <Loader2 size={34} className="animate-spin text-[#e9d7a7]" />
                <p className="text-[13.5px] text-white/70">Включаю камеру и загружаю отслеживание лица…</p>
              </div>
            )}
            {track === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 px-10 text-center">
                <CameraOff size={38} className="text-[#e9d7a7]" />
                <p className="max-w-md text-[14px] leading-relaxed text-white/75">{error}</p>
                <div className="flex gap-3">
                  <button
                    onClick={startCamera}
                    className="min-h-12 rounded-full bg-gradient-to-r from-[#1b2c6e] to-[#000d44] px-6 text-[12px] font-bold uppercase tracking-[0.14em] text-white"
                  >
                    Повторить
                  </button>
                  <button
                    onClick={() => {
                      setMode("picker");
                      setSelected(null);
                    }}
                    className="gold-border min-h-12 rounded-full px-6 text-[12px] font-bold uppercase tracking-[0.14em] text-[#f7ecc9]"
                  >
                    Другое изделие
                  </button>
                </div>
              </div>
            )}

            {/* панель управления */}
            <div className="absolute inset-x-0 bottom-0 z-10" style={{ transform: "scaleX(-1)" }}>
              <div
                className="glass mx-auto mb-5 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-3 rounded-3xl px-6 py-4"
              >
                <span className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ transform: "scaleX(-1)" }}>
                  {track === "on" ? (
                    <>
                      <SparklesIcon size={14} className="text-[#e9d7a7]" /> Отслеживание лица
                    </>
                  ) : (
                    <>
                      <Hand size={14} className="text-[#e9d7a7]" /> Ручной режим
                    </>
                  )}
                </span>
                <div className="flex w-44 items-center gap-3" style={{ transform: "scaleX(-1)" }}>
                  <span className="text-[11px] text-white/50" style={{ transform: "scaleX(-1)" }}>Размер</span>
                  <Slider
                    value={[manualScale]}
                    min={0.4}
                    max={2.2}
                    step={0.05}
                    onValueChange={(v) => {
                      setTrack("manual");
                      setManualScale(v[0]);
                    }}
                    aria-label="Размер украшения"
                  />
                </div>
                <div className="flex w-44 items-center gap-3" style={{ transform: "scaleX(-1)" }}>
                  <span className="text-[11px] text-white/50" style={{ transform: "scaleX(-1)" }}>Высота</span>
                  <Slider
                    value={[manualY]}
                    min={-0.4}
                    max={0.5}
                    step={0.01}
                    onValueChange={(v) => {
                      setTrack("manual");
                      setManualY(v[0]);
                    }}
                    aria-label="Положение по высоте"
                  />
                </div>
                <div className="flex w-40 items-center gap-3" style={{ transform: "scaleX(-1)" }}>
                  <span className="text-[11px] text-white/50" style={{ transform: "scaleX(-1)" }}>Сдвиг</span>
                  <Slider
                    value={[manualX]}
                    min={-0.3}
                    max={0.3}
                    step={0.01}
                    onValueChange={(v) => {
                      setTrack("manual");
                      setManualX(v[0]);
                    }}
                    aria-label="Положение по горизонтали"
                  />
                </div>
                <button
                  onClick={captureShot}
                  className="flex h-14 items-center gap-2.5 rounded-full bg-gradient-to-r from-[#1b2c6e] to-[#000d44] px-6 text-[12px] font-bold uppercase tracking-[0.14em] text-white shadow-[0_0_28px_rgba(27,44,110,0.6)] transition-transform active:scale-95"
                  style={{ transform: "scaleX(-1)" }}
                >
                  <Camera size={17} /> Снимок
                </button>
                <button
                  onClick={() => {
                    setSelected(null);
                    setMode("picker");
                    stopCamera();
                  }}
                  className="flex h-14 items-center gap-2 rounded-full border border-white/15 px-5 text-[12px] font-bold uppercase tracking-[0.14em] text-white/70"
                  style={{ transform: "scaleX(-1)" }}
                >
                  <RotateCcw size={16} /> Другое
                </button>
              </div>
            </div>

            {track === "manual" && (
              <div className="absolute left-6 top-6 flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-[11.5px] text-white/70 backdrop-blur" style={{ transform: "scaleX(-1)" }}>
                <Move size={13} className="text-[#e9d7a7]" style={{ transform: "scaleX(-1)" }} />
                <span style={{ transform: "scaleX(-1)" }}>Подстройте размер и высоту ползунками</span>
              </div>
            )}
          </div>
        )}

        {/* Снимок */}
        {mode === "captured" && capture && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
            <div className="relative max-h-[70vh] overflow-hidden rounded-3xl border border-[rgba(233,215,167,0.3)]">
              { }
              <img src={capture} alt="Снимок с примеркой" className="max-h-[70vh] object-contain" />
              <Sparkle size={22} className="sparkle-anim absolute left-5 top-5" />
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href={capture}
                download={`cassiopea-tryon-${selected?.slug || "look"}.jpg`}
                className="flex min-h-13 items-center gap-2.5 rounded-full bg-gradient-to-r from-[#1b2c6e] to-[#000d44] px-7 text-[12px] font-bold uppercase tracking-[0.14em] text-white"
              >
                <Download size={17} /> Сохранить
              </a>
              <button
                onClick={closeCapture}
                className="gold-border flex min-h-13 items-center gap-2.5 rounded-full px-7 text-[12px] font-bold uppercase tracking-[0.14em] text-[#f7ecc9]"
              >
                <RotateCcw size={17} /> Ещё снимок
              </button>
              {selected && (
                <button
                  onClick={() => {
                    stopCamera();
                    onClose();
                    onOpenProduct(selected.slug);
                  }}
                  className="flex min-h-13 items-center gap-2.5 rounded-full border border-white/15 px-7 text-[12px] font-bold uppercase tracking-[0.14em] text-white/70"
                >
                  Об изделии
                </button>
              )}
            </div>
            <p className="text-[12px] text-white/40">
              Снимок сделан и сохранён локально на этом планшете. Понравился образ — консультант подаст украшение из витрины.
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
