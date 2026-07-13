// ===================================================
// DEEP FOCUS - POMODORO TIMER APPLICATION
// ===================================================

/**
 * True when the keyboard event originates from a typing context —
 * inputs, textareas, selects, or contenteditable elements. Global
 * shortcuts must stay inert there so typing (e.g. spaces in the task
 * input) is never hijacked. Shared by every global keydown listener.
 */
function isTypingContext(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Celebration — premium confetti layer rendered ABOVE the entire UI.
 * One fixed container attached directly to document.body (never inside
 * a card, transform container, or stacking context), so particles can
 * never be clipped by overflow, border-radius, or z-index. Physics:
 * radial burst from the origin element, outward spread, then a gentle
 * gravity fall with sway, fading out over ~2.2-2.9s. A single rAF loop
 * animates compositor-only properties (transform/opacity) for 60fps.
 */
const Celebration = {
  container: null,
  particles: [],
  raf: null,
  lastT: 0,

  getContainer() {
    if (!this.container) {
      const el = document.createElement("div");
      el.className = "celebration-layer";
      el.setAttribute("aria-hidden", "true");
      document.body.appendChild(el);
      this.container = el;
    }
    return this.container;
  },

  /** Fire a burst from the center of originEl (or screen center) */
  burst(originEl, count = 70) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return; // respect the user's motion preference
    }
    const container = this.getContainer();
    const rect = originEl && originEl.getBoundingClientRect();
    const ox = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const oy = rect ? rect.top + rect.height / 3 : window.innerHeight / 2;

    // Palette follows the current wallpaper accent
    const rootStyles = getComputedStyle(document.documentElement);
    const accent =
      rootStyles.getPropertyValue("--accent-color").trim() || "#a855f7";
    const hover =
      rootStyles.getPropertyValue("--accent-hover").trim() || "#c084fc";
    const colors = [accent, hover, "#ffffff", "#fbbf24", accent];

    const now = performance.now();
    for (let i = 0; i < count; i++) {
      const el = document.createElement("div");
      el.className = "celebration-particle";
      const size = 5 + Math.random() * 7;
      el.style.width = size + "px";
      el.style.height =
        (Math.random() < 0.45 ? size : size * 0.45).toFixed(1) + "px";
      el.style.background = colors[i % colors.length];
      el.style.borderRadius = Math.random() < 0.5 ? "50%" : "2px";
      container.appendChild(el);

      const angle = Math.random() * Math.PI * 2;
      const speed = 4.5 + Math.random() * 9;
      this.particles.push({
        el,
        x: ox,
        y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4, // upward bias: a real "pop"
        rot: Math.random() * 360,
        vr: (Math.random() - 0.5) * 16,
        sway: Math.random() * Math.PI * 2,
        born: now,
        life: 2200 + Math.random() * 700, // fades out at 2.2-2.9s
      });
    }

    if (!this.raf) {
      this.lastT = now;
      this.raf = requestAnimationFrame((t) => this.tick(t));
    }
  },

  tick(t) {
    // Normalize physics to a 60fps baseline so high-refresh displays
    // and dropped frames both look identical
    const dt = Math.min(Math.max((t - this.lastT) / 16.67, 0.5), 2);
    this.lastT = t;

    const alive = [];
    for (const p of this.particles) {
      const age = t - p.born;
      if (age >= p.life) {
        p.el.remove();
        continue;
      }
      const drag = Math.pow(0.96, dt);
      p.vx *= drag;
      p.vy = Math.min(p.vy * drag + 0.3 * dt, 6.5); // gravity, capped
      p.sway += 0.08 * dt;
      p.x += (p.vx + Math.sin(p.sway) * 0.7) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;

      const fadeStart = p.life - 700;
      const opacity =
        age > fadeStart ? Math.max(0, 1 - (age - fadeStart) / 700) : 1;
      p.el.style.opacity = opacity.toFixed(3);
      p.el.style.transform =
        "translate3d(" +
        p.x.toFixed(1) +
        "px, " +
        p.y.toFixed(1) +
        "px, 0) rotate(" +
        p.rot.toFixed(1) +
        "deg)";
      alive.push(p);
    }
    this.particles = alive;
    this.raf = alive.length
      ? requestAnimationFrame((tt) => this.tick(tt))
      : null;
  },
};

/**
 * PomodoroTimer Class - Main application logic
 */
class PomodoroTimer {
  constructor() {
    // Timer Configuration
    this.defaultDurations = {
      pomodoro: 25,
      "short-break": 5,
      "long-break": 15,
    };

    this.durations = { ...this.defaultDurations };

    // Timer State
    this.currentSession = "pomodoro";
    this.timeRemaining = this.durations.pomodoro * 60; // in seconds
    this.isRunning = false;
    this.timerInterval = null;

    // Settings
    this.autoStart = false;
    this.enableNotifications = true;

    // DOM Elements
    this.timerDisplay = document.getElementById("timerDisplay");
    this.startBtn = document.getElementById("startBtn");
    this.pauseBtn = document.getElementById("pauseBtn");
    this.resetBtn = document.getElementById("resetBtn");
    this.settingsBtn = document.getElementById("settingsBtn");
    this.saveSettingsBtn = document.getElementById("saveSettingsBtn");
    this.tabButtons = document.querySelectorAll(".tab-btn");
    this.pomodoroInput = document.getElementById("pomodoroInput");
    this.shortBreakInput = document.getElementById("shortBreakInput");
    this.longBreakInput = document.getElementById("longBreakInput");
    this.autoStartToggle = document.getElementById("autoStartToggle");
    this.notificationToggle = document.getElementById("notificationToggle");

    // Initialize
    this.loadSettings();
    this.initEventListeners();
    this.updateTimerDisplay();
  }

  /**
   * Initialize all event listeners
   */
  initEventListeners() {
    // Timer Controls
    this.startBtn.addEventListener("click", () => this.start());
    this.pauseBtn.addEventListener("click", () => this.pause());
    this.resetBtn.addEventListener("click", () => this.reset());

    // Tab Switching
    this.tabButtons.forEach((btn) => {
      btn.addEventListener("click", () =>
        this.switchSession(btn.dataset.session),
      );
    });

    // Settings
    this.saveSettingsBtn.addEventListener("click", () => this.saveSettings());

    // Keyboard Shortcuts — inert while the user is typing, so Space
    // inserts a space in the task input instead of toggling the timer
    document.addEventListener("keydown", (e) => {
      if (isTypingContext(e.target)) return;

      if (e.code === "Space") {
        e.preventDefault();
        this.isRunning ? this.pause() : this.start();
      }
      if (e.code === "KeyR") {
        this.reset();
      }
    });

    // Discord Card Click
    document.querySelector(".discord-card").addEventListener("click", () => {
      window.open("https://discord.com", "_blank");
    });
  }

  /**
   * Start the timer
   */
  start() {
    if (this.isRunning) return;

    // Safety: never allow two intervals to run at once
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    this.isRunning = true;
    this.startBtn.style.display = "none";
    this.pauseBtn.style.display = "flex";

    this.timerInterval = setInterval(() => {
      this.timeRemaining--;

      if (this.timeRemaining <= 0) {
        this.timerComplete();
      } else {
        this.updateTimerDisplay();
      }
    }, 1000);
  }

  /**
   * Pause the timer
   */
  pause() {
    this.isRunning = false;
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.startBtn.style.display = "flex";
    this.pauseBtn.style.display = "none";
  }

  /**
   * Reset the timer
   */
  reset() {
    this.pause();
    this.timeRemaining = this.durations[this.currentSession] * 60;
    this.updateTimerDisplay();
  }

  /**
   * Switch session type (pomodoro, short-break, long-break)
   */
  switchSession(sessionType) {
    if (this.isRunning) {
      this.pause();
    }

    this.currentSession = sessionType;
    this.timeRemaining = this.durations[sessionType] * 60;

    // Update active tab
    this.tabButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.session === sessionType);
    });

    // Update timer label
    const labels = {
      pomodoro: "FOCUS SESSION",
      "short-break": "SHORT BREAK",
      "long-break": "LONG BREAK",
    };
    document.querySelector(".timer-label").textContent = labels[sessionType];

    this.updateTimerDisplay();
  }

  /**
   * Handle timer completion
   */
  timerComplete() {
    this.pause();

    // Clamp and show 00:00 so the completed session stays visible
    this.timeRemaining = 0;
    this.updateTimerDisplay();

    // Session flow (bell, modal, auto-switching) is handled by
    // NotificationManager.handleSessionComplete(), wired up in the
    // timerComplete override during initialization.
  }

  /**
   * Play notification sound
   */
  playNotification() {
    // Create a simple beep sound
    const audioContext = new (
      window.AudioContext || window.webkitAudioContext
    )();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = "sine";

    gain.gain.setValueAtTime(0.3, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.5,
    );

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  }

  /**
   * Switch to a session type, reset it to the configured duration,
   * and start it immediately.
   */
  startSession(sessionType) {
    this.switchSession(sessionType); // pauses, resets duration, updates tabs/label
    this.start();
  }

  /**
   * Move to next session
   */
  nextSession() {
    const sessionOrder = ["pomodoro", "short-break", "long-break"];
    const currentIndex = sessionOrder.indexOf(this.currentSession);
    const nextIndex = (currentIndex + 1) % sessionOrder.length;
    this.switchSession(sessionOrder[nextIndex]);
    this.start();
  }

  /**
   * Update timer display
   */
  updateTimerDisplay() {
    const minutes = Math.floor(this.timeRemaining / 60);
    const seconds = this.timeRemaining % 60;
    this.timerDisplay.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    // Update page title
    document.title = `${this.timerDisplay.textContent} - Deep Focus`;

    // Update progress bars
    this.updateProgressBars();
  }

  /**
   * Update progress indicator bars
   */
  updateProgressBars() {
    const progressBars = document.querySelectorAll(".progress-bar");
    const totalSeconds = this.durations[this.currentSession] * 60;
    const elapsed = totalSeconds - this.timeRemaining;
    const progress = (elapsed / totalSeconds) * 100;

    progressBars.forEach((bar, index) => {
      const barProgress = Math.min(100, Math.max(0, progress - index * 33.33));
      bar.style.width = barProgress + "%";
    });
  }

  /**
   * Load settings from localStorage
   */
  loadSettings() {
    const stored = localStorage.getItem("pomodoroSettings");
    if (stored) {
      const settings = JSON.parse(stored);
      this.durations = settings.durations || this.defaultDurations;
      this.autoStart = settings.autoStart || false;
      this.enableNotifications = settings.enableNotifications !== false;

      this.pomodoroInput.value = this.durations.pomodoro;
      this.shortBreakInput.value = this.durations["short-break"];
      this.longBreakInput.value = this.durations["long-break"];
      this.autoStartToggle.checked = this.autoStart;
      this.notificationToggle.checked = this.enableNotifications;

      this.timeRemaining = this.durations[this.currentSession] * 60;
    }

    // Request notification permission
    if (
      this.enableNotifications &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission();
    }
  }

  /**
   * Save settings to localStorage
   */
  saveSettings() {
    const newDurations = {
      pomodoro: parseInt(this.pomodoroInput.value) || 25,
      "short-break": parseInt(this.shortBreakInput.value) || 5,
      "long-break": parseInt(this.longBreakInput.value) || 15,
    };

    this.durations = newDurations;
    this.autoStart = this.autoStartToggle.checked;
    this.enableNotifications = this.notificationToggle.checked;

    localStorage.setItem(
      "pomodoroSettings",
      JSON.stringify({
        durations: this.durations,
        autoStart: this.autoStart,
        enableNotifications: this.enableNotifications,
      }),
    );

    // Reset timer with new duration
    this.reset();

    // Close modal
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("settingsModal"),
    );
    if (modal) {
      modal.hide();
    }

    // Show confirmation
    this.showToast("Settings saved successfully!");
  }

  /**
   * Show toast notification
   */
  showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast-notification";
    toast.textContent = message;
    toast.style.cssText = `
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            background: var(--card-bg);
            backdrop-filter: blur(20px);
            border: 1px solid var(--card-border);
            color: var(--text-primary);
            padding: 1rem 1.5rem;
            border-radius: 50px;
            z-index: 1000;
            animation: slideInUp 0.3s ease-out;
        `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = "slideOutDown 0.3s ease-out";
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }
}

