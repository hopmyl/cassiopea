/**
 * Локальный движок голосового ассистента Cassiopea.
 * Работает офлайн: распознаёт намерения и сущности по базе каталога.
 * LLM-слой (см. /api/assistant) подключается поверх и откатывается сюда при недоступности.
 */
import {
  collections,
  productsOfCollection,
  bySlug,
  fmtPrice,
  fmtPriceSpoken,
  normalize,
  products,
  STONES,
  sectionCount,
} from "./catalog";
import { BOUTIQUES, FACTS, MYTH, CARE_TIPS, CONTACTS } from "./company";

export interface AssistantAction {
  type: "nav" | "product" | "collection" | "catalog";
  payload?: string;
  label: string;
}

export interface AssistantReply {
  text: string;
  spoken?: string;
  actions: AssistantAction[];
  chips: string[];
}

const DEFAULT_CHIPS = [
  "Расскажи о торговом доме",
  "Какие есть коллекции?",
  "Покажи кольца",
  "Что значит созвездие Кассиопеи?",
  "Где находятся бутики?",
];

const COLLECTION_KEYS: Array<{ slug: string; keys: string[] }> = [
  { slug: "azbuka-morze", keys: ["морзе", "азбук"] },
  { slug: "sakralny-kod", keys: ["сакрал"] },
  { slug: "tvoy-taynyy-shifr", keys: ["тайн", "шифр", "герменевтик", "secret"] },
  { slug: "zashchita", keys: ["защит", "оберег"] },
  { slug: "amore-fati", keys: ["amore", "amor fati", "любв к судьб", "любов к судьб"] },
  { slug: "sozvezdiya-galaxy", keys: ["galaxy", "созвезд", "галакт", "зодиак"] },
  { slug: "ekspressiya", keys: ["экспресс", "выражени"] },
  { slug: "i-m-cassiopea", keys: ["i m cassiopea", "im cassiopea", "i'm cassiopea", "я кассиопея", "ай эм", "айм"] },
  { slug: "svobodnaya-orbita", keys: ["орбит", "свобод"] },
];

function findCollection(q: string) {
  for (const { slug, keys } of COLLECTION_KEYS) {
    if (keys.some((k) => q.includes(k))) return collections.find((c) => c.slug === slug);
  }
  return undefined;
}

function sectionOf(q: string): string | undefined {
  if (/кольц|перстен|обручальн/.test(q)) return "Кольца";
  if (/серьг|пусет|кафф/.test(q)) return "Серьги";
  if (/подвеск|кулон|крест/.test(q)) return "Подвески";
  if (/браслет/.test(q)) return "Браслеты";
  return undefined;
}

function findProduct(q: string, ctxSlug?: string) {
  // Спец-случай: «буква О», «буквы З, Ю» и т.п. — однобуквенные артикулы
  // (JS \b не работает с кириллицей — используем lookahead/lookbehind)
  const letterMatch = q.match(/букв[аыуе]+\s+([а-яё][а-яё,\sи]{0,8})/);
  if (letterMatch) {
    const letters = letterMatch[1].split(/[\s,и]+/).filter((t) => t.length >= 1 && t.length <= 2);
    const byLetter = products.filter((p) => {
      const m = normalize(p.name).match(/букв[аыуе]+\s+([а-яё][а-яё,\sи]{0,8})/);
      if (!m) return false;
      const nameLetters = m[1].split(/[\s,и]+/).filter((t) => t.length >= 1 && t.length <= 2);
      return letters.some((l) => nameLetters.includes(l));
    });
    if (byLetter.length) {
      const sec = sectionOf(q);
      const pick = (sec ? byLetter.filter((p) => p.section === sec) : byLetter)[0] || byLetter[0];
      return pick;
    }
  }
  const toks = normalize(q).split(/[^a-zа-я0-9]+/).filter((t) => t.length > 2);
  let best: { slug: string; score: number } | null = null;
  for (const p of products) {
    const name = normalize(p.name);
    let score = 0;
    for (const t of toks) if (name.includes(t)) score += t.length;
    if (ctxSlug && p.slug === ctxSlug) score += 12;
    if (score > 0 && (!best || score > best.score)) best = { slug: p.slug, score };
  }
  if (best && best.score >= 4) return bySlug.get(best.slug);
  return undefined;
}

