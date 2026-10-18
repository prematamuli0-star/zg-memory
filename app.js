
/* ZG Memory — Complete app.js */
"use strict";

let sb = null;
let currentUser = null;
let isAdmin = false;
let songs = [];
let albumOrders = {};
let currentView = "home";
let authMode = "signin";
let deferredInstall = null;
let currentSongId = null;
let selectedAlbum = null;
let adminPanelOpen = false;

const $ = id => document.getElementById(id);
const FAV_KEY = "zg-memory-favorites-v1";

let favorites = readFavorites();

function readFavorites() {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || "[]").map(String);
  } catch {
    return [];
  }
}

function saveFavorites() {
  localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
  updateFavCount();
}

function updateFavCount() {
  if ($("favCount")) $("favCount").textContent = favorites.length;
  if ($("favTabCount")) $("favTabCount").textContent = favorites.length;
}

function toast(message) {
  const element = $("toast");
  if (!element) return;
  element.textContent = message;
  element.classList.add("show");
  setTimeout(() => element.classList.remove("show"), 3000);
}

function setStatus(message) {
  if ($("status")) $("status").textContent = message;
}

function safeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function coverOf(song) {
  return song.cover_url || "./icon.svg";
}

function metaOf(song) {
  return [song.artist || "Unknown artist", song.album, song.year]
    .filter(Boolean)
    .join(" • ");
}

/* Song list and search */
function visibleSongs() {
  const query = ($("searchInput")?.value || "").trim().toLowerCase();

  let list = songs.filter(song =>
    [song.title, song.artist, song.album, song.year]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query)
  );

  if (currentView === "favorites") {
    list = list.filter(song => favorites.includes(String(song.id)));
  }

  if (currentView === "albumSongs" && selectedAlbum !== null) {
    list = list.filter(song => (song.album || "Unsorted") === selectedAlbum);
  }

  return list;
}