// ===================================================
// MUSIC PLAYER
// ===================================================

/**
 * PLAYLIST — add your tracks here.
 * Each entry: { title, artist, src, cover }
 * src can be a local file (e.g. "assets/music/song.mp3") or a URL.
 */
const PLAYLIST = [
  {
    title: "Night lofi playlist • lofi music | chill beats to relax/study",
    artist: "HITO",
    src: "assets/sounds/music1.mp3",
    cover: "music-pic.jpg",
  },
  {
    title: "Chill Songs | Cozy & Relaxing Music for a Peaceful Day ",
    artist: "Lofi Playlist",
    src: "assets/sounds/music2.mp3",
    cover: "music-pic.jpg",
  },
  {
    title: "Quiet Time with God: 1 Hour Instrumental Worship | Prayer Music",
    artist: "Serene Sessions",
    src: "assets/sounds/music3.mp3",
    cover: "music-pic.jpg",
  },
  {
    title:
      "Demon Slayer Infinity castle Movie OST: Akaza's Backstory Theme | Emotional Version",
    artist: "Tsuyu 愛",
    src: "assets/sounds/music4.mp3",
    cover: "music-pic.jpg",
  },
  {
    title: "Night lofi playlist • lofi music | chill beats to relax/study",
    artist: "HITO",
    src: "assets/sounds/music5.mp3",
    cover: "music-pic.jpg",
  },
  // {
  //   title: "Second Track",
  //   artist: "Artist Name",
  //   src: "assets/music/track2.mp3",
  //   cover: "music-pic.jpg",
  // },
];

// ===================================================
// LIVE WALLPAPER
// ===================================================

/**
 * LIVE_WALLPAPERS — add your built-in wallpaper videos here.
 * Each entry: { name, src, accent } — src can be a local MP4/WebM
 * (e.g. "assets/wallpapers/blue-sky.mp4") or a URL. The accent color
 * retints all interactive elements to match the wallpaper's mood.
 */
const LIVE_WALLPAPERS = [
  {
    name: "Blue Sky",
    desktop: "assets/images/Live-Wallpapers/lwp1-Blue_Sky.mp4",
    mobile: "assets/images/Live-Wallpapers/lwp1-Blue_Sky_Mobile.MP4",
    accent: "#22D3EE",
  },
  {
    name: "Calm Forest",
    desktop: "assets/images/Live-Wallpapers/lwp2-Calm_Forest.mp4",
    mobile: "assets/images/Live-Wallpapers/lwp2-Calm_Forest_Mobile.MP4",
    accent: "#59C173",
  },
  {
    name: "Hidden Garden Temple",
    desktop: "assets/images/Live-Wallpapers/lwp3-Hidden_Garden_Temple.mp4",
    mobile:
      "assets/images/Live-Wallpapers/lwp3-Hidden_Garden_Temple_Mobile.MP4",
    accent: "#8BC34A",
  },
];

/** Default accent (the original purple) for image mode and uploads */
const DEFAULT_ACCENT = "#a855f7";

/* ---- Small color utilities for deriving the accent palette ---- */

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Mix a hex color toward white (amt > 0) or black (amt < 0), 0..1 */
function shadeHex(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  const t = amt > 0 ? 255 : 0;
  const p = Math.abs(amt);
  const mix = (c) => Math.round(c + (t - c) * p);
  return (
    "#" +
    [mix(r), mix(g), mix(b)]
      .map((c) => c.toString(16).padStart(2, "0"))
      .join("")
  );
}

function hexToRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * AMBIENT_SOUNDS — built-in natural/ambient loops for the Ambient tab.
 * Each entry: { id, title, icon, file, loop } — files loop seamlessly
 * until stopped. Add or remove entries freely; the UI adapts.
 * The shape supports future mixing (multiple ids playing at once).
 */
const AMBIENT_SOUNDS = [
  {
    id: "ocean",
    title: "Ocean Waves",
    icon: "\u{1F30A}",
    file: "assets/ambients/ocean-waves.mp3",
    loop: true,
  },
  {
    id: "rain",
    title: "Rain",
    icon: "\u{1F327}",
    file: "assets/ambients/rain.mp3",
    loop: true,
  },
  {
    id: "thunder",
    title: "Thunderstorm",
    icon: "\u{26C8}",
    file: "assets/ambients/thunder.mp3",
    loop: true,
  },
  {
    id: "forest",
    title: "Forest",
    icon: "\u{1F332}",
    file: "assets/ambients/forest.mp3",
    loop: true,
  },
  {
    id: "wind",
    title: "Wind Through Trees",
    icon: "\u{1F343}",
    file: "assets/ambients/wind.mp3",
    loop: true,
  },
  {
    id: "fireplace",
    title: "Fireplace",
    icon: "\u{1F525}",
    file: "assets/ambients/fireplace.mp3",
    loop: true,
  },
  {
    id: "coffee",
    title: "Coffee Shop",
    icon: "\u2615",
    file: "assets/ambients/coffee.mp3",
    loop: true,
  },
  {
    id: "library",
    title: "Library",
    icon: "\u{1F4DA}",
    file: "assets/ambients/library.mp3",
    loop: true,
  },
  {
    id: "crickets",
    title: "Night Crickets",
    icon: "\u{1F303}",
    file: "assets/ambients/crickets.mp3",
    loop: true,
  },
  {
    id: "night-forest",
    title: "Night Forest",
    icon: "\u{1F989}",
    file: "assets/ambients/night-forest.mp3",
    loop: true,
  },
  {
    id: "birds",
    title: "Morning Birds",
    icon: "\u{1F426}",
    file: "assets/ambients/birds.mp3",
    loop: true,
  },
  {
    id: "river",
    title: "River Stream",
    icon: "\u{1F3DE}",
    file: "assets/ambients/river.mp3",
    loop: true,
  },
  {
    id: "snow",
    title: "Snow Wind",
    icon: "\u2744",
    file: "assets/ambients/snow.mp3",
    loop: true,
  },
  {
    id: "campfire",
    title: "Campfire",
    icon: "\u{1F3D5}",
    file: "assets/ambients/campfire.mp3",
    loop: true,
  },
  {
    id: "train",
    title: "Train Journey",
    icon: "\u{1F682}",
    file: "assets/ambients/train.mp3",
    loop: true,
  },
];

/**
 * AmbientPlayer — independent multi-sound ambient mixing engine.
 * Any number of sounds can play simultaneously alongside the music.
 * Audio elements come from a reusable pool (never destroyed, only
 * reassigned), each sound loops until removed, and one master volume
 * governs the whole ambient mix. Owns the compact active-sounds panel
 * and the library modal; persists to its own localStorage key.
 */
class AmbientPlayer {
  static STORAGE_KEY = "deepFocusAmbient";

  constructor(sounds, { onChange } = {}) {
    // Ambient sounds are built-in application content — the library
    // is fixed; users play and mix them, never edit them
    this.sounds = (Array.isArray(sounds) ? sounds : []).map((s) => ({
      id: s.id,
      title: s.title,
      icon: s.icon,
      src: s.file,
    }));
    this.onChange = typeof onChange === "function" ? onChange : () => {};

    // Element pool: the static #ambientPlayer element is slot 0;
    // more are created on demand and reused forever after
    const seed = document.getElementById("ambientPlayer");
    this.pool = seed ? [seed] : [];
    this.active = new Map(); // sound id -> pooled audio element

    this.panelEl = document.getElementById("ambientPanel");
    this.activeListEl = document.getElementById("ambientActiveList");
    this.toggleBtn = document.getElementById("ambientToggleBtn");
    this.volumeSlider = document.getElementById("ambientVolumeSlider");
    this.playerCard = document.getElementById("musicPlayer");
    // Settings-page list (read-only: built-in assets)
    this.manageListEl = document.getElementById("ambientManageList");

    this.volume = 0.5; // master ambient volume — independent of music
    this.retryOnGesture = false;

    if (!seed || !this.panelEl) return;

    this.loadState();
    this.buildLibrary();
    this.renderManageList();
    this.initEventListeners();
    this.restore();
  }

  /* ---------- Element pool ---------- */

  acquireElement() {
    const inUse = new Set(this.active.values());
    let el = this.pool.find((a) => !inUse.has(a));
    if (!el) {
      el = new Audio(); // grown once, reused forever
      el.preload = "none";
      this.pool.push(el);
    }
    el.loop = true;
    el.volume = this.volume;
    return el;
  }

  /* ---------- Wiring ---------- */

