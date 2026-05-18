# Задание 4 — Структура базы данных Melody

## Описание

Данный документ описывает структуру базы данных проекта Melody.
БД реализована на PostgreSQL. Схема хранится в `landing/server/db/schema.sql`
и применяется автоматически при запуске сервера через `initDb()`.

---

## Сущности и таблицы

### 1. `users` — Пользователи

| Поле           | Тип          | Обязательное | Описание                          |
|----------------|--------------|:------------:|-----------------------------------|
| `id`           | UUID         | ✅           | Первичный ключ (gen_random_uuid)  |
| `email`        | TEXT         | ✅           | Email (уникальный, case-insensitive) |
| `password_hash`| TEXT         | ✅           | Хэш пароля (bcrypt)               |
| `display_name` | TEXT         | ✅           | Имя пользователя (уникальное)     |
| `bio`          | TEXT         | ❌           | Описание профиля                  |
| `avatar_url`   | TEXT         | ❌           | Ссылка на аватар                  |
| `created_at`   | TIMESTAMPTZ  | ✅           | Дата регистрации                  |
| `updated_at`   | TIMESTAMPTZ  | ✅           | Дата последнего обновления        |

**Индексы:**
- `idx_users_email` — уникальный, по `lower(email)`
- `idx_users_display_name` — уникальный, по `lower(display_name)`

---

### 2. `tracks` — Музыкальные треки

| Поле            | Тип          | Обязательное | Описание                             |
|-----------------|--------------|:------------:|--------------------------------------|
| `id`            | UUID         | ✅           | Первичный ключ                       |
| `user_id`       | UUID         | ✅           | Внешний ключ → `users.id`            |
| `title`         | TEXT         | ✅           | Название трека                       |
| `storage_name`  | TEXT         | ✅           | Имя файла на диске (UUID.mp3)        |
| `original_name` | TEXT         | ✅           | Оригинальное имя при загрузке        |
| `mime_type`     | TEXT         | ✅           | MIME-тип (по умолчанию audio/mpeg)   |
| `file_path`     | TEXT         | ✅           | Полный путь к файлу                  |
| `file_size`     | BIGINT       | ❌           | Размер файла в байтах                |
| `duration`      | INTEGER      | ❌           | Длительность в секундах              |
| `created_at`    | TIMESTAMPTZ  | ✅           | Дата загрузки                        |
| `updated_at`    | TIMESTAMPTZ  | ✅           | Дата обновления                      |

**Ограничения:**
- `UNIQUE (user_id, storage_name)` — уникальность файла в рамках пользователя
- `ON DELETE CASCADE` — при удалении пользователя треки удаляются

**Индексы:**
- `idx_tracks_user` — по `user_id`
- `idx_tracks_title` — по `lower(title)`

---

### 3. `albums` — Альбомы

| Поле          | Тип          | Обязательное | Описание                      |
|---------------|--------------|:------------:|-------------------------------|
| `id`          | UUID         | ✅           | Первичный ключ                |
| `user_id`     | UUID         | ✅           | Внешний ключ → `users.id`     |
| `name`        | TEXT         | ✅           | Название альбома              |
| `description` | TEXT         | ❌           | Описание альбома              |
| `cover_url`   | TEXT         | ❌           | Обложка альбома               |
| `created_at`  | TIMESTAMPTZ  | ✅           | Дата создания                 |
| `updated_at`  | TIMESTAMPTZ  | ✅           | Дата обновления               |

**Ограничения:**
- `ON DELETE CASCADE` — при удалении пользователя альбомы удаляются

**Индексы:**
- `idx_albums_user` — по `user_id`

---

### 4. `album_tracks` — Связь альбомов и треков

| Поле       | Тип          | Обязательное | Описание                        |
|------------|--------------|:------------:|---------------------------------|
| `album_id` | UUID         | ✅           | Внешний ключ → `albums.id`      |
| `track_id` | UUID         | ✅           | Внешний ключ → `tracks.id`      |
| `position` | INTEGER      | ✅           | Порядок трека в альбоме         |
| `added_at` | TIMESTAMPTZ  | ✅           | Дата добавления трека в альбом  |

**Ограничения:**
- `PRIMARY KEY (album_id, track_id)` — составной первичный ключ
- `ON DELETE CASCADE` — при удалении альбома или трека связи удаляются

**Индексы:**
- `idx_album_tracks_album` — по `album_id`
- `idx_album_tracks_track` — по `track_id`

---

## Связи между сущностями

```
users (1) ──────< tracks (many)
users (1) ──────< albums (many)
albums (many) >──< tracks (many)  через album_tracks
```

---

## Расположение файлов

```
landing/server/db/
├── schema.sql   — SQL-схема всех таблиц, индексов и ограничений
├── pool.js      — создание пула соединений PostgreSQL
└── init.js      — инициализация БД (читает и применяет schema.sql)
```

---

## Применение схемы

Схема применяется автоматически при запуске сервера:

```javascript
import { createPool, initDb } from './db/init.js';

const pool = createPool(process.env.DATABASE_URL);
await initDb(pool);
```