function productSummary(p: NonNullable<ReturnType<typeof bySlug.get>>): string {
  const parts: string[] = [p.name + "."];
  const ch = p.characteristics || {};
  parts.push(`Металл — ${p.metal || "золото 750 пробы"}, вставка — ${p.stone || "без вставок"}.`);
  if (ch["Общий вес изделия, грамм"]) parts.push(`Общий вес ${ch["Общий вес изделия, грамм"]} грамма.`);
  if (ch["Вес, карат"] && ch["Количество"]) {
    parts.push(`${ch["Количество"]} камня(ов), ${ch["Вес, карат"]} карата, огранка «${ch["Форма огранки"] || "круг"}».`);
  }
  if (ch["Проба"]) parts.push(`Проба золота — ${ch["Проба"]}.`);
  if (p.collection_names?.length) parts.push(`Коллекция «${p.collection_names[0]}».`);
  parts.push(`Стоимость — ${fmtPrice(p.price)}.`);
  return parts.join(" ");
}

function productChips(p: NonNullable<ReturnType<typeof bySlug.get>>): string[] {
  return [
    `Расскажи о коллекции ${p.collection_names?.[0] || "Cassiopea"}`,
    "Покажи похожие украшения",
    `Сколько стоит ${p.name}?`,
  ];
}

