import { Router } from 'express';
import nodemailer from 'nodemailer';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// =====================
// POST /api/chat — GPT чат
// =====================
router.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const { message, history = [] } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'no_message' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.json({ reply: 'GPT чат не настроен. Добавьте OPENAI_API_KEY в .env файл.' });
    }

    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey });

    const messages = [
      {
        role: 'system',
        content: 'Ты музыкальный ассистент приложения Melody. Помогаешь пользователям с музыкой, треками и плейлистами. Отвечай кратко и по делу на русском языке.',
      },
      ...history.slice(-10),
      { role: 'user', content: message.slice(0, 500) },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
      max_tokens: 300,
    });

    const reply = completion.choices[0]?.message?.content?.trim() || 'Не могу ответить';
    res.json({ reply });
  } catch (e) {
    console.error('[CHAT ERROR]', e?.message || e);
    res.json({ reply: 'Ошибка GPT. Проверьте OPENAI_API_KEY в .env файле.' });
  }
});

// =====================
// POST /api/feedback — форма обратной связи
// =====================
router.post('/api/feedback', async (req, res) => {
  try {
    const { name, email, message } = req.body || {};
    if (!message || message.trim().length < 3) {
      return res.status(400).json({ ok: false, error: 'too_short' });
    }

    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const to = process.env.FEEDBACK_TO;

    if (!host || !user || !pass || !to) {
      console.warn('[FEEDBACK] SMTP not configured — skipping email send');
      return res.json({ ok: true });
    }

    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || user,
      to,
      subject: `Melody: пожелание от ${name || 'аноним'}`,
      text: `От: ${name || '—'}\nEmail: ${email || '—'}\n\n${message}`,
    });

    res.json({ ok: true });
  } catch (e) {
    console.error('[FEEDBACK ERROR]', e?.message || e);
    res.status(500).json({ ok: false, error: 'smtp_failed' });
  }
});

// =====================
// GET /api/popular — популярные треки
// =====================
router.get('/api/popular', async (_req, res) => {
  try {
    const items = [
      { rank: 1,  title: 'Espresso',              artist: 'Sabrina Carpenter',          url: 'https://www.billboard.com/charts/hot-100/' },
      { rank: 2,  title: 'Please Please Please',   artist: 'Sabrina Carpenter',          url: 'https://www.billboard.com/charts/hot-100/' },
      { rank: 3,  title: 'A Bar Song (Tipsy)',     artist: 'Shaboozey',                  url: 'https://www.billboard.com/charts/hot-100/' },
      { rank: 4,  title: 'Good Luck, Babe!',       artist: 'Chappell Roan',              url: 'https://www.billboard.com/charts/hot-100/' },
      { rank: 5,  title: 'Die With A Smile',       artist: 'Lady Gaga & Bruno Mars',     url: 'https://www.billboard.com/charts/hot-100/' },
      { rank: 6,  title: 'Taste',                  artist: 'Sabrina Carpenter',          url: 'https://www.billboard.com/charts/hot-100/' },
      { rank: 7,  title: 'APT.',                   artist: 'ROSE & Bruno Mars',          url: 'https://www.billboard.com/charts/hot-100/' },
      { rank: 8,  title: 'Birds Of A Feather',     artist: 'Billie Eilish',              url: 'https://www.billboard.com/charts/hot-100/' },
      { rank: 9,  title: 'Luther',                 artist: 'Kendrick Lamar & SZA',      url: 'https://www.billboard.com/charts/hot-100/' },
      { rank: 10, title: 'TEXAS HOLD EM',          artist: 'Beyoncé',                    url: 'https://www.billboard.com/charts/hot-100/' },
      { rank: 11, title: 'Not Like Us',            artist: 'Kendrick Lamar',             url: 'https://www.billboard.com/charts/hot-100/' },
      { rank: 12, title: 'Beautiful Things',       artist: 'Benson Boone',               url: 'https://www.billboard.com/charts/hot-100/' },
      { rank: 13, title: 'Lose Control',           artist: 'Teddy Swims',                url: 'https://www.billboard.com/charts/hot-100/' },
      { rank: 14, title: 'Too Sweet',              artist: 'Hozier',                     url: 'https://www.billboard.com/charts/hot-100/' },
      { rank: 15, title: 'Stargazing',             artist: 'Myles Smith',                url: 'https://www.billboard.com/charts/hot-100/' },
      { rank: 16, title: 'Sailor Song',            artist: 'Gigi Perez',                 url: 'https://www.billboard.com/charts/hot-100/' },
      { rank: 17, title: 'I Had Some Help',        artist: 'Post Malone ft. Morgan Wallen', url: 'https://www.billboard.com/charts/hot-100/' },
      { rank: 18, title: 'Paris',                  artist: 'The Chainsmokers',           url: 'https://www.billboard.com/charts/hot-100/' },
      { rank: 19, title: 'Wildflower',             artist: 'Billie Eilish',              url: 'https://www.billboard.com/charts/hot-100/' },
      { rank: 20, title: 'One Of The Girls',       artist: 'The Weeknd',                 url: 'https://www.billboard.com/charts/hot-100/' },
    ];
    res.json({ items });
  } catch {
    res.json({ items: [] });
  }
});

export default router;
