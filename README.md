# Задание 6 — Backend, PostgreSQL, аутентификация, загрузка mp3

## Ветка: `feature/PROJ-006-backend-postgresql-auth`

---

## Что сделано в этой ветке

Настроено подключение к PostgreSQL, реализована аутентификация через JWT + cookie, настроена загрузка mp3-файлов через multer.

---

## Настройка окружения

Создайте файл `landing/server/.env`:

```dotenv
# База данных
DATABASE_URL=postgresql://melody:melody@localhost:5432/melody

# Если на Windows конфликт портов PostgreSQL:
# DATABASE_URL=postgresql://melody:melody@localhost:55433/melody

# JWT секрет (минимум 16 символов)
JWT_SECRET=melody_dev_secret_34563568666754674563434352

# Порт сервера
PORT=8787

# CORS
CORS_ORIGIN=http://localhost:5173

# SMTP для формы обратной связи (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=ваш_gmail@gmail.com
SMTP_PASS=пароль_приложения_gmail
SMTP_FROM=ваш_gmail@gmail.com
FEEDBACK_TO=куда_слать@gmail.com

# OpenAI для GPT чата (опционально)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Запуск базы данных

```bash
# Запустить PostgreSQL через Docker
docker compose up -d db

# Проверить статус
docker compose ps
```

> **Windows:** если установлен локальный PostgreSQL — он занимает порт 5432.
> Измените в `docker-compose.yml`:
> ```yaml
> ports:
>   - "55433:5432"
> ```
> И в `.env` используйте порт `55433`.

---

## Запуск сервера

```bash
cd landing/server
npm install
node index.js
```

Ожидаемый вывод:
```
[DB] Schema initialized
[SERVER] Running on http://localhost:8787
```

---

## Аутентификация

- Регистрация: хеширование пароля bcrypt + JWT в httpOnly cookie
- Вход: проверка пароля + выдача JWT (срок 7 дней)
- Выход: очистка cookie
- Защита маршрутов: middleware `requireAuth`

Требования к паролю: минимум 12 символов, должны быть буква и цифра.

---

## Загрузка mp3

- Маршрут: `POST /api/upload`
- Файлы сохраняются в `uploads/<userId>/<uuid>.mp3`
- Разрешены только `.mp3` файлы
- Максимальный размер: 200 MB
- Метаданные сохраняются в таблицу `tracks`

---

## Проверка API

```bash
# Проверка сервера
curl http://localhost:8787/api/me
# Ответ: {"error":"unauthorized"} — сервер работает

# Регистрация
curl -X POST http://localhost:8787/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123456789","displayName":"TestUser"}'

# Вход
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123456789"}'
```

---

## Коммиты ветки

- `feat(db): подключение PostgreSQL через переменную DATABASE_URL`
- `feat(auth): реализация регистрации пользователя с хешированием пароля`
- `feat(auth): реализация входа и выдачи JWT токена в cookie`
- `feat(auth): реализация выхода и очистки cookie`
- `feat(auth): добавлен маршрут GET /api/me для текущего пользователя`
- `feat(middleware): добавлен requireAuth для защиты приватных маршрутов`
- `feat(upload): загрузка mp3 файлов через multer в папку uploads/<userId>`
- `feat(upload): сохранение метаданных файла в таблицу tracks`
- `feat(upload): валидация типа файла и обработка ошибок загрузки`
- `chore(env): настройка переменных окружения через dotenv`
