# Серверная часть

## Описание задачи

Реализация REST API сервера для проекта **Melody** на базе **Express.js**.  
Сервер обеспечивает взаимодействие между клиентом (React) и базой данных (PostgreSQL).

---

## Что изменилось в этой ветке

- Создан `landing/server/index.js` — точка входа: настройка Express, CORS, middlewares, инициализация БД, запуск
- Создана структура маршрутов `landing/server/routes/`
- Создана структура контроллеров `landing/server/controllers/`
- Создана структура сервисов `landing/server/services/`
- Добавлены дополнительные роуты: GPT-чат, обратная связь, популярное (`extraRoutes.js`)
- Настроен прокси в `landing/vite.config.ts` (dev-режим)

---

## Архитектура сервера

```
index.js  (точка входа)
    │
    ├── routes/authRoutes.js       → controllers/authController.js   → services/userService.js
    ├── routes/trackRoutes.js      → controllers/trackController.js  → services/trackService.js
    ├── routes/albumRoutes.js      → controllers/albumController.js  → services/albumService.js
    ├── routes/profileRoutes.js    → controllers/profileController.js
    └── routes/extraRoutes.js      (chat, feedback, popular — инлайн)
```

Каждый запрос получает `req.pool` и `req.uploadsRoot` через глобальный middleware.

---

## Переменные окружения

Файл: `landing/server/.env`

```env
DATABASE_URL=postgresql://melody:melody@localhost:5432/melody
JWT_SECRET=melody_dev_secret_XXXXXXXXXXXX   # минимум 16 символов
PORT=8787
CORS_ORIGIN=http://localhost:5173

# SMTP (необязательно — для формы обратной связи)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@gmail.com
SMTP_PASS=app_password
SMTP_FROM=your@gmail.com
FEEDBACK_TO=target@gmail.com

# OpenAI (необязательно — для GPT-чата)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxx
```

> Без `DATABASE_URL` и `JWT_SECRET` сервер не запустится.

---

## API эндпоинты

### Авторизация
| Метод  | Путь                   | Описание                    |
|--------|------------------------|-----------------------------|
| POST   | `/api/auth/register`   | Регистрация пользователя    |
| POST   | `/api/auth/login`      | Вход                        |
| POST   | `/api/auth/logout`     | Выход (очищает cookie)      |
| GET    | `/api/me`              | Текущий пользователь        |
| DELETE | `/api/users/me`        | Удалить аккаунт             |

### Треки
| Метод  | Путь                   | Описание                    |
|--------|------------------------|-----------------------------|
| GET    | `/api/tracks`          | Треки пользователя          |
| POST   | `/api/upload`          | Загрузка mp3 (multipart)    |
| POST   | `/api/tracks/delete`   | Удаление треков             |
| GET    | `/api/search`          | Поиск треков                |
| GET    | `/music/:owner/:file`  | Стриминг mp3 (range-запросы)|

### Альбомы
| Метод  | Путь                          | Описание              |
|--------|-------------------------------|-----------------------|
| GET    | `/api/albums`                 | Список альбомов       |
| POST   | `/api/albums`                 | Создать альбом        |
| GET    | `/api/albums/:id`             | Альбом с треками      |
| PATCH  | `/api/albums/:id`             | Переименовать         |
| DELETE | `/api/albums/:id`             | Удалить альбом        |
| POST   | `/api/albums/:id/tracks`      | Добавить трек         |
| DELETE | `/api/albums/:id/tracks/:tid` | Убрать трек           |

### Профиль
| Метод | Путь                        | Описание                 |
|-------|-----------------------------|--------------------------|
| GET   | `/api/profile/me`           | Профиль + треки (я)      |
| GET   | `/api/users/:id/profile`    | Публичный профиль        |

### Прочее
| Метод | Путь             | Описание                        |
|-------|------------------|---------------------------------|
| GET   | `/api/popular`   | Топ-20 треков (хардкод Billboard)|
| POST  | `/api/chat`      | GPT-чат (требует OPENAI_API_KEY)|
| POST  | `/api/feedback`  | Форма обратной связи (SMTP)     |

---

## Установка и запуск

```bash
# 1. Перейти в папку сервера
cd landing/server

# 2. Установить зависимости
npm install

# 3. Создать .env (пример выше)

# 4. Убедиться, что БД запущена
docker compose up -d db   # из корня проекта

# 5. Запустить сервер
node index.js
```

**Ожидаемый вывод:**
```
[DB] Schema initialized
[SERVER] Running on http://localhost:8787
```

---

## Зависимости

| Пакет          | Назначение                        |
|----------------|-----------------------------------|
| `express`      | HTTP-фреймворк                    |
| `pg`           | PostgreSQL клиент                 |
| `bcrypt`       | Хэширование паролей               |
| `jsonwebtoken` | JWT-токены                        |
| `cookie-parser`| Чтение HTTP cookies               |
| `cors`         | CORS-заголовки                    |
| `multer`       | Загрузка файлов (multipart)       |
| `dotenv`       | Загрузка `.env`                   |
| `nodemailer`   | Отправка email                    |
| `openai`       | GPT-чат                           |

---