function render() {
  if (!$("songList")) return;

  const list = visibleSongs();
  const albumsHost = $("albumsView");
  const inAlbums = currentView === "albums";

  const titles = {
    home: ["YOUR COLLECTION", "All songs"],
    albums: ["YOUR COLLECTION", "Albums"],
    albumSongs: ["ALBUM", selectedAlbum || "Album songs"],
    library: ["YOUR LIBRARY", "Music library"],
    favorites: ["SAVED FOR LATER", "Your favorites"]
  };

  const heading = titles[currentView] || titles.home;

  if ($("sectionEyebrow")) $("sectionEyebrow").textContent = heading[0];
  if ($("sectionTitle")) $("sectionTitle").textContent = heading[1];

  if ($("songCount")) {
    if (inAlbums) {
      const count = new Set(
        songs.map(song => (song.album || "Unsorted").trim() || "Unsorted")
      ).size;

      $("songCount").textContent =
        `${count} album${count === 1 ? "" : "s"}`;
    } else {
      $("songCount").textContent =
        `${list.length} song${list.length === 1 ? "" : "s"}`;
    }
  }

  updateFavCount();

  if (albumsHost) {
    if (inAlbums) {
      const groups = new Map();

      songs.forEach(song => {
        const name = (song.album || "Unsorted").trim() || "Unsorted";

        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push(song);
      });

      const query = ($("searchInput")?.value || "").trim().toLowerCase();

      const entries = [...groups.entries()]
        .filter(([name, tracks]) =>
          !query || name.toLowerCase().includes(query) || tracks.some(song =>
            [song.title, song.artist, song.year].filter(Boolean).join(" ").toLowerCase().includes(query))
        )
        .sort((a, b) => (albumOrders[a[0]] ?? 999999) - (albumOrders[b[0]] ?? 999999) || a[0].localeCompare(b[0]));

      albumsHost.innerHTML = entries.map(([name, tracks], index) => {
        const coverSong = tracks.find(song => song.cover_url) || tracks[0];
        return `<div class="album-card-wrap ${isAdmin ? "admin-sortable" : ""}" ${isAdmin ? `data-album-drag="${safeText(name)}"` : ""}>
          <button class="album-card" type="button" data-open-album="${safeText(name)}" aria-label="Open album ${safeText(name)}">
            <span class="album-number">${index + 1}</span>
            <img src="${safeText(coverOf(coverSong))}" alt="" loading="lazy" onerror="this.onerror=null;this.src='./icon.svg'">
            <strong>${safeText(name)}</strong><span>${tracks.length} song${tracks.length === 1 ? "" : "s"}</span>
          </button>
          ${isAdmin ? `<span class="drag-hint" aria-hidden="true">⠿ Drag to reorder</span>` : ""}
        </div>`;
      }).join("");

      albumsHost.classList.remove("hidden");
    } else {
      albumsHost.classList.add("hidden");
      albumsHost.innerHTML = "";
    }
  }

  const headingHost = $("songSectionHeading");
  if (headingHost) headingHost.classList.toggle("hidden", inAlbums);

  if (currentView === "albumSongs") {
    if ($("sectionTitle") && !$("backAlbumsBtn")) {
      $("sectionTitle").insertAdjacentHTML(
        "afterend",
        '<button id="backAlbumsBtn" class="button secondary" type="button">← All Albums</button>'
      );
    }
  } else {
    $("backAlbumsBtn")?.remove();
  }

  $("songList").innerHTML = list.map((song, index) => `
    <article class="song-card ${isAdmin ? "admin-sortable" : ""}" ${isAdmin ? `data-song-drag="${safeText(song.id)}"` : ""}>
      <span class="song-number">${String(index + 1).padStart(2, "0")}</span>

      <button class="song-main" type="button"
        data-play="${safeText(song.id)}"
        aria-label="Play ${safeText(song.title)}">
        <img class="song-cover" src="${safeText(coverOf(song))}"
          alt="" loading="lazy"
          onerror="this.onerror=null;this.src='./icon.svg'">
        <span class="song-copy">
          <h3>${safeText(song.title)}</h3>
          <p>${safeText(metaOf(song))}</p>
        </span>
      </button>

      <button class="play-button" type="button"
        data-play="${safeText(song.id)}" aria-label="Play">▶</button>

      ${isAdmin ? `
        <span class="drag-hint song-drag-hint" aria-hidden="true">⠿</span>
        <button class="edit-button song-admin-action" type="button"
          data-edit="${safeText(song.id)}" aria-label="Edit ${safeText(song.title)}">Edit</button>
        <button class="delete-button song-admin-action" type="button"
          data-delete="${safeText(song.id)}" aria-label="Delete ${safeText(song.title)}">Delete</button>
      ` : `
        <button class="heart-button ${favorites.includes(String(song.id)) ? "favorited" : ""}"
          type="button" data-fav="${safeText(song.id)}"
          aria-label="Toggle favorite">
          ${favorites.includes(String(song.id)) ? "♥" : "♡"}
        </button>
      `}
    </article>
  `).join("");

  const noSongs = list.length === 0;

  $("emptyState")?.classList.toggle("hidden", inAlbums || !noSongs);
  $("songList").classList.toggle("hidden", inAlbums || noSongs);
  // Attach Sortable only after visibility is updated; otherwise returning from Albums
  // can leave the song list without drag handlers.
  setupDragSorting();

  document.querySelectorAll("[data-view]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.view === currentView ||
      (currentView === "albumSongs" && button.dataset.view === "albums")
    );
  });

  $("adminModal")?.classList.toggle("hidden", !isAdmin || !adminPanelOpen);
  document.body.classList.toggle("admin-modal-open", isAdmin && adminPanelOpen);
}

/* Load songs from Supabase */
async function loadSongs() {
  if (!sb) {
    setStatus("Setup needed: check config.js.");
    render();
    return;
  }

  setStatus("Loading music…");

  const { data, error } = await sb.from("songs")
    .select("id,title,artist,album,year,cover_url,cover_path,audio_path,created_at,sort_order")
    .order("sort_order", { ascending: true }).order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    setStatus("Could not load music. Check Supabase setup and table policies.");
    return;
  }

  songs = data || [];
  const albumResult = await sb.from("album_order").select("album_name,sort_order").order("sort_order", {ascending:true});
  if (albumResult.error) console.warn("Album order table not ready:", albumResult.error.message);
  albumOrders = Object.fromEntries((albumResult.data || []).map(row => [row.album_name, Number(row.sort_order)]));
  setStatus(songs.length ? "Tap a song to listen." : "No songs uploaded yet.");
  render();
}