  initEventListeners() {
    this.toggleBtn.addEventListener("click", () => this.masterToggle());

    this.volumeSlider.addEventListener("input", (e) => {
      this.setVolume(e.target.value / 100);
    });

    // In-card library rows (delegated): the row itself toggles the
    // sound; the hover-revealed x stops an active one explicitly
    this.activeListEl.addEventListener("click", (e) => {
      const row = e.target.closest(".ambient-active-row");
      if (!row) return;
      const id = row.dataset.id;
      if (e.target.closest(".ambient-row-remove")) {
        this.remove(id);
      } else {
        this.active.has(id) ? this.remove(id) : this.add(id);
      }
    });

    this.activeListEl.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const row = e.target.closest(".ambient-active-row");
      if (!row) return;
      e.preventDefault();
      const id = row.dataset.id;
      this.active.has(id) ? this.remove(id) : this.add(id);
    });
  }

  buildLibrary() {
    // In-card library rows — rebuilt only when the library itself
    // changes (import/remove/rename); state updates happen in place
    const fragment = document.createDocumentFragment();
    this.rowsById = new Map();

    this.sounds.forEach((s) => {
      const row = document.createElement("div");
      row.className = "ambient-active-row";
      row.dataset.id = s.id;
      row.setAttribute("role", "button");
      row.tabIndex = 0;
      row.innerHTML =
        '<span class="ambient-row-icon">' +
        s.icon +
        '</span><span class="ambient-row-title">' +
        s.title +
        '</span><span class="ambient-row-live">' +
        '<span class="mini-eq"><i></i><i></i><i></i></span>' +
        '<span class="ambient-row-playing">Playing</span>' +
        "</span>" +
        '<button type="button" class="ambient-row-btn ambient-row-remove" title="Stop sound">' +
        '<i class="fas fa-times"></i></button>';
      this.rowsById.set(s.id, row);
      fragment.appendChild(row);
    });

    this.activeListEl.replaceChildren(fragment);
    this.refreshUI();
  }

  /* ---------- Mixing ---------- */ /* ---------- Mixing ---------- */

  get isPlaying() {
    for (const el of this.active.values()) if (!el.paused) return true;
    return false;
  }

  soundById(id) {
    return this.sounds.find((s) => s.id === id) || null;
  }

  /** Start a sound (immediately) alongside whatever else is playing */
  add(id) {
    const sound = this.soundById(id);
    if (!sound || this.active.has(id)) return;
    const el = this.acquireElement();
    if (el.getAttribute("src") !== sound.src) {
      el.setAttribute("src", sound.src);
      el.load();
    }
    this.active.set(id, el);
    this.playElement(el);
    this.refreshUI();
    this.saveState();
  }

  /** Stop a sound and release its element back to the pool */
  remove(id) {
    const el = this.active.get(id);
    if (!el) return;
    el.pause();
    this.active.delete(id);
    this.refreshUI();
    this.saveState();
  }

  toggleSoundPlayback(id) {
    const el = this.active.get(id);
    if (!el) return;
    el.paused ? this.playElement(el) : el.pause();
    // element events don't exist on pooled elements — sync manually
    this.refreshUI();
    this.saveState();
  }

  /** Pause everything, or resume everything, in one tap */
  masterToggle() {
    if (this.active.size === 0) return;
    if (this.isPlaying) {
      for (const el of this.active.values()) el.pause();
    } else {
      for (const el of this.active.values()) this.playElement(el);
    }
    this.refreshUI();
    this.saveState();
  }

  playElement(el) {
    el.play()
      .then(() => {
        this.retryOnGesture = false;
        this.refreshUI();
      })
      .catch(() => this.armGestureRetry());
  }

  armGestureRetry() {
    if (this.retryOnGesture) return;
    this.retryOnGesture = true;
    document.addEventListener(
      "pointerdown",
      () => {
        this.retryOnGesture = false;
        for (const el of this.active.values()) {
          if (el.paused) el.play().catch(() => {});
        }
        this.refreshUI();
      },
      { once: true },
    );
  }

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, v));
    for (const el of this.active.values()) el.volume = this.volume;
    this.saveState();
  }

  /* ---------- UI ---------- */

  refreshUI() {
    // Update the in-card rows in place — no rebuilding. Active sounds
    // float to the top (appendChild moves cached nodes, cheaply).
    const order = [
      ...this.active.keys(),
      ...this.sounds.map((s) => s.id).filter((id) => !this.active.has(id)),
    ];
    for (const id of order) {
      const row = this.rowsById.get(id);
      if (!row) continue;
      const el = this.active.get(id);
      row.classList.toggle("active", !!el);
      row.classList.toggle("audible", !!el && !el.paused);
      if (el) {
        row.querySelector(".ambient-row-playing").textContent = el.paused
          ? "Paused"
          : "Playing";
      }
      this.activeListEl.appendChild(row); // reorders, never recreates
    }

    // Master row + card-level state
    const playing = this.isPlaying;
    this.toggleBtn.innerHTML = playing
      ? '<i class="fas fa-pause"></i>'
      : '<i class="fas fa-play"></i>';
    this.toggleBtn.disabled = this.active.size === 0;
    this.playerCard.classList.toggle("ambient-playing", playing);
    this.onChange();
  }

  /* ---------- Settings list (read-only, built-in assets) ---------- */

  /** Icon + name only — no rename, no delete */
  renderManageList() {
    if (!this.manageListEl) return;
    const fragment = document.createDocumentFragment();
    this.sounds.forEach((s) => {
      const row = document.createElement("div");
      row.className = "ambient-manage-row";

      const icon = document.createElement("span");
      icon.className = "ambient-manage-icon";
      icon.textContent = s.icon;

      const name = document.createElement("span");
      name.className = "ambient-manage-name-static";
      name.textContent = s.title;

      row.append(icon, name);
      fragment.appendChild(row);
    });
    this.manageListEl.replaceChildren(fragment);
  }

  /* ---------- Persistence ---------- */ /* ---------- Persistence ---------- */

  saveState() {
    try {
      localStorage.setItem(
        AmbientPlayer.STORAGE_KEY,
        JSON.stringify({
          activeIds: [...this.active.keys()],
          volume: this.volume,
          wasPlaying: this.isPlaying,
        }),
      );
    } catch (_) {
      /* storage unavailable — ignore */
    }
  }

  loadState() {
    this.savedIds = [];
    this.wasPlaying = false;
    try {
      const s = JSON.parse(localStorage.getItem(AmbientPlayer.STORAGE_KEY));
      if (s && typeof s === "object") {
        if (typeof s.volume === "number") this.volume = s.volume;
        if (Array.isArray(s.activeIds)) {
          this.savedIds = s.activeIds;
        } else if (s.soundId) {
          this.savedIds = [s.soundId]; // migrate single-sound saves
        }
        this.wasPlaying = !!s.wasPlaying; // legacy removedIds/renames ignored
      }
    } catch (_) {
      /* corrupted storage — keep defaults */
    }
  }

  restore() {
    this.volumeSlider.value = String(Math.round(this.volume * 100));
    for (const id of this.savedIds) {
      const sound = this.soundById(id);
      if (!sound) continue;
      const el = this.acquireElement();
      el.setAttribute("src", sound.src);
      this.active.set(id, el);
      if (this.wasPlaying) this.playElement(el);
    }
    this.refreshUI();
  }
}

/**
 * MusicPlayer Class — playlist, shuffle, repeat, seeking,
 * fade transitions, and localStorage persistence.
 * Fully independent of the Pomodoro timer, so music keeps
 * playing across session switches.
 */
class MusicPlayer {
  static STORAGE_KEY = "deepFocusMusic";
  static FADE_MS = 350;

  constructor(playlist, ambientSounds) {
    // Dual-audio: this class drives MUSIC on its own element; the
    // AmbientPlayer below drives ambient on a second element. Both can
    // play simultaneously and never interrupt each other. Tabs and the
    // playlist UI live here; ambient rows just delegate to the engine.
    this.ambient = new AmbientPlayer(ambientSounds, {
      onChange: () => this.updateActiveItem(),
    });
    // Music is user content: the coded PLAYLIST plus session imports
    this.baseTracks = Array.isArray(playlist) ? playlist : [];
    this.importedTracks = []; // session-only (object URLs)
    this.libraries = {
      music: [...this.baseTracks],
      ambient: this.ambient.sounds, // for row rendering only
    };
    this.activeTab = "music";
    this.playlist = this.libraries.music; // playback is music-only here
    this.trackIndex = 0;
    this.volume = 0.7; // user volume, 0–1
    this.isMuted = false;
    this.isShuffle = false;
    this.repeatMode = "off"; // "off" | "all" | "one"
    this.history = []; // for prev-track while shuffling
    this.fadeTimer = null;
    this.lastSavedAt = 0;

    // DOM Elements
    this.audio = document.getElementById("audioPlayer");
    this.playerEl = document.getElementById("musicPlayer");
    this.mainEl = document.getElementById("playerMain");
    this.emptyEl = document.getElementById("playerEmpty");
    this.playlistEl = document.getElementById("playerPlaylist");
    this.countEl = document.getElementById("playlistCount");
    this.tabButtons = Array.from(document.querySelectorAll(".player-tab"));
    // Settings > Music Library management UI
    this.musicImportInput = document.getElementById("musicImportInput");
    this.musicManageEl = document.getElementById("musicManageList");
    this.titleEl = document.getElementById("songTitle");
    this.artistEl = document.getElementById("songArtist");
    this.currentTimeEl = document.getElementById("currentTimeLabel");
    this.totalTimeEl = document.getElementById("totalTimeLabel");
    this.playBtn = document.getElementById("playBtn");
    this.prevBtn = document.getElementById("prevBtn");
    this.nextBtn = document.getElementById("nextBtn");
    this.shuffleBtn = document.getElementById("shuffleBtn");
    this.repeatBtn = document.getElementById("repeatBtn");
    this.volumeBtn = document.getElementById("volumeBtn");
    this.progressTrack = document.getElementById("progressTrack");
    this.progressFill = document.getElementById("progressFill");
    this.volumeSlider = document.getElementById("volumeSlider");

    this.isSeeking = false;

    if (!this.audio || !this.playerEl) return;

    // Empty state only when there is nothing to play in ANY category
    if (this.libraries.music.length + this.libraries.ambient.length === 0) {
      this.mainEl.hidden = true;
      if (this.playlistEl) this.playlistEl.hidden = true;
      this.emptyEl.hidden = false;
      return;
    }

    this.loadState();
    this.renderPlaylist(); // built once — items are reused, never recreated
    this.renderMusicManageList();
    this.initMusicLibraryListeners();
    this.initEventListeners();
    if (this.playlist.length > 0) {
      this.loadTrack(this.trackIndex, { resumePosition: true });
    } else {
      // Ambient-only setup: hide the music-specific sections
      this.playerEl.classList.add("music-empty");
      this.activeTab = "ambient";
    }
    this.applyVolumeUI();
    this.applyModeUI();
  }

  initEventListeners() {
    // Transport
    this.playBtn.addEventListener("click", () => this.togglePlay());
    this.prevBtn.addEventListener("click", () => this.prevTrack());
    this.nextBtn.addEventListener("click", () => this.nextTrack());
    this.shuffleBtn.addEventListener("click", () => this.toggleShuffle());
    this.repeatBtn.addEventListener("click", () => this.cycleRepeat());
    this.volumeBtn.addEventListener("click", () => this.toggleMute());

    // Seeking — one pointer-event pipeline covers click-to-jump and
    // drag-to-scrub on both mouse and touch. Pointer capture keeps the
    // drag alive even when the finger/cursor leaves the track.
    const pctFromEvent = (e) => {
      const rect = this.progressTrack.getBoundingClientRect();
      return Math.min(
        100,
        Math.max(0, ((e.clientX - rect.left) / rect.width) * 100),
      );
    };

    this.progressTrack.addEventListener("pointerdown", (e) => {
      if (!this.audio.duration) return;
      e.preventDefault();
      this.isSeeking = true;
      this.progressTrack.classList.add("seeking");
      this.progressTrack.setPointerCapture(e.pointerId);
      this.seekTo(pctFromEvent(e));
    });

    this.progressTrack.addEventListener("pointermove", (e) => {
      if (!this.isSeeking) return;
      this.seekTo(pctFromEvent(e));
    });

    const endSeek = () => {
      if (!this.isSeeking) return;
      this.isSeeking = false;
      this.progressTrack.classList.remove("seeking");
    };
    this.progressTrack.addEventListener("pointerup", endSeek);
    this.progressTrack.addEventListener("pointercancel", endSeek);

    // Keyboard seeking on the focused bar (role="slider")
    this.progressTrack.addEventListener("keydown", (e) => {
      if (!this.audio.duration) return;
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const delta = e.key === "ArrowRight" ? 5 : -5;
      this.audio.currentTime = Math.min(
        this.audio.duration,
        Math.max(0, this.audio.currentTime + delta),
      );
      this.onTimeUpdate();
    });

    // Volume
    this.volumeSlider.addEventListener("input", (e) => {
      this.volume = e.target.value / 100;
      this.isMuted = this.volume === 0;
      this.audio.volume = this.volume;
      this.audio.muted = false;
      this.applyVolumeUI();
      this.saveState();
    });

    // Audio events
    this.audio.addEventListener("timeupdate", () => this.onTimeUpdate());
    this.audio.addEventListener("loadedmetadata", () => {
      this.totalTimeEl.textContent = this.formatTime(this.audio.duration);
    });
    this.audio.addEventListener("ended", () => this.onTrackEnded());
    this.audio.addEventListener("play", () => this.updatePlayIcon(true));
    this.audio.addEventListener("pause", () => this.updatePlayIcon(false));
    this.audio.addEventListener("error", () => {
      this.artistEl.textContent = "Track unavailable — check the file path";
    });

    // Persist position when leaving the page
    window.addEventListener("beforeunload", () => this.saveState(true));
  }

