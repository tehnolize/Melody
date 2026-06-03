# Авторизация

## Описание задачи

Реализация полной системы авторизации для **Melody** на основе **JWT + HttpOnly Cookie**.  
Включает регистрацию, вход, выход, защиту маршрутов и удаление аккаунта.

---

## Что изменилось в этой ветке

- Создан `landing/server/services/passwordService.js` — хэширование и проверка паролей (bcrypt)
- Создан `landing/server/services/tokenService.js` — создание и верификация JWT
- Создан `landing/server/services/userService.js` — бизнес-логика: регистрация, вход, получение профиля, удаление
- Создан `landing/server/middleware/auth.js` — middleware `requireAuth` и `optionalAuth`
- Создан `landing/server/controllers/authController.js` — обработчики HTTP-запросов
- Создан `landing/server/routes/authRoutes.js` — роуты авторизации
- Обновлён `landing/server/index.js` — подключение authRoutes

---

## Как работает авторизация

```
Клиент                   Сервер
  │                         │
  │── POST /api/auth/login ──▶
  │                         │  verifyPassword(bcrypt)
  │                         │  signToken(JWT, 7d)
  │◀── Set-Cookie: token ───│  HttpOnly, SameSite=lax
  │                         │
  │── GET /api/me ──────────▶
  │   (cookie автоматически) │  requireAuth middleware
  │                         │  verifyToken(JWT)
  │◀── { user } ────────────│
```

**Токен** хранится в HttpOnly cookie (недоступен JS), TTL = 7 дней.

---

## Правила валидации

### Регистрация (`POST /api/auth/register`)

| Поле          | Правило                                         |
|---------------|-------------------------------------------------|
| `email`       | Валидный формат, уникальный (case-insensitive)  |
| `password`    | Минимум 12 символов, есть буква и цифра         |
| `displayName` | От 2 до 80 символов, уникальный (case-insensitive)|

### Вход (`POST /api/auth/login`)

| Поле       | Правило                            |
|------------|------------------------------------|
| `email`    | Непустой                           |
| `password` | Проверяется через bcrypt           |

> При неверном email или пароле возвращается единый ответ `invalid_credentials` (защита от перебора).

---

## Коды ошибок

| Код                    | HTTP | Описание                          |
|------------------------|------|-----------------------------------|
| `invalid_email`        | 400  | Некорректный формат email         |
| `password_too_weak`    | 400  | Пароль не соответствует правилам  |
| `invalid_display_name` | 400  | Имя слишком короткое/длинное      |
| `email_taken`          | 409  | Email уже занят                   |
| `display_name_taken`   | 409  | Ник уже занят                     |
| `invalid_credentials`  | 401  | Неверный email или пароль         |
| `unauthorized`         | 401  | Токен отсутствует или недействителен|
| `password_required`    | 400  | Пароль не передан при удалении    |
| `invalid_password`     | 401  | Неверный пароль при удалении      |

---

## Middleware

### `requireAuth`

Проверяет JWT из cookie. Добавляет `req.userId` и `req.userEmail`.  
При ошибке — `401 { error: "unauthorized" }`.

```javascript
import { requireAuth } from '../middleware/auth.js';

router.get('/api/tracks', requireAuth, getTracks);
```

### `optionalAuth`

Пытается авторизовать, но не блокирует запрос при отсутствии токена.  
Используется для стриминга треков (публичные + приватные).

```javascript
router.get('/music/:ownerId/:storageName', optionalAuth, streamTrack);
```

---

## Файловая структура

```
landing/server/
├── middleware/
│   └── auth.js              — requireAuth, optionalAuth
├── services/
│   ├── passwordService.js   — hashPassword, verifyPassword
│   ├── tokenService.js      — signToken, verifyToken, getJwtSecret
│   └── userService.js       — registerUser, loginUser, getMe, deleteUser
├── controllers/
│   └── authController.js    — register, login, logout, me, deleteAccount
└── routes/
    └── authRoutes.js        — POST /register, POST /login, POST /logout, GET /me, DELETE /users/me
```

---

## Переменные окружения

```env
JWT_SECRET=melody_dev_secret_XXXXXXXXXXXX   # обязательно, минимум 16 символов
```

> Без этой переменной сервер завершится с ошибкой при старте.

---

## Примеры запросов

```bash
# Регистрация
curl -X POST http://localhost:8787/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"StrongPass123","displayName":"JohnDoe"}'

# Вход
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"user@example.com","password":"StrongPass123"}'

# Текущий пользователь (с cookie)
curl http://localhost:8787/api/me -b cookies.txt

# Выход
curl -X POST http://localhost:8787/api/auth/logout -b cookies.txt
```

---