export function answer(question: string, ctx?: { productSlug?: string }): AssistantReply {
  const q = normalize(question);
  const has = (...rx: RegExp[]) => rx.some((r) => r.test(q));

  // --- приветствие и знакомство
  if (/^(привет|здравств|добрый|доброе|добрый день|добрый вечер|доброе утро|hello|hi)\b/.test(q) || q.length < 3) {
    return {
      text: "Здравствуйте! Я Кассиопея — голосовой ассистент ювелирного дома. Могу рассказать об украшениях, коллекциях и истории дома, показать каталог и открыть виртуальную примерку. Спросите меня о чём угодно.",
      actions: [],
      chips: DEFAULT_CHIPS,
    };
  }
  if (has(/ты кто|как тебя зовут|что ты умеешь|помощь|помоги|who are you/)) {
    return {
      text: "Я голосовой ассистент Cassiopea. Знаю каждое изделие каталога, все девять коллекций и историю дома. Могу провести экскурсию, подобрать украшение по вкусу и бюджету или включить виртуальную примерку с камерой.",
      actions: [],
      chips: ["Подбери украшение до 200 000 рублей", "Открой виртуальную примерку", "Расскажи о наградах дома"],
    };
  }

  // --- примерка
  if (has(/пример|примерить|примерк|виртуальн|камер|зеркал/)) {
    return {
      text: "Открываю виртуальную примерку. Разрешите доступ к фронтальной камере — и вы увидите украшения на себе. Можно примерить серьги и подвески.",
      actions: [{ type: "nav", payload: "tryon", label: "Виртуальная примерка" }],
      chips: ["Покажи серьги для примерки", "Расскажи о коллекциях"],
    };
  }

  // --- коллекции: список
  if (has(/какие.*(коллекц|линейк)|список коллекц|все коллекц|коллекции (есть|дома)/)) {
    const names = collections.map((c) => `«${c.name}»`).join(", ");
    return {
      text: `В доме девять коллекций: ${names}. Каждая — о своём смысле: шифры, созвездия, защита, любовь к судьбе и свободная орбита. Какую рассказать подробнее?`,
      actions: [{ type: "nav", payload: "collections", label: "Все коллекции" }],
      chips: ["Расскажи о коллекции Азбука Морзе", "Расскажи о коллекции GALAXY", "Расскажи о Свободной орбите"],
    };
  }

  // --- конкретная коллекция
  const col = findCollection(q);
  if (col && has(/коллекц|расскажи|о ней|что (это|такое)|истори коллекц|покажи коллекц/)) {
    const ps = productsOfCollection(col.slug);
    const prices = ps.map((p) => p.price || 0).filter(Boolean);
    const examples = ps.slice(0, 3).map((p) => p.name).join(", ");
    const from = prices.length ? fmtPrice(Math.min(...prices)) : "";
    const to = prices.length ? fmtPrice(Math.max(...prices)) : "";
    const desc = col.description?.[0] || col.tagline || "";
    return {
      text: `Коллекция «${col.name}». ${col.tagline ? col.tagline + ". " : ""}${desc} В коллекции ${ps.length} изделий, цены от ${from} до ${to}. Например: ${examples}.`,
      spoken: `Коллекция «${col.name}». ${col.tagline ? col.tagline + ". " : ""}${desc} В коллекции ${ps.length} украшений, цены от ${from} до ${to}. Показать её на экране?`,
      actions: [{ type: "collection", payload: col.slug, label: `Коллекция «${col.name}»` }],
      chips: [`Покажи изделия коллекции ${col.name}`, "Какие ещё есть коллекции?"],
    };
  }

  // --- о доме
  if (has(/о (доме|компани|бренде)|расскажи о (доме|компани|бренде)|истори (дома|компани|бренда)|кто такие cassiopea|кто вы|чем вы занимаетесь/)) {
    return {
      text: "Ювелирный дом Cassiopea назван в честь созвездия Кассиопеи. Дом создаёт украшения для свободных, смелых и стремительных: из белого и жёлтого золота 750 пробы с природными бриллиантами. Вдохновение Космосом здесь соединяется с инженерией огранки, а каждое украшение несёт личный смысл. Хотите узнать о наградах, бутиках или коллекциях?",
      actions: [{ type: "nav", payload: "about", label: "О доме Cassiopea" }],
      chips: ["Расскажи о наградах", "Где находятся бутики?", "Какие есть коллекции?"],
    };
  }
  if (has(/наград|преми|бренд года|достижен|award/)) {
    const f = FACTS[0];
    return {
      text: `${f.title}: ${f.text} Также дом стал лауреатом «Признания Петербурга» на JUNWEX и первым в индустрии представил цифрового амбассадора — Кассиопею.`,
      actions: [{ type: "nav", payload: "about", label: "О доме" }],
      chips: ["Партнёрство с обсерваторией", "Расскажи об иммерсивном бутике"],
    };
  }
  if (has(/обсерватор|sao|ран\b|астроном|научн/)) {
    return {
      text: FACTS[2].text + " А блог Кассиопеи на Дзене пишется в сотрудничестве с учёными обсерватории — космос здесь настоящий.",
      actions: [],
      chips: ["Расскажи о созвездии Кассиопеи", "Покажи коллекцию GALAXY"],
    };
  }
  if (has(/амбассадор|цифров|аватар|дзен/)) {
    return {
      text: FACTS[1].text,
      actions: [],
      chips: ["Расскажи о доме", "Какие есть коллекции?"],
    };
  }
  if (has(/иммерсив|ратуш|флагман|роза хутор/)) {
    return {
      text: FACTS[3].text + " Адрес: площадь Розы, 2, Эсто-Садок, Сочи. Ежедневно с 10 до 21.",
      actions: [{ type: "nav", payload: "about", label: "Бутики" }],
      chips: ["Где ещё есть бутики?", "Как связаться с домом?"],
    };
  }

  // --- созвездие/миф
  if (has(/созвезд|миф|легенд|буква w|почему cassiopea|почему кассиопея|неб|звезд/)) {
    return {
      text: MYTH,
      actions: [],
      chips: ["Покажи коллекцию GALAXY", "Расскажи о доме"],
    };
  }

  // --- бутики
  if (has(/бутик|магазин|адрес|где купить|где наход|точк|салон/)) {
    const list = BOUTIQUES.slice(0, 6)
      .map((b) => `${b.city} — ${b.name}, ${b.address}`)
      .join("; ");
    return {
      text: `Украшения Cassiopea представлены в семи городах и точках: ${list}. Флагманский иммерсивный бутик — на Роза Хутор в Сочи.`,
      actions: [{ type: "nav", payload: "about", label: "Бутики и контакты" }],
      chips: ["Как связаться с домом?", "Расскажи о доме"],
    };
  }

  // --- контакты
  if (has(/контакт|телефон|позвон|связ|почт|e-?mail|менеджер|консультант/)) {
    return {
      text: `Телефон дома — ${CONTACTS.phone}, почта ${CONTACTS.email}. Работаем с понедельника по субботу с 10 до 20 по Москве. Консультант дома также может подойти к вам в зале.`,
      actions: [],
      chips: ["Где находятся бутики?", "Расскажи о доме"],
    };
  }

  // --- уход/гарантия/доставка/размер
  if (has(/уход|ухажив|чистить|хранить|почистить/)) {
    return {
      text: "Несколько правил: снимайте украшения перед спортом и сном, избегайте контакта с косметикой и хлором, храните отдельно в мягких салфетках и протирайте микрофиброй после носки. Золото 750 пробы любит бережное обращение — и отвечает сиянием.",
      actions: [],
      chips: ["Расскажи о гарантии", "Покажи новинки каталога"],
    };
  }
  if (has(/гаранти|сертификат|возврат/)) {
    return {
      text: "Каждое изделие Cassiopea сопровождается биркой и гарантийным талоном дома. Детали гарантии и возврата подскажет консультант зала или служба заботы по телефону " + CONTACTS.phone + ".",
      actions: [],
      chips: ["Какие есть услуги?", "Расскажи о доме"],
    };
  }
  if (has(/доставк|достав|оплат|купить онлайн|заказать/)) {
    return {
      text: "Показанное в зале украшение можно оформить у консультанта: он зарезервирует изделие, оформит доставку и оплату удобным способом. Подарочные сертификаты дома доступны и в бутиках, и онлайн.",
      actions: [],
      chips: ["Где находятся бутики?", "Покажи самые желанные украшения"],
    };
  }
  if (has(/размер|кольца размер|как узнать размер/)) {
    return {
      text: "Размерную линейку и подсказки по подбору размера кольца покажет консультант в бутике — он измерит палец профессиональным кольцемером. Это бесплатно и занимает минуту.",
      actions: [],
      chips: ["Покажи кольца", "Где находятся бутики?"],
    };
  }

  // --- избранное
  if (has(/избран|понравив|сохраненн/)) {
    return {
      text: "Открываю избранное — украшения, отмеченные сердечком. Оттуда можно записаться на просмотр в бутик.",
      actions: [{ type: "nav", payload: "favorites", label: "Избранное" }],
      chips: ["Покажи кольца", "Расскажи о коллекциях"],
    };
  }

  // --- суперлатативные подборки
  const section = sectionOf(q);
  const wantsExpensive = has(/дорог|премиальн|роскошн|топ|внушительн|самых дорог/);
  const wantsCheap = has(/дешев|недорог|бюджет|скромн|доступн/);
  const wantsUnder = q.match(/до (\d[\d\s]*)\s*(тысяч|тыс|k|р|руб)/);
  if (wantsExpensive || wantsCheap || wantsUnder || has(/подбери|посоветуй|предложи|хочу (украшение|подарок)|что подарить/)) {
    let pool = section ? products.filter((p) => p.section === section) : products.slice();
    if (wantsUnder) {
      const raw = wantsUnder[1].replace(/\s/g, "");
      let limit = parseInt(raw, 10);
      if (/тысяч|тыс|k/.test(wantsUnder[2])) limit *= 1000;
      pool = pool.filter((p) => (p.price || 0) <= limit);
      pool.sort((a, b) => (b.price || 0) - (a.price || 0));
      const picks = pool.slice(0, 3);
      if (picks.length) {
        return {
          text: `Вот украшения до ${limit.toLocaleString("ru-RU")} рублей: ` + picks.map((p) => `${p.name} — ${fmtPrice(p.price)}`).join("; ") + ". Показать каталог?",
          actions: [{ type: "catalog", payload: JSON.stringify({ sort: "price-desc" }), label: "Каталог" }],
          chips: ["Покажи серьги", "Покажи подвески с бриллиантами"],
        };
      }
      return {
        text: `В этой цене пока пусто — самые доступные изделия дома начинаются от ${fmtPrice(Math.min(...products.map((p) => p.price || 0)))}. Показать самые доступные?`,
        actions: [{ type: "catalog", payload: JSON.stringify({ sort: "price-asc" }), label: "Каталог" }],
        chips: ["Самое доступное кольцо", "Покажи подвески"],
      };
    }
    if (wantsCheap) pool.sort((a, b) => (a.price || 0) - (b.price || 0));
    else pool.sort((a, b) => (b.price || 0) - (a.price || 0));
    const picks = pool.slice(0, 3);
    if (picks.length) {
      const lead = wantsCheap ? "Самые доступные" : "Самые выразительные";
      return {
        text: `${lead} ${section ? section.toLowerCase() : "изделия дома"}: ` + picks.map((p) => `${p.name} — ${fmtPrice(p.price)}`).join("; ") + ".",
        actions: [{ type: "product", payload: picks[0].slug, label: picks[0].name }],
        chips: ["Покажи ещё варианты", "Расскажи о коллекциях"],
      };
    }
  }

  // --- конкретное изделие: цена
  if (has(/сколько стоит|цена|почем/)) {
    const p = findProduct(q, ctx?.productSlug);
    if (p) {
      return {
        text: `${p.name} — ${fmtPrice(p.price)}. ${p.metal}, ${p.stone}. Хотите примерить или увидеть на экране?`,
        actions: [{ type: "product", payload: p.slug, label: p.name }],
        chips: ["Открой виртуальную примерку", `Расскажи о коллекции ${p.collection_names?.[0] || ""}`],
      };
    }
  }

  // --- поиск по камню
  const stoneHit = STONES.find((s) => q.includes(normalize(s).split(" ")[0])) ||
    (has(/бриллиант|диамант/) ? "Бриллиант" : undefined);
  if (stoneHit && has(/покажи|найди|украшен|издели|с (камн|бриллиант)/)) {
    const st = stoneHit === "Бриллиант" ? "Бриллиант" : stoneHit;
    const list = products.filter((p) => p.stone === st).slice(0, 3);
    return {
      text: `Изделия с ${st.toLowerCase()}: ` + list.map((p) => `${p.name} — ${fmtPrice(p.price)}`).join("; ") + ".",
      actions: [{ type: "catalog", payload: JSON.stringify({ stone: st }), label: `Изделия с ${st}` }],
      chips: ["Покажи всё с бриллиантами", "Расскажи о коллекциях"],
    };
  }

  // --- навигация
  if (has(/^покажи|^открой|^перейди|каталог|^хочу посмотреть/)) {
    if (section) {
      return {
        text: `Открываю ${section.toLowerCase()} — в каталоге ${sectionCount(section)} ${section === "Кольца" ? "колец" : section === "Серьги" ? "пар серёг" : section === "Подвески" ? "подвесок" : "браслет"}.`,
        actions: [{ type: "catalog", payload: JSON.stringify({ section }), label: section }],
        chips: ["Самое дорогое", "С бриллиантами", "Расскажи о коллекциях"],
      };
    }
    if (has(/коллекц/)) {
      return {
        text: "Открываю коллекции дома — девять линий, от «Азбуки Морзе» до «Свободной орбиты».",
        actions: [{ type: "nav", payload: "collections", label: "Коллекции" }],
        chips: DEFAULT_CHIPS,
      };
    }
    return {
      text: "Открываю полный каталог дома: 136 изделий из белого и жёлтого золота.",
      actions: [{ type: "nav", payload: "catalog", label: "Каталог" }],
      chips: ["Покажи кольца", "Покажи серьги", "Самое дорогое изделие"],
    };
  }

  // --- свободный поиск изделия
  const p = findProduct(q, ctx?.productSlug);
  if (p) {
    return {
      text: productSummary(p),
      actions: [{ type: "product", payload: p.slug, label: p.name }],
      chips: productChips(p),
    };
  }

  // --- ничего не нашли
  return {
    text: "Пока я знаю каталог, коллекции и историю дома. Спросите, например: «расскажи о коллекции Азбука Морзе», «покажи серьги с танзанитом» или «сколько стоит кольцо I'm Cassiopea». Если нужна живая консультация — позовите консультанта зала.",
    actions: [],
    chips: DEFAULT_CHIPS,
  };
}
