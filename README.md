# Melody - Музыкальный веб-сервис

# Платформа для прослушивания музыки, управления плейлистами и персонализации контента.

---

## Оглавление
- [О проекте](#-o-проекте)
- [Технологии](#-технологии)
- [Структура проекта](#-структура-проекта)
- [Быстрый старт](#-быстрый-старт)
- [Переменные окружения](#-структура-веток)
- [API Документация](#-api-документация)
- [Тестирование](#-тестирование)
- [Вкладка в проект](#-вклад-в-проект)

---

## О проекте

**Melody** - это веб-приложение для:
- Поиск и прослушивания музыкальных треков
- Создания и управления плейлистами
- Персонализация профиля пользователя
- Безопасной авторизации и управления доступом

### Основные функции
| Функция | Описание | Статус |
|---------|----------|--------|
| Регистрация/Вход | JWT-аутенфикация с refresh-токенами | ✅ |
| Профиль пользователи | Аватар, настройки, история | ✅ |
| Музыкальная библиотека | Загрузка, каталогизация, поиск | ✅ |
| Плейлисты | Создание, редактирование, шаринг | ✅ |
| Плеер | Воспроизведение, очередь, рекомендации | ✅ |

---

## ⚙️ Технологии

### Backend
- **Node.js** + **Express** - серверная платформа
- **PostgreSQL** - реляционная база данных
- **Sequalize/Knex** - ORM/Query builder
- **bcrypt** - хэширование паролей
- **jsonwebtoken** - JWT-аутенфикация

### Frontend
- **HTML5/CSS3/JavaScript** - базовая вёрстка
- **Fetch API** - взаимодействие с бэкендом

### Инструменты
- **Git/GitHub** - контроль версий
- **npm** - управление зависимостями
- **dotenv** - управление конфигацией
- **winston/pino** - логирование

---

## 🗂️ Структура проекта

Melody/
|----- src/
| |------ config/
| | |_______ database.js # Настройка подключения к БД
| |------ controllers/
| | | ----- auth.controller.js # Логика авторизации
| | | ----- user.controller.js # Профиль пользователя
| | | ----- track.controller.js # Работас треками
| | | ----- playlist.controller.js # Плейсты
| |------- models/
| | | ----- User.js # Модель пользователя
| | | ----- Track.js # Модель плейлиста
| | | _____ index.js # Экспорт всех моделей
| |------ routes/
| | |------ auth.routes.js # Маршруты авторизации
| | |------ user.routes.js # Маршруты профиля
| | |------ track.routes.js # Маршруты треков
| | |------ playlist.routes.js # Маршруты плейлистов
| | | _____ index.js # Сборка всех роутов
| | ------ middleware/
| | | ------ auth.js # Проверка JWT
| | | ------ errorHandlers.js # Глобальная обработка ошибок
| | | ------ validate.js # Валидация запросов
| | |_______ upload.js # Загрузка файлов
| |-------- utils/
| | |---------- apiResponse.js # Стандартизация ответов
| | |---------- logger.js # Настройка логгера
| | |__________ helpers.js # Вспомогательные функции
| |___________ app.js # Инициализация Express
|----------- public/
| |----------- css/
| |----------- js/
| |___________ index.html # Главная страница
|----------- uploads/ # Папка для загруженных файлов
|----------- .env.example # Шаблона переменных окружения 
|----------- .gitignore # Исключения для Git
|----------- package.json # Зависимости и скрипты
|----------- server.js # Точка входа в сервер
|___________ README.md # Этот файл

## 🚀 Быстрый старт

### Требования
- Node.js >= 18.x
- PostgreSQL >= 14.x
- npm >= 9.x

### Установка 

```bash
# 1. Клонируйте репозиторий
git clone https://github.com/tehnolize/Melody.git
cd Melody

# 2. Установите зависимости
npm install

# 3. Настройте окружение 
cp .env.example .env

# Отредактируйте .env (см. раздел ниже)

# 4. Инициализируйте базу данных
npm run migrate

# 5. Запустите сервер в режиме разработки
npm run dev

# 6. Для продакшена:
npm start

Доступные скрипты (package.json)

Команды                 Описание

npm run dev             Запуск с nodemon (hot-reload)
npm start               Запуск в продакшен-режиме
npm run migrate         Применение миграций БД
npm run migrate:undo    Откат последней миграции
npm test                Запуск тестов
npm run test:coverage   Тесты с покрытием
npm run lint            Проверка стиля кода (ESLint)

⚙️ Пемеренные окружения 

Создайте файл .env на основе .env.example

# === СЕРВЕ ===
NODE_ENV=development
PORT=3000
API_PREFIX=/api/v1
CORS_ORIGIN=http://localhost:5173

# === БАЗА ДАННЫХ (PostgreSQL) ===
DB_HOST=localhost
DB_PORT=5432
DB_NAME=melody
DB_USER=postgres
DB_PASSWORD=your_secure_password
DB_POOL_MIN=2
DB_POOL_MAX=10

# === JWT АУТЕНТИФИКАЦИЯ ===
JWT_SECRET=your_super_secret_key_change_in_production
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# === EMAIL (восстановление пароля) ===
SMTP_HOST=smtp.mail.ru
SMTP_PORT=587
SMTP_USER=your_email@mail.ru
SMTP_PASS=your_app_password
EMAIL_FROM=Melody <noreply@melody.app>

# === ЗАГРУЗКА ФАЙЛОВ ===
UPLOAD_PATH=./uploads/music
MAX_FILE_SIZE=52428800
ALLOWED_FORMATS=mp3,wav,flac

# === ЛОГИРОВАНИЕ ===
LOG_LEVEL=info
LOG_FILE=./logs/app.log
