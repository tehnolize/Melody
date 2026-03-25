import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import nodemailer from "nodemailer";
import OpenAI from "openai";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";

const PORT = Number(process.env.PORT || 8787);
const MUSIC_FOLDER = process.env.MUSIC_FOLDER || path.resolve(process.cwd(), "..", "..", "music");
const FEEDBACK_TO = process.env.FEEDBACK_TO || "koipu08hh@gmail.com";

const log = {
  info: (msg, data) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`, data || ''),
  success: (msg, data) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`, data || ''),
  error: (msg, err) => console.error(`\x1b[31m[ERROR]\x1b[0m ${msg}`, err || ''),
  warn: (msg, data) => console.warn(`\x1b[33m[WARN]\x1b[0m ${msg}`, data || ''),
};

log.info("SMTP Configuration", {
  SMTP_HOST: process.env.SMTP_HOST ? "✓" : "✗",
  SMTP_USER: process.env.SMTP_USER ? "✓" : "✗",
  SMTP_PASS: process.env.SMTP_PASS ? "✓" : "✗",
  SMTP_PORT: process.env.SMTP_PORT || "465",
  FEEDBACK_TO: FEEDBACK_TO,
});

const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
const openai = OPENAI_API_KEY && OPENAI_API_KEY.length > 10 ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

const GPT_MODEL = "gpt-3.5-turbo";
const GPT_INPUT_PRICE = 0.0005 / 1000;
const GPT_OUTPUT_PRICE = 0.0015 / 1000;
const INITIAL_BALANCE = 10.0;

let totalSpent = 0.0;
let totalRequests = 0;
let totalInputTokens = 0;
let totalOutputTokens = 0;


if (openai) {
  log.success("OpenAI API configured", { keyLength: OPENAI_API_KEY.length, keyPrefix: OPENAI_API_KEY.substring(0, 7) + "..." });
  const configLines = [
    '\x1b[32mGPT Chat Configuration\x1b[0m',
    '',
    `Model:              \x1b[33m${GPT_MODEL}\x1b[0m`,
    `Initial Balance:    \x1b[32m$${INITIAL_BALANCE.toFixed(2)}\x1b[0m`,
    `Input Price:        \x1b[33m$${GPT_INPUT_PRICE.toFixed(6)}\x1b[0m per token`,
    `Output Price:       \x1b[33m$${GPT_OUTPUT_PRICE.toFixed(6)}\x1b[0m per token`
  ];
  console.log('\n' + createBox(configLines, '\x1b[36m', true).join('\n') + '\n');
} else {
  log.warn("OpenAI API key not found or invalid - GPT chat will be disabled", { 
    hasKey: !!process.env.OPENAI_API_KEY,
    keyLength: OPENAI_API_KEY?.length || 0 
  });
}

function formatUsageStats() {
  const remaining = Math.max(0, INITIAL_BALANCE - totalSpent);
  const estimatedRequestsLeft = remaining > 0 ? Math.floor(remaining / ((GPT_INPUT_PRICE * 200) + (GPT_OUTPUT_PRICE * 150))) : 0;
  
  return {
    spent: totalSpent,
    remaining,
    requests: totalRequests,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    estimatedRequestsLeft
  };
}

function logUsageBox(stats, requestCost, inputTokens, outputTokens, totalTokens) {
  const barWidth = 40;
  const remainingBar = Math.min(barWidth, Math.floor((stats.remaining / INITIAL_BALANCE) * barWidth));
  const spentBar = barWidth - remainingBar;
  const bar = '\x1b[31m' + '█'.repeat(spentBar) + '\x1b[32m' + '█'.repeat(remainingBar) + '\x1b[0m';
  
  const usageLines = [
    '\x1b[32mGPT Request Completed\x1b[0m',
    '',
    `Model:              \x1b[33m${GPT_MODEL}\x1b[0m`,
    `Input Tokens:       \x1b[36m${inputTokens.toString().padStart(6)}\x1b[0m`,
    `Output Tokens:      \x1b[36m${outputTokens.toString().padStart(6)}\x1b[0m`,
    `Total Tokens:       \x1b[36m${totalTokens.toString().padStart(6)}\x1b[0m`,
    `Request Cost:       \x1b[33m$${requestCost.toFixed(6)}\x1b[0m`,
    '',
    `Total Spent:        \x1b[31m$${stats.spent.toFixed(6)}\x1b[0m`,
    `Remaining:          \x1b[32m$${stats.remaining.toFixed(2)}\x1b[0m`,
    `Balance:           ${bar}`,
    `Total Requests:    \x1b[36m${stats.requests}\x1b[0m`,
    `Est. Requests Left: \x1b[33m~${stats.estimatedRequestsLeft}\x1b[0m`
  ];
  
  console.log('\n' + createBox(usageLines, '\x1b[36m', true).join('\n') + '\n');
}