/* Play a song */
async function playSong(id) {
  const song = songs.find(item => String(item.id) === String(id));
  if (!song || !sb) return;

  if (!song.audio_path) {
    toast("This song has no audio file.");
    return;
  }

  const { data } = sb.storage.from("music-audio").getPublicUrl(song.audio_path);

  if (!data?.publicUrl) {
    toast("Audio URL unavailable.");
    return;
  }

  currentSongId = song.id;
  $("playerCover").src = coverOf(song);
  $("playerTitle").textContent = song.title;
  $("playerArtist").textContent = metaOf(song);

  const audio = $("audio");
  audio.src = data.publicUrl;
  $("miniPlayer").classList.remove("hidden");

  try {
    await audio.play();
  } catch {
    toast("Tap Play to start the song.");
  }
}

/* Player controls: Next, Previous, Repeat and Shuffle */
let repeatSongEnabled = false;
let shuffleSongEnabled = false;

function getPlaybackList() {
  const list = visibleSongs();
  return list.length ? list : songs;
}

async function playNextSong() {
  const audio = $("audio");
  const list = getPlaybackList();

  if (!list.length) return;

  if (shuffleSongEnabled && list.length > 1) {
    const choices = list.filter(
      song => String(song.id) !== String(currentSongId)
    );
    const next = choices[Math.floor(Math.random() * choices.length)];

    if (next) await playSong(next.id);
    return;
  }

  const index = list.findIndex(
    song => String(song.id) === String(currentSongId)
  );

  const nextIndex = index < 0 ? 0 : (index + 1) % list.length;
  await playSong(list[nextIndex].id);
}

async function playPreviousSong() {
  const list = getPlaybackList();

  if (!list.length) return;

  const index = list.findIndex(
    song => String(song.id) === String(currentSongId)
  );

  const previousIndex =
    index < 0 ? 0 : (index - 1 + list.length) % list.length;

  await playSong(list[previousIndex].id);
}

$("audio")?.addEventListener("ended", async () => {
  if (repeatSongEnabled) {
    const audio = $("audio");
    audio.currentTime = 0;

    try {
      await audio.play();
    } catch {
      toast("Tap Play to restart the song.");
    }
  } else {
    await playNextSong();
  }
});

$("nextSong")?.addEventListener("click", event => {
  event.stopPropagation();
  playNextSong();
});

$("previousSong")?.addEventListener("click", event => {
  event.stopPropagation();
  playPreviousSong();
});

$("repeatSong")?.addEventListener("click", event => {
  event.stopPropagation();
  repeatSongEnabled = !repeatSongEnabled;

  $("repeatSong").textContent =
    repeatSongEnabled ? "Repeat: On" : "Repeat: Off";

  $("repeatSong").setAttribute(
    "aria-pressed", String(repeatSongEnabled)
  );
});

$("shuffleSong")?.addEventListener("click", event => {
  event.stopPropagation();
  shuffleSongEnabled = !shuffleSongEnabled;

  $("shuffleSong").textContent =
    shuffleSongEnabled ? "Shuffle: On" : "Shuffle: Off";

  $("shuffleSong").setAttribute(
    "aria-pressed", String(shuffleSongEnabled)
  );
});

/* Full-screen and mini-player controls */
function expandPlayer() {
  $("miniPlayer")?.classList.add("player-expanded");
}

function minimizePlayer() {
  $("miniPlayer")?.classList.remove("player-expanded");
}

$("miniPlayer")?.addEventListener("click", event => {
  if (event.target.closest("#closePlayer")) return;
  if (event.target.closest("audio")) return;
  if (event.target.closest("#back10, #forward10")) return;
  expandPlayer();
});

$("closePlayer")?.addEventListener("click", event => {
  event.stopPropagation();

  if ($("miniPlayer").classList.contains("player-expanded")) {
    minimizePlayer();
  } else {
    $("audio").pause();
    $("miniPlayer").classList.add("hidden");
  }
});

/* Skip 10 seconds backward or forward */
function skipAudio(seconds) {
  const audio = $("audio");
  if (!audio || !Number.isFinite(audio.duration)) return;

  audio.currentTime = Math.max(
    0,
    Math.min(audio.duration, audio.currentTime + seconds)
  );
}

$("back10")?.addEventListener("click", event => {
  event.stopPropagation();
  skipAudio(-10);
});

$("forward10")?.addEventListener("click", event => {
  event.stopPropagation();
  skipAudio(10);
});

