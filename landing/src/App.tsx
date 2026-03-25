import React, { useEffect, useMemo, useRef, useState } from "react";

type User = { id: string; email: string; displayName: string };
type Track = {
  id: string;
  file: string;
  title: string;
  url: string;
  ownerId?: string;
  ownerName?: string;
  owned?: boolean;
};
type SearchHit = { track_id: string; title: string; owner_id: string; owner_name: string };
type AlbumRow = { id: string; name: string; created_at: string; track_count: number };

async function api(path: string, init?: RequestInit) {
  return fetch(path, { ...init, credentials: "include" });
}
type PopularItem = { rank: number; title: string; artist: string; url: string };
type ChatMsg = { from: "user" | "bot"; text: string; t: number };

const log = {
  info: (msg: string, data?: any) => console.log(`%c[INFO]%c ${msg}`, 'color: #00d4ff; font-weight: bold', 'color: inherit', data || ''),
  success: (msg: string, data?: any) => console.log(`%c[SUCCESS]%c ${msg}`, 'color: #00d38a; font-weight: bold', 'color: inherit', data || ''),
  error: (msg: string, err?: any) => console.error(`%c[ERROR]%c ${msg}`, 'color: #ff4444; font-weight: bold', 'color: inherit', err || ''),
  warn: (msg: string, data?: any) => console.warn(`%c[WARN]%c ${msg}`, 'color: #ffaa00; font-weight: bold', 'color: inherit', data || ''),
};

function safeJson<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    if (!v) return fallback;
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

function fmtTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function splitArtistTitle(name: string) {
  const base = name.replace(/\.mp3$/i, "");
  const parts = base.split(" - ");
  if (parts.length >= 2) {
    const artist = parts[0].trim();
    const title = parts.slice(1).join(" - ").trim();
    return { artist, title };
  }
  return { artist: "Unknown", title: base.trim() };
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export default function App() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const srcNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bassRef = useRef<BiquadFilterNode | null>(null);
  const midRef = useRef<BiquadFilterNode | null>(null);
  const trebleRef = useRef<BiquadFilterNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const [tracks, setTracks] = useState<Track[]>([]);
  const tracksById = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);

  const [queue, setQueue] = useState<string[]>(() => safeJson("mw_queue", []));
  const [currentId, setCurrentId] = useState<string>(() => localStorage.getItem("mw_currentId") || "");
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const [curTime, setCurTime] = useState<number>(() => Number(localStorage.getItem("mw_curTime") || "0"));
  const [duration, setDuration] = useState<number>(0);

  const [volume, setVolume] = useState<number>(() => clamp(Number(localStorage.getItem("mw_volume") || "0.85"), 0, 1));
  const [playbackRate, setPlaybackRate] = useState<number>(() =>
    clamp(Number(localStorage.getItem("mw_rate") || "1"), 0.5, 2)
  );

  type LoopMode = "none" | "one" | "all";
  const [loopMode, setLoopMode] = useState<LoopMode>(() => {
    const v = localStorage.getItem("mw_loopMode");
    return v === "one" || v === "all" ? v : "none";
  });

  const [bass, setBass] = useState<number>(() => clamp(Number(localStorage.getItem("mw_bass") || "0"), -12, 12));
  const [mid, setMid] = useState<number>(() => clamp(Number(localStorage.getItem("mw_mid") || "0"), -12, 12));
  const [treble, setTreble] = useState<number>(() => clamp(Number(localStorage.getItem("mw_treble") || "0"), -12, 12));

  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const [popular, setPopular] = useState<PopularItem[]>([]);
  const [popularError, setPopularError] = useState<string>("");

  const [chatOpen, setChatOpen] = useState<boolean>(() => localStorage.getItem("mw_chatOpen") !== "0");
  const [chat, setChat] = useState<ChatMsg[]>([{ from: "bot", text: "Привет!", t: Date.now() }]);
  const [chatInput, setChatInput] = useState<string>("");

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [fbName, setFbName] = useState("");
  const [fbEmail, setFbEmail] = useState("");
  const [fbText, setFbText] = useState("");

  const [toast, setToast] = useState<string>("");
  const [deleteMode, setDeleteMode] = useState(false);
  const [deleteSelected, setDeleteSelected] = useState<string[]>([]);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authDisplayName, setAuthDisplayName] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);

  const [albums, setAlbums] = useState<AlbumRow[]>([]);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>("");
  const [renameAlbumId, setRenameAlbumId] = useState<string>("");
  const [renameAlbumValue, setRenameAlbumValue] = useState<string>("");
  const [addDialogTrackId, setAddDialogTrackId] = useState<string>("");
  const [profileTracks, setProfileTracks] = useState<Array<{ id: string; title: string; file: string; url: string }>>([]);

  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState("");

  const [loopMenuOpen, setLoopMenuOpen] = useState(false);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [eqTypeMenuOpen, setEqTypeMenuOpen] = useState(false);

  type EqType = "mirror-bars" | "dual-side" | "symmetric" | "wave" | "circle" | "edges-in" | "vertical" | "pulse" | "spectrum" | "bars-3d" | "spiral" | "waterfall" | "particles";
  const [eqType, setEqType] = useState<EqType>(() => {
    const v = localStorage.getItem("mw_eqType");
    const validTypes: EqType[] = ["mirror-bars", "dual-side", "symmetric", "wave", "circle", "edges-in", "vertical", "pulse", "spectrum", "bars-3d", "spiral", "waterfall", "particles"];
    return validTypes.includes(v as EqType) ? (v as EqType) : "mirror-bars";
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dirInputRef = useRef<HTMLInputElement | null>(null);
  const loopMenuRef = useRef<HTMLDivElement | null>(null);
  const speedMenuRef = useRef<HTMLDivElement | null>(null);
  const eqTypeMenuRef = useRef<HTMLDivElement | null>(null);

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function fetchTracks() {
    const r = await api("/api/tracks");
    if (!r.ok) throw new Error("tracks_failed");
    const data = (await r.json()) as { tracks: Track[] };
    const tracks = data.tracks || [];
    setTracks(tracks);
    log.success(`Tracks loaded: ${tracks.length}`);
  }

  async function loadAlbums() {
    const r = await api("/api/albums");
    if (!r.ok) return;
    const data = (await r.json()) as { albums: AlbumRow[] };
    setAlbums(data.albums || []);
  }

  async function loadProfileTracks() {
    const r = await api("/api/profile/me");
    if (!r.ok) return;
    const data = (await r.json()) as {
      tracks: Array<{ id: string; title: string; file: string; url: string }>;
    };
    setProfileTracks(data.tracks || []);
  }

  async function fetchPopular() {
    try {
      setPopularError("");
      const r = await api("/api/popular?limit=100");
      if (!r.ok) throw new Error("popular_failed");
      const data = (await r.json()) as { items: PopularItem[] };
      const items = Array.isArray(data.items) ? data.items : [];
      setPopular(items);
      if (items.length > 0) {
        log.success(`Popular tracks loaded: ${items.length}`);
      }
    } catch {
      setPopular([]);
      setPopularError("Нет данных");
      log.warn("Failed to load popular tracks");
    }
  }

  useEffect(() => {
    log.info("MusicWeb initialized");
    (async () => {
      try {
        const r = await api("/api/me");
        if (r.ok) {
          const d = (await r.json()) as { user: User };
          setUser(d.user);
          setAuthOpen(false);
        } else {
          setUser(null);
          setAuthOpen(true);
        }
      } catch {
        setUser(null);
        setAuthOpen(true);
      } finally {
        setSessionChecked(true);
      }
    })();
    fetchPopular().catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchTracks().catch(() => {});
    loadAlbums().catch(() => {});
    loadProfileTracks().catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = searchQ.trim();
    if (q.length < 2) {
      setSearchHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      setSearchBusy(true);
      api(`/api/search?q=${encodeURIComponent(q.slice(0, 120))}`)
        .then((r) => r.json())
        .then((d: { results?: SearchHit[] }) => setSearchHits(d.results || []))
        .catch(() => setSearchHits([]))
        .finally(() => setSearchBusy(false));
    }, 320);
    return () => window.clearTimeout(t);
  }, [searchQ, user]);

  useEffect(() => {
    if (tracks.length === 0) return;

    setQueue((prev) => {
      const ids = new Set(tracks.map((t) => t.id));
      const kept = prev.filter((id) => ids.has(id));
      const add = tracks.map((t) => t.id).filter((id) => !kept.includes(id));
      const next = [...kept, ...add];
      localStorage.setItem("mw_queue", JSON.stringify(next));
      return next;
    });

    setCurrentId((prev) => {
      if (prev && tracksById.has(prev)) return prev;
      const first = tracks[0]?.id || "";
      if (first) localStorage.setItem("mw_currentId", first);
      return first;
    });
  }, [tracks, tracksById]);

  useEffect(() => {
    localStorage.setItem("mw_currentId", currentId);
  }, [currentId]);

  useEffect(() => {
    localStorage.setItem("mw_isPlaying", isPlaying ? "1" : "0");
  }, [isPlaying]);

  useEffect(() => {
    localStorage.setItem("mw_curTime", String(curTime));
  }, [curTime]);

  useEffect(() => {
    localStorage.setItem("mw_volume", String(volume));
    const a = audioRef.current;
    if (a) a.volume = volume;
  }, [volume]);

  useEffect(() => {
    localStorage.setItem("mw_rate", String(playbackRate));
    const a = audioRef.current;
    if (a) a.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    localStorage.setItem("mw_loopMode", loopMode);
  }, [loopMode]);

  useEffect(() => {
    localStorage.setItem("mw_bass", String(bass));
    localStorage.setItem("mw_mid", String(mid));
    localStorage.setItem("mw_treble", String(treble));
    if (bassRef.current) bassRef.current.gain.value = bass;
    if (midRef.current) midRef.current.gain.value = mid;
    if (trebleRef.current) trebleRef.current.gain.value = treble;
  }, [bass, mid, treble]);

  useEffect(() => {
    localStorage.setItem("mw_chatOpen", chatOpen ? "1" : "0");
  }, [chatOpen]);

  useEffect(() => {
    if (!user) {
      setChat([{ from: "bot", text: "Привет!", t: Date.now() }]);
      return;
    }
    // История чата изолируется по user.id, чтобы пользователи не видели чужие сообщения на одном устройстве.
    const key = `mw_chat_${user.id}`;
    setChat(safeJson<ChatMsg[]>(key, [{ from: "bot", text: `Привет, ${user.displayName}!`, t: Date.now() }]));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem(`mw_chat_${user.id}`, JSON.stringify(chat.slice(-50)));
    } catch {}
  }, [chat, user]);

  function clearChat() {
    setChat([{ from: "bot", text: "Чат очищен. Чем могу помочь?", t: Date.now() }]);
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (loopMenuRef.current && !loopMenuRef.current.contains(e.target as Node)) {
        setLoopMenuOpen(false);
      }
      if (speedMenuRef.current && !speedMenuRef.current.contains(e.target as Node)) {
        setSpeedMenuOpen(false);
      }
      if (eqTypeMenuRef.current && !eqTypeMenuRef.current.contains(e.target as Node)) {
        setEqTypeMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    localStorage.setItem("mw_eqType", eqType);
  }, [eqType]);

  function ensureAudioGraph() {
    const a = audioRef.current;
    if (!a) return;

    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new Ctx();
    }
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    if (!srcNodeRef.current) {
      srcNodeRef.current = ctx.createMediaElementSource(a);
    }
    if (!analyserRef.current) {
      analyserRef.current = ctx.createAnalyser();
      analyserRef.current.fftSize = 1024;
      analyserRef.current.smoothingTimeConstant = 0.86;
    }
    if (!bassRef.current) {
      const n = ctx.createBiquadFilter();
      n.type = "lowshelf";
      n.frequency.value = 140;
      n.gain.value = bass;
      bassRef.current = n;
    }
    if (!midRef.current) {
      const n = ctx.createBiquadFilter();
      n.type = "peaking";
      n.frequency.value = 1000;
      n.Q.value = 1.0;
      n.gain.value = mid;
      midRef.current = n;
    }
    if (!trebleRef.current) {
      const n = ctx.createBiquadFilter();
      n.type = "highshelf";
      n.frequency.value = 7000;
      n.gain.value = treble;
      trebleRef.current = n;
    }

    const src = srcNodeRef.current;
    const bassN = bassRef.current;
    const midN = midRef.current;
    const trebleN = trebleRef.current;
    const analyser = analyserRef.current;

    try {
      src.disconnect();
      bassN.disconnect();
      midN.disconnect();
      trebleN.disconnect();
      analyser.disconnect();
    } catch {}

    src.connect(bassN);
    bassN.connect(midN);
    midN.connect(trebleN);
    trebleN.connect(analyser);
    analyser.connect(ctx.destination);

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  }

  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  function startViz() {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    const bins = 60;
    const data = new Uint8Array(analyser.frequencyBinCount);
    let fadeValue = 1;
    const fadeSpeed = 0.05;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(data);

      const fadeTarget = isPlayingRef.current ? 1 : 0;
      fadeValue += (fadeTarget - fadeValue) * fadeSpeed;

      ctx2d.clearRect(0, 0, w, h);

      const padX = 12 * dpr;
      const innerW = w - padX * 2;
      const innerH = h;
      const centerX = w / 2;
      const centerY = h / 2;
      const halfBins = Math.floor(bins / 2);
      const barW = innerW / bins;
      const gap = Math.max(1 * dpr, barW * 0.15);
      const bw = Math.max(2 * dpr, barW - gap);
      const radius = Math.min(innerW, innerH) * 0.4;

      if (eqType === "mirror-bars") {
        for (let i = 0; i < bins; i++) {
          const offsetFromCenter = i - halfBins;
          const absOffset = Math.abs(offsetFromCenter);
          const freqIndex = Math.floor((absOffset / halfBins) * data.length);
          const idx = Math.min(Math.max(0, freqIndex), data.length - 1);
          const v = data[idx] / 255;
          const eased = Math.pow(v, 1.2);
          const bh = Math.max(2 * dpr, innerH * eased * 0.5 * fadeValue);
          const x = centerX + offsetFromCenter * barW - bw / 2;
          ctx2d.fillStyle = `rgba(0, 211, 138, ${fadeValue})`;
          ctx2d.fillRect(x, centerY - bh, bw, bh);
          ctx2d.fillRect(x, centerY, bw, bh);
        }
      } else if (eqType === "dual-side") {
        const halfBinsCount = Math.floor(bins / 2);
        for (let i = 0; i < halfBinsCount; i++) {
          const leftFreqIndex = Math.floor((i / halfBinsCount) * data.length);
          const rightFreqIndex = Math.floor(((halfBinsCount - 1 - i) / halfBinsCount) * data.length);
          const leftIdx = Math.min(Math.max(0, leftFreqIndex), data.length - 1);
          const rightIdx = Math.min(Math.max(0, rightFreqIndex), data.length - 1);
          const leftV = data[leftIdx] / 255;
          const rightV = data[rightIdx] / 255;
          const leftEased = Math.pow(leftV, 1.2);
          const rightEased = Math.pow(rightV, 1.2);
          const leftBh = Math.max(2 * dpr, innerH * leftEased * 0.98 * fadeValue);
          const rightBh = Math.max(2 * dpr, innerH * rightEased * 0.98 * fadeValue);
          const leftX = padX + i * barW;
          const rightX = centerX + (i + 1) * barW;
          ctx2d.fillStyle = `rgba(0, 211, 138, ${fadeValue})`;
          ctx2d.fillRect(leftX, innerH - leftBh, bw, leftBh);
          ctx2d.fillRect(rightX, innerH - rightBh, bw, rightBh);
        }
      } else if (eqType === "symmetric") {
        for (let i = 0; i < bins; i++) {
          const offsetFromCenter = i - halfBins;
          const absOffset = Math.abs(offsetFromCenter);
          const normalizedOffset = absOffset / halfBins;
          const freqIndex = Math.floor((i / bins) * data.length);
          const idx = Math.min(Math.max(0, freqIndex), data.length - 1);
          const v = data[idx] / 255;
          const eased = Math.pow(v, 1.2);
          const pyramidMultiplier = 1 - normalizedOffset * 0.6;
          const bh = Math.max(2 * dpr, innerH * eased * 0.5 * fadeValue * pyramidMultiplier);
          const x = centerX + offsetFromCenter * barW - bw / 2;
          ctx2d.fillStyle = `rgba(0, 211, 138, ${fadeValue})`;
          ctx2d.fillRect(x, centerY - bh, bw, bh);
          ctx2d.fillRect(x, centerY, bw, bh);
        }
      } else if (eqType === "wave") {
        ctx2d.strokeStyle = `rgba(0, 211, 138, ${fadeValue})`;
        ctx2d.lineWidth = 2 * dpr;
        ctx2d.beginPath();
        for (let i = 0; i < bins; i++) {
          const freqIndex = Math.floor((i / bins) * data.length);
          const idx = Math.min(Math.max(0, freqIndex), data.length - 1);
          const v = data[idx] / 255;
          const eased = Math.pow(v, 1.2);
          const y = centerY - (eased * innerH * 0.4 * fadeValue);
          const x = padX + (i / bins) * innerW;
          if (i === 0) ctx2d.moveTo(x, y);
          else ctx2d.lineTo(x, y);
        }
        ctx2d.stroke();
      } else if (eqType === "circle") {
        const angleStep = (Math.PI * 2) / bins;
        for (let i = 0; i < bins; i++) {
          const freqIndex = Math.floor((i / bins) * data.length);
          const idx = Math.min(Math.max(0, freqIndex), data.length - 1);
          const v = data[idx] / 255;
          const eased = Math.pow(v, 1.2);
          const angle = i * angleStep;
          const barLength = radius * eased * fadeValue;
          const x1 = centerX + Math.cos(angle) * radius;
          const y1 = centerY + Math.sin(angle) * radius;
          const x2 = centerX + Math.cos(angle) * (radius + barLength);
          const y2 = centerY + Math.sin(angle) * (radius + barLength);
          ctx2d.strokeStyle = `rgba(0, 211, 138, ${fadeValue})`;
          ctx2d.lineWidth = 3 * dpr;
          ctx2d.beginPath();
          ctx2d.moveTo(x1, y1);
          ctx2d.lineTo(x2, y2);
          ctx2d.stroke();
        }
      } else if (eqType === "edges-in") {
        for (let i = 0; i < bins; i++) {
          const offsetFromCenter = i - halfBins;
          const absOffset = Math.abs(offsetFromCenter);
          const normalizedOffset = absOffset / halfBins;
          const freqIndex = Math.floor((i / bins) * data.length);
          const idx = Math.min(Math.max(0, freqIndex), data.length - 1);
          const v = data[idx] / 255;
          const eased = Math.pow(v, 1.2);
          const edgeMultiplier = normalizedOffset;
          const bh = Math.max(2 * dpr, innerH * eased * 0.98 * fadeValue * edgeMultiplier);
          const x = centerX + offsetFromCenter * barW - bw / 2;
          const y = innerH - bh;
          ctx2d.fillStyle = `rgba(0, 211, 138, ${fadeValue})`;
          ctx2d.fillRect(x, y, bw, bh);
        }
      } else if (eqType === "vertical") {
        const verticalBins = Math.floor(bins * 0.6);
        const barH = innerH / verticalBins;
        const gapH = Math.max(1 * dpr, barH * 0.1);
        const bh = Math.max(2 * dpr, barH - gapH);
        for (let i = 0; i < verticalBins; i++) {
          const freqIndex = Math.floor((i / verticalBins) * data.length);
          const idx = Math.min(Math.max(0, freqIndex), data.length - 1);
          const v = data[idx] / 255;
          const eased = Math.pow(v, 1.2);
          const barW = innerW * eased * fadeValue;
          const x = centerX - barW / 2;
          const y = padX + i * barH;
          ctx2d.fillStyle = `rgba(0, 211, 138, ${fadeValue})`;
          ctx2d.fillRect(x, y, barW, bh);
        }
      } else if (eqType === "pulse") {
        const maxValue = Math.max(...Array.from(data));
        const maxV = maxValue / 255;
        const eased = Math.pow(maxV, 1.2);
        const pulseRadius = radius * (0.3 + eased * 0.7) * fadeValue;
        ctx2d.fillStyle = `rgba(0, 211, 138, ${fadeValue * 0.3})`;
        ctx2d.beginPath();
        ctx2d.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
        ctx2d.fill();
        ctx2d.strokeStyle = `rgba(0, 211, 138, ${fadeValue})`;
        ctx2d.lineWidth = 3 * dpr;
        ctx2d.stroke();
      } else if (eqType === "spectrum") {
        ctx2d.strokeStyle = `rgba(0, 211, 138, ${fadeValue})`;
        ctx2d.lineWidth = 1.5 * dpr;
        for (let i = 0; i < bins; i++) {
          const freqIndex = Math.floor((i / bins) * data.length);
          const idx = Math.min(Math.max(0, freqIndex), data.length - 1);
          const v = data[idx] / 255;
          const eased = Math.pow(v, 1.2);
          const lineHeight = innerH * eased * fadeValue;
          const x = padX + (i / bins) * innerW;
          ctx2d.beginPath();
          ctx2d.moveTo(x, innerH);
          ctx2d.lineTo(x, innerH - lineHeight);
          ctx2d.stroke();
        }
      } else if (eqType === "bars-3d") {
        for (let i = 0; i < bins; i++) {
          const offsetFromCenter = i - halfBins;
          const freqIndex = Math.floor((i / bins) * data.length);
          const idx = Math.min(Math.max(0, freqIndex), data.length - 1);
          const v = data[idx] / 255;
          const eased = Math.pow(v, 1.2);
          const bh = Math.max(2 * dpr, innerH * eased * 0.98 * fadeValue);
          const x = centerX + offsetFromCenter * barW - bw / 2;
          const y = innerH - bh;
          const gradient = ctx2d.createLinearGradient(x, y, x, y + bh);
          gradient.addColorStop(0, `rgba(0, 211, 138, ${fadeValue})`);
          gradient.addColorStop(1, `rgba(0, 150, 100, ${fadeValue})`);
          ctx2d.fillStyle = gradient;
          ctx2d.fillRect(x, y, bw, bh);
          ctx2d.fillStyle = `rgba(0, 255, 200, ${fadeValue * 0.5})`;
          ctx2d.fillRect(x, y, bw, bh * 0.2);
        }
      } else if (eqType === "spiral") {
        const maxValue = Math.max(...Array.from(data));
        const maxV = maxValue / 255;
        const spiralTurns = 3;
        for (let i = 0; i < bins; i++) {
          const freqIndex = Math.floor((i / bins) * data.length);
          const idx = Math.min(Math.max(0, freqIndex), data.length - 1);
          const v = data[idx] / 255;
          const eased = Math.pow(v, 1.2);
          const angle = (i / bins) * Math.PI * 2 * spiralTurns;
          const baseRadius = radius * 0.3;
          const radiusOffset = radius * eased * fadeValue;
          const r = baseRadius + radiusOffset;
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;
          ctx2d.fillStyle = `rgba(0, 211, 138, ${fadeValue})`;
          ctx2d.beginPath();
          ctx2d.arc(x, y, 4 * dpr, 0, Math.PI * 2);
          ctx2d.fill();
        }
      } else if (eqType === "waterfall") {
        const waterfallHeight = Math.floor(innerH / 20);
        for (let row = 0; row < 20; row++) {
          const rowAlpha = (20 - row) / 20;
          for (let i = 0; i < bins; i++) {
            const freqIndex = Math.floor((i / bins) * data.length);
            const idx = Math.min(Math.max(0, freqIndex), data.length - 1);
            const v = data[idx] / 255;
            const eased = Math.pow(v, 1.2);
            const barHeight = waterfallHeight * eased * fadeValue * rowAlpha;
            const x = padX + (i / bins) * innerW;
            const y = innerH - (row + 1) * waterfallHeight;
            ctx2d.fillStyle = `rgba(0, 211, 138, ${fadeValue * rowAlpha * 0.8})`;
            ctx2d.fillRect(x, y, bw, barHeight);
          }
        }
      } else if (eqType === "particles") {
        const particleCount = bins;
        for (let i = 0; i < particleCount; i++) {
          const freqIndex = Math.floor((i / particleCount) * data.length);
          const idx = Math.min(Math.max(0, freqIndex), data.length - 1);
          const v = data[idx] / 255;
          const eased = Math.pow(v, 1.2);
          const particleSize = 3 + eased * 8;
          const x = padX + (i / particleCount) * innerW;
          const y = centerY + (Math.random() - 0.5) * innerH * 0.3 * (1 - eased);
          ctx2d.fillStyle = `rgba(0, 211, 138, ${fadeValue * eased})`;
          ctx2d.beginPath();
          ctx2d.arc(x, y, particleSize * dpr, 0, Math.PI * 2);
          ctx2d.fill();
        }
      }
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    draw();
  }


  const currentTrack = currentId ? tracksById.get(currentId) : undefined;
  const currentMeta = currentTrack ? splitArtistTitle(currentTrack.file) : { artist: "", title: "" };

  async function play() {
    const a = audioRef.current;
    if (!a || !currentTrack) return;

    ensureAudioGraph();
    startViz();

    a.volume = volume;
    a.playbackRate = playbackRate;

    try {
      const playPromise = a.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
      setIsPlaying(true);
      log.info(`Playing: ${currentTrack.file}`);
    } catch {
      setIsPlaying(false);
      showToast("Нажми Play ещё раз (браузер блокирует автозвук)");
    }
  }

  function pause() {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    setIsPlaying(false);
    if (currentTrack) log.info(`Paused: ${currentTrack.file}`);
  }

  function togglePlay() {
    const a = audioRef.current;
    if (!a || !currentTrack) {
      if (currentTrack) {
        play().catch(() => {});
      }
      return;
    }
    if (isPlaying) pause();
    else play();
  }

  function prev() {
    if (!currentId || queue.length === 0) return;
    const i = queue.indexOf(currentId);
    const nextId = queue[(i - 1 + queue.length) % queue.length];
    setCurTime(0);
    setCurrentId(nextId);
    setTimeout(() => play(), 0);
  }

  function next() {
    if (!currentId || queue.length === 0) return;
    const i = queue.indexOf(currentId);
    const nextIndex = (i + 1) % queue.length;
    const nextId = queue[nextIndex];
    setCurTime(0);
    setCurrentId(nextId);
    setTimeout(() => play(), 0);
  }

  function cycleLoopMode() {
    setLoopMode((prev) => (prev === "none" ? "one" : prev === "one" ? "all" : "none"));
  }

  function getLoopModeLabel() {
    if (loopMode === "none") return "Повтор: выкл";
    if (loopMode === "one") return "Повтор: 1 трек";
    return "Повтор: весь плейлист";
  }

  function getLoopModeIcon() {
    if (loopMode === "none") return "⊘";
    if (loopMode === "one") return "↻";
    return "∞";
  }

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onLoaded = () => {
      setDuration(Number.isFinite(a.duration) ? a.duration : 0);
      const savedId = localStorage.getItem("mw_currentId") || "";
      const savedTime = Number(localStorage.getItem("mw_curTime") || "0");
      if (savedId && savedId === currentId && savedTime > 0 && savedTime < a.duration - 0.25) {
        a.currentTime = savedTime;
        setCurTime(savedTime);
      }
      setIsPlaying(!a.paused && !a.ended);
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    const onTime = () => setCurTime(a.currentTime || 0);
    const onEnded = async () => {
      if (loopMode === "one") {
        a.currentTime = 0;
        try {
          const playPromise = a.play();
          if (playPromise !== undefined) {
            await playPromise;
          }
          setIsPlaying(true);
        } catch {
          setIsPlaying(false);
        }
        return;
      }
      if (loopMode === "all") {
        const i = queue.indexOf(currentId);
        const nextIndex = (i + 1) % queue.length;
        const nextId = queue[nextIndex];
        setCurTime(0);
        setCurrentId(nextId);
        setTimeout(async () => {
          const a2 = audioRef.current;
          if (!a2) return;
          try {
            const playPromise = a2.play();
            if (playPromise !== undefined) {
              await playPromise;
            }
            setIsPlaying(true);
          } catch {
            setIsPlaying(false);
          }
        }, 0);
        return;
      }
      const i = queue.indexOf(currentId);
      if (i >= 0 && i < queue.length - 1) {
        const nextIndex = i + 1;
        const nextId = queue[nextIndex];
        setCurTime(0);
        setCurrentId(nextId);
        setTimeout(async () => {
          const a2 = audioRef.current;
          if (!a2) return;
          try {
            const playPromise = a2.play();
            if (playPromise !== undefined) {
              await playPromise;
            }
            setIsPlaying(true);
          } catch {
            setIsPlaying(false);
          }
        }, 0);
      } else {
        pause();
      }
    };

    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnded);

    return () => {
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnded);
    };
  }, [currentId, queue, loopMode]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    if (currentTrack) {
      const desiredSrc = currentTrack.url;
      const cur = a.getAttribute("data-src") || "";
      if (cur !== desiredSrc) {
        a.src = desiredSrc;
        a.setAttribute("data-src", desiredSrc);
        a.load();
      }
      startViz();
    }
  }, [currentTrack]);

  useEffect(() => {
    if (analyserRef.current && canvasRef.current) {
      startViz();
    }
  }, [eqType]);

  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      const a = audioRef.current;
      if (!a) return;
      localStorage.setItem("mw_curTime", String(a.currentTime || 0));
    }, 900);
    return () => window.clearInterval(id);
  }, [isPlaying, currentId]);

  function reorder(from: number, to: number) {
    setQueue((prev) => {
      const nextQ = [...prev];
      const [it] = nextQ.splice(from, 1);
      nextQ.splice(to, 0, it);
      localStorage.setItem("mw_queue", JSON.stringify(nextQ));
      return nextQ;
    });
  }

  async function uploadFiles(list: FileList) {
    const files = Array.from(list);
    if (files.length === 0) return;
    if (!user) {
      showToast("Войдите в аккаунт");
      setAuthOpen(true);
      return;
    }
    if (albums.length === 0) {
      showToast("Сначала создайте альбом, затем загружайте треки");
      return;
    }

    const bad = files.filter((f) => !f.name.toLowerCase().endsWith(".mp3"));
    if (bad.length > 0) {
      showToast("Можно загрузить только mp3");
      log.warn(`Invalid files rejected: ${bad.length}`);
      return;
    }

    const fd = new FormData();
    for (const f of files) fd.append("files", f);

    const r = await api("/api/upload", { method: "POST", body: fd });
    if (!r.ok) {
      showToast("Не удалось загрузить");
      log.error("Upload failed");
      return;
    }
    log.success(`Files uploaded: ${files.length}`);
    showToast("Файлы добавлены");
    await fetchTracks().catch(() => {});
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text) return;
    setChatInput("");

    const msg: ChatMsg = { from: "user", text, t: Date.now() };
    setChat((p) => [...p, msg]);

    try {
      const chatHistory = chat.slice(-20).map(m => ({
        role: m.from === "user" ? "user" : "assistant",
        content: m.text
      }));
      
      const r = await api("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, history: chatHistory }),
      });
      const data = (await r.json()) as { reply?: string };
      const reply = (data.reply || "").trim() || "Ок";
      setChat((p) => [...p, { from: "bot", text: reply, t: Date.now() }]);
    } catch {
      setChat((p) => [...p, { from: "bot", text: "Ошибка связи с сервером", t: Date.now() }]);
    }
  }

  async function sendFeedback() {
    const message = fbText.trim();
    if (message.length < 3) {
      showToast("Напиши чуть подробнее");
      return;
    }
    const payload = { name: fbName.trim(), email: fbEmail.trim(), message };
    try {
      const r = await api("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !data.ok) {
        const errorMsg = data.error || "Не удалось отправить";
        try {
          const draft = safeJson<Array<{ name: string; email: string; message: string; t: number }>>("mw_feedback_failed", []);
          draft.push({ ...payload, t: Date.now() });
          localStorage.setItem("mw_feedback_failed", JSON.stringify(draft.slice(-20)));
        } catch {}
        setFeedbackOpen(false);
        setFbText("");
        setFbName("");
        setFbEmail("");
        showToast(errorMsg);
        return;
      }
      setFeedbackOpen(false);
      setFbText("");
      setFbName("");
      setFbEmail("");
      showToast("Письмо отправлено");
    } catch (err) {
      try {
        const draft = safeJson<Array<{ name: string; email: string; message: string; t: number }>>("mw_feedback_failed", []);
        draft.push({ ...payload, t: Date.now() });
        localStorage.setItem("mw_feedback_failed", JSON.stringify(draft.slice(-20)));
      } catch {}
      setFeedbackOpen(false);
      setFbText("");
      setFbName("");
      setFbEmail("");
      showToast("Письмо не отправлено: сеть/SMTP недоступны");
    }
  }

  function toggleDeleteSelect(id: string) {
    setDeleteSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function exitDeleteMode() {
    setDeleteMode(false);
    setDeleteSelected([]);
  }

  async function deleteSelectedTracks() {
    if (deleteSelected.length === 0 || deleteBusy) return;
    const ownedIds = deleteSelected.filter((id) => tracksById.get(id)?.owned === true);
    const borrowedIds = deleteSelected.filter((id) => tracksById.get(id)?.owned !== true);
    const ok = window.confirm(
      ownedIds.length > 0
        ? `Удалить ${ownedIds.length} своих файлов с сервера?` +
            (borrowedIds.length ? ` Ещё ${borrowedIds.length} чужих треков будут убраны только из очереди.` : "")
        : `Убрать ${borrowedIds.length} треков из очереди (чужие файлы не удаляются)?`
    );
    if (!ok) return;

    setDeleteBusy(true);
    try {
      if (borrowedIds.length > 0) {
        setQueue((prev) => {
          const next = prev.filter((id) => !borrowedIds.includes(id));
          localStorage.setItem("mw_queue", JSON.stringify(next));
          return next;
        });
      }
      if (ownedIds.length === 0) {
        showToast("Удалены только ссылки на чужие треки из очереди");
        exitDeleteMode();
        setDeleteBusy(false);
        await fetchTracks().catch(() => {});
        return;
      }

      const r = await api("/api/tracks/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: ownedIds }),
      });
      const data = (await r.json()) as { ok?: boolean; deleted?: string[]; failed?: Array<{ id: string; reason: string }> };
      if (!r.ok || !data.ok) {
        showToast("Не удалось удалить треки");
        return;
      }

      const deletedCount = Array.isArray(data.deleted) ? data.deleted.length : 0;
      const failedCount = Array.isArray(data.failed) ? data.failed.length : 0;
      showToast(
        failedCount > 0
          ? `Удалено: ${deletedCount}, ошибок: ${failedCount}`
          : `Удалено треков: ${deletedCount}`
      );

      exitDeleteMode();
      await fetchTracks().catch(() => {});
    } catch {
      showToast("Ошибка удаления");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function submitAuth() {
    setAuthBusy(true);
    try {
      if (authTab === "register") {
        const r = await api("/api/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: authEmail.trim(),
            password: authPassword,
            displayName: authDisplayName.trim(),
          }),
        });
        const d = (await r.json()) as { user?: User; error?: string };
        if (!r.ok) {
          showToast(
            d.error === "email_taken"
              ? "Этот email уже занят"
              : d.error === "invalid_email"
                ? "Некорректный email"
                : d.error === "password_too_short"
                  ? "Пароль от 6 символов"
                  : "Ошибка регистрации"
          );
          return;
        }
        if (d.user) setUser(d.user);
        setAuthOpen(false);
        showToast("Аккаунт создан");
      } else {
        const r = await api("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: authEmail.trim(), password: authPassword }),
        });
        const d = (await r.json()) as { user?: User };
        if (!r.ok) {
          showToast("Неверный email или пароль");
          return;
        }
        if (d.user) setUser(d.user);
        setAuthOpen(false);
        showToast("С возвращением");
      }
    } catch {
      showToast("Ошибка сети");
    } finally {
      setAuthBusy(false);
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
    setTracks([]);
    setQueue([]);
    setAlbums([]);
    setProfileTracks([]);
    setSearchHits([]);
    setSearchQ("");
    setCurrentId("");
    setChat([{ from: "bot", text: "Привет!", t: Date.now() }]);
    setAuthOpen(true);
    try {
      localStorage.removeItem("mw_queue");
      localStorage.removeItem("mw_currentId");
    } catch {
      /* ignore */
    }
  }

  async function submitDeleteAccount() {
    const r = await api("/api/users/me", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: deleteAccountPassword }),
    });
    if (r.ok) {
      setDeleteAccountOpen(false);
      setDeleteAccountPassword("");
      setUser(null);
      setTracks([]);
      setQueue([]);
      setAlbums([]);
      setProfileTracks([]);
      setSearchHits([]);
      setSearchQ("");
      setCurrentId("");
      setChat([{ from: "bot", text: "Привет!", t: Date.now() }]);
      setAuthOpen(true);
      showToast("Аккаунт и ваши файлы удалены");
    } else {
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      showToast(d.error === "invalid_password" ? "Неверный пароль" : "Не удалось удалить аккаунт");
    }
  }

  async function createAlbum() {
    const name = newAlbumName.trim();
    if (!name) return;
    const r = await api("/api/albums", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (r.ok) {
      setNewAlbumName("");
      await loadAlbums();
      showToast("Альбом создан");
    } else showToast("Не удалось создать альбом");
  }

  async function addTrackToAlbum(albumId: string, trackId: string) {
    const r = await api(`/api/albums/${albumId}/tracks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trackId }),
    });
    if (r.ok) {
      showToast("Трек добавлен в альбом");
      setAddDialogTrackId("");
      await fetchTracks();
      await loadAlbums();
    } else showToast("Не удалось добавить (возможно уже в альбоме)");
  }

  async function openAlbum(albumId: string) {
    const r = await api(`/api/albums/${albumId}`);
    if (!r.ok) {
      showToast("Не удалось открыть альбом");
      return;
    }
    const d = (await r.json()) as { album: { id: string; name: string }; tracks: Track[] };
    const albumTracks = d.tracks || [];
    setSelectedAlbumId(albumId);
    setTracks((prev) => {
      const map = new Map(prev.map((t) => [t.id, t]));
      for (const t of albumTracks) map.set(t.id, t);
      return Array.from(map.values());
    });
    const ids = albumTracks.map((t) => t.id);
    // При выборе альбома полностью переключаем очередь на его треки.
    setQueue(ids);
    localStorage.setItem("mw_queue", JSON.stringify(ids));
    if (ids.length > 0) {
      setCurrentId(ids[0]);
      setCurTime(0);
    }
    showToast(`Открыт альбом: ${d.album.name}`);
  }

  async function renameAlbum(albumId: string) {
    const name = renameAlbumValue.trim();
    if (!name) return;
    const r = await api(`/api/albums/${albumId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (r.ok) {
      setRenameAlbumId("");
      setRenameAlbumValue("");
      await loadAlbums();
      showToast("Альбом переименован");
    } else showToast("Не удалось переименовать альбом");
  }

  async function removeAlbum(albumId: string) {
    // Удаляем только связь альбома и его метаданные; mp3-файлы владельца остаются.
    const ok = window.confirm("Удалить альбом? Треки в хранилище останутся.");
    if (!ok) return;
    const r = await api(`/api/albums/${albumId}`, { method: "DELETE" });
    if (r.ok) {
      if (selectedAlbumId === albumId) setSelectedAlbumId("");
      await loadAlbums();
      await fetchTracks();
      showToast("Альбом удалён");
    } else showToast("Не удалось удалить альбом");
  }

  const queueTracks = useMemo(() => queue.map((id) => tracksById.get(id)).filter(Boolean) as Track[], [queue, tracksById]);

  const popularLoop = useMemo(() => {
    if (popular.length === 0) return [];
    const list = popular.slice(0, 100);
    return [...list, ...list];
  }, [popular]);

  if (!sessionChecked) {
    return (
      <div className="app" style={{ display: "grid", placeItems: "center", minHeight: "100vh", color: "rgba(255,255,255,0.65)" }}>
        Загрузка…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="authOnlyScreen">
        {authOpen && (
          <div className="modalOverlay">
            <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
              <div className="modalHead">
                <div className="modalTitle">{authTab === "login" ? "Вход" : "Регистрация"}</div>
              </div>
              <div className="modalBody">
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <button type="button" className={"btn " + (authTab === "login" ? "btnPrimary" : "")} onClick={() => setAuthTab("login")}>
                    Вход
                  </button>
                  <button
                    type="button"
                    className={"btn " + (authTab === "register" ? "btnPrimary" : "")}
                    onClick={() => setAuthTab("register")}
                  >
                    Регистрация
                  </button>
                </div>
                {authTab === "register" ? (
                  <input
                    className="input"
                    placeholder="Имя (отображается в профиле)"
                    value={authDisplayName}
                    onChange={(e) => setAuthDisplayName(e.target.value)}
                    style={{ marginBottom: 8 }}
                  />
                ) : null}
                <input
                  className="input"
                  placeholder="Email"
                  type="email"
                  autoComplete="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  style={{ marginBottom: 8 }}
                />
                <input
                  className="input"
                  placeholder="Пароль"
                  type="password"
                  autoComplete={authTab === "login" ? "current-password" : "new-password"}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  style={{ marginBottom: 12 }}
                />
                <button type="button" className="sendBtn" disabled={authBusy} onClick={() => submitAuth().catch(() => {})}>
                  {authBusy ? "…" : authTab === "login" ? "Войти" : "Зарегистрироваться"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbarInner" style={{ flexWrap: "wrap" }}>
          <div className="brand">
            <div className="brandBadge">MW</div>
            <div className="brandName">MusicWeb</div>
          </div>

          <div className="topbarSearch">
            <input
              className="input searchInput"
              placeholder={user ? "Поиск треков по названию (другие пользователи)…" : "Войдите, чтобы искать треки"}
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              disabled={!user}
            />
            {searchBusy ? <span className="hint" style={{ marginLeft: 8 }}>Поиск…</span> : null}
          </div>

          <div className="actions">
            {user ? (
              <>
                <span className="userChip" title={user.email}>
                  {user.displayName}
                </span>
                <button type="button" className="btn" onClick={() => logout().catch(() => {})}>
                  Выйти
                </button>
                <button
                  type="button"
                  className="btn btnDanger"
                  onClick={() => {
                    const ok = window.confirm("Удалить аккаунт? Будут удалены профиль, альбомы и все ваши файлы.");
                    if (ok) setDeleteAccountOpen(true);
                  }}
                >
                  Удалить аккаунт
                </button>
              </>
            ) : (
              <button type="button" className="btn btnPrimary" onClick={() => setAuthOpen(true)}>
                Войти
              </button>
            )}
            <button className={"btn " + (chatOpen ? "btnPrimary" : "")} onClick={() => setChatOpen((v) => !v)}>
              чат
            </button>
          </div>
        </div>
      </div>

      <div className="page">
        <div className="layout">
          <div className="col">
            <div className="panel">
              <div className="panelInner">
                <div className="sectionTitle">
                  <span>Результаты поиска</span>
                  <span className="hint">{user ? "чужие треки → в альбом" : "—"}</span>
                </div>
                <div className="searchList">
                  {searchHits.length === 0 ? (
                    <div className="hint">{user ? "Введите минимум 2 символа в строке поиска." : "Войдите, чтобы искать."}</div>
                  ) : (
                    searchHits.map((h) => (
                      <div key={h.track_id} className="searchRow">
                        <div className="qText">
                          <div className="qTitle">{h.title}</div>
                          <div className="qSub">{h.owner_name}</div>
                        </div>
                        <button
                          type="button"
                          className="btn btnPrimary"
                          disabled={!user}
                          onClick={() => {
                            if (albums.length === 0) {
                              showToast("Сначала создайте альбом");
                              return;
                            }
                            setAddDialogTrackId(h.track_id);
                          }}
                        >
                          В мой альбом
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div style={{ height: 16 }} />

            <div className="panel">
              <div className="panelInner">
                <div className="sectionTitle">
                  <span>Альбомы</span>
                  <span className="hint">Загрузка треков идёт в ваш профиль</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <button className="btn" onClick={() => fileInputRef.current?.click()} disabled={!user || albums.length === 0}>
                    + mp3
                  </button>
                  <button className="btn" onClick={() => dirInputRef.current?.click()} disabled={!user || albums.length === 0}>
                    + папка
                  </button>
                  {albums.length === 0 ? <span className="hint">Сначала создайте альбом</span> : null}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp3,audio/mpeg"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => {
                    if (e.target.files) uploadFiles(e.target.files).catch(() => {});
                    e.target.value = "";
                  }}
                />
                <input
                  ref={dirInputRef}
                  type="file"
                  accept=".mp3,audio/mpeg"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => {
                    if (e.target.files) uploadFiles(e.target.files).catch(() => {});
                    e.target.value = "";
                  }}
                  {...({ webkitdirectory: "true", directory: "true" } as any)}
                />
                <div className="row2" style={{ marginBottom: 10 }}>
                  <input
                    className="input"
                    placeholder="Название нового альбома"
                    value={newAlbumName}
                    onChange={(e) => setNewAlbumName(e.target.value)}
                    disabled={!user}
                  />
                  <button
                    type="button"
                    className="btn btnPrimary"
                    onClick={() => createAlbum().catch(() => {})}
                    disabled={!user}
                  >
                    Создать
                  </button>
                </div>
                <div className="fieldLabel">Альбомы</div>
                <div className="queueList">
                  {albums.length === 0 ? (
                    <div className="hint">Альбомов пока нет.</div>
                  ) : (
                    albums.map((a) => (
                      <div key={a.id} className={"queueItem " + (selectedAlbumId === a.id ? "queueItemActive" : "")}>
                        <div className="qText" onClick={() => openAlbum(a.id).catch(() => {})} style={{ cursor: "pointer" }}>
                          <div className="qTitle">{a.name}</div>
                          <div className="qSub">Треков: {a.track_count}</div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            className="btn"
                            onClick={() => {
                              setRenameAlbumId(a.id);
                              setRenameAlbumValue(a.name);
                            }}
                          >
                            ✎
                          </button>
                          <button type="button" className="btn btnDanger" onClick={() => removeAlbum(a.id).catch(() => {})}>
                            🗑
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div style={{ height: 16 }} />

            <div className="panel">
              <div className="panelInner">
                <div className="sectionTitle">
                  <span>Мой профиль</span>
                  <span className="hint">ваши загрузки</span>
                </div>
                <div className="queueList">
                  {profileTracks.length === 0 ? (
                    <div className="hint">{user ? "В профиле пока пусто — загрузите mp3." : "Нет данных"}</div>
                  ) : (
                    profileTracks.map((t) => (
                      <div key={t.id} className="queueItem">
                        <div className="bullet" />
                        <div className="qText">
                          <div className="qTitle">{t.title}</div>
                          <div className="qSub">{t.file}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div style={{ height: 16 }} />

            <div className="panel">
              <div className="panelInner">
                <div className="sectionTitle">
                  <span>Проигрыватель</span>
                </div>

                <h1 className="nowTitle">{currentMeta.artist ? `${currentMeta.artist} — ${currentMeta.title}` : "Нет трека"}</h1>
                <div className="nowSub">{currentTrack?.file || ""}</div>

                <div className="controlsRow">
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <button className="iconBtn" onClick={prev} aria-label="Prev">
                      ⟨⟨
                    </button>
                    <button className="iconBtn playBtn" onClick={togglePlay} aria-label="Play">
                      {isPlaying ? "❚❚" : "▶"}
                    </button>
                    <button className="iconBtn" onClick={next} aria-label="Next">
                      ⟩⟩
                    </button>
                    <div style={{ position: "relative" }} ref={loopMenuRef}>
                      <button
                        className={"iconBtn " + (loopMode !== "none" ? "btnPrimary" : "")}
                        onClick={() => setLoopMenuOpen(!loopMenuOpen)}
                        aria-label={"Loop: " + (loopMode === "one" ? "track" : loopMode === "all" ? "playlist" : "off")}
                        title={getLoopModeLabel()}
                      >
                        {getLoopModeIcon()}
                      </button>
                      {loopMenuOpen && (
                        <div className="dropdownMenu" style={{ right: 0, left: "auto", minWidth: "180px", width: "auto" }}>
                          <div
                            className={"dropdownItem " + (loopMode === "none" ? "dropdownItemActive" : "")}
                            onClick={() => {
                              setLoopMode("none");
                              setLoopMenuOpen(false);
                            }}
                          >
                            <span>⊘</span>
                            <span>Выкл повтор</span>
                          </div>
                          <div
                            className={"dropdownItem " + (loopMode === "one" ? "dropdownItemActive" : "")}
                            onClick={() => {
                              setLoopMode("one");
                              setLoopMenuOpen(false);
                            }}
                          >
                            <span>↻</span>
                            <span>Повтор 1 трек</span>
                          </div>
                          <div
                            className={"dropdownItem " + (loopMode === "all" ? "dropdownItemActive" : "")}
                            onClick={() => {
                              setLoopMode("all");
                              setLoopMenuOpen(false);
                            }}
                          >
                            <span>∞</span>
                            <span>Повтор весь плейлист</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ position: "relative", minWidth: 160 }} ref={speedMenuRef}>
                      <div className="fieldLabel">Скорость</div>
                      <button className="dropdownBtn" onClick={() => setSpeedMenuOpen(!speedMenuOpen)}>
                        <span>{playbackRate}×</span>
                        <span style={{ opacity: 0.6 }}>▼</span>
                      </button>
                      {speedMenuOpen && (
                        <div className="dropdownMenu">
                          <div
                            className={"dropdownItem " + (playbackRate === 0.75 ? "dropdownItemActive" : "")}
                            onClick={() => {
                              setPlaybackRate(0.75);
                              setSpeedMenuOpen(false);
                            }}
                          >
                            0.75×
                          </div>
                          <div
                            className={"dropdownItem " + (playbackRate === 1 ? "dropdownItemActive" : "")}
                            onClick={() => {
                              setPlaybackRate(1);
                              setSpeedMenuOpen(false);
                            }}
                          >
                            1×
                          </div>
                          <div
                            className={"dropdownItem " + (playbackRate === 1.25 ? "dropdownItemActive" : "")}
                            onClick={() => {
                              setPlaybackRate(1.25);
                              setSpeedMenuOpen(false);
                            }}
                          >
                            1.25×
                          </div>
                          <div
                            className={"dropdownItem " + (playbackRate === 1.5 ? "dropdownItemActive" : "")}
                            onClick={() => {
                              setPlaybackRate(1.5);
                              setSpeedMenuOpen(false);
                            }}
                          >
                            1.5×
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="progressWrap">
                  <input
                    className="range"
                    type="range"
                    min={0}
                    max={Math.max(0.01, duration)}
                    step={0.01}
                    value={Math.min(curTime, duration || curTime)}
                    onChange={(e) => {
                      const a = audioRef.current;
                      if (!a) return;
                      const v = Number(e.target.value);
                      a.currentTime = v;
                      setCurTime(v);
                    }}
                  />
                  <div className="progressMeta">
                    <span>{fmtTime(curTime)}</span>
                    <span>{fmtTime(duration)}</span>
                  </div>

                  <div>
                    <div className="fieldLabel">Громкость</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <input className="range" type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
                      <span style={{ minWidth: "45px", fontSize: "12px", color: "rgba(255, 255, 255, 0.55)" }}>{Math.round(volume * 100)}%</span>
                    </div>
                  </div>
                </div>

                <div className="eqWrap">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <div className="fieldLabel">Эквалайзер</div>
                    <div style={{ position: "relative" }} ref={eqTypeMenuRef}>
                      <button className="dropdownBtn" onClick={() => setEqTypeMenuOpen(!eqTypeMenuOpen)} style={{ minWidth: "200px" }}>
                        <span>
                          {eqType === "mirror-bars" ? "Зеркальные бары" :
                           eqType === "dual-side" ? "Разделённый" :
                           eqType === "symmetric" ? "Симметричный" :
                           eqType === "wave" ? "Волна" :
                           eqType === "circle" ? "Круг" :
                           eqType === "edges-in" ? "От краёв к центру" :
                           eqType === "vertical" ? "Вертикальный" :
                           eqType === "pulse" ? "Пульсация" :
                           eqType === "spectrum" ? "Спектр" :
                           eqType === "bars-3d" ? "3D бары" :
                           eqType === "spiral" ? "Спираль" :
                           eqType === "waterfall" ? "Водопад" :
                           "Частицы"}
                        </span>
                        <span style={{ opacity: 0.6 }}>▼</span>
                      </button>
                      {eqTypeMenuOpen && (
                        <div className="dropdownMenu" style={{ maxHeight: "300px", overflowY: "auto" }}>
                          <div
                            className={"dropdownItem " + (eqType === "mirror-bars" ? "dropdownItemActive" : "")}
                            onClick={() => {
                              setEqType("mirror-bars");
                              setEqTypeMenuOpen(false);
                            }}
                          >
                            Зеркальные бары
                          </div>
                          <div
                            className={"dropdownItem " + (eqType === "dual-side" ? "dropdownItemActive" : "")}
                            onClick={() => {
                              setEqType("dual-side");
                              setEqTypeMenuOpen(false);
                            }}
                          >
                            Разделённый
                          </div>
                          <div
                            className={"dropdownItem " + (eqType === "symmetric" ? "dropdownItemActive" : "")}
                            onClick={() => {
                              setEqType("symmetric");
                              setEqTypeMenuOpen(false);
                            }}
                          >
                            Симметричный
                          </div>
                          <div
                            className={"dropdownItem " + (eqType === "wave" ? "dropdownItemActive" : "")}
                            onClick={() => {
                              setEqType("wave");
                              setEqTypeMenuOpen(false);
                            }}
                          >
                            Волна
                          </div>
                          <div
                            className={"dropdownItem " + (eqType === "circle" ? "dropdownItemActive" : "")}
                            onClick={() => {
                              setEqType("circle");
                              setEqTypeMenuOpen(false);
                            }}
                          >
                            Круг
                          </div>
                          <div
                            className={"dropdownItem " + (eqType === "edges-in" ? "dropdownItemActive" : "")}
                            onClick={() => {
                              setEqType("edges-in");
                              setEqTypeMenuOpen(false);
                            }}
                          >
                            От краёв к центру
                          </div>
                          <div
                            className={"dropdownItem " + (eqType === "vertical" ? "dropdownItemActive" : "")}
                            onClick={() => {
                              setEqType("vertical");
                              setEqTypeMenuOpen(false);
                            }}
                          >
                            Вертикальный
                          </div>
                          <div
                            className={"dropdownItem " + (eqType === "pulse" ? "dropdownItemActive" : "")}
                            onClick={() => {
                              setEqType("pulse");
                              setEqTypeMenuOpen(false);
                            }}
                          >
                            Пульсация
                          </div>
                          <div
                            className={"dropdownItem " + (eqType === "spectrum" ? "dropdownItemActive" : "")}
                            onClick={() => {
                              setEqType("spectrum");
                              setEqTypeMenuOpen(false);
                            }}
                          >
                            Спектр
                          </div>
                          <div
                            className={"dropdownItem " + (eqType === "bars-3d" ? "dropdownItemActive" : "")}
                            onClick={() => {
                              setEqType("bars-3d");
                              setEqTypeMenuOpen(false);
                            }}
                          >
                            3D бары
                          </div>
                          <div
                            className={"dropdownItem " + (eqType === "spiral" ? "dropdownItemActive" : "")}
                            onClick={() => {
                              setEqType("spiral");
                              setEqTypeMenuOpen(false);
                            }}
                          >
                            Спираль
                          </div>
                          <div
                            className={"dropdownItem " + (eqType === "waterfall" ? "dropdownItemActive" : "")}
                            onClick={() => {
                              setEqType("waterfall");
                              setEqTypeMenuOpen(false);
                            }}
                          >
                            Водопад
                          </div>
                          <div
                            className={"dropdownItem " + (eqType === "particles" ? "dropdownItemActive" : "")}
                            onClick={() => {
                              setEqType("particles");
                              setEqTypeMenuOpen(false);
                            }}
                          >
                            Частицы
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="viz">
                    <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
                  </div>

                  <div className="eqGrid">
                    <div className="eqCard">
                      <div className="eqName">Bass</div>
                      <div className="eqVal">{bass.toFixed(0)} dB</div>
                      <input className="range" type="range" min={-12} max={12} step={1} value={bass} onChange={(e) => setBass(Number(e.target.value))} />
                    </div>
                    <div className="eqCard">
                      <div className="eqName">Mid</div>
                      <div className="eqVal">{mid.toFixed(0)} dB</div>
                      <input className="range" type="range" min={-12} max={12} step={1} value={mid} onChange={(e) => setMid(Number(e.target.value))} />
                    </div>
                    <div className="eqCard">
                      <div className="eqName">Treble</div>
                      <div className="eqVal">{treble.toFixed(0)} dB</div>
                      <input className="range" type="range" min={-12} max={12} step={1} value={treble} onChange={(e) => setTreble(Number(e.target.value))} />
                    </div>
                  </div>
                </div>

                <audio ref={audioRef} preload="auto" />
              </div>
            </div>

            <div style={{ height: 16 }} />

            <div className="panel">
              <div className="panelInner">
                <div className="sectionTitle">
                  <span>Очередь</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {!deleteMode ? (
                      <button className="btn btnDanger" onClick={() => setDeleteMode(true)}>
                        Удалить
                      </button>
                    ) : (
                      <>
                        <button className="btn" onClick={exitDeleteMode} disabled={deleteBusy}>
                          Отмена
                        </button>
                        <button
                          className="btn btnDanger"
                          onClick={() => deleteSelectedTracks().catch(() => {})}
                          disabled={deleteBusy || deleteSelected.length === 0}
                          title={deleteSelected.length === 0 ? "Выберите треки для удаления" : ""}
                        >
                          {deleteBusy ? "Удаление..." : `Подтвердить (${deleteSelected.length})`}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="queueList">
                  {queueTracks.map((t, idx) => {
                    const active = t.id === currentId;
                    const selected = deleteSelected.includes(t.id);
                    return (
                      <div
                        key={t.id}
                        className={
                          "queueItem " +
                          (active ? "queueItemActive " : "") +
                          (selected ? "queueItemSelected " : "") +
                          (dragOver === idx && dragFrom !== null && dragFrom !== idx ? "dragOver" : "")
                        }
                        draggable={!deleteMode}
                        onDragStart={() => {
                          if (deleteMode) return;
                          setDragFrom(idx);
                        }}
                        onDragOver={(e) => {
                          if (deleteMode) return;
                          e.preventDefault();
                          setDragOver(idx);
                        }}
                        onDragEnd={() => {
                          setDragFrom(null);
                          setDragOver(null);
                        }}
                        onDrop={(e) => {
                          if (deleteMode) return;
                          e.preventDefault();
                          if (dragFrom === null) return;
                          reorder(dragFrom, idx);
                          setDragFrom(null);
                          setDragOver(null);
                        }}
                        onClick={() => {
                          if (deleteMode) {
                            toggleDeleteSelect(t.id);
                            return;
                          }
                          setCurTime(0);
                          setCurrentId(t.id);
                          setTimeout(() => play(), 0);
                        }}
                      >
                        <div className="bullet" />
                        <div className="qText">
                          <div className="qTitle">{splitArtistTitle(t.file).title}</div>
                          <div className="qSub">{t.file}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ height: 16 }} />

            <div className="panel">
              <div className="popularOuter">
                <div className="sectionTitle">
                  <span>Популярное</span>
                  <span className="hint">{popularError ? popularError : "Hot 100"}</span>
                </div>

                <div className="popularMarquee">
                  {popularLoop.length === 0 ? (
                    <div style={{ padding: "10px 2px", color: "rgba(255,255,255,0.55)" }}>Нет данных</div>
                  ) : (
                    <div className="popularRow">
                      {popularLoop.map((p, i) => (
                        <a key={`${p.rank}-${p.title}-${i}`} className="popCard" href={p.url} target="_blank" rel="noreferrer">
                          <div className="popRank">#{p.rank}</div>
                          <div className="popTitle">{p.title}</div>
                          <div className="popArtist">{p.artist}</div>
                          <div className="popLink">Открыть источник</div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ height: 16 }} />

            <div className="panel">
              <div className="panelInner">
                <div className="sectionTitle">
                  <span>Пожелания</span>
                  <button className="btn btnPrimary" onClick={() => setFeedbackOpen(true)}>
                    Написать
                  </button>
                </div>
              </div>
            </div>
          </div>

          {chatOpen && (
            <div className="col">
              <div className="panel chatPanel">
                <div className="panelInner" style={{ paddingBottom: 10 }}>
                  <div className="sectionTitle" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Чат</span>
                    <button
                      className="btn"
                      onClick={clearChat}
                      style={{ padding: "6px 12px", fontSize: "12px", minWidth: "auto" }}
                      title="Очистить чат"
                    >
                      Очистить
                    </button>
                  </div>
                </div>

                <div className="chatBody">
                  {chat.map((m) => (
                    <div key={m.t} className={"msg " + (m.from === "user" ? "msgUser" : "")}>
                      {m.text}
                    </div>
                  ))}
                </div>

                <div className="chatInputRow">
                  <input
                    className="input"
                    value={chatInput}
                    placeholder="Сообщение..."
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") sendChat().catch(() => {});
                    }}
                  />
                  <button className="sendBtn" onClick={() => sendChat().catch(() => {})}>
                    Отправить
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {feedbackOpen && (
        <div className="modalOverlay" onMouseDown={() => setFeedbackOpen(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHead">
              <div className="modalTitle">Письмо</div>
              <button className="btn" onClick={() => setFeedbackOpen(false)}>
                ✕
              </button>
            </div>
            <div className="modalBody">
              <div className="row2">
                <input className="input" placeholder="Имя (необязательно)" value={fbName} onChange={(e) => setFbName(e.target.value)} />
                <input className="input" placeholder="Email (необязательно)" value={fbEmail} onChange={(e) => setFbEmail(e.target.value)} />
              </div>
              <textarea className="textarea" placeholder="Текст пожелания..." value={fbText} onChange={(e) => setFbText(e.target.value)} />
              <button className="sendBtn" onClick={() => sendFeedback().catch(() => {})}>
                Отправить
              </button>
            </div>
          </div>
        </div>
      )}

      {authOpen && (
        <div className="modalOverlay" onMouseDown={() => user && setAuthOpen(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHead">
              <div className="modalTitle">{authTab === "login" ? "Вход" : "Регистрация"}</div>
              {user ? (
                <button type="button" className="btn" onClick={() => setAuthOpen(false)}>
                  ✕
                </button>
              ) : null}
            </div>
            <div className="modalBody">
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button
                  type="button"
                  className={"btn " + (authTab === "login" ? "btnPrimary" : "")}
                  onClick={() => setAuthTab("login")}
                >
                  Вход
                </button>
                <button
                  type="button"
                  className={"btn " + (authTab === "register" ? "btnPrimary" : "")}
                  onClick={() => setAuthTab("register")}
                >
                  Регистрация
                </button>
              </div>
              {authTab === "register" ? (
                <input
                  className="input"
                  placeholder="Имя (отображается в профиле)"
                  value={authDisplayName}
                  onChange={(e) => setAuthDisplayName(e.target.value)}
                  style={{ marginBottom: 8 }}
                />
              ) : null}
              <input
                className="input"
                placeholder="Email"
                type="email"
                autoComplete="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                style={{ marginBottom: 8 }}
              />
              <input
                className="input"
                placeholder="Пароль"
                type="password"
                autoComplete={authTab === "login" ? "current-password" : "new-password"}
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                style={{ marginBottom: 12 }}
              />
              <button type="button" className="sendBtn" disabled={authBusy} onClick={() => submitAuth().catch(() => {})}>
                {authBusy ? "…" : authTab === "login" ? "Войти" : "Зарегистрироваться"}
              </button>
              {!user ? <div className="hint" style={{ marginTop: 10 }}>Без входа недоступны загрузка, поиск и библиотека.</div> : null}
            </div>
          </div>
        </div>
      )}

      {deleteAccountOpen && (
        <div className="modalOverlay" onMouseDown={() => setDeleteAccountOpen(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHead">
              <div className="modalTitle">Удалить аккаунт</div>
              <button type="button" className="btn" onClick={() => setDeleteAccountOpen(false)}>
                ✕
              </button>
            </div>
            <div className="modalBody">
              <p className="hint" style={{ marginTop: 0 }}>
                Будут удалены ваш профиль, все ваши загруженные файлы и альбомы. Действие необратимо.
              </p>
              <input
                className="input"
                type="password"
                placeholder="Текущий пароль"
                value={deleteAccountPassword}
                onChange={(e) => setDeleteAccountPassword(e.target.value)}
                style={{ marginBottom: 12 }}
              />
              <button type="button" className="sendBtn" style={{ background: "rgba(255,68,68,0.25)" }} onClick={() => submitDeleteAccount().catch(() => {})}>
                Удалить навсегда
              </button>
            </div>
          </div>
        </div>
      )}

      {renameAlbumId && (
        <div className="modalOverlay" onMouseDown={() => setRenameAlbumId("")}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHead">
              <div className="modalTitle">Переименовать альбом</div>
              <button type="button" className="btn" onClick={() => setRenameAlbumId("")}>
                ✕
              </button>
            </div>
            <div className="modalBody">
              <input className="input" value={renameAlbumValue} onChange={(e) => setRenameAlbumValue(e.target.value)} />
              <button type="button" className="sendBtn" onClick={() => renameAlbum(renameAlbumId).catch(() => {})}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {addDialogTrackId && (
        <div className="modalOverlay" onMouseDown={() => setAddDialogTrackId("")}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHead">
              <div className="modalTitle">Альбомы</div>
              <button type="button" className="btn" onClick={() => setAddDialogTrackId("")}>
                ✕
              </button>
            </div>
            <div className="modalBody">
              <div className="fieldLabel">Выберите, в какой альбом добавить трек</div>
              <div className="queueList">
                {albums.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="btn"
                    style={{ justifyContent: "space-between" }}
                    onClick={() => addTrackToAlbum(a.id, addDialogTrackId).catch(() => {})}
                  >
                    <span>{a.name}</span>
                    <span style={{ opacity: 0.65 }}>({a.track_count})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