const app = express();
app.use(cors({ origin: ["http://localhost:5173"], credentials: false }));
app.use(express.json({ limit: "1mb" }));

function isInside(base, target) {
  const rel = path.relative(base, target);
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function encodeFileUrl(file) {
  return "/music/" + encodeURIComponent(file);
}

function normalizeName(name) {
  return name.replace(/[\\\/]+/g, "_").trim();
}

async function uniqueFilePath(folder, fileName) {
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  let candidate = fileName;
  let i = 1;
  while (true) {
    const full = path.join(folder, candidate);
    try {
      await fsp.access(full);
      candidate = `${base} (${i})${ext}`;
      i += 1;
    } catch {
      return full;
    }
  }
}

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      await fsp.mkdir(MUSIC_FOLDER, { recursive: true });
      cb(null, MUSIC_FOLDER);
    } catch (e) {
      cb(e);
    }
  },
  filename: async (_req, file, cb) => {
    const raw = normalizeName(file.originalname);
    cb(null, raw);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.originalname.toLowerCase().endsWith(".mp3");
    cb(ok ? null : new Error("only_mp3"), ok);
  },
});

app.get("/api/tracks", async (_req, res) => {
  try {
    await fsp.mkdir(MUSIC_FOLDER, { recursive: true });
    const files = (await fsp.readdir(MUSIC_FOLDER))
      .filter((f) => f.toLowerCase().endsWith(".mp3"))
      .sort((a, b) => a.localeCompare(b));

    const tracks = files.map((f) => ({
      id: f,
      file: f,
      title: f.replace(/\.mp3$/i, ""),
      url: encodeFileUrl(f),
    }));

    log.info(`Tracks loaded: ${tracks.length}`);
    res.json({ tracks });
  } catch (e) {
    log.error("Failed to load tracks", e.message);
    res.status(500).json({ error: "tracks_error" });
  }
});