/* Navigation */
function setView(view) {
  currentView = view;
  selectedAlbum = null;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openAlbum(name) {
  selectedAlbum = name;
  currentView = "albumSongs";
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* Admin drag-and-drop ordering — persisted in Supabase */
let albumSortable = null;
let songSortable = null;

function setupDragSorting() {
  if (typeof Sortable === "undefined") return;
  const albumsHost = $("albumsView");
  const songsHost = $("songList");
  if (albumSortable) { albumSortable.destroy(); albumSortable = null; }
  if (songSortable) { songSortable.destroy(); songSortable = null; }
  if (!isAdmin) return;

  if (albumsHost && currentView === "albums" && !albumsHost.classList.contains("hidden")) {
    albumSortable = Sortable.create(albumsHost, {
      animation: 180,
      draggable: ".album-card-wrap[data-album-drag]",
      handle: ".album-card img, .album-number, .drag-hint",
      delay: 180,
      delayOnTouchOnly: true,
      touchStartThreshold: 5,
      ghostClass: "sort-ghost",
      chosenClass: "sort-chosen",
      onEnd: async () => saveAlbumOrderFromDOM()
    });
  }

  if (songsHost && !songsHost.classList.contains("hidden") &&
      ["home", "library", "favorites", "albumSongs"].includes(currentView)) {
    songSortable = Sortable.create(songsHost, {
      animation: 180,
      draggable: ".song-card[data-song-drag]",
      handle: ".song-cover, .song-number, .song-drag-hint",
      delay: 180,
      delayOnTouchOnly: true,
      touchStartThreshold: 5,
      ghostClass: "sort-ghost",
      chosenClass: "sort-chosen",
      onEnd: async () => saveSongOrderFromDOM()
    });
  }
}

async function saveAlbumOrderFromDOM() {
  if (!isAdmin || !sb) return;
  const host = $("albumsView");
  const visibleNames = [...host.querySelectorAll("[data-album-drag]")].map(el => el.dataset.albumDrag);
  const allNames = [...new Set(songs.map(song => (song.album || "Unsorted").trim() || "Unsorted"))]
    .sort((a,b) => (albumOrders[a] ?? 999999) - (albumOrders[b] ?? 999999) || a.localeCompare(b));
  const visibleSet = new Set(visibleNames);
  const names = [...visibleNames, ...allNames.filter(name => !visibleSet.has(name))];
  const rows = names.map((album_name, sort_order) => ({ album_name, sort_order }));
  const { error } = await sb.from("album_order").upsert(rows, { onConflict: "album_name" });
  if (error) {
    console.error("Album reorder failed:", error);
    toast("Album order save failed: " + (error.message || error.details || error.code || "check Supabase permissions"));
    await loadSongs();
    return;
  }
  albumOrders = Object.fromEntries(rows.map(row => [row.album_name, row.sort_order]));
  render();
  toast("Album order saved.");
}

async function saveSongOrderFromDOM() {
  if (!isAdmin || !sb) return;
  const host = $("songList");
  const visibleIds = [...host.querySelectorAll("[data-song-drag]")].map(el => el.dataset.songDrag);
  const visibleSet = new Set(visibleIds);
  const existing = [...songs].sort((a,b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
  const orderedIds = [...visibleIds, ...existing.filter(song => !visibleSet.has(String(song.id))).map(song => String(song.id))];
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await sb.from("songs").update({ sort_order: i }).eq("id", orderedIds[i]);
    if (error) {
      console.error("Song reorder failed:", error);
      toast("Song order save failed: " + (error.message || error.details || error.code || "check Supabase permissions"));
      await loadSongs();
      return;
    }
  }
  await loadSongs();
  toast("Song order saved.");
}

/* Click actions */
document.addEventListener("click", async event => {

  const playButton = event.target.closest("[data-play]");
  if (playButton) {
    await playSong(playButton.dataset.play);
    return;
  }

  const favoriteButton = event.target.closest("[data-fav]");
  if (favoriteButton) {
    const id = String(favoriteButton.dataset.fav);

    favorites = favorites.includes(id)
      ? favorites.filter(item => item !== id)
      : [...favorites, id];

    saveFavorites();
    render();
    return;
  }

  const albumButton = event.target.closest("[data-open-album]");
  if (albumButton) {
    openAlbum(albumButton.dataset.openAlbum);
    return;
  }

  if (event.target.closest("#backAlbumsBtn")) {
    setView("albums");
    return;
  }

  const editButton = event.target.closest("[data-edit]");
  if (editButton) {
    await editSong(editButton.dataset.edit);
    return;
  }

  const deleteButton = event.target.closest("[data-delete]");
  if (deleteButton) {
    await deleteSong(deleteButton.dataset.delete);
    return;
  }

  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    setView(viewButton.dataset.view);
  }
});

/* Search */
$("searchInput")?.addEventListener("input", render);

$("clearSearch")?.addEventListener("click", () => {
  if ($("searchInput")) $("searchInput").value = "";
  render();
  $("searchInput")?.focus();
});

/* Profile and authentication */
function openAuth() {
  const modal = $("authDialog");
  if (modal && typeof modal.showModal === "function") {
    if (!modal.open) modal.showModal();
  }
}

function closeAuth() {
  const modal = $("authDialog");
  if (modal && typeof modal.close === "function" && modal.open) {
    modal.close();
  }
}

function openProfile() {
  if (currentUser) {
    toast("Signed in: " + currentUser.email);
  } else {
    openAuth();
  }
}

$("profileTop")?.addEventListener("click", openProfile);
$("profileNav")?.addEventListener("click", openProfile);
$("closeAuth")?.addEventListener("click", closeAuth);

$("toggleAuth")?.addEventListener("click", () => {
  authMode = authMode === "signin" ? "signup" : "signin";

  if ($("authTitle")) {
    $("authTitle").textContent =
      authMode === "signin" ? "Sign in" : "Create account";
  }

  if ($("authSubmit")) {
    $("authSubmit").textContent =
      authMode === "signin" ? "Sign in" : "Sign up";
  }

  if ($("toggleAuth")) {
    $("toggleAuth").textContent =
      authMode === "signin"
        ? "Need an account? Sign up"
        : "Already registered? Sign in";
  }
});

$("authForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!sb) {
    toast("Supabase is not configured.");
    return;
  }

  const email = $("authEmail")?.value.trim();
  const password = $("authPassword")?.value;

  if (!email || !password) {
    toast("Enter email and password.");
    return;
  }

  const button = $("authSubmit");
  if (button) {
    button.disabled = true;
    button.textContent = "Please wait…";
  }

  try {
    const result = authMode === "signin"
      ? await sb.auth.signInWithPassword({ email, password })
      : await sb.auth.signUp({ email, password });

    if (result.error) throw result.error;

    if (authMode === "signup" && !result.data.session) {
      toast("Check your email to confirm your account.");
    } else {
      toast(authMode === "signin" ? "Signed in." : "Account created.");
    }

    closeAuth();
    await refreshSession();
  } catch (error) {
    console.error(error);
    toast(error.message || "Authentication failed.");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = authMode === "signin" ? "Sign in" : "Sign up";
    }
  }
});