  /* ---------- Track loading & transitions ---------- */

  loadTrack(index, { resumePosition = false, autoplay = false } = {}) {
    this.trackIndex =
      ((index % this.playlist.length) + this.playlist.length) %
      this.playlist.length;
    const track = this.playlist[this.trackIndex];

    this.audio.src = track.src;
    this.titleEl.textContent = track.title;
    this.artistEl.textContent = track.artist || "";
    this.setProgress(0, { instant: true });
    this.currentTimeEl.textContent = "0:00";
    this.totalTimeEl.textContent = "0:00";

    if (resumePosition && this.savedPosition > 0) {
      const pos = this.savedPosition;
      this.audio.addEventListener(
        "loadedmetadata",
        () => {
          if (pos < this.audio.duration) this.audio.currentTime = pos;
        },
        { once: true },
      );
      this.savedPosition = 0;
    }

    if (autoplay) {
      this.play();
    }
    this.updateActiveItem();
    this.saveState(true);
  }

  /** Smooth fade-out → switch → fade-in */
  switchTrack(index) {
    this.playerEl.classList.add("switching");
    const wasPlaying = !this.audio.paused;

    const doSwitch = () => {
      this.loadTrack(index, { autoplay: wasPlaying });
      setTimeout(
        () => this.playerEl.classList.remove("switching"),
        MusicPlayer.FADE_MS,
      );
    };

    if (wasPlaying) {
      this.fadeTo(0, MusicPlayer.FADE_MS, doSwitch);
    } else {
      doSwitch();
    }
  }

  /* ---------- Playback ---------- */

  play() {
    this.audio.volume = 0;
    this.audio
      .play()
      .then(() => this.fadeTo(this.volume, MusicPlayer.FADE_MS))
      .catch((err) => console.log("Audio play failed:", err));
  }

  togglePlay() {
    if (this.audio.paused) {
      this.play();
    } else {
      this.fadeTo(0, MusicPlayer.FADE_MS, () => {
        this.audio.pause();
        this.audio.volume = this.volume;
        this.saveState(true);
      });
    }
  }

  nextTrack() {
    if (this.isShuffle) {
      this.history.push(this.trackIndex);
      this.switchTrack(this.pickShuffleIndex());
    } else {
      this.switchTrack(this.trackIndex + 1);
    }
  }

  prevTrack() {
    // Restart current track if more than 3s in (standard player behavior)
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    if (this.isShuffle && this.history.length > 0) {
      this.switchTrack(this.history.pop());
    } else {
      this.switchTrack(this.trackIndex - 1);
    }
  }

  onTrackEnded() {
    if (this.repeatMode === "one") {
      this.audio.currentTime = 0;
      this.play();
      return;
    }

    const isLast = this.trackIndex === this.playlist.length - 1;
    if (this.repeatMode === "off" && isLast && !this.isShuffle) {
      this.updatePlayIcon(false);
      this.saveState(true);
      return;
    }

    // Auto-play the next song
    if (this.isShuffle) {
      this.history.push(this.trackIndex);
      this.loadTrack(this.pickShuffleIndex(), { autoplay: true });
    } else {
      this.loadTrack(this.trackIndex + 1, { autoplay: true });
    }
  }

  pickShuffleIndex() {
    if (this.playlist.length < 2) return this.trackIndex;
    let next;
    do {
      next = Math.floor(Math.random() * this.playlist.length);
    } while (next === this.trackIndex);
    return next;
  }

  /** Linear volume fade toward `target` over `ms`, then call `done` */
  fadeTo(target, ms, done) {
    clearInterval(this.fadeTimer);
    const steps = 12;
    const from = this.audio.volume;
    const delta = (target - from) / steps;
    let i = 0;

    this.fadeTimer = setInterval(() => {
      i++;
      this.audio.volume = Math.min(1, Math.max(0, from + delta * i));
      if (i >= steps) {
        clearInterval(this.fadeTimer);
        this.audio.volume = target;
        if (done) done();
      }
    }, ms / steps);
  }

