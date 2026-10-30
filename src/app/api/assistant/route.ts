import { NextRequest, NextResponse } from "next/server";
import { collections, productsOfCollection, products, fmtPrice, sectionCount } from "@/lib/catalog";
import { BOUTIQUES, FACTS, MYTH, CONTACTS } from "@/lib/company";
import { answer as localAnswer } from "@/lib/assistant-engine";

export const runtime = "nodejs";
export const maxDuration = 60;

function buildKB(): string {
  const lines: string[] = [];
  lines.push("=== ЮВЕЛИРНЫЙ ДОМ CASSIOPEA ===");
  lines.push("Премиальный российский ювелирный дом, назван в честь созвездия Кассиопеи (5 звёзд буквой W).");
  lines.push("Золото 750 пробы, белое и жёлтое, природные бриллианты и цветные камни.");
  lines.push("Миссия: создавать украшения для свободных, смелых, стремительных личностей; вдохновение Космосом.");
  lines.push("Награды: Ювелирный бренд года 2024 (Fashion TV Awards); «Признание Петербурга» (JUNWEX, 2025).");
  lines.push("Первый в индустрии цифровой амбассадор (2026); блог Кассиопеи на Дзене; партнёрство с САО РАН.");
  lines.push("Иммерсивный флагманский бутик в ТРЦ «Ратуша», Роза Хутор, Сочи (открыт в декабре 2025).");
  lines.push(`Контакты: ${CONTACTS.phone}, ${CONTACTS.email}, ${CONTACTS.legal}. Часы: ${CONTACTS.hours}.`);
  lines.push("Бутики: " + BOUTIQUES.map((b) => `${b.city}: ${b.name}, ${b.address} (${b.hours})`).join(" | "));
  lines.push("");
  lines.push("=== КОЛЛЕКЦИИ (9) ===");
  for (const c of collections) {
    const ps = productsOfCollection(c.slug);
    const prices = ps.map((p) => p.price || 0).filter(Boolean);
    const range = prices.length ? `цены ${Math.min(...prices).toLocaleString("ru-RU")}–${Math.max(...prices).toLocaleString("ru-RU")} ₽` : "";
    lines.push(`«${c.name}» — ${c.tagline || ""} ${c.description?.[0] ? c.description[0] : ""} Изделий: ${ps.length}. ${range}`);
  }
  lines.push("");
  lines.push(`=== КАТАЛОГ (${products.length} изделий) ===`);
  lines.push(`Секции: Кольца (${sectionCount("Кольца")}), Серьги (${sectionCount("Серьги")}), Подвески (${sectionCount("Подвески")}), Браслеты (${sectionCount("Браслеты")}).`);
  for (const p of products) {
    const ch = p.characteristics || {};
    const extra = [
      ch["Общий вес изделия, грамм"] ? `${ch["Общий вес изделия, грамм"]} г` : "",
      ch["Вес, карат"] ? `${ch["Вес, карат"]} ct` : "",
      ch["Артикул"] ? `арт. ${ch["Артикул"]}` : "",
    ].filter(Boolean).join(", ");
    lines.push(
      `${p.section} | ${p.name} | ${fmtPrice(p.price)} | ${p.metal || ""}, ${p.stone || ""}${extra ? ` | ${extra}` : ""}${p.collection_names?.length ? ` | коллекция «${p.collection_names[0]}»` : ""}`,
    );
  }
  lines.push("");
  lines.push("=== МИФ О СОЗВЕЗДИИ ===");
  lines.push(MYTH);
  lines.push("=== ФАКТЫ ===");
  FACTS.forEach((f) => lines.push(`${f.title}: ${f.text}`));
  return lines.join("\n");
}

const SYSTEM = `Ты — Кассиопея, голосовой ассистент ювелирного дома Cassiopea. Ты стоишь в торговом зале бутика на планшете.
Правила:
1. Отвечай ТОЛЬКО на основе базы знаний ниже. Не выдумывай цены, артикулы и факты.
2. Отвечай по-русски, тепло и элегантно, как консультант люксового бутика. 2–5 предложений.
3. Говори вслух-понятно: цены произноси как «120 000 рублей».
4. Если вопрос вне темы ювелирного дома — мягко верни к украшениям.
5. Если уместно открыть экран, в самом конце добавь ОДНОЙ строкой тег действий:
ACTIONS:[{"type":"collection","payload":"azbuka-morze"}]
где type: "collection" (payload — slug коллекции), "product" (payload — slug изделия), "catalog" (payload — JSON-фильтр {"section":"Серьги"} или {"stone":"Бриллиант"} или {"sort":"price-desc"}), "nav" (payload: home|collections|catalog|about|tryon|favorites). Слаги бери только из базы.
Не оборачивай ответ в markdown.

БАЗА ЗНАНИЙ:
`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message: string = (body.message || "").toString().slice(0, 800);
    const history: Array<{ role: "user" | "assistant"; content: string }> = Array.isArray(body.history)
      ? body.history.slice(-8)
      : [];
    const ctxProductSlug: string | undefined = body.contextProductSlug || undefined;

    if (!message.trim()) {
      return NextResponse.json({ error: "empty message" }, { status: 400 });
    }

    // Локальный движок — всегда готов как ответ и как фолбэк
    const local = localAnswer(message, { productSlug: ctxProductSlug });

    try {
      const ZAI = (await import("z-ai-web-dev-sdk")).default;
      const zai = await ZAI.create();
      const kb = buildKB();
      const messages = [
        { role: "assistant" as const, content: SYSTEM + kb },
        ...history.map((h) => ({ role: h.role, content: h.content.slice(0, 1200) })),
        {
          role: "user" as const,
          content:
            ctxProductSlug
              ? `[На экране открыто изделие slug=${ctxProductSlug}] ${message}`
              : message,
        },
      ];
      const completion = await zai.chat.completions.create({
        messages,
        thinking: { type: "disabled" },
      });
      let text = completion.choices[0]?.message?.content?.trim() || "";
      if (!text) throw new Error("empty LLM response");

      const actions: Array<{ type: string; payload?: string; label?: string }> = [];
      const m = text.match(/ACTIONS:\s*(\[[\s\S]*?\])\s*$/);
      if (m) {
        try {
          const parsed = JSON.parse(m[1]);
          if (Array.isArray(parsed)) actions.push(...parsed);
        } catch {}
        text = text.slice(0, m.index).trim();
      }
      const mapped = actions.map((a) => ({
        type: (["collection", "product", "catalog", "nav"].includes(a.type) ? a.type : "nav") as
          | "collection"
          | "product"
          | "catalog"
          | "nav",
        payload: a.payload,
        label: a.label || "Открыть",
      }));
      return NextResponse.json({ text, actions: mapped, source: "llm" });
    } catch (e) {
      // LLM недоступен (лимит/сеть) — тихо используем локальный движок
      return NextResponse.json({
        text: local.text,
        spoken: local.spoken || local.text,
        actions: local.actions,
        chips: local.chips,
        source: "local",
      });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "assistant error" },
      { status: 500 },
    );
  }
}