async function signOut() {
  if (!sb) return;

  const { error } = await sb.auth.signOut();

  if (error) {
    toast("Sign out failed.");
    return;
  }

  currentUser = null;
  isAdmin = false;
  adminPanelOpen = false;
  $("adminModal")?.classList.add("hidden");
  document.body.classList.remove("admin-modal-open");
  toast("Signed out.");
  await refreshSession();
}

async function refreshSession() {
  if (!sb) return;

  const { data, error } = await sb.auth.getSession();

  if (error) {
    console.error(error);
    return;
  }

  currentUser = data.session?.user || null;

  /*
    IMPORTANT:
    Admin access must be enforced by Supabase policies.
    A logged-in account alone must not be treated as an admin.
  */
  isAdmin = false;

 

 if (currentUser && sb) {
  const { data: adminRecord, error: adminError } = await sb
    .from("admin_users")
    .select("user_id")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (!adminError && adminRecord?.user_id === currentUser.id) {
    isAdmin = true;
  } else if (adminError) {
    console.error("Admin check failed:", adminError);
  }
}

  const adminButton = $("adminLoginBtn");
  if (adminButton) {
    adminButton.classList.toggle("hidden", !isAdmin);
    adminButton.textContent = adminPanelOpen ? "Close Admin" : "Admin Panel";
    adminButton.setAttribute("aria-expanded", String(isAdmin && adminPanelOpen));
  }
  $("adminModal")?.classList.toggle("hidden", !isAdmin || !adminPanelOpen);
  document.body.classList.toggle("admin-modal-open", isAdmin && adminPanelOpen);

  if ($("profileAction")) {
    $("profileAction").textContent = currentUser ? "Sign out" : "Sign in";
  }

  render();
}