  /* ---------- Modes ---------- */

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    this.history = [];
    this.applyModeUI();
    this.saveState();
  }

  cycleRepeat() {
    const order = ["off", "all", "one"];
    this.repeatMode = order[(order.indexOf(this.repeatMode) + 1) % 3];
    this.applyModeUI();
    this.saveState();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.audio.muted = this.isMuted;
    this.applyVolumeUI();
    this.saveState();
  }

  /* ---------- UI updates ---------- */

  onTimeUpdate() {
    if (!this.audio.duration) return;
    // While the user is scrubbing, the drag owns the bar
    if (!this.isSeeking) {
      this.setProgress((this.audio.currentTime / this.audio.duration) * 100);
    }
    this.currentTimeEl.textContent = this.formatTime(this.audio.currentTime);

    // Throttled position save (every ~3s while playing)
    const now = Date.now();
    if (now - this.lastSavedAt > 3000) {
      this.lastSavedAt = now;
      this.saveState(true);
    }
  }

  /** Jump playback to a percentage of the track and reflect it instantly */
  seekTo(pct) {
    if (!this.audio.duration) return;
    this.audio.currentTime = (pct / 100) * this.audio.duration;
    this.setProgress(pct);
    this.currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
  }

  /** Single write-point for the progress bar UI */
  setProgress(pct, { instant = false } = {}) {
    if (instant) {
      // Snap without the glide (e.g. resetting on track change)
      this.progressFill.style.transition = "none";
      this.progressFill.style.width = pct + "%";
      void this.progressFill.offsetWidth; // flush so the snap applies
      this.progressFill.style.transition = "";
    } else {
      this.progressFill.style.width = pct + "%";
    }
    this.progressTrack.setAttribute("aria-valuenow", String(Math.round(pct)));
  }

  /**
   * Build the playlist UI exactly once. Rows are cached in
   * this.playlistItems and updated in place afterwards — a single
   * delegated click listener handles every row, so large playlists
   * stay cheap to render and scroll.
   */
  /* ---------- Music Library (Settings page) ---------- */

  initMusicLibraryListeners() {
    if (this.musicImportInput) {
      this.musicImportInput.addEventListener("change", () => {
        this.importMusic(this.musicImportInput.files);
        this.musicImportInput.value = "";
      });
    }
    if (this.musicManageEl) {
      this.musicManageEl.addEventListener("click", (e) => {
        const btn = e.target.closest(".ambient-manage-remove");
        if (!btn) return;
        this.deleteImported(btn.closest(".ambient-manage-row").dataset.id);
      });
      this.musicManageEl.addEventListener("change", (e) => {
        const input = e.target.closest(".ambient-manage-name");
        if (!input) return;
        this.renameImported(
          input.closest(".ambient-manage-row").dataset.id,
          input.value.trim(),
        );
      });
    }
  }

  /** Import MP3s into the Music playlist (session object URLs) */
  importMusic(fileList) {
    const files = Array.from(fileList || []).filter((f) =>
      f.type.startsWith("audio"),
    );
    if (files.length === 0) return;
    files.forEach((file, i) => {
      this.importedTracks.push({
        id: "music-import-" + Date.now() + "-" + i,
        title: file.name.replace(/\.[^.]+$/, ""),
        artist: "Imported",
        src: URL.createObjectURL(file),
      });
    });
    this.rebuildMusicLibrary();
  }

  deleteImported(id) {
    const idx = this.importedTracks.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const wasCurrent =
      this.playlist[this.trackIndex] === this.importedTracks[idx];
    URL.revokeObjectURL(this.importedTracks[idx].src);
    this.importedTracks.splice(idx, 1);
    this.rebuildMusicLibrary({ currentRemoved: wasCurrent });
  }

  renameImported(id, name) {
    if (!name) return;
    const track = this.importedTracks.find((t) => t.id === id);
    if (!track) return;
    track.title = name;
    this.rebuildMusicLibrary();
  }

  /** Recompose the playlist and refresh every dependent UI piece,
   *  keeping the currently playing track (and playback) intact */
  rebuildMusicLibrary({ currentRemoved = false } = {}) {
    const current = currentRemoved ? null : this.playlist[this.trackIndex];

    this.libraries.music = [...this.baseTracks, ...this.importedTracks];
    this.playlist = this.libraries.music;

    this.history = []; // shuffle history indexes are stale now

    // Re-locate the playing track in the recomposed list
    const found = current ? this.playlist.indexOf(current) : -1;
    if (found >= 0) {
      this.trackIndex = found; // same song object — playback untouched
    } else {
      this.trackIndex = 0;
      if (currentRemoved && this.playlist.length > 0) {
        this.loadTrack(0); // deleted the playing song: load the first
      }
    }

    // First import into an empty Music library revives the player
    if (
      this.playlist.length > 0 &&
      this.playerEl.classList.contains("music-empty")
    ) {
      this.playerEl.classList.remove("music-empty");
      this.loadTrack(0);
    } else if (this.playlist.length === 0) {
      this.playerEl.classList.add("music-empty");
      this.audio.pause();
    }

    // Rebuild the playlist rows (library actually changed) + settings
    this.itemsByCategory.music = this.buildCategoryItems("music");
    if (this.activeTab === "music") {
      this.playlistEl.replaceChildren(...this.itemsByCategory.music);
    }
    this.showTab(this.activeTab, { skipSave: true });
    this.renderMusicManageList();

    // Update Now Playing text in case the current track was renamed
    const track = this.playlist[this.trackIndex];
    if (track) {
      this.titleEl.textContent = track.title;
      this.artistEl.textContent = track.artist || "";
    }
    this.saveState();
  }

  /** Settings list: imported songs only — rename inline, delete */
  renderMusicManageList() {
    if (!this.musicManageEl) return;
    if (this.importedTracks.length === 0) {
      const note = document.createElement("div");
      note.className = "ambient-manage-empty";
      note.textContent = "No imported songs yet.";
      this.musicManageEl.replaceChildren(note);
      return;
    }
    const fragment = document.createDocumentFragment();
    this.importedTracks.forEach((t) => {
      const row = document.createElement("div");
      row.className = "ambient-manage-row";
      row.dataset.id = t.id;

      const icon = document.createElement("span");
      icon.className = "ambient-manage-icon";
      icon.textContent = "\u{1F3B5}";

      const name = document.createElement("input");
      name.type = "text";
      name.className = "form-control ambient-manage-name";
      name.value = t.title;
      name.setAttribute("aria-label", "Song name");

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "ambient-manage-remove";
      removeBtn.title = "Delete song";
      removeBtn.innerHTML = '<i class="fas fa-trash"></i>';

      row.append(icon, name, removeBtn);
      fragment.appendChild(row);
    });
    this.musicManageEl.replaceChildren(fragment);
  }

  renderPlaylist() {
    if (!this.playlistEl) return;

    // Music rows are built exactly once; the Ambient tab shows the
    // compact mixer panel instead of a list, so nothing to build there.
    this.itemsByCategory = {
      music: this.buildCategoryItems("music"),
    };

    this.playlistEl.addEventListener("click", (e) => {
      const row = e.target.closest(".playlist-item");
      if (!row) return;
      this.selectTrack("music", parseInt(row.dataset.index, 10));
    });

    // Tab switching: browsing only — the current sound keeps playing
    this.tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => this.showTab(btn.dataset.category));
    });

    this.showTab(this.activeTab, { skipSave: true });
  }

  buildCategoryItems(category) {
    const isAmbient = category === "ambient";
    return this.libraries[category].map((track, i) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "playlist-item";
      item.setAttribute("role", "listitem");
      item.dataset.index = String(i);
      item.dataset.category = category;

      const icon = document.createElement("span");
      icon.className = "playlist-item-icon";
      icon.innerHTML =
        (isAmbient
          ? '<span class="icon-note playlist-emoji">' + track.icon + "</span>"
          : '<i class="fas fa-music icon-note"></i>') +
        '<span class="mini-eq"><i></i><i></i><i></i></span>';

      const text = document.createElement("span");
      text.className = "playlist-item-text";

      const title = document.createElement("span");
      title.className = "playlist-item-title";
      title.textContent = track.title;
      text.appendChild(title);

      if (!isAmbient && track.artist) {
        const artist = document.createElement("span");
        artist.className = "playlist-item-artist";
        artist.textContent = track.artist;
        text.appendChild(artist);
      }

      item.appendChild(icon);
      item.appendChild(text);
      return item;
    });
  }

  /** Swap the visible category. Pure UI — playback is untouched. */
  showTab(category, { skipSave = false } = {}) {
    if (!this.libraries[category]) category = "music";
    this.activeTab = category;

    this.tabButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.category === category);
    });

    const ambient = category === "ambient";
    this.playlistEl.hidden = ambient;
    if (this.ambient.panelEl) this.ambient.panelEl.hidden = !ambient;

    if (!ambient) {
      const items = this.itemsByCategory.music;
      this.playlistEl.replaceChildren(...items);
      if (items.length === 0) {
        const note = document.createElement("div");
        note.className = "playlist-empty-note";
        note.textContent = "Add tracks to the PLAYLIST array in script.js";
        this.playlistEl.replaceChildren(note);
      }
    }

    if (this.countEl) {
      if (ambient) {
        const on = this.ambient.active.size;
        this.countEl.textContent =
          on > 0
            ? on + (on === 1 ? " Sound Active" : " Sounds Active")
            : this.ambient.sounds.length + " Sounds";
      } else {
        const n = this.libraries.music.length;
        this.countEl.textContent = n + (n === 1 ? " Song" : " Songs");
      }
    }

    this.updateActiveItem();
    if (!skipSave) this.saveState();
  }

  /** A music row was tapped (ambient lives in its own panel/modal). */
  selectTrack(category, index) {
    if (!this.libraries.music[index]) return;
    if (index === this.trackIndex) {
      this.togglePlay();
      return;
    }
    this.switchTrack(index);
  }

  /** Highlight the current music track; keep the header count live */
  updateActiveItem() {
    if (!this.itemsByCategory) return;
    this.itemsByCategory.music.forEach((item, i) => {
      item.classList.toggle("active", i === this.trackIndex);
    });
    if (this.activeTab === "music") {
      const active = this.itemsByCategory.music[this.trackIndex];
      if (active) active.scrollIntoView({ block: "nearest" });
    } else if (this.countEl) {
      const on = this.ambient.active.size;
      this.countEl.textContent =
        on > 0
          ? on + (on === 1 ? " Sound Active" : " Sounds Active")
          : this.ambient.sounds.length + " Sounds";
    }
  }

  updatePlayIcon(isPlaying) {
    // Drives the header equalizer and active-row bars via CSS
    this.playerEl.classList.toggle("playing", isPlaying);
    this.playBtn.innerHTML = isPlaying
      ? '<i class="fas fa-pause"></i>'
      : '<i class="fas fa-play"></i>';
    this.playBtn.title = isPlaying ? "Pause" : "Play";
  }

  applyVolumeUI() {
    const effective = this.isMuted ? 0 : this.volume;
    this.volumeSlider.value = Math.round(this.volume * 100);
    this.updateSliderFill(this.volumeSlider);

    let icon = "fa-volume-up";
    if (this.isMuted || effective === 0) icon = "fa-volume-mute";
    else if (effective < 0.5) icon = "fa-volume-down";
    this.volumeBtn.innerHTML = `<i class="fas ${icon}"></i>`;
    this.volumeBtn.title = this.isMuted ? "Unmute" : "Mute";
  }

  applyModeUI() {
    this.shuffleBtn.classList.toggle("active", this.isShuffle);
    this.repeatBtn.classList.toggle("active", this.repeatMode !== "off");
    this.repeatBtn.classList.toggle("repeat-one", this.repeatMode === "one");
    this.repeatBtn.title = `Repeat: ${this.repeatMode}`;
  }

  updateSliderFill(slider) {
    const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.setProperty("--fill", pct + "%");
  }

  formatTime(seconds) {
    if (!isFinite(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  /* ---------- Persistence ---------- */

  saveState(includePosition = false) {
    const state = {
      trackIndex: this.trackIndex,
      activeTab: this.activeTab,
      volume: this.volume,
      isMuted: this.isMuted,
      isShuffle: this.isShuffle,
      repeatMode: this.repeatMode,
    };
    if (includePosition) {
      state.position = this.audio.currentTime || 0;
    } else {
      const prev = this.readState();
      state.position = prev.position || 0;
    }
    try {
      localStorage.setItem(MusicPlayer.STORAGE_KEY, JSON.stringify(state));
    } catch (_) {
      /* storage unavailable — ignore */
    }
  }

  readState() {
    try {
      return JSON.parse(localStorage.getItem(MusicPlayer.STORAGE_KEY)) || {};
    } catch (_) {
      return {};
    }
  }

  loadState() {
    const s = this.readState();

    if (s.activeTab && this.libraries[s.activeTab]) {
      this.activeTab = s.activeTab;
    }
    if (
      typeof s.trackIndex === "number" &&
      s.trackIndex >= 0 &&
      s.trackIndex < this.playlist.length
    ) {
      this.trackIndex = s.trackIndex;
    }
    if (typeof s.volume === "number") this.volume = s.volume;
    this.isMuted = !!s.isMuted;
    this.isShuffle = !!s.isShuffle;
    if (["off", "all", "one"].includes(s.repeatMode)) {
      this.repeatMode = s.repeatMode;
    }
    this.savedPosition = typeof s.position === "number" ? s.position : 0;

    this.audio.volume = this.volume;
    this.audio.muted = this.isMuted;
  }
}

/**
 * TaskManager Class - Handles task management and tracking
 */
class TaskManager {
  constructor() {
    this.tasks = [];
    this.taskNextId = 1;
    this.focusedTaskId = null;

    // DOM Elements
    this.taskInput = document.getElementById("taskInput");
    this.taskAddBtn = document.getElementById("taskAddBtn");
    this.taskList = document.getElementById("taskList");
    this.taskClearBtn = document.getElementById("taskClearBtn");
    this.taskRemoveAllBtn = document.getElementById("taskRemoveAllBtn");
    this.taskProgressFill = document.getElementById("taskProgressFill");
    this.taskProgressText = document.getElementById("taskProgressText");

    this.initEventListeners();
    this.loadTasks();
    this.renderTasks();
  }

  initEventListeners() {
    this.taskAddBtn.addEventListener("click", () => this.addTask());
    this.taskInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) {
        this.addTask();
      }
    });
    this.taskClearBtn.addEventListener("click", () => this.clearCompleted());
    this.taskRemoveAllBtn.addEventListener("click", () => this.removeAll());
  }

  addTask() {
    const title = this.taskInput.value.trim();
    if (!title) return;

    const task = {
      id: this.taskNextId++,
      title,
      completed: false,
      pomodoroGoal: 1,
      pomodoroCurrent: 0,
      createdAt: Date.now(),
    };

    this.tasks.push(task);
    this.taskInput.value = "";
    this.saveTasks();
    this.renderTasks();
  }

  completeTask(id) {
    const task = this.tasks.find((t) => t.id === id);
    if (task) {
      task.completed = !task.completed;
      this.saveTasks();
      this.renderTasks();

      // Check if all tasks are completed
      if (this.tasks.length > 0 && this.tasks.every((t) => t.completed)) {
        this.triggerConfetti();
      }
    }
  }

  deleteTask(id) {
    this.tasks = this.tasks.filter((t) => t.id !== id);
    this.saveTasks();
    this.renderTasks();
  }

  setFocusedTask(id) {
    this.focusedTaskId = this.focusedTaskId === id ? null : id;
    this.saveTasks();
    this.renderTasks();
  }

  incrementPomodoro(id) {
    const task = this.tasks.find((t) => t.id === id);
    if (task) {
      task.pomodoroCurrent++;
      if (task.pomodoroCurrent >= task.pomodoroGoal) {
        task.completed = true;
      }
      this.saveTasks();
      this.renderTasks();
    }
  }

  updateProgress() {
    const completed = this.tasks.filter((t) => t.completed).length;
    const total = this.tasks.length;
    const percentage = total === 0 ? 0 : (completed / total) * 100;

    this.taskProgressFill.style.width = percentage + "%";
    this.taskProgressText.textContent = `${completed} / ${total}`;
  }

  renderTasks() {
    this.taskList.innerHTML = "";

    this.tasks.forEach((task) => {
      const taskEl = document.createElement("div");
      taskEl.className = `task-card ${task.completed ? "completed" : ""} ${this.focusedTaskId === task.id ? "focused" : ""}`;
      taskEl.draggable = true;
      taskEl.dataset.taskId = task.id;

      taskEl.innerHTML = `
                <input type="checkbox" class="task-checkbox" ${task.completed ? "checked" : ""}>
                <div class="task-content">
                    <p class="task-title">${this.escapeHtml(task.title)}</p>
                    
                </div>
                <button class="task-delete-btn">
                    <i class="fas fa-times"></i>
                </button>
            `;

      taskEl
        .querySelector(".task-checkbox")
        .addEventListener("change", () => this.completeTask(task.id));
      taskEl
        .querySelector(".task-delete-btn")
        .addEventListener("click", () => this.deleteTask(task.id));
      taskEl.addEventListener("dragstart", (e) =>
        this.handleDragStart(e, task.id),
      );
      taskEl.addEventListener("dragend", () => this.handleDragEnd());
      taskEl.addEventListener("dragover", (e) => this.handleDragOver(e));
      taskEl.addEventListener("drop", (e) => this.handleDrop(e, task.id));

      this.taskList.appendChild(taskEl);
    });

    this.updateProgress();
  }

  handleDragStart(e, taskId) {
    e.dataTransfer.effectAllowed = "move";
    e.target.classList.add("dragging");
    e.dataTransfer.setData("taskId", taskId);
  }

  handleDragEnd() {
    document.querySelectorAll(".task-card").forEach((el) => {
      el.classList.remove("dragging", "drag-over");
    });
  }

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    e.currentTarget.classList.add("drag-over");
  }

  handleDrop(e, targetId) {
    e.preventDefault();
    const sourceId = parseInt(e.dataTransfer.getData("taskId"));

    if (sourceId !== targetId) {
      const sourceIndex = this.tasks.findIndex((t) => t.id === sourceId);
      const targetIndex = this.tasks.findIndex((t) => t.id === targetId);

      if (sourceIndex !== -1 && targetIndex !== -1) {
        [this.tasks[sourceIndex], this.tasks[targetIndex]] = [
          this.tasks[targetIndex],
          this.tasks[sourceIndex],
        ];
        this.saveTasks();
        this.renderTasks();
      }
    }
    e.currentTarget.classList.remove("drag-over");
  }

  clearCompleted() {
    this.tasks = this.tasks.filter((t) => !t.completed);
    this.saveTasks();
    this.renderTasks();
  }

  removeAll() {
    if (confirm("Are you sure you want to remove all tasks?")) {
      this.tasks = [];
      this.saveTasks();
      this.renderTasks();
    }
  }

  saveTasks() {
    localStorage.setItem("pomodoroTasks", JSON.stringify(this.tasks));
  }

  loadTasks() {
    const stored = localStorage.getItem("pomodoroTasks");
    if (stored) {
      this.tasks = JSON.parse(stored);
      this.taskNextId = Math.max(...this.tasks.map((t) => t.id), 0) + 1;
    }
  }

  triggerConfetti() {
    // Burst from the completed Task Card, rendered above the whole UI
    Celebration.burst(document.getElementById("taskPanel"));
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

/**
 * NotificationManager Class - Handles session completion notifications
 */
class NotificationManager {
  constructor(timerInstance) {
    this.timer = timerInstance;
    this.enableSound = true;
    this.soundVolume = 70;
    this.enableVibration = false;
    this.audioContext = null;
    this.isHandlingCompletion = false;
    this.fallbackNodes = [];
    this.bellStopTimeout = null; // auto-stops the bell after 3 seconds

    this.dismissBtn = document.getElementById("dismissBtn");

    // DOM Elements
    this.soundToggle = document.getElementById("soundToggle");
    this.soundVolumeSlider = document.getElementById("soundVolumeSlider");
    this.vibrationToggle = document.getElementById("vibrationToggle");
    this.sessionCompleteModal = new bootstrap.Modal(
      document.getElementById("sessionCompleteModal"),
      {
        backdrop: "static",
      },
    );
    this.nextSessionBtn = document.getElementById("nextSessionBtn");

    // "What would you like to do next?" modal (shown after Next Session)
    this.chooseSessionModal = new bootstrap.Modal(
      document.getElementById("chooseSessionModal"),
      {
        backdrop: "static",
      },
    );
    this.shortBreakChoiceBtn = document.getElementById("shortBreakChoiceBtn");
    this.longBreakChoiceBtn = document.getElementById("longBreakChoiceBtn");

    this.loadSettings();
    this.initEventListeners();
  }

  initEventListeners() {
    // Preload the bell on the first user interaction so it's already
    // buffered (and permitted by browser autoplay policy) when time is up
    document.addEventListener(
      "pointerdown",
      () => {
        if (!this.bellAudio) {
          this.bellAudio = new Audio("assets/sounds/School-Bell-Ring.mp3");
          this.bellAudio.preload = "auto";
          this.bellSrcIndex = 0;
          this.bellAudio.load();
        }
      },
      { once: true },
    );

    if (this.soundToggle) {
      this.soundToggle.addEventListener("change", (e) => {
        this.enableSound = e.target.checked;
        this.saveSettings();
      });
    }
    if (this.soundVolumeSlider) {
      this.soundVolumeSlider.addEventListener("input", (e) => {
        this.soundVolume = parseInt(e.target.value);
        this.saveSettings();
      });
    }
    if (this.vibrationToggle) {
      this.vibrationToggle.addEventListener("change", (e) => {
        this.enableVibration = e.target.checked;
        this.saveSettings();
      });
    }

    this.nextSessionBtn.addEventListener("click", () =>
      this.handleNextSession(),
    );

    // Dismiss: stop the sound the instant it's clicked (don't wait for
    // the modal hide animation). Bootstrap's data-bs-dismiss closes the
    // modal; nothing else happens — no session switch, no new timer.
    if (this.dismissBtn) {
      this.dismissBtn.addEventListener("click", () => {
        this.stopZenBell();
      });
    }

    // Whenever the modal closes (any way), make sure the sound is off
    // and completion handling is unlocked for the next session.
    document
      .getElementById("sessionCompleteModal")
      .addEventListener("hidden.bs.modal", () => {
        this.stopZenBell();
        this.isHandlingCompletion = false;
      });

    // "What would you like to do next?" choices
    if (this.shortBreakChoiceBtn) {
      this.shortBreakChoiceBtn.addEventListener("click", () =>
        this.startChosenBreak("short-break"),
      );
    }
    if (this.longBreakChoiceBtn) {
      this.longBreakChoiceBtn.addEventListener("click", () =>
        this.startChosenBreak("long-break"),
      );
    }
    document
      .getElementById("chooseSessionModal")
      .addEventListener("hidden.bs.modal", () => {
        this.stopZenBell();
      });

    // If the user manually starts, resets, or switches sessions while
    // the bell is still ringing, silence it immediately.
    const startBtn = document.getElementById("startBtn");
    const resetBtn = document.getElementById("resetBtn");
    if (startBtn) startBtn.addEventListener("click", () => this.stopZenBell());
    if (resetBtn) resetBtn.addEventListener("click", () => this.stopZenBell());
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.stopZenBell());
    });
    document.addEventListener("keydown", (e) => {
      if (isTypingContext(e.target)) return;
      if (e.code === "Space" || e.code === "KeyR") this.stopZenBell();
    });
  }

  playZenBell() {
    if (!this.enableSound) return;

    // Single-instance rule: silence anything already ringing (and clear
    // any pending auto-stop) before starting, so sounds never overlap.
    this.stopZenBell();

    // Ring for exactly 3 seconds, then stop automatically
    const scheduleAutoStop = () => {
      clearTimeout(this.bellStopTimeout);
      this.bellStopTimeout = setTimeout(() => this.stopZenBell(), 3000);
    };

    // Try known locations for the bell file, in order. Once a working
    // source is found, the same Audio instance is reused on every ring.
    const sources = [
      "School-Bell-Ring.mp3",
      "assets/sounds/School-Bell-Ring.mp3",
      "assets/School-Bell-Ring.mp3",
    ];

    const tryPlay = (i) => {
      if (i >= sources.length) {
        // No file could be loaded — fall back to a synthesized bell
        this.playFallbackBeep();
        scheduleAutoStop();
        return;
      }

      if (!this.bellAudio || this.bellSrcIndex !== i) {
        this.bellAudio = new Audio(sources[i]);
        this.bellAudio.preload = "auto";
        this.bellSrcIndex = i;
      }

      this.bellAudio.volume = this.soundVolume / 100;
      this.bellAudio.currentTime = 0;
      this.bellAudio
        .play()
        .then(scheduleAutoStop)
        .catch(() => {
          // File missing or blocked at this path — try the next one
          this.bellAudio = null;
          tryPlay(i + 1);
        });
    };

    try {
      tryPlay(this.bellSrcIndex || 0);
    } catch (err) {
      this.playFallbackBeep();
      scheduleAutoStop();
    }
  }

  /** Web Audio bell-like chime used only if the mp3 can't be found */
  playFallbackBeep() {
    try {
      if (!this.audioContext) {
        this.audioContext = new (
          window.AudioContext || window.webkitAudioContext
        )();
      }
      const ctx = this.audioContext;
      const vol = (this.soundVolume / 100) * 0.4;

      [880, 1108].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        const t = ctx.currentTime + idx * 0.35;
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
        osc.start(t);
        osc.stop(t + 1.2);
        this.fallbackNodes.push(osc);
        osc.onended = () => {
          this.fallbackNodes = this.fallbackNodes.filter((n) => n !== osc);
        };
      });
    } catch (_) {
      /* audio unavailable */
    }
  }

  showCompletionModal(sessionType) {
    const titles = {
      pomodoro: "Great Work! 🎉",
      "short-break": "Break Complete! ☕",
      "long-break": "Long Break Done! 🌟",
    };
    const messages = {
      pomodoro: "You&apos;ve completed a focus session. Ready for a break?",
      "short-break": "Ready to dive back in?",
      "long-break": "Feeling refreshed? Time for another focus session?",
    };

    document.getElementById("sessionCompleteTitle").textContent =
      titles[sessionType];
    document.getElementById("sessionCompleteMessage").textContent =
      messages[sessionType];

    this.sessionCompleteModal.show();
  }

  sendBrowserNotification(sessionType) {
    if (!this.timer.enableNotifications) return;
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
      const notificationText = {
        pomodoro: "Time to take a break!",
        "short-break": "Ready for another session?",
        "long-break": "Great work! Time for another focus session?",
      };
      new Notification("Deep Focus", {
        body: notificationText[sessionType],
        icon: "assets/images/logo.png",
      });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }

  handleSessionComplete(sessionType) {
    // Re-entry guard: prevents duplicate bells/modals if completion
    // is ever triggered twice for the same tick
    if (this.isHandlingCompletion) return;
    this.isHandlingCompletion = true;

    this.playZenBell();
    if (this.enableVibration && navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 200]);
    }
    this.sendBrowserNotification(sessionType);

    if (sessionType === "pomodoro") {
      // Focus session: show the modal and WAIT for the user's choice.
      // The timer does not continue on its own.
      this.showCompletionModal(sessionType);
      // Guard is released when the modal closes (hidden.bs.modal)
    } else {
      // Short/Long break: no modal, no confirmation — automatically
      // switch back to the Focus session and start it.
      this.isHandlingCompletion = false;
      this.timer.startSession("pomodoro");
    }
  }

  //Create a function to stop the bell (mp3 and fallback beep alike).
  stopZenBell() {
    clearTimeout(this.bellStopTimeout);
    this.bellStopTimeout = null;

    if (this.bellAudio) {
      this.bellAudio.pause();
      this.bellAudio.currentTime = 0;
    }
    // Also cut off the synthesized fallback chime if it's playing
    this.fallbackNodes.forEach((osc) => {
      try {
        osc.stop();
      } catch (_) {
        /* already stopped */
      }
    });
    this.fallbackNodes = [];
  }

  handleNextSession() {
    this.stopZenBell(); // Stop the bell immediately
    this.isHandlingCompletion = false;
    this.sessionCompleteModal.hide();
    // Ask the user what to do next instead of switching right away
    this.chooseSessionModal.show();
  }

  /** User picked Short Break or Long Break from the choice modal */
  startChosenBreak(breakType) {
    this.stopZenBell();
    this.chooseSessionModal.hide();
    // Switch to the chosen break, reset to its configured duration,
    // and start it automatically.
    this.timer.startSession(breakType);
  }

  saveSettings() {
    const current = JSON.parse(
      localStorage.getItem("pomodoroSettings") || "{}",
    );
    current.notificationSettings = {
      enableSound: this.enableSound,
      soundVolume: this.soundVolume,
      enableVibration: this.enableVibration,
    };
    localStorage.setItem("pomodoroSettings", JSON.stringify(current));
  }

  loadSettings() {
    const stored = localStorage.getItem("pomodoroSettings");
    if (stored) {
      const settings = JSON.parse(stored);
      if (settings.notificationSettings) {
        this.enableSound = settings.notificationSettings.enableSound !== false;
        this.soundVolume = settings.notificationSettings.soundVolume || 70;
        this.enableVibration =
          settings.notificationSettings.enableVibration || false;

        if (this.soundToggle) this.soundToggle.checked = this.enableSound;
        if (this.soundVolumeSlider)
          this.soundVolumeSlider.value = this.soundVolume;
        if (this.vibrationToggle)
          this.vibrationToggle.checked = this.enableVibration;
      }
    }
  }
}

