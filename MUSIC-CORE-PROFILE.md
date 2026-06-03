# Музыкальное ядро и профиль

## Описание задачи

Реализация музыкального функционала **Melody**: загрузка и стриминг mp3, управление альбомами, профиль пользователя, поиск треков.

---

## Что изменилось в этой ветке

- Создан `landing/server/services/trackService.js` — CRUD треков + поиск
- Создан `landing/server/services/albumService.js` — CRUD альбомов + управление треками в альбоме
- Созданы контроллеры: `trackController.js`, `albumController.js`, `profileController.js`
- Созданы роуты: `trackRoutes.js`, `albumRoutes.js`, `profileRoutes.js`
- Добавлен стриминг mp3 с поддержкой **HTTP Range Requests** (перемотка)
- Реализован поиск треков по названию и владельцу
- Реализованы публичный и приватный профили пользователя
- Обновлён React-клиент (`landing/src/App.tsx`): плеер, очередь, эквалайзер, альбомы, чат

---

## Функциональность

### Загрузка треков

- Формат: только `.mp3`
- Максимальный размер: **200 МБ** на файл
- До **200 файлов** за один запрос
- Файлы сохраняются в `uploads/<userId>/<UUID>.mp3`
- Метаданные записываются в таблицу `tracks`

```bash
curl -X POST http://localhost:8787/api/upload \
  -b cookies.txt \
  -F "files=@song.mp3"
```

### Стриминг mp3

Поддерживает **HTTP Range Requests** — браузер может перематывать трек без полной загрузки.

```
GET /music/:ownerId/:storageName
```

Трек отдаётся только если он существует в БД у указанного владельца (защита от прямого перебора файлов).

### Поиск треков

```
GET /api/search?q=название&owner=имяПользователя
```

- Минимум 2 символа в каждом поле
- Поиск case-insensitive (ILIKE)
- Результат: до 50 записей, отсортированы по автору и названию

---

## Альбомы

Альбомы — это **логические группы** треков (связи в `album_tracks`).  
Физический файл mp3 всегда хранится в профиле владельца.

```
Создать альбом       →  POST   /api/albums
Список альбомов      →  GET    /api/albums
Открыть альбом       →  GET    /api/albums/:id
Переименовать        →  PATCH  /api/albums/:id
Удалить альбом       →  DELETE /api/albums/:id
Добавить трек        →  POST   /api/albums/:id/tracks
Убрать трек          →  DELETE /api/albums/:id/tracks/:trackId
```

> Удаление альбома **не удаляет** mp3-файлы. Удаляются только связи и метаданные альбома.

---

## Профиль

### Мой профиль (приватный)
```
GET /api/profile/me
```
Возвращает: данные пользователя + все его треки с привязкой к альбомам (`albumIds`).

### Публичный профиль
```
GET /api/users/:userId/profile
```
Возвращает: публичные данные пользователя + список его треков (без email).

---

## Клиентская часть (React)

### Возможности плеера
- Воспроизведение / пауза / предыдущий / следующий трек
- Перемотка через progressbar
- Громкость
- Скорость воспроизведения: `0.75×` / `1×` / `1.25×` / `1.5×`
- Режимы повтора: выкл / 1 трек / весь плейлист

### Эквалайзер (Web Audio API)
- Bass / Mid / Treble (−12 … +12 dB)
- 13 режимов визуализации: зеркальные бары, волна, круг, спираль, частицы и др.

### Очередь
- Drag & Drop для изменения порядка
- Поиск по трекам очереди
- Цветовая маркировка: зелёный — свой трек, фиолетовый — из чужого альбома

### Управление альбомами
- Создание, переименование, удаление
- Добавление / удаление трека из альбома
- Перемещение трека между альбомами

---

## Структура файлов

```
landing/server/
├── services/
│   ├── trackService.js      — getUserTracks, createTrack, deleteTracks, searchTracks
│   └── albumService.js      — getUserAlbums, getAlbumWithTracks, createAlbum, updateAlbum, deleteAlbum, ...
├── controllers/
│   ├── trackController.js   — getTracks, uploadTracks, deleteTracksHandler, streamTrack, searchTracksHandler
│   ├── albumController.js   — getAlbums, getAlbum, createAlbumHandler, ...
│   └── profileController.js — getMyProfile, getPublicProfile
└── routes/
    ├── trackRoutes.js       — /api/tracks, /api/upload, /api/tracks/delete, /api/search, /music/:owner/:file
    ├── albumRoutes.js       — /api/albums и вложенные роуты
    └── profileRoutes.js     — /api/profile/me, /api/users/:id/profile

landing/src/
├── App.tsx                  — весь клиент (плеер, очередь, альбомы, чат, поиск)
├── index.css                — стили
└── main.tsx                 — точка входа React
```

---

## Запуск клиента

```bash
cd landing

# Установить зависимости (один раз)
npm install

# Dev-сервер с прокси на порт 8787
npm run dev
```

Откройте в браузере: [http://localhost:5173](http://localhost:5173)

> Vite автоматически проксирует запросы `/api` и `/music` на сервер `http://localhost:8787`.

---

## Требования к окружению

| Компонент | Версия |
|-----------|--------|
| Node.js   | ≥ 18   |
| npm       | ≥ 8    |
| Браузер   | С поддержкой Web Audio API (Chrome, Firefox, Edge) |

---