$("profileAction")?.addEventListener("click", () => {
  if (currentUser) {
    signOut();
  } else {
    openAuth();
  }
});

/* Admin panel modal: only open for a verified admin */
function closeAdminPanel() {
  adminPanelOpen = false;
  $("adminModal")?.classList.add("hidden");
  document.body.classList.remove("admin-modal-open");
  const adminButton = $("adminLoginBtn");
  if (adminButton) {
    adminButton.textContent = "Admin Panel";
    adminButton.setAttribute("aria-expanded", "false");
  }
}

$("adminLoginBtn")?.addEventListener("click", () => {
  if (!isAdmin) {
    toast("Admin access required.");
    return;
  }
  adminPanelOpen = !adminPanelOpen;
  $("adminModal")?.classList.toggle("hidden", !adminPanelOpen);
  document.body.classList.toggle("admin-modal-open", adminPanelOpen);
  $("adminLoginBtn").textContent = adminPanelOpen ? "Close Admin" : "Admin Panel";
  $("adminLoginBtn").setAttribute("aria-expanded", String(adminPanelOpen));
});

$("adminPanelCloseBtn")?.addEventListener("click", closeAdminPanel);
$("adminModal")?.addEventListener("click", event => {
  if (event.target === $("adminModal")) closeAdminPanel();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && adminPanelOpen) closeAdminPanel();
});

/* Admin logout */
$("adminLogoutBtn")?.addEventListener("click", signOut);

/* Upload one song or multiple songs */
async function uploadSong(event) {
  event.preventDefault();

  if (!sb || !isAdmin) {
    toast("Admin access required.");
    return;
  }

  const title = $("songTitle")?.value.trim() || "";
  const artist = $("songArtist")?.value.trim() || "";
  const album = $("songAlbum")?.value.trim() || "";
  const yearText = $("songYear")?.value.trim() || "";
  const cover = $("songCover")?.files?.[0];
  const audioInput = $("songAudio");
  const multipleInput = $("songAudioMultiple");

  const audioFiles = [
    ...(audioInput?.files || []),
    ...(multipleInput?.files || [])
  ];

  const uniqueFiles = [...new Map(
    audioFiles.map(file => [`${file.name}-${file.size}`, file])
  ).values()];

  if (!artist || !cover || uniqueFiles.length === 0) {
    toast("Enter singer, album cover and at least one audio file.");
    return;
  }

  if (cover.size > 5 * 1024 * 1024) {
    toast("Cover image must be 5 MB or smaller.");
    return;
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(cover.type)) {
    toast("Choose a JPG, PNG or WebP cover.");
    return;
  }

  const year = yearText ? Number(yearText) : null;

  if (year !== null &&
      (!Number.isInteger(year) || year < 1000 || year > 9999)) {
    toast("Enter a valid year.");
    return;
  }

  const button = $("uploadBtn");
  if (button) {
    button.disabled = true;
    button.textContent = "Uploading…";
  }

  const cleanName = file =>
    file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-90);

  try {
    for (let index = 0; index < uniqueFiles.length; index++) {
      const audio = uniqueFiles[index];

      if (audio.size > 50 * 1024 * 1024) {
        throw new Error(`${audio.name}: audio file exceeds 50 MB.`);
      }

      if (audio.type && !audio.type.startsWith("audio/")) {
        throw new Error(`${audio.name}: choose an audio file.`);
      }

      const songTitle = uniqueFiles.length === 1 && title
        ? title
        : audio.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");

      const prefix = crypto.randomUUID();
      const coverPath = `${prefix}/${cleanName(cover)}`;
      const audioPath = `${prefix}/${cleanName(audio)}`;

      const coverUpload = await sb.storage
        .from("music-covers")
        .upload(coverPath, cover, {
          upsert: false,
          contentType: cover.type
        });

      if (coverUpload.error) throw coverUpload.error;

      const audioUpload = await sb.storage
        .from("music-audio")
        .upload(audioPath, audio, {
          upsert: false,
          contentType: audio.type || "audio/mpeg"
        });

      if (audioUpload.error) {
        await sb.storage.from("music-covers").remove([coverPath]);
        throw audioUpload.error;
      }

      const { data: coverData } = sb.storage
        .from("music-covers")
        .getPublicUrl(coverPath);

      const result = await sb.from("songs").insert({
        title: songTitle,
        artist,
        album: album || null,
        year,
        cover_url: coverData.publicUrl,
        cover_path: coverPath,
        audio_path: audioPath,
        sort_order: songs.length
      });

      if (result.error) {
        await sb.storage.from("music-covers").remove([coverPath]);
        await sb.storage.from("music-audio").remove([audioPath]);
        throw result.error;
      }
    }

    $("uploadForm")?.reset();
    toast("Upload completed.");
    await loadSongs();
  } catch (error) {
    console.error(error);
    toast("Upload failed: " + (error.message || "Check Supabase policies."));
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Upload song";
    }
  }
}