// ===================================================
// WALLPAPER MANAGER
// ===================================================

/**
 * WallpaperManager — live-wallpaper-only background system.
 * One persistent <video> element is the application background:
 * its source is swapped (never the element), switches crossfade via
 * an opacity dip, settings persist to localStorage, playback pauses
 * with tab visibility, and load failures fall back to the default
 * built-in so the background is never blank.
 */
class WallpaperManager {
  static STORAGE_KEY = "deepFocusWallpaper";
  static FADE_MS = 600; // matches the CSS opacity transition

  constructor(wallpapers) {
    this.wallpapers = Array.isArray(wallpapers) ? wallpapers : [];

    // The single video element — its src is swapped, never the element
    this.video = document.getElementById("wallpaperVideo");
    this.layer = document.getElementById("wallpaperLayer");

    // Settings controls
    this.builtinSelect = document.getElementById("builtinWallpaperSelect");
    this.audioToggle = document.getElementById("wallpaperAudioToggle");
    this.brightnessSlider = document.getElementById(
      "wallpaperBrightnessSlider",
    );
    this.overlaySlider = document.getElementById("wallpaperOverlaySlider");
    this.blurSlider = document.getElementById("wallpaperBlurSlider");
    this.brightnessValue = document.getElementById("wallpaperBrightnessValue");
    this.overlayValue = document.getElementById("wallpaperOverlayValue");
    this.blurValue = document.getElementById("wallpaperBlurValue");

    // Wallpaper position controls (Settings)
    this.posXSlider = document.getElementById("wallpaperPosX");
    this.posYSlider = document.getElementById("wallpaperPosY");
    this.posXValue = document.getElementById("wallpaperPosXValue");
    this.posYValue = document.getElementById("wallpaperPosYValue");
    this.posModeLabel = document.getElementById("wallpaperPositionMode");
    this.posResetBtn = document.getElementById("wallpaperPosReset");

    // Desktop vs mobile framing switches with this query — reacting to
    // the change event also covers phone rotation and window resizing
    this.mobileMQ = window.matchMedia("(max-width: 767px)");
    this.appliedPosition = null;

    if (!this.video || !this.layer) return;

    this.settings = {
      builtinIndex: 0,
      brightness: 100, // %
      overlay: 20, // %
      blur: 0, // px
      audio: false, // wallpaper sound off by default
      // Per-wallpaper, per-screen-size position overrides:
      // { [wallpaperKey]: { desktop: "x% y%", mobile: "x% y%" } }
      positions: {},
    };

    this.retryOnGesture = false; // autoplay blocked, retry on tap
    this.failedSrcs = new Set(); // sources that errored (loop guard)
    this.fadeTimeout = null;

    this.loadSettings();
    this.populateBuiltins();
    this.initEventListeners();
    this.syncControls();
    this.apply();
  }

