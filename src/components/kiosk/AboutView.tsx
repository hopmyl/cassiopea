"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Phone, Mail, MapPin, Clock, Sparkles as SparklesIcon } from "lucide-react";
import { BOUTIQUES, FACTS, MISSION, MYTH, CONTACTS, STORY } from "@/lib/company";
import { Constellation, Sparkle, Sparkles } from "./Sparkle";

export default function AboutView({ onBack }: { onBack: () => void }) {
  return (
    <div className="no-select relative pb-16">
      {/* Шапка */}
      <section className="relative overflow-hidden px-8 pt-10 pb-12 lg:px-16">
        <Sparkles count={14} />
        <div className="absolute -right-32 top-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(0,13,68,0.5),rgba(1,3,7,0)_65%)]" />
        <button
          onClick={onBack}
          className="mb-6 flex min-h-11 items-center gap-2 text-[12px] font-semibold tracking-[0.16em] text-white/50 uppercase transition-colors hover:text-[#f7ecc9]"
        >
          <ArrowLeft size={15} /> На главную
        </button>
        <div className="relative z-10 max-w-3xl">
          <div className="mb-5 flex items-center gap-4">
            <Constellation size={64} />
            <p className="tracked text-[11px] text-white/50">Lat. Cassiopeia</p>
          </div>
          <h1 className="font-display text-[50px] leading-tight font-semibold text-[#f3ead2]">
            Дом Cassiopea — <span className="gold-text">в созвездии лучших</span>
          </h1>
          <p className="mt-5 text-[16px] leading-relaxed text-white/65">{MYTH}</p>
        </div>
      </section>

      {/* История */}
      <section className="px-8 lg:px-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="tracked mb-4 text-[11px] text-[#e9d7a7]/70">История и философия</p>
            {STORY.map((s, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className="mb-4 text-[15.5px] leading-relaxed text-white/70"
              >
                {s}
              </motion.p>
            ))}
            <div className="glass relative mt-7 rounded-2xl p-6">
              <Sparkle size={20} className="absolute -top-2.5 -left-2.5" color="#e9d7a7" />
              <p className="font-display text-[19px] leading-relaxed text-[#f3ead2]">«{MISSION}»</p>
            </div>
          </div>

          {/* Факты */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FACTS.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: (i % 2) * 0.08 }}
                className="rounded-2xl border border-white/8 bg-gradient-to-b from-[rgba(10,15,32,0.6)] to-[rgba(2,4,10,0.8)] p-5"
              >
                <SparklesIcon size={16} className="mb-3 text-[#e9d7a7]/80" />
                <h3 className="font-display text-[19px] font-semibold text-[#f3ead2]">{f.title}</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-white/55">{f.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Бутики */}
      <section className="mt-16 px-8 lg:px-16">
        <p className="tracked mb-2 text-[11px] text-[#e9d7a7]/70">Где встретить звёзды ближе</p>
        <h2 className="font-display mb-8 text-[38px] font-semibold text-[#f3ead2]">Бутики и салоны</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {BOUTIQUES.map((b, i) => (
            <motion.div
              key={b.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: (i % 3) * 0.07 }}
              className={`relative rounded-2xl border p-5 ${
                b.flagship
                  ? "gold-border bg-gradient-to-b from-[rgba(27,44,110,0.35)] to-[rgba(2,4,10,0.85)]"
                  : "border-white/8 bg-white/[0.03]"
              }`}
            >
              {b.flagship && (
                <span className="absolute right-4 top-4 rounded-full bg-[rgba(233,215,167,0.15)] px-3 py-1 text-[10px] font-bold tracking-[0.14em] text-[#f7ecc9] uppercase">
                  Флагман
                </span>
              )}
              <p className="tracked mb-2 text-[10.5px] text-[#e9d7a7]/70">{b.city}</p>
              <h3 className="font-display text-[21px] font-semibold text-[#f3ead2]">{b.name}</h3>
              <div className="mt-3 space-y-1.5 text-[12.5px] text-white/55">
                <p className="flex items-start gap-2">
                  <MapPin size={13} className="mt-0.5 shrink-0 text-[#e9d7a7]/60" />
                  {b.address}
                </p>
                <p className="flex items-start gap-2">
                  <Clock size={13} className="mt-0.5 shrink-0 text-[#e9d7a7]/60" />
                  {b.hours}
                </p>
                {b.phone && (
                  <p className="flex items-start gap-2">
                    <Phone size={13} className="mt-0.5 shrink-0 text-[#e9d7a7]/60" />
                    {b.phone}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Контакты */}
      <section className="mt-16 px-8 lg:px-16">
        <div className="glass flex flex-wrap items-center justify-between gap-6 rounded-3xl px-8 py-7">
          <div>
            <p className="tracked mb-2 text-[11px] text-[#e9d7a7]/70">Дом на связи</p>
            <p className="font-display text-[30px] font-semibold text-[#f3ead2]">{CONTACTS.phone}</p>
            <p className="mt-1 text-[13px] text-white/55">{CONTACTS.hours}</p>
          </div>
          <div className="text-[13.5px] text-white/60">
            <p className="flex items-center gap-2">
              <Mail size={15} className="text-[#e9d7a7]/70" />
              {CONTACTS.email}
            </p>
            <p className="mt-2 flex items-center gap-2">
              <MapPin size={15} className="text-[#e9d7a7]/70" />
              {CONTACTS.legal}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[12px] text-white/40">© 2026 Ювелирный дом Cassiopea</p>
            <p className="mt-1 text-[12px] text-white/40">cassiopea.ru</p>
          </div>
        </div>
      </section>
    </div>
  );
}
