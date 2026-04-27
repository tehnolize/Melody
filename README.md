================================================================================
                        MELODY — ИНСТРУКЦИЯ ПО ЗАПУСКУ
================================================================================

1. ТРЕБОВАНИЯ
--------------------------------------------------------------------------------

Перед началом убедитесь, что установлено:

- Node.js v18 или выше       https://nodejs.org/
- Git                        https://git-scm.com/
- Docker Desktop             https://www.docker.com/products/docker-desktop/

Проверка версий:
  node -v
  npm -v
  git --version
  docker -v

--------------------------------------------------------------------------------
2. КЛОНИРОВАНИЕ РЕПОЗИТОРИЯ
--------------------------------------------------------------------------------

cd C:\Users\ВАШ_ПОЛЬЗОВАТЕЛЬ\Downloads
git clone -b feature/PROJ-007-music-core-profile https://github.com/tehnolize/Melody.git site
cd site

--------------------------------------------------------------------------------
3. КОНФЛИКТ ПОРТОВ POSTGRESQL (WINDOWS)
--------------------------------------------------------------------------------

Если порт 5432 занят локальным PostgreSQL:

Откройте docker-compose.yml

БЫЛО:
  ports:
    - "5432:5432"

СТАЛО:
  ports:
    - "55433:5432"

--------------------------------------------------------------------------------
4. ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ (.env)
--------------------------------------------------------------------------------

Файл: landing/server/.env

# Без конфликта портов
DATABASE_URL=postgresql://melody:melody@localhost:5432/melody

# С конфликтом портов
DATABASE_URL=postgresql://melody:melody@localhost:55433/melody

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

--------------------------------------------------------------------------------
5. ЗАПУСК БД (DOCKER)
--------------------------------------------------------------------------------

cd site
docker compose down -v
docker compose up -d db
docker compose ps

--------------------------------------------------------------------------------
6. УСТАНОВКА ЗАВИСИМОСТЕЙ
--------------------------------------------------------------------------------

# Клиент
cd site\landing
npm install

# Сервер
cd site\landing\server
npm install

--------------------------------------------------------------------------------
7. ЗАПУСК СЕРВЕРА
--------------------------------------------------------------------------------

cd site\landing\server
node index.js

Ожидается:
[DB] Schema initialized
[SERVER] Running on http://localhost:8787

--------------------------------------------------------------------------------
8. ЗАПУСК КЛИЕНТА
--------------------------------------------------------------------------------

(в новом терминале)

cd site\landing
npm run dev

Ожидается:
http://localhost:5173

--------------------------------------------------------------------------------
9. ОТКРЫТИЕ САЙТА
--------------------------------------------------------------------------------

http://localhost:5173

--------------------------------------------------------------------------------
10. ПРОВЕРКА
--------------------------------------------------------------------------------

curl http://localhost:8787/api/me
→ {"error":"unauthorized"}

curl http://localhost:8787/api/popular
→ {"items":[...]}

--------------------------------------------------------------------------------
11. БЫСТРЫЙ СТАРТ
--------------------------------------------------------------------------------

Терминал 1:
  docker compose up -d db

Терминал 2:
  node index.js

Терминал 3:
  npm run dev

--------------------------------------------------------------------------------
12. ПРОБЛЕМЫ
--------------------------------------------------------------------------------

npm error Missing script "dev"
→ используйте node index.js

DATABASE_URL is not set
→ создайте .env

password authentication failed
→ смените порт на 55433

EADDRINUSE
→ освободите порт 8787

bcrypt ошибка (Mac)
→ npm install bcrypt --build-from-source

--------------------------------------------------------------------------------
13. СТРУКТУРА ПРОЕКТА
--------------------------------------------------------------------------------

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

--------------------------------------------------------------------------------
14. API
--------------------------------------------------------------------------------

POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/me
DELETE /api/users/me
GET    /api/tracks
POST   /api/upload
POST   /api/tracks/delete
GET    /api/search
GET    /api/albums
POST   /api/albums
PATCH  /api/albums/:id
DELETE /api/albums/:id
GET    /api/profile/me
GET    /api/popular
POST   /api/chat
POST   /api/feedback
GET    /music/:ownerId/:filename

================================================================================
