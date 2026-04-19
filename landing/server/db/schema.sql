
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- уникальный идентификатор пользователя
  email         TEXT        NOT NULL,                              -- адрес электронной почты (уникальный)
  password_hash TEXT        NOT NULL,                              -- хэш пароля (bcrypt)
  display_name  TEXT        NOT NULL,                              -- отображаемое имя (уникальное)
  bio           TEXT,                                              -- описание профиля (необязательно)
  avatar_url    TEXT,                                              -- ссылка на аватар (необязательно)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),                -- дата регистрации
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()                 -- дата последнего обновления
);

-- Уникальность email (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
  ON users (lower(email));

-- Уникальность display_name (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_display_name
  ON users (lower(display_name));


-- ===================
-- Таблица: tracks
-- Назначение: хранит метаданные загруженных музыкальных файлов
-- ===================
CREATE TABLE IF NOT EXISTS tracks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- уникальный идентификатор трека
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- владелец трека
  title         TEXT        NOT NULL,                              -- название трека
  storage_name  TEXT        NOT NULL,                              -- имя файла на диске (UUID.mp3)
  original_name TEXT        NOT NULL,                              -- оригинальное имя файла при загрузке
  mime_type     TEXT        NOT NULL DEFAULT 'audio/mpeg',         -- MIME-тип файла
  file_path     TEXT        NOT NULL,                              -- полный путь хранения файла
  file_size     BIGINT,                                            -- размер файла в байтах
  duration      INTEGER,                                           -- длительность в секундах
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),                -- дата загрузки
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),                -- дата последнего обновления
  UNIQUE (user_id, storage_name)                                   -- уникальность файла в рамках пользователя
);

-- Индекс по владельцу (быстрый поиск треков пользователя)
CREATE INDEX IF NOT EXISTS idx_tracks_user
  ON tracks (user_id);

-- Индекс по названию (поиск треков)
CREATE INDEX IF NOT EXISTS idx_tracks_title
  ON tracks (lower(title));


-- ===================
-- Таблица: albums
-- Назначение: хранит альбомы пользователей
-- ===================
CREATE TABLE IF NOT EXISTS albums (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(), -- уникальный идентификатор альбома
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- владелец альбома
  name        TEXT        NOT NULL,                              -- название альбома
  description TEXT,                                              -- описание альбома (необязательно)
  cover_url   TEXT,                                              -- обложка альбома (необязательно)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),                -- дата создания
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()                 -- дата последнего обновления
);

-- Индекс по владельцу альбома
CREATE INDEX IF NOT EXISTS idx_albums_user
  ON albums (user_id);


-- ===================
-- Таблица: album_tracks
-- Назначение: связь альбомов и треков (many-to-many)
-- ===================
CREATE TABLE IF NOT EXISTS album_tracks (
  album_id   UUID        NOT NULL REFERENCES albums(id) ON DELETE CASCADE, -- ссылка на альбом
  track_id   UUID        NOT NULL REFERENCES tracks(id) ON DELETE CASCADE, -- ссылка на трек
  position   INTEGER     NOT NULL DEFAULT 0,                               -- порядковый номер трека в альбоме
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),                           -- дата добавления трека в альбом
  PRIMARY KEY (album_id, track_id)                                         -- составной первичный ключ
);

-- Индекс по альбому (быстрый поиск треков альбома)
CREATE INDEX IF NOT EXISTS idx_album_tracks_album
  ON album_tracks (album_id);

-- Индекс по треку (быстрый поиск альбомов трека)
CREATE INDEX IF NOT EXISTS idx_album_tracks_track
  ON album_tracks (track_id);
