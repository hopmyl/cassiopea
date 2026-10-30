"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, X, Volume2, VolumeX, Send, Sparkles } from "lucide-react";
import { bySlug } from "@/lib/catalog";
import type { AssistantAction } from "@/lib/assistant-engine";
import { Sparkle } from "./Sparkle";

type Phase = "idle" | "listening" | "thinking" | "speaking";

interface Msg {
  role: "user" | "assistant";
  text: string;
  actions?: AssistantAction[];
  chips?: string[];
}

const WELCOME: Msg = {
  role: "assistant",
  text:
    "Здравствуйте! Я Кассиопея — голосовой ассистент ювелирного дома. Нажмите на микрофон и спросите: расскажите о коллекции, сколько стоит кольцо, где находятся бутики…",
  chips: [
    "Расскажи о торговом доме",
    "Какие есть коллекции?",
    "Покажи кольца",
    "Что значит созвездие Кассиопеи?",
    "Где находятся бутики?",
  ],
};

export default function AssistantOverlay({
  open,
  onClose,
  onAction,
  contextProductSlug,
  initialQuestion,
}: {
  open: boolean;
  onClose: () => void;
  onAction: (a: AssistantAction) => void;
  contextProductSlug?: string;
  initialQuestion?: string;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([WELCOME]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [input, setInput] = useState("");
  const [muted, setMuted] = useState(false);
  const [interim, setInterim] = useState("");
  const [listenError, setListenError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recogRef = useRef<any>(null);
  const mediaRef = useRef<{ stream: MediaStream; recorder: MediaRecorder; chunks: Blob[] } | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const historyRef = useRef<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, phase, interim]);

  const speak = useCallback(async (text: string) => {
    if (mutedRef.current) return;
    try {
      window.speechSynthesis?.cancel();
    } catch {}
    const spoken = text
      .replace(/₽/g, " рублей")
      .replace(/Cassiopea/gi, "Кассиопеа")
      .replace(/I'm Cassiopea/gi, "Ай эм Кассиопеа");
    // Приоритет: серверная женская модель (мягкий тембр)
    setPhase("speaking");
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: spoken.slice(0, 950) }),
      });
      if (!res.ok) throw new Error("tts failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (!audioElRef.current) audioElRef.current = new Audio();
      audioElRef.current.src = url;
      audioElRef.current.onended = () => {
        setPhase("idle");
        URL.revokeObjectURL(url);
      };
      audioElRef.current.onerror = () => setPhase("idle");
      await audioElRef.current.play();
      return;
    } catch {}
    // Резерв: встроенный синтез планшета (выбираем женский русский голос)
    try {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(spoken);
        u.lang = "ru-RU";
        const voices = window.speechSynthesis.getVoices();
        const ru = voices.filter((v) => v.lang?.toLowerCase().startsWith("ru"));
        // предпочитаем женские голоса по типичным именам
        const femaleHints = ["milena", "alyona", "alena", "katya", "ekaterina", "irina", "female", "женск", "tatyana", "svetlana", "google"];
        const female =
          ru.find((v) => femaleHints.some((h) => v.name.toLowerCase().includes(h))) ||
          ru.find((v) => !/male|мужск|pavel|yuri|dmitri|artem/i.test(v.name));
        if (female) u.voice = female;
        else if (ru.length) u.voice = ru[0];
        u.rate = 1;
        u.pitch = 1.1;
        u.onend = () => setPhase("idle");
        u.onerror = () => setPhase("idle");
        window.speechSynthesis.speak(u);
        return;
      }
    } catch {}
    setPhase("idle");
  }, []);

  const stopSpeaking = useCallback(() => {
    try {
      window.speechSynthesis?.cancel();
    } catch {}
    audioElRef.current?.pause();
  }, []);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q) return;
      stopSpeaking();
      setMsgs((m) => [...m, { role: "user", text: q }]);
      historyRef.current.push({ role: "user", content: q });
      setInput("");
      setInterim("");
      setPhase("thinking");
      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: q,
            history: historyRef.current.slice(-8),
            contextProductSlug: contextProductSlug || undefined,
          }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        const reply: Msg = {
          role: "assistant",
          text: data.text,
          actions: (data.actions || []).filter(
            (a: AssistantAction) => a && a.type && (a.payload || a.type === "nav"),
          ),
          chips: data.chips,
        };
        setMsgs((m) => [...m, reply]);
        historyRef.current.push({ role: "assistant", content: data.text });
        // Автоматически открываем экраны, о которых говорит ассистент
        (reply.actions || []).forEach((a: AssistantAction) => onAction(a));
        speak(data.spoken || data.text);
      } catch {
        const fallback: Msg = {
          role: "assistant",
          text: "Связь с ассистентом прервалась. Попробуйте ещё раз или задайте вопрос консультанту зала — он рядом.",
          chips: WELCOME.chips,
        };
        setMsgs((m) => [...m, fallback]);
        setPhase("idle");
      }
    },
    [contextProductSlug, onAction, speak, stopSpeaking],
  );

  // Речь → текст: встроенное распознавание планшета
  const startBrowserRecog = useCallback(() => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return false;
    try {
      const r = new SR();
      r.lang = "ru-RU";
      r.interimResults = true;
      r.continuous = false;
      r.maxAlternatives = 1;
      r.onresult = (e: any) => {
        let finalText = "";
        let interimText = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalText += t;
          else interimText += t;
        }
        setInterim(interimText);
        if (finalText) {
          setPhase("thinking");
          r.stop();
          send(finalText);
        }
      };
      r.onerror = (e: any) => {
        setPhase("idle");
        setInterim("");
        recogRef.current = null;
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setListenError("Доступ к микрофону запрещён. Разрешите его в настройках браузера.");
        } else if (e.error !== "aborted") {
          setListenError("Голос не распознан. Нажмите ещё раз или напишите текстом.");
        }
      };
      r.onend = () => {
        setInterim("");
        recogRef.current = null;
        setPhase((p) => (p === "listening" ? "idle" : p));
      };
      r.start();
      recogRef.current = r;
      return true;
    } catch {
      return false;
    }
  }, [send]);

  // Резерв: запись → серверное распознавание
  const startServerRecog = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        mediaRef.current = null;
        setPhase("thinking");
        try {
          const blob = new Blob(chunks, { type: chunks[0]?.type || "audio/webm" });
          const b64 = await new Promise<string>((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(String(fr.result));
            fr.onerror = reject;
            fr.readAsDataURL(blob);
          });
          const res = await fetch("/api/asr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audioBase64: b64 }),
          });
          if (!res.ok) throw new Error(String(res.status));
          const data = await res.json();
          if (data.text) send(data.text);
          else {
            setPhase("idle");
            setListenError("Речь не расслышана. Попробуйте ещё раз.");
          }
        } catch {
          setPhase("idle");
          setListenError("Не удалось распознать речь. Напишите вопрос текстом.");
        }
      };
      mediaRef.current = { stream, recorder, chunks };
      recorder.start();
      setPhase("listening");
      setListenError("Слушаю… (серверное распознавание)");
      setTimeout(() => {
        if (mediaRef.current?.recorder.state === "recording") {
          mediaRef.current.recorder.stop();
        }
      }, 7000);
    } catch {
      setPhase("idle");
      setListenError("Микрофон недоступен. Напишите вопрос текстом — ассистент всё понимает.");
    }
  }, [send]);

  const startListening = useCallback(() => {
    stopSpeaking();
    setListenError(null);
    if (phase === "listening") {
      recogRef.current?.stop?.();
      if (mediaRef.current?.recorder.state === "recording") mediaRef.current.recorder.stop();
      setPhase("idle");
      return;
    }
    setPhase("listening");
    if (!startBrowserRecog()) {
      startServerRecog();
    }
  }, [phase, startBrowserRecog, startServerRecog, stopSpeaking]);

  // Закрытие: остановить всё
  useEffect(() => {
    if (!open) {
      stopSpeaking();
      recogRef.current?.stop?.();
      if (mediaRef.current?.recorder.state === "recording") mediaRef.current.recorder.stop();
      setPhase("idle");
      setInterim("");
    }
  }, [open, stopSpeaking]);

  // Внешний вопрос (например, «Рассказать голосом» на карточке)
  useEffect(() => {
    if (open && initialQuestion) {
      setMsgs([WELCOME]);
      historyRef.current = [];
      const t = setTimeout(() => send(initialQuestion), 350);
      return () => clearTimeout(t);
    }
     
  }, [open, initialQuestion]);

  const lastChips = msgs.length >= 2 ? (msgs[msgs.length - 1].chips || WELCOME.chips) : WELCOME.chips;
  const ctxName = contextProductSlug ? bySlug.get(contextProductSlug)?.name : undefined;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex flex-col bg-[rgba(1,2,6,0.82)] backdrop-blur-xl"
          role="dialog"
          aria-label="Голосовой ассистент Кассиопея"
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <Sparkle size={26} className="sparkle-anim absolute left-[12%] top-[18%]" />
            <Sparkle size={16} className="sparkle-anim absolute right-[16%] top-[26%]" style={{ animationDelay: "1.1s" }} />
            <Sparkle size={20} className="sparkle-anim absolute bottom-[24%] left-[20%]" style={{ animationDelay: "2s" }} />
          </div>

          {/* Шапка */}
          <div className="relative z-10 flex items-center gap-4 border-b border-white/8 px-6 py-4">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#1b2c6e] to-[#000d44]">
              <Sparkle size={20} color="#f7ecc9" className={phase === "speaking" || phase === "listening" ? "sparkle-anim" : ""} />
              {(phase === "listening" || phase === "speaking") && (
                <span className="pulse-ring absolute inset-0 rounded-full border border-[#e9d7a7]/60" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-[24px] font-semibold text-[#f3ead2]">Кассиопея</h2>
              <p className="text-[12px] text-white/45">
                {ctxName ? `Изделие на экране: ${ctxName} · ` : ""}
                {phase === "listening"
                  ? "слушаю вас…"
                  : phase === "thinking"
                    ? "подбираю ответ…"
                    : phase === "speaking"
                      ? "говорю…"
                      : "ассистент ювелирного дома"}
              </p>
            </div>
            <button
              onClick={() => setMuted((v) => !v)}
              className="flex h-11 w-11 items-center justify-center rounded-full text-white/60 hover:text-white"
              aria-label={muted ? "Включить голос" : "Выключить голос"}
            >
              {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
            </button>
            <button
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full text-white/60 hover:text-white"
              aria-label="Закрыть ассистента"
            >
              <X size={22} />
            </button>
          </div>

          {/* Чат */}
          <div ref={scrollRef} className="chat-scroll relative z-10 flex-1 overflow-y-auto px-6 py-6">
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {msgs.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`max-w-[85%] rounded-2xl px-5 py-4 text-[14.5px] leading-relaxed ${
                    m.role === "user"
                      ? "self-end bg-gradient-to-r from-[#1b2c6e] to-[#000d44] text-white"
                      : "glass-soft self-start text-white/85"
                  }`}
                >
                  {m.text}
                  {m.actions && m.actions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {m.actions.map((a, j) => (
                        <button
                          key={j}
                          onClick={() => onAction(a)}
                          className="rounded-full border border-[rgba(233,215,167,0.4)] px-4 py-1.5 text-[11px] font-bold tracking-[0.12em] text-[#f7ecc9] uppercase transition-colors hover:bg-[rgba(233,215,167,0.1)]"
                        >
                          {a.label} →
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
              {interim && (
                <div className="glass-soft max-w-[85%] self-start rounded-2xl px-5 py-4 text-[14.5px] italic text-white/50">
                  {interim}…
                </div>
              )}
              {phase === "thinking" && (
                <div className="glass-soft flex w-24 items-center justify-center gap-1.5 self-start rounded-2xl px-5 py-4">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-2 w-2 animate-bounce rounded-full bg-[#e9d7a7]/80"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Подсказки + ввод */}
          <div className="relative z-10 border-t border-white/8 px-6 py-4">
            <div className="mx-auto max-w-3xl">
              <div className="mb-3 flex flex-wrap gap-2">
                {lastChips.map((c) => (
                  <button
                    key={c}
                    onClick={() => send(c)}
                    className="rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-[12.5px] text-white/70 transition-colors hover:border-[rgba(233,215,167,0.4)] hover:text-[#f7ecc9]"
                  >
                    {c}
                  </button>
                ))}
              </div>
              {listenError && (
                <p className="mb-2 text-center text-[12px] text-[#e9d7a7]/80">{listenError}</p>
              )}
              <div className="flex items-center gap-3">
                <button
                  onClick={startListening}
                  className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 ${
                    phase === "listening"
                      ? "bg-[#e9d7a7] text-[#05070f]"
                      : "bg-gradient-to-r from-[#1b2c6e] to-[#000d44] text-white"
                  }`}
                  aria-label={phase === "listening" ? "Остановить запись" : "Говорить"}
                >
                  {phase === "listening" && (
                    <>
                      <span className="pulse-ring absolute inset-0 rounded-full border-2 border-[#e9d7a7]" />
                      <span className="pulse-ring absolute inset-0 rounded-full border border-[#e9d7a7]/70" style={{ animationDelay: "0.5s" }} />
                    </>
                  )}
                  <Mic size={22} />
                </button>
                <div className="relative flex-1">
                  <Sparkles size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send(input)}
                    placeholder="Или напишите вопрос…"
                    className="h-14 w-full rounded-full border border-white/12 bg-white/[0.04] pl-11 pr-4 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-[rgba(233,215,167,0.5)]"
                    aria-label="Текст вопроса ассистенту"
                  />
                </div>
                <button
                  onClick={() => send(input)}
                  disabled={!input.trim()}
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[rgba(233,215,167,0.35)] text-[#f7ecc9] transition-transform active:scale-95 disabled:opacity-30"
                  aria-label="Отправить"
                >
                  <Send size={19} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
