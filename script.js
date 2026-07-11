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
    title: "hate that i made you love me",
    artist: "Ariana Grande",
    src: "assets/sounds/music1.mp3",
    cover: "",
  },
  {
    title: "First Love | Remember The Day",
    artist: "Piano Themes",
    src: "assets/sounds/music2.mp3",
    cover: "",
  },
  {
    title: "Những Lời Dối Gian (Thiện Toàn Remix Tiktok 2025)",
    artist: "Wanji Music 2024",
    src: "assets/sounds/music3.mp3",
    cover: "",
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
    src: "assets/images/Live-Wallpapers/lwp1-Blue_Sky.mp4",
    accent: "#22D3EE",
  },
  {
    name: "Calm Forest",
    src: "assets/images/Live-Wallpapers/lwp2-Calm_Forest.mp4",
    accent: "#59C173",
  },
  {
    name: "Hidden Garden Temple",
    src: "assets/images/Live-Wallpapers/lwp3-Hidden_Garden_Temple.mp4",
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
 * MusicPlayer Class — playlist, shuffle, repeat, seeking,
 * fade transitions, and localStorage persistence.
 * Fully independent of the Pomodoro timer, so music keeps
 * playing across session switches.
 */
class MusicPlayer {
  static STORAGE_KEY = "deepFocusMusic";
  static FADE_MS = 350;

  constructor(playlist) {
    this.playlist = Array.isArray(playlist) ? playlist : [];
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

    // Empty playlist → clean empty state, no listeners needed
    if (this.playlist.length === 0) {
      this.mainEl.hidden = true;
      if (this.playlistEl) this.playlistEl.hidden = true;
      this.emptyEl.hidden = false;
      return;
    }

    this.loadState();
    this.renderPlaylist(); // built once — items are reused, never recreated
    this.initEventListeners();
    this.loadTrack(this.trackIndex, { resumePosition: true });
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
    this.artistEl.textContent = track.artist;
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
  renderPlaylist() {
    if (!this.playlistEl) return;

    const fragment = document.createDocumentFragment();
    this.playlistItems = this.playlist.map((track, i) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "playlist-item";
      item.setAttribute("role", "listitem");
      item.dataset.index = String(i);

      const icon = document.createElement("span");
      icon.className = "playlist-item-icon";
      icon.innerHTML =
        '<i class="fas fa-music icon-note"></i>' +
        '<span class="mini-eq"><i></i><i></i><i></i></span>';

      const text = document.createElement("span");
      text.className = "playlist-item-text";

      const title = document.createElement("span");
      title.className = "playlist-item-title";
      title.textContent = track.title;

      const artist = document.createElement("span");
      artist.className = "playlist-item-artist";
      artist.textContent = track.artist || "";

      text.appendChild(title);
      if (track.artist) text.appendChild(artist);
      item.appendChild(icon);
      item.appendChild(text);
      fragment.appendChild(item);
      return item;
    });

    this.playlistEl.innerHTML = "";
    this.playlistEl.appendChild(fragment);

    // One delegated listener for the whole list
    this.playlistEl.addEventListener("click", (e) => {
      const row = e.target.closest(".playlist-item");
      if (!row) return;
      const index = parseInt(row.dataset.index, 10);
      if (index === this.trackIndex) {
        this.togglePlay(); // tapping the current song toggles playback
      } else {
        this.switchTrack(index);
      }
    });

    if (this.countEl) {
      const n = this.playlist.length;
      this.countEl.textContent = n + (n === 1 ? " Song" : " Songs");
    }

    this.updateActiveItem();
  }

  /** Highlight the current track and keep it visible in the list */
  updateActiveItem() {
    if (!this.playlistItems) return;
    this.playlistItems.forEach((item, i) => {
      item.classList.toggle("active", i === this.trackIndex);
    });
    const active = this.playlistItems[this.trackIndex];
    if (active) active.scrollIntoView({ block: "nearest" });
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
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement("div");
      confetti.className = "confetti";
      confetti.style.left = Math.random() * 100 + "vw";
      confetti.style.top = "-10px";
      confetti.style.background = [
        "var(--accent-primary)",
        "var(--accent-hover)",
        "#a855f7",
        "#c084fc",
      ][Math.floor(Math.random() * 4)];
      confetti.style.width = Math.random() * 10 + 5 + "px";
      confetti.style.height = Math.random() * 10 + 5 + "px";
      confetti.style.borderRadius = "50%";

      document.body.appendChild(confetti);
      setTimeout(() => confetti.remove(), 2500);
    }
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
    this.uploadInput = document.getElementById("wallpaperUploadInput");
    this.audioToggle = document.getElementById("wallpaperAudioToggle");
    this.brightnessSlider = document.getElementById(
      "wallpaperBrightnessSlider",
    );
    this.overlaySlider = document.getElementById("wallpaperOverlaySlider");
    this.blurSlider = document.getElementById("wallpaperBlurSlider");
    this.brightnessValue = document.getElementById("wallpaperBrightnessValue");
    this.overlayValue = document.getElementById("wallpaperOverlayValue");
    this.blurValue = document.getElementById("wallpaperBlurValue");

    if (!this.video || !this.layer) return;

    this.settings = {
      builtinIndex: 0,
      brightness: 100, // %
      overlay: 20, // %
      blur: 0, // px
      audio: false, // wallpaper sound off by default
    };

    this.customUrl = null; // object URL of an uploaded video
    this.usingCustom = false; // uploaded video active this session
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
        const { builtinIndex, brightness, overlay, blur, audio } = saved;
        this.settings = {
          ...this.settings,
          ...(Number.isFinite(builtinIndex) && { builtinIndex }),
          ...(Number.isFinite(brightness) && { brightness }),
          ...(Number.isFinite(overlay) && { overlay }),
          ...(Number.isFinite(blur) && { blur }),
          ...(typeof audio === "boolean" && { audio }),
        };
      }
    } catch (_) {
      /* corrupted storage — keep defaults */
    }
    // Uploads are session-bound (object URLs), so persisted choice is
    // always one of the built-ins
    this.settings.builtinIndex = Math.min(
      Math.max(0, this.settings.builtinIndex || 0),
      Math.max(0, this.wallpapers.length - 1),
    );
  }

  saveSettings() {
    try {
      localStorage.setItem(
        WallpaperManager.STORAGE_KEY,
        JSON.stringify(this.settings),
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
      this.usingCustom = false;
      this.apply();
      this.saveSettings();
    });

    // Upload: instant preview via object URL
    this.uploadInput.addEventListener("change", () => {
      const file = this.uploadInput.files && this.uploadInput.files[0];
      if (!file) return;
      if (this.customUrl) URL.revokeObjectURL(this.customUrl);
      this.customUrl = URL.createObjectURL(file);
      this.usingCustom = true;
      this.failedSrcs.delete(this.customUrl);
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

  /* ---------- Source selection ---------- */

  currentSrc() {
    if (this.usingCustom && this.customUrl) return this.customUrl;
    const wp = this.wallpapers[this.settings.builtinIndex];
    return wp ? wp.src : null;
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

  /** Full state application: visuals + accent + video source */
  apply() {
    this.applyVisualVars();
    this.applyAccent();

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
    };

    if (firstLoad) {
      swap(); // nothing on screen yet — fade straight in
    } else {
      // Fade the current wallpaper out, then swap and fade back in
      this.layer.classList.add("switching");
      this.fadeTimeout = setTimeout(swap, WallpaperManager.FADE_MS);
    }
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

    // Find the first built-in that hasn't already failed
    const fallback = this.wallpapers.find((wp) => !this.failedSrcs.has(wp.src));
    if (!fallback) {
      // Everything failed — hide the video, keep the dark base
      this.layer.classList.remove("active", "switching");
      this.video.pause();
      return;
    }

    const index = this.wallpapers.indexOf(fallback);
    this.usingCustom = false;
    this.settings.builtinIndex = index;
    this.syncControls();
    this.apply();
    this.saveSettings();
  }

  /* ---------- Adaptive accent ---------- */

  /** The accent belonging to the current wallpaper (default otherwise) */
  activeAccent() {
    if (!this.usingCustom) {
      const wp = this.wallpapers[this.settings.builtinIndex];
      if (wp && wp.accent) return wp.accent;
    }
    return DEFAULT_ACCENT;
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
  const musicPlayer = new MusicPlayer(PLAYLIST);
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