  /* ---------- Persistence ---------- */

  loadSettings() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(WallpaperManager.STORAGE_KEY),
      );
      if (saved && typeof saved === "object") {
        // "mode" from older versions is intentionally ignored —
        // the system is live-wallpaper-only now
        const {
          wallpaper,
          builtinIndex,
          brightness,
          overlay,
          blur,
          audio,
          positions,
        } = saved;
        // Preferred: resolve the stored wallpaper name to an index;
        // legacy saves with a raw index still load
        let index;
        if (wallpaper) {
          const i = this.wallpapers.findIndex((wp) => wp.name === wallpaper);
          if (i >= 0) index = i;
        }
        if (index === undefined && Number.isFinite(builtinIndex)) {
          index = builtinIndex;
        }
        this.settings = {
          ...this.settings,
          ...(index !== undefined && { builtinIndex: index }),
          ...(Number.isFinite(brightness) && { brightness }),
          ...(Number.isFinite(overlay) && { overlay }),
          ...(Number.isFinite(blur) && { blur }),
          ...(typeof audio === "boolean" && { audio }),
          ...(positions && typeof positions === "object" && { positions }),
        };
      }
    } catch (_) {
      /* corrupted storage — keep defaults */
    }
    this.settings.builtinIndex = Math.min(
      Math.max(0, this.settings.builtinIndex || 0),
      Math.max(0, this.wallpapers.length - 1),
    );
  }

  saveSettings() {
    try {
      // Only the wallpaper NAME is stored — the desktop/mobile variant
      // is always decided automatically at load time
      const wp = this.wallpapers[this.settings.builtinIndex];
      const { builtinIndex, ...rest } = this.settings;
      localStorage.setItem(
        WallpaperManager.STORAGE_KEY,
        JSON.stringify({ ...rest, wallpaper: wp ? wp.name : null }),
      );
    } catch (_) {
      /* storage unavailable — ignore */
    }
  }

  /* ---------- Setup ---------- */

  populateBuiltins() {
    this.builtinSelect.innerHTML = "";
    if (this.wallpapers.length === 0) {
      const opt = document.createElement("option");
      opt.textContent = "No built-in wallpapers configured";
      opt.disabled = true;
      opt.selected = true;
      this.builtinSelect.appendChild(opt);
      this.builtinSelect.disabled = true;
      return;
    }
    this.wallpapers.forEach((wp, i) => {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = wp.name;
      this.builtinSelect.appendChild(opt);
    });
  }

  initEventListeners() {
    this.builtinSelect.addEventListener("change", () => {
      this.settings.builtinIndex = parseInt(this.builtinSelect.value, 10) || 0;
      this.apply();
      this.saveSettings();
    });

    this.audioToggle.addEventListener("change", () => {
      this.settings.audio = this.audioToggle.checked;
      this.video.muted = !this.settings.audio;
      if (this.settings.audio) {
        // The toggle click is a user gesture, so play-with-sound is allowed
        this.video.play().catch(() => {});
      }
      this.saveSettings();
    });

    // Sliders apply live while dragging
    this.brightnessSlider.addEventListener("input", () => {
      this.settings.brightness = Number(this.brightnessSlider.value);
      this.applyVisualVars();
      this.saveSettings();
    });
    this.overlaySlider.addEventListener("input", () => {
      this.settings.overlay = Number(this.overlaySlider.value);
      this.applyVisualVars();
      this.saveSettings();
    });
    this.blurSlider.addEventListener("input", () => {
      this.settings.blur = Number(this.blurSlider.value);
      this.applyVisualVars();
      this.saveSettings();
    });

    // Position sliders: preview updates immediately, saved per
    // wallpaper and per screen-size profile
    const onPosInput = () => {
      const pos = this.posXSlider.value + "% " + this.posYSlider.value + "%";
      const key = this.wallpaperKey();
      if (!this.settings.positions[key]) this.settings.positions[key] = {};
      this.settings.positions[key][this.positionMode()] = pos;
      this.applyPosition();
      this.updatePositionLabels();
      this.saveSettings();
    };
    if (this.posXSlider && this.posYSlider) {
      this.posXSlider.addEventListener("input", onPosInput);
      this.posYSlider.addEventListener("input", onPosInput);
    }
    if (this.posResetBtn) {
      this.posResetBtn.addEventListener("click", () => {
        const key = this.wallpaperKey();
        if (this.settings.positions[key]) {
          delete this.settings.positions[key][this.positionMode()];
          if (Object.keys(this.settings.positions[key]).length === 0) {
            delete this.settings.positions[key];
          }
        }
        this.applyPosition();
        this.syncPositionControls();
        this.saveSettings();
      });
    }

    // Crossing the mobile breakpoint (resize/rotation): switch to the
    // correct video variant. The event only fires when the device
    // category actually changes, and setSource() no-ops when the
    // resolved source is identical — no unnecessary reloads.
    const onMQChange = () => {
      this.applyPosition();
      this.syncPositionControls();
      const src = this.currentSrc();
      if (src) this.setSource(src); // fades, keeps looping, auto-plays
    };
    if (this.mobileMQ.addEventListener) {
      this.mobileMQ.addEventListener("change", onMQChange);
    } else if (this.mobileMQ.addListener) {
      this.mobileMQ.addListener(onMQChange); // older Safari
    }

    // A wallpaper that can't load falls back to the default built-in —
    // the background must never end up blank
    this.video.addEventListener("error", () => this.handleVideoFailure());

    // Performance: no decoding while the tab is hidden
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.video.pause();
      } else if (this.layer.classList.contains("active")) {
        this.video.play().catch(() => {});
      }
    });
  }

  /* ---------- Source selection (automatic desktop/mobile variant) ---------- */

  /** Preference order for the current screen. Mobile screens try the
   *  portrait video first, then the landscape one; desktop screens use
   *  the landscape video (a failure there falls to another wallpaper,
   *  per the failure-handling contract). */
  variantChain(wp) {
    return this.mobileMQ.matches
      ? [wp.mobile, wp.desktop]
      : [wp.desktop, wp.mobile];
  }

  /** First variant of a wallpaper that hasn't failed this session */
  srcFor(wp) {
    if (!wp) return null;
    return (
      this.variantChain(wp).find((s) => s && !this.failedSrcs.has(s)) || null
    );
  }

  currentSrc() {
    return this.srcFor(this.wallpapers[this.settings.builtinIndex]);
  }

  /* ---------- Visual variables ---------- */

  /** Push brightness/overlay/blur into CSS custom properties */
  applyVisualVars() {
    const root = document.documentElement;
    root.style.setProperty(
      "--wallpaper-brightness",
      String(this.settings.brightness / 100),
    );
    root.style.setProperty(
      "--wallpaper-overlay",
      String(this.settings.overlay / 100),
    );
    root.style.setProperty("--wallpaper-blur", this.settings.blur + "px");
    // Only pay the backdrop-filter cost when blur is actually on
    document.body.classList.toggle("wallpaper-blur-on", this.settings.blur > 0);
    this.updateValueLabels();
  }

  /* ---------- Application ---------- */

  /** Full state application: visuals + accent + framing + source */
  apply() {
    this.applyVisualVars();
    this.applyAccent();
    this.applyPosition();
    this.syncPositionControls();

    const src = this.currentSrc();
    if (!src) return; // nothing configured — dark base stays visible
    this.setSource(src);
  }

  /**
   * Swap the video source with a smooth fade. The single element is
   * reused; if the source hasn't changed, nothing happens at all.
   */
  setSource(src) {
    if (this.video.getAttribute("src") === src) {
      // Same wallpaper — just make sure it's visible and playing
      this.layer.classList.add("active");
      this.playCurrent();
      return;
    }

    clearTimeout(this.fadeTimeout);

    const firstLoad = !this.video.getAttribute("src");
    const swap = () => {
      this.video.setAttribute("src", src);
      this.video.load();
      this.video.muted = !this.settings.audio;
      this.layer.classList.remove("switching");
      this.layer.classList.add("active");
      this.playCurrent();
      this.prefetchNext(); // browser-idle hint, not a second video
    };

    if (firstLoad) {
      swap(); // nothing on screen yet — fade straight in
    } else {
      // Fade the current wallpaper out, then swap and fade back in
      this.layer.classList.add("switching");
      this.fadeTimeout = setTimeout(swap, WallpaperManager.FADE_MS);
    }
  }

  /** Low-priority prefetch hint for the next wallpaper in the list —
   *  a <link rel=prefetch>, never a second video element */
  prefetchNext() {
    if (this.wallpapers.length < 2) return;
    const next =
      this.wallpapers[
        (this.settings.builtinIndex + 1) % this.wallpapers.length
      ];
    const src = this.srcFor(next);
    if (!src) return;
    this.prefetched = this.prefetched || new Set();
    if (this.prefetched.has(src)) return;
    this.prefetched.add(src);
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "video";
    link.href = src;
    document.head.appendChild(link);
  }

  playCurrent() {
    this.video
      .play()
      .then(() => {
        this.retryOnGesture = false;
      })
      .catch(() => {
        // Autoplay blocked (some mobile browsers) — retry on first tap
        this.armGestureRetry();
      });
  }

  /** One-shot retry when autoplay policy needs a user gesture first */
  armGestureRetry() {
    if (this.retryOnGesture) return;
    this.retryOnGesture = true;
    document.addEventListener(
      "pointerdown",
      () => {
        this.retryOnGesture = false;
        this.video.play().catch(() => this.handleVideoFailure());
      },
      { once: true },
    );
  }

  /**
   * A wallpaper failed to load/play. Fall back to the default built-in
   * (index 0). Each source only gets one attempt per session, so a
   * broken default can't cause an error loop — worst case, the dark
   * base color and overlay remain, never a blank white page.
   */
  handleVideoFailure() {
    const failed = this.video.getAttribute("src");
    if (failed) this.failedSrcs.add(failed);

    // 1) Same wallpaper, other variant (mobile -> desktop typically):
    //    srcFor() skips failed sources, so if anything is left for the
    //    selected wallpaper, keep the user's selection
    if (this.currentSrc()) {
      this.apply();
      return;
    }

    // 2) Otherwise: first wallpaper with any working variant (default
    //    built-in first) — the background must never end up blank
    const index = this.wallpapers.findIndex((wp) => this.srcFor(wp));
    if (index === -1) {
      // Everything failed — hide the video, keep the dark base
      this.layer.classList.remove("active", "switching");
      this.video.pause();
      return;
    }

    this.settings.builtinIndex = index;
    this.syncControls();
    this.apply();
    this.saveSettings();
  }

  /* ---------- Wallpaper position (desktop vs mobile framing) ---------- */

  positionMode() {
    return this.mobileMQ.matches ? "mobile" : "desktop";
  }

  /** Stable identity for the current wallpaper's saved positions —
   *  the name, so desktop and mobile variants share one identity */
  wallpaperKey() {
    const wp = this.wallpapers[this.settings.builtinIndex];
    return wp ? wp.name : "none";
  }

  /** Effective position: user override -> wallpaper profile -> center */
  currentPositionValue() {
    const key = this.wallpaperKey();
    const mode = this.positionMode();
    const override =
      this.settings.positions[key] && this.settings.positions[key][mode];
    if (override) return override;
    const wp = this.wallpapers[this.settings.builtinIndex];
    if (wp) {
      const profile =
        mode === "mobile" ? wp.mobilePosition : wp.desktopPosition;
      if (profile) return profile;
    }
    return "center center";
  }

  /** Only touches the style when the value actually changes (perf) */
  applyPosition() {
    const pos = this.currentPositionValue();
    if (pos === this.appliedPosition) return;
    this.appliedPosition = pos;
    this.video.style.objectPosition = pos;
  }

  /** "60% center" / "left top" -> numeric slider values */
  parsePosition(pos) {
    const words = { left: 0, top: 0, center: 50, right: 100, bottom: 100 };
    const parts = String(pos).trim().split(/\s+/);
    const num = (v, fallback) => {
      if (v in words) return words[v];
      const n = parseFloat(v);
      return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : fallback;
    };
    return {
      x: num(parts[0] || "center", 50),
      y: num(parts[1] || "center", 50),
    };
  }

  /** Point the sliders at the current wallpaper + screen-size profile */
  syncPositionControls() {
    if (!this.posXSlider || !this.posYSlider) return;
    const { x, y } = this.parsePosition(this.currentPositionValue());
    this.posXSlider.value = String(Math.round(x));
    this.posYSlider.value = String(Math.round(y));
    if (this.posModeLabel) {
      this.posModeLabel.textContent =
        this.positionMode() === "mobile" ? "Mobile" : "Desktop";
    }
    this.updatePositionLabels();
  }

  updatePositionLabels() {
    if (this.posXValue)
      this.posXValue.textContent = this.posXSlider.value + "%";
    if (this.posYValue)
      this.posYValue.textContent = this.posYSlider.value + "%";
  }

  /* ---------- Adaptive accent ---------- */

  /** The accent belonging to the current wallpaper (default otherwise) */
  activeAccent() {
    const wp = this.wallpapers[this.settings.builtinIndex];
    return (wp && wp.accent) || DEFAULT_ACCENT;
  }

  /**
   * Retint every interactive element to match the wallpaper's mood.
   * Derives the full palette (hover, dark, glows, soft, ambient) from
   * a single accent hex and updates CSS variables in place — no reload.
   */
  applyAccent() {
    const accent = this.activeAccent();
    if (accent === this.appliedAccent) return; // no change, no work
    this.appliedAccent = accent;

    const root = document.documentElement.style;
    root.setProperty("--accent-color", accent);
    root.setProperty("--accent-hover", shadeHex(accent, 0.2));
    root.setProperty("--accent-dark", shadeHex(accent, -0.25));
    root.setProperty("--accent-glow", hexToRgba(accent, 0.35));
    root.setProperty("--accent-glow-strong", hexToRgba(accent, 0.5));
    root.setProperty("--accent-soft", hexToRgba(accent, 0.13));
    root.setProperty("--accent-ambient", hexToRgba(accent, 0.08));
  }

  /* ---------- Settings UI sync ---------- */

  syncControls() {
    if (!this.builtinSelect.disabled) {
      this.builtinSelect.value = String(this.settings.builtinIndex);
    }
    this.audioToggle.checked = !!this.settings.audio;
    this.brightnessSlider.value = String(this.settings.brightness);
    this.overlaySlider.value = String(this.settings.overlay);
    this.blurSlider.value = String(this.settings.blur);
    this.updateValueLabels();
  }

  updateValueLabels() {
    if (this.brightnessValue)
      this.brightnessValue.textContent = this.settings.brightness + "%";
    if (this.overlayValue)
      this.overlayValue.textContent = this.settings.overlay + "%";
    if (this.blurValue) this.blurValue.textContent = this.settings.blur + "px";
  }
}