$("uploadForm")?.addEventListener("submit", uploadSong);

/* Edit song details */
async function editSong(id) {
  if (!sb || !isAdmin) {
    toast("Admin access required.");
    return;
  }

  const song = songs.find(item => String(item.id) === String(id));
  if (!song) return;

  const title = prompt("Song title:", song.title || "");
  if (title === null) return;

  const artist = prompt("Singer / artist:", song.artist || "");
  if (artist === null) return;

  const album = prompt("Album name:", song.album || "");
  if (album === null) return;

  const yearText = prompt("Year:", song.year || "");
  if (yearText === null) return;

  const year = yearText.trim() ? Number(yearText) : null;

  if (!title.trim() || !artist.trim()) {
    toast("Title and artist are required.");
    return;
  }

  if (year !== null &&
      (!Number.isInteger(year) || year < 1000 || year > 9999)) {
    toast("Enter a valid year.");
    return;
  }

  const { error } = await sb.from("songs").update({
    title: title.trim(),
    artist: artist.trim(),
    album: album.trim() || null,
    year
  }).eq("id", song.id);

  if (error) {
    toast("Edit failed: " + error.message);
    return;
  }

  toast("Song details updated.");
  await loadSongs();
}

/* Delete song */
async function deleteSong(id) {
  if (!sb || !isAdmin) {
    toast("Admin access required.");
    return;
  }

  if (!confirm("Delete this song and its files?")) return;

  const song = songs.find(item => String(item.id) === String(id));
  if (!song) return;

  const { error } = await sb.from("songs")
    .delete()
    .eq("id", song.id);

  if (error) {
    toast("Delete failed: " + error.message);
    return;
  }

  const tasks = [];

  if (song.audio_path) {
    tasks.push(
      sb.storage.from("music-audio").remove([song.audio_path])
    );
  }

  if (song.cover_path) {
    tasks.push(
      sb.storage.from("music-covers").remove([song.cover_path])
    );
  }

  await Promise.allSettled(tasks);

  favorites = favorites.filter(item => item !== String(id));
  saveFavorites();

  if (String(currentSongId) === String(id)) {
    $("audio")?.pause();
    $("miniPlayer")?.classList.add("hidden");
    currentSongId = null;
  }

  toast("Song deleted.");
  await loadSongs();
}

/* Initialize Supabase */
async function init() {
  const config = window.ZG_SUPABASE_CONFIG;

  if (!window.supabase || !config?.url || !config?.anonKey) {
    setStatus("Setup needed: check config.js.");
    render();
    return;
  }

  try {
    sb = window.supabase.createClient(config.url, config.anonKey);

    sb.auth.onAuthStateChange(() => {
      setTimeout(refreshSession, 0);
    });

    await refreshSession();
    await loadSongs();
  } catch (error) {
    console.error(error);
    setStatus("Could not initialize Supabase. Check config.js.");
  }
}

/* Install app */
window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstall = event;
  $("installBtn")?.classList.remove("hidden");
});

$("installBtn")?.addEventListener("click", async () => {
  if (!deferredInstall) return;

  deferredInstall.prompt();
  await deferredInstall.userChoice;

  deferredInstall = null;
  $("installBtn")?.classList.add("hidden");
});

/* Service worker */
if ("serviceWorker" in navigator &&
    location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.warn);
  });
}

/* Start app */
init();
