# Задание 4 — Структура базы данных

## Ветка: `feature/PROJ-004-database-structure`

---

## Что сделано в этой ветке

Спроектирована и создана структура базы данных PostgreSQL для проекта Melody.

---

## Созданные файлы

```
landing/server/db/
├── schema.sql   — SQL-схема всех таблиц, индексов и ограничений
├── pool.js      — создание пула соединений PostgreSQL
└── init.js      — инициализация БД при запуске сервера
DB_STRUCTURE.md  — документация структуры БД
```

---

## Таблицы базы данных

### `users` — пользователи
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| email | TEXT | Email (уникальный) |
| password_hash | TEXT | Хэш пароля (bcrypt) |
| display_name | TEXT | Имя пользователя (уникальное) |
| bio | TEXT | Описание профиля |
| avatar_url | TEXT | Ссылка на аватар |
| created_at | TIMESTAMPTZ | Дата регистрации |
| updated_at | TIMESTAMPTZ | Дата обновления |

### `tracks` — музыкальные треки
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| user_id | UUID | Владелец трека |
| title | TEXT | Название трека |
| storage_name | TEXT | Имя файла на диске |
| original_name | TEXT | Оригинальное имя файла |
| mime_type | TEXT | MIME-тип (audio/mpeg) |
| file_path | TEXT | Путь к файлу |
| file_size | BIGINT | Размер в байтах |
| duration | INTEGER | Длительность в секундах |

### `albums` — альбомы
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| user_id | UUID | Владелец альбома |
| name | TEXT | Название альбома |
| description | TEXT | Описание |
| cover_url | TEXT | Обложка |

### `album_tracks` — связь альбомов и треков (many-to-many)
| Поле | Тип | Описание |
|------|-----|----------|
| album_id | UUID | Ссылка на альбом |
| track_id | UUID | Ссылка на трек |
| position | INTEGER | Порядок в альбоме |
| added_at | TIMESTAMPTZ | Дата добавления |

---

## Связи между таблицами

```
users (1) ──→ tracks (many)
users (1) ──→ albums (many)
albums (many) ←→ tracks (many)  через album_tracks
```

При удалении пользователя — каскадное удаление треков и альбомов (`ON DELETE CASCADE`).

---

## Как применяется схема

Схема применяется автоматически при запуске сервера:

```javascript
import { createPool, initDb } from './db/init.js';
const pool = createPool(process.env.DATABASE_URL);
await initDb(pool);
```

---

## Коммиты ветки

- `feat(db): add schema.sql with users, tracks, albums, album_tracks tables`
- `feat(db): add pool.js for PostgreSQL connection`
- `feat(db): add init.js to apply schema on server startup`
- `docs(db): add database structure description with tables and relations`