// ===================================================
// INITIALIZATION
// ===================================================

// Initialize timer when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  const timer = new PomodoroTimer();
  const taskManager = new TaskManager();
  const notificationManager = new NotificationManager(timer);
  const musicPlayer = new MusicPlayer(PLAYLIST, AMBIENT_SOUNDS);
  const wallpaperManager = new WallpaperManager(LIVE_WALLPAPERS);

  // Integrate task manager with timer
  const originalTimerComplete = timer.timerComplete.bind(timer);
  timer.timerComplete = function () {
    // Increment pomodoro count for focused task if any
    if (this.currentSession === "pomodoro" && taskManager.focusedTaskId) {
      taskManager.incrementPomodoro(taskManager.focusedTaskId);
    }

    // Call original completion handler
    originalTimerComplete();

    // Always run completion handling — the bell is controlled by
    // "Enable notification sound", the browser notification by
    // "Enable notifications". They're checked inside handleSessionComplete.
    notificationManager.handleSessionComplete(this.currentSession);
  };

  // Task panel collapse toggle — the header (or its chevron button)
  // minimizes the panel to just its title bar on any screen size.
  const taskPanel = document.getElementById("taskPanel");
  const taskPanelHeader = document.querySelector(".task-panel-header");
  if (taskPanel && taskPanelHeader) {
    taskPanelHeader.addEventListener("click", () => {
      taskPanel.classList.toggle("collapsed");
    });
  }

  // Music player collapse — mobile only, so users can flip between
  // Music and Tasks without long scrolling. Desktop is unaffected.
  const playerCard = document.getElementById("musicPlayer");
  const playerHeader = document.querySelector(".player-header");
  if (playerCard && playerHeader) {
    playerHeader.addEventListener("click", () => {
      if (window.matchMedia("(max-width: 767px)").matches) {
        playerCard.classList.toggle("collapsed");
      }
    });
  }

  // Add keyboard shortcuts info (optional)
  console.log("🎯 Deep Focus - Keyboard Shortcuts:");
  console.log("Space - Start/Pause timer");
  console.log("R - Reset timer");
});

// Add slideOutDown animation
const style = document.createElement("style");
style.textContent = `
    @keyframes slideOutDown {
        from {
            opacity: 1;
            transform: translateY(0);
        }
        to {
            opacity: 0;
            transform: translateY(30px);
        }
    }
`;
document.head.appendChild(style);