app.get("/music/*", async (req, res) => {
  try {
    const rel = decodeURIComponent(req.params[0] || "");
    const full = path.join(MUSIC_FOLDER, rel);
    if (!isInside(MUSIC_FOLDER, full)) return res.status(400).end();

    const st = await fsp.stat(full);
    if (!st.isFile()) return res.status(404).end();

    const range = req.headers.range;
    const contentType = "audio/mpeg";

    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", contentType);

    if (!range) {
      res.setHeader("Content-Length", st.size);
      fs.createReadStream(full).pipe(res);
      return;
    }

    const m = /^bytes=(\d+)-(\d+)?$/i.exec(range);
    if (!m) {
      res.status(416).end();
      return;
    }

    const start = Number(m[1]);
    const end = m[2] ? Number(m[2]) : st.size - 1;
    if (start >= st.size || end >= st.size || start > end) {
      res.status(416).end();
      return;
    }

    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${st.size}`);
    res.setHeader("Content-Length", end - start + 1);

    fs.createReadStream(full, { start, end }).pipe(res);
  } catch {
    res.status(404).end();
  }
});

app.post("/api/upload", upload.array("files", 200), async (req, res) => {
  try {
    const files = req.files || [];
    for (const f of files) {
      const cur = path.join(MUSIC_FOLDER, f.filename);
      const target = await uniqueFilePath(MUSIC_FOLDER, f.filename);
      if (target !== cur) {
        await fsp.rename(cur, target);
      }
    }
    log.success(`Files uploaded: ${files.length}`);
    res.json({ ok: true });
  } catch (e) {
    log.error("Upload failed", e.message);
    res.status(400).json({ ok: false, error: "upload_failed" });
  }
});

app.post("/api/tracks/delete", async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const uniqueIds = [...new Set(ids.map((v) => String(v || "").trim()).filter(Boolean))];

    if (uniqueIds.length === 0) {
      return res.status(400).json({ ok: false, error: "no_tracks_selected" });
    }

    const deleted = [];
    const failed = [];

    for (const id of uniqueIds) {
      const safeName = path.basename(id);
      if (safeName !== id || !safeName.toLowerCase().endsWith(".mp3")) {
        failed.push({ id, reason: "invalid_track_id" });
        continue;
      }

      const full = path.join(MUSIC_FOLDER, safeName);
      if (!isInside(MUSIC_FOLDER, full)) {
        failed.push({ id, reason: "outside_music_folder" });
        continue;
      }

      try {
        await fsp.unlink(full);
        deleted.push(safeName);
      } catch (e) {
        if (e?.code === "ENOENT") {
          failed.push({ id, reason: "not_found" });
        } else {
          failed.push({ id, reason: "delete_failed" });
        }
      }
    }

    log.info(`Tracks delete requested: ${uniqueIds.length}`, { deleted: deleted.length, failed: failed.length });
    return res.json({ ok: true, deleted, failed });
  } catch (e) {
    log.error("Failed to delete tracks", e.message);
    return res.status(500).json({ ok: false, error: "delete_tracks_failed" });
  }
});


app.post("/api/chat", async (req, res) => {
  const msg = String(req.body?.message || "").trim();
  if (!msg) return res.json({ reply: "Напиши сообщение" });

  if (!openai) {
    return res.json({ reply: "GPT не настроен. Добавь OPENAI_API_KEY в .env файл." });
  }

  try {
    log.info(`\x1b[36m[GPT Request]\x1b[0m "${msg.substring(0, 60)}${msg.length > 60 ? '...' : ''}"`);
    
    const systemPrompt = `Ты музыкальный помощник в веб-приложении для прослушивания музыки. 

Твоя задача:
- Помогать пользователям с вопросами о музыке, треках, плейлистах, жанрах, исполнителях и музыкальных настройках
- Отвечать на приветствия (привет, как дела и т.д.) дружелюбно и в контексте музыкального приложения
- Отвечать на вопросы о популярной музыке, рекомендациях треков, жанрах музыки
- Помогать с настройками музыкального плеера (эквалайзер, громкость, повтор и т.д.)
- Помнить контекст предыдущих сообщений в разговоре

ВАЖНО:
- Если вопрос НЕ связан с музыкой (программирование, политика, личные данные, общие вопросы не о музыке), вежливо откажись отвечать и предложи задать музыкальный вопрос
- Отвечай кратко, дружелюбно и по делу
- Используй русский язык
- На приветствия отвечай в контексте музыкального приложения (например: "Привет! Что включим сегодня?" или "Привет! Готов помочь с музыкой!")
- Помни предыдущие сообщения пользователя и используй этот контекст для более точных ответов`;

    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    const validHistory = history
      .filter(h => h && typeof h.role === 'string' && typeof h.content === 'string')
      .filter(h => h.role === 'user' || h.role === 'assistant')
      .slice(-15);

    const messages = [
      { role: "system", content: systemPrompt },
      ...validHistory,
      { role: "user", content: msg }
    ];

    const completion = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: messages,
      max_tokens: 250,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content?.trim() || "Не удалось получить ответ";
    
    const usage = completion.usage;
    if (usage) {
      const inputTokens = usage.prompt_tokens || 0;
      const outputTokens = usage.completion_tokens || 0;
      const totalTokens = usage.total_tokens || 0;
      const requestCost = (inputTokens * GPT_INPUT_PRICE) + (outputTokens * GPT_OUTPUT_PRICE);
      
      totalSpent += requestCost;
      totalRequests++;
      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;
      
      const stats = formatUsageStats();
      logUsageBox(stats, requestCost, inputTokens, outputTokens, totalTokens);
    } else {
      log.success(`Chat GPT response: "${reply.substring(0, 50)}..."`);
    }
    
    return res.json({ reply });
  } catch (err) {
    const errorCode = err.code || err.status || 'unknown';
    const errorMessage = err.message || 'Unknown error';
    
    console.log(`\x1b[31m╔════════════════════════════════════════════════════════════╗\x1b[0m`);
    console.log(`\x1b[31m║\x1b[0m  \x1b[31mGPT Request Failed\x1b[0m${' '.repeat(38)}\x1b[31m║\x1b[0m`);
    console.log(`\x1b[31m╠════════════════════════════════════════════════════════════╣\x1b[0m`);
    console.log(`\x1b[31m║\x1b[0m  Error Code:    \x1b[33m${String(errorCode).padEnd(40)}\x1b[31m║\x1b[0m`);
    console.log(`\x1b[31m║\x1b[0m  Error Message: \x1b[33m${errorMessage.substring(0, 40).padEnd(40)}\x1b[31m║\x1b[0m`);
    console.log(`\x1b[31m╚════════════════════════════════════════════════════════════╝\x1b[0m`);
    
    if (err.status === 429 || err.code === 'insufficient_quota' || errorMessage.includes('quota')) {
      const stats = formatUsageStats();
      console.log(`\x1b[33m[WARN]\x1b[0m Quota exceeded. Remaining balance: $${stats.remaining.toFixed(2)}`);
      return res.json({ reply: `К сожалению, превышен лимит запросов к GPT или закончился баланс (осталось ~$${stats.remaining.toFixed(2)}). Проверь баланс на platform.openai.com или попробуй позже.` });
    }
    
    if (err.status === 401 || errorMessage.includes('Invalid API key') || errorMessage.includes('authentication')) {
      log.error("OpenAI API key is invalid");
      return res.json({ reply: "Ошибка авторизации GPT. Проверь API ключ в настройках." });
    }
    
    return res.json({ reply: `Ошибка GPT (${errorCode}): ${errorMessage.substring(0, 100)}. Попробуй позже.` });
  }
});

function smtpReady() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function makeTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  
  const options = {
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false,
      ciphers: 'SSLv3',
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  };
  
  return nodemailer.createTransport(options);
}

app.post("/api/feedback", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim();
    const message = String(req.body?.message || "").trim();

    if (message.length < 3) return res.status(400).json({ ok: false, error: "message_too_short" });

    if (!smtpReady()) {
      const missing = [];
      if (!process.env.SMTP_HOST) missing.push("SMTP_HOST");
      if (!process.env.SMTP_USER) missing.push("SMTP_USER");
      if (!process.env.SMTP_PASS) missing.push("SMTP_PASS");
      return res.status(501).json({ 
        ok: false, 
        error: `SMTP не настроен. Отсутствуют: ${missing.join(", ")}` 
      });
    }

    const transport = makeTransport();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    const subject = "MusicWeb: Пожелание";
    const text = [
      `Имя: ${name || "-"}`,
      `Email: ${email || "-"}`,
      "",
      message,
    ].join("\n");

    await transport.verify();
    log.success("SMTP connection verified");

    await transport.sendMail({
      from,
      to: FEEDBACK_TO,
      subject,
      text,
    });

    log.success(`Email sent to ${FEEDBACK_TO}`);
    res.json({ ok: true });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "send_failed";
    
    if (err.code === 'ECONNREFUSED') {
      log.error("SMTP connection refused", err.message);
      res.status(500).json({ 
        ok: false, 
        error: "Не удалось подключиться к SMTP серверу. Проверьте файрвол и интернет-соединение." 
      });
    } else if (err.code === 'EAUTH') {
      log.error("SMTP authentication failed", err.message);
      res.status(500).json({ 
        ok: false, 
        error: "Ошибка аутентификации. Проверьте логин и пароль приложения." 
      });
    } else {
      log.error("Feedback send failed", errorMsg);
      res.status(500).json({ ok: false, error: errorMsg });
    }
  }
});

let popularCache = { t: 0, items: [] };

function parseAcharts(html, limit) {
  const items = [];
  const reRow = /<tr[^>]*>\s*<td[^>]*>\s*(\d+)\s*<\/td>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<br[^>]*>\s*<a[^>]*>([^<]+)<\/a>/gi;
  let m;
  while ((m = reRow.exec(html))) {
    const rank = Number(m[1]);
    const href = m[2];
    const title = String(m[3] || "").trim();
    const artist = String(m[4] || "").trim();
    if (!rank || !title) continue;
    const url = href.startsWith("http") ? href : `https://acharts.co${href.startsWith("/") ? "" : "/"}${href}`;
    items.push({ rank, title, artist: artist || "Unknown", url });
    if (items.length >= limit) break;
  }
  return items;
}

function parseBillboardBasic(html, limit) {
  const items = [];
  const blockRe = /<h3[^>]*id="title-of-a-story"[^>]*>([\s\S]*?)<\/h3>/gi;
  let m;
  while ((m = blockRe.exec(html))) {
    const title = String(m[1] || "").replace(/\s+/g, " ").trim();
    if (!title || title.toLowerCase() === "songwriter(s)") continue;
    items.push({ title });
    if (items.length >= limit * 2) break;
  }
  const uniq = [];
  const seen = new Set();
  for (const it of items) {
    const k = it.title.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(it.title);
    if (uniq.length >= limit) break;
  }
  return uniq.map((t, i) => ({
    rank: i + 1,
    title: t,
    artist: "",
    url: "https://www.billboard.com/charts/hot-100/"
  }));
}

app.get("/api/popular", async (req, res) => {
  const limit = Math.max(1, Math.min(100, Number(req.query.limit || 100) || 100));
  const now = Date.now();
  if (popularCache.items.length > 0 && now - popularCache.t < 30 * 60 * 1000) {
    log.info(`Popular tracks (cached): ${limit}`);
    return res.json({ items: popularCache.items.slice(0, limit) });
  }

  const headers = {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "accept-language": "en-US,en;q=0.9,ru;q=0.8",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };

  try {
    const bb = await fetch("https://www.billboard.com/charts/hot-100/", { headers, redirect: "follow" });
    if (bb.ok) {
      const html = await bb.text();
      const items = parseBillboardBasic(html, limit);
      if (items.length > 0) {
        popularCache = { t: now, items };
        log.success(`Popular tracks loaded from Billboard: ${items.length}`);
        return res.json({ items: items.slice(0, limit) });
      }
    }
  } catch (e) {
    log.warn("Billboard fetch failed", e.message);
  }

  try {
    const ac = await fetch("https://acharts.co/us_singles_top_100", { headers, redirect: "follow" });
    if (!ac.ok) throw new Error("acharts_failed");
    const html = await ac.text();
    const items = parseAcharts(html, limit);
    if (items.length > 0) {
      popularCache = { t: now, items };
      log.success(`Popular tracks loaded from Acharts: ${items.length}`);
      return res.json({ items: items.slice(0, limit) });
    }
  } catch (e) {
    log.warn("Acharts fetch failed", e.message);
  }

  log.warn("No popular tracks available");
  res.json({ items: [] });
});

function createBox(lines, color = '\x1b[36m', addSeparators = false) {
  const maxLen = Math.max(...lines.map(l => {
    const text = l.replace(/\x1b\[[0-9;]*m/g, '');
    return text.length;
  }));
  const width = maxLen + 4;
  const top = color + '╔' + '═'.repeat(Math.max(2, width - 2)) + '╗\x1b[0m';
  const bottom = color + '╚' + '═'.repeat(Math.max(2, width - 2)) + '╝\x1b[0m';
  const sep = color + '╠' + '═'.repeat(Math.max(2, width - 2)) + '╣\x1b[0m';
  const result = [top];
  
  lines.forEach((line, i) => {
    const textLen = line.replace(/\x1b\[[0-9;]*m/g, '').length;
    const padding = Math.max(0, width - textLen - 4);
    result.push(`${color}║\x1b[0m ${line}${' '.repeat(padding)} ${color}║\x1b[0m`);
    
    if (addSeparators && i < lines.length - 1 && lines[i + 1] === '') {
      result.push(sep);
    }
  });
  
  result.push(bottom);
  return result;
}

app.listen(PORT, async () => {
  await fsp.mkdir(MUSIC_FOLDER, { recursive: true }).catch(() => {});
  const lines = [
    '\x1b[36mMusicWeb Server Started\x1b[0m',
    `Server: \x1b[33mhttp://localhost:${PORT}\x1b[0m`,
    `Music:  \x1b[33m${MUSIC_FOLDER}\x1b[0m`,
  ];
  console.log('\n' + createBox(lines, '\x1b[32m', false).join('\n') + '\n');
});
