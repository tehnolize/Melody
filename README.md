# MELODY — инструкция по запуску

## Описание 
Ветка отвечает за работу с медиаконтентом и пользовательскими данными: профиль, плейлисты, очередь воспроизведения, загрузка треков.

Краткое руководство по локальному запуску клиента, сервера и базы данных.

---

# Запуск 
```bash
git checkout feature/PROJ-007-music-core-profile
npm install 
cp .env.example .env
npm run dev

## Содержание

1. [Требования](#1-требования)  
2. [Клонирование репозитория](#2-клонирование-репозитория)  
3. [Конфликт портов PostgreSQL (Windows)](#3-конфликт-портов-postgresql-windows)  
4. [Переменные окружения (.env)](#4-переменные-окружения-env)  
5. [Запуск БД (Docker)](#5-запуск-бд-docker)  
6. [Установка зависимостей](#6-установка-зависимостей)  
7. [Запуск сервера](#7-запуск-сервера)  
8. [Запуск клиента](#8-запуск-клиента)  
9. [Открытие сайта](#9-открытие-сайта)  
10. [Проверка](#10-проверка)  
11. [Быстрый старт](#11-быстрый-старт)  
12. [Проблемы](#12-проблемы)  
13. [Структура проекта](#13-структура-проекта)  
14. [API](#14-api)

---

## 1. Требования

Перед началом убедитесь, что установлено:

| Что нужно | Ссылка |
|-----------|--------|
| **Node.js** v18 или выше | [nodejs.org](https://nodejs.org/) |
| **Git** | [git-scm.com](https://git-scm.com/) |
| **Docker Desktop** | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) |

**Проверка версий** (в терминале):

```powershell
node -v
npm -v
git --version
docker -v
```

---

## 2. Клонирование репозитория

```powershell
cd C:\Users\ВАШ_ПОЛЬЗОВАТЕЛЬ\Downloads
git clone -b feature/PROJ-007-music-core-profile https://github.com/tehnolize/Melody.git site
cd site
```

> Замените `ВАШ_ПОЛЬЗОВАТЕЛЬ` на имя пользователя Windows.

---

## 3. Конфликт портов PostgreSQL (Windows)

Если порт **5432** занят локальным PostgreSQL:

1. Откройте файл `docker-compose.yml` в корне `site/`.
2. Измените проброс порта для сервиса БД.

**Было:**

```yaml
ports:
  - "5432:5432"
```

**Стало:**

```yaml
ports:
  - "55433:5432"
```

В `DATABASE_URL` тогда используйте порт **55433** (см. следующий раздел).

---

## 4. Переменные окружения (.env)

Создайте или отредактируйте файл:

**`landing/server/.env`**

```env
# Без конфликта портов
DATABASE_URL=postgresql://melody:melody@localhost:5432/melody

# С конфликтом портов (если в docker-compose проброшен 55433)
# DATABASE_URL=postgresql://melody:melody@localhost:55433/melody

JWT_SECRET=melody_dev_secret_XXXXXXXXXXXX
PORT=8787

# Дополнительно
CORS_ORIGIN=http://localhost:5173

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@gmail.com
SMTP_PASS=app_password
SMTP_FROM=your@gmail.com
FEEDBACK_TO=target@gmail.com

OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxx
```

> Оставьте в файле **одну** актуальную строку `DATABASE_URL` под ваш порт.

Пример для копирования можно взять из `landing/server/.env.example`, если он есть в репозитории.

---

## 5. Запуск БД (Docker)

Из корня проекта (`site/`):

```powershell
cd site
docker compose down -v
docker compose up -d db
docker compose ps
```

---

## 6. Установка зависимостей

**Клиент** (`landing/`):

```powershell
cd site\landing
npm install
```

**Сервер** (`landing/server/`):

```powershell
cd site\landing\server
npm install
```

---

## 7. Запуск сервера

```powershell
cd site\landing\server
node index.js
```

**Ожидаемый вывод:**

```text
=======
# Задание 6 — Backend, PostgreSQL, аутентификация, загрузка mp3

## Ветка: `feature/PROJ-006-backend-postgresql-auth`

## Описание 
Векта реализует систему безопасности: регистрация, вход, JWT-токены, восстановление пароля и защита маршрутов.

---

## Что сделано в этой ветке

Настроено подключение к PostgreSQL, реализована аутентификация через JWT + cookie, настроена загрузка mp3-файлов через multer.

---

## Запуск
```bash
git checkout feature/PROJ-006-backend-postgresql-auth
npm install
cp .env.example .env
npm run dev

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
>>>>>>> origin/main
[DB] Schema initialized
[SERVER] Running on http://localhost:8787
```

---


## 8. Запуск клиента

В **новом** терминале:

```powershell
cd site\landing
npm run dev
```

**Ожидается:** адрес вида [http://localhost:5173](http://localhost:5173)

---

## 9. Открытие сайта

Откройте в браузере:

**[http://localhost:5173](http://localhost:5173)**

---

## 10. Проверка

```powershell
curl http://localhost:8787/api/me
```

Ожидается ответ с ошибкой авторизации, например:

```json
{"error":"unauthorized"}
```

```powershell
curl http://localhost:8787/api/popular
```

Ожидается JSON с массивом популярного контента, например:

```json
{"items":[...]}
=======
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
>>>>>>> origin/main
```

---


## 11. Быстрый старт

| Терминал | Команды (из корня `site/`, если не указано иначе) |
|----------|---------------------------------------------------|
| **1** | `docker compose up -d db` |
| **2** | `cd landing\server` → `node index.js` |
| **3** | `cd landing` → `npm run dev` |

---

## 12. Проблемы

| Симптом | Что сделать |
|---------|-------------|
| `npm error Missing script "dev"` | Для API используйте `node index.js` в папке `landing/server`. |
| `DATABASE_URL is not set` | Создайте `landing/server/.env` и задайте переменные. |
| `password authentication failed` | Часто конфликт порта с локальным Postgres — смените проброс на **55433** и обновите `DATABASE_URL`. |
| `EADDRINUSE` | Освободите порт **8787** или смените `PORT` в `.env`. |
| Ошибка **bcrypt** (Mac) | `npm install bcrypt --build-from-source` |

---

## 13. Структура проекта

```text
site/
├── docker-compose.yml
├── DB_STRUCTURE.md
├── README.md
└── landing/
    ├── src/
    │   └── App.tsx
    ├── package.json
    └── server/
        ├── index.js
        ├── .env
        ├── .env.example
        ├── package.json
        ├── routes/
        ├── controllers/
        ├── services/
        ├── middleware/
        ├── db/
        └── uploads/
```

---

## 14. API

| Метод | Путь |
|-------|------|
| `POST` | `/api/auth/register` |
| `POST` | `/api/auth/login` |
| `POST` | `/api/auth/logout` |
| `GET` | `/api/me` |
| `DELETE` | `/api/users/me` |
| `GET` | `/api/tracks` |
| `POST` | `/api/upload` |
| `POST` | `/api/tracks/delete` |
| `GET` | `/api/search` |
| `GET` | `/api/albums` |
| `POST` | `/api/albums` |
| `PATCH` | `/api/albums/:id` |
| `DELETE` | `/api/albums/:id` |
| `GET` | `/api/profile/me` |
| `GET` | `/api/popular` |
| `POST` | `/api/chat` |
| `POST` | `/api/feedback` |
| `GET` | `/music/:ownerId/:filename` |

---
=======
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
