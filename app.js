
/* ZG Memory — complete app.js */
let sb = null;
let currentUser = null;
let isAdmin = false;
let songs = [];
let currentView = "home";
let authMode = "signin";
let deferredInstall = null;

const $ = id => document.getElementById(id);
const FAV_KEY = "zg-memory-favorites-v1";

let favorites = readFavorites();

function readFavorites() {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveFavorites() {
  localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
  updateFavCount();
}

function updateFavCount() {
  $("favCount").textContent = favorites.length;
  $("favTabCount").textContent = favorites.length;
}

function toast(message) {
  const t = $("toast");
  t.textContent = message;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}

function setStatus(message) {
  $("status").textContent = message;
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

function fallbackCover() {
  return "./icon.svg";
}

function coverOf(song) {
  return song.cover_url || fallbackCover();
}

function artistOf(song) {
  return song.artist || "Unknown artist";
}

function metaOf(song) {
  return [artistOf(song), song.album, song.year]
    .filter(Boolean)
    .join(" • ");
}

/* Filter songs and preserve serial numbers in displayed order */
function visibleSongs() {
  const query = $("searchInput").value.trim().toLowerCase();

  let list = songs.filter(song =>
    [song.title, song.artist, song.album, song.year]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query)
  );

  if (currentView === "favorites") {
    list = list.filter(song => favorites.includes(song.id));
  }

  return list;
}

function render() {
  const list = visibleSongs();
  const host = $("songList");

  const titles = {
    home: ["YOUR COLLECTION", "All songs"],
    library: ["YOUR LIBRARY", "Music library"],
    favorites: ["SAVED FOR LATER", "Your favorites"]
  };

  $("sectionEyebrow").textContent = titles[currentView][0];
  $("sectionTitle").textContent = titles[currentView][1];

  $("songCount").textContent =
    `${list.length} song${list.length === 1 ? "" : "s"}`;

  updateFavCount();

  host.innerHTML = list.map((song, index) => `
    <article class="song-card">
      <span class="song-number" aria-label="Track number ${index + 1}">
        ${String(index + 1).padStart(2, "0")}
      </span>

      <button class="song-main"
        type="button"
        data-play="${safeText(song.id)}"
        aria-label="Play ${safeText(song.title)}">

        <img class="song-cover"
          src="${safeText(coverOf(song))}"
          alt=""
          loading="lazy"
          onerror="this.src='./icon.svg'">

        <span class="song-copy">
          <h3>${safeText(song.title)}</h3>
          <p>${safeText(metaOf(song))}</p>
        </span>
      </button>

      <button class="play-button"
        type="button"
        data-play="${safeText(song.id)}"
        aria-label="Play song">▶</button>

      <button class="heart-button ${favorites.includes(song.id) ? "favorited" : ""}"
        type="button"
        data-fav="${safeText(song.id)}"
        aria-label="Toggle favorite">
        ${favorites.includes(song.id) ? "♥" : "♡"}
      </button>
    </article>
  `).join("");

  $("emptyState").classList.toggle("hidden", list.length > 0);
  host.classList.toggle("hidden", list.length === 0);

  document.querySelectorAll("[data-view]").forEach(button => {
    button.classList.toggle("active", button.dataset.view === currentView);
  });

  $("adminCard").classList.toggle("hidden", !isAdmin);
  renderAdminList();
}

function renderAdminList() {
  const host = $("adminSongList");

  if (!isAdmin) {
    host.innerHTML = "";
    return;
  }

  host.innerHTML = songs.map((song, index) => `
    <div class="admin-song-row">
      <span class="song-number">
        ${String(index + 1).padStart(2, "0")}
      </span>

      <img src="${safeText(coverOf(song))}"
        alt=""
        onerror="this.src='./icon.svg'">

      <div class="song-copy">
        <h3>${safeText(song.title)}</h3>
        <p>${safeText(metaOf(song))}</p>
      </div>

      <button class="delete-button"
        type="button"
        data-delete="${safeText(song.id)}">
        Delete
      </button>
    </div>
  `).join("") || "<p>No songs uploaded yet.</p>";
}

async function loadSongs() {
  if (!sb) {
    setStatus("Setup needed: check config.js.");
    render();
    return;
  }

  setStatus("Loading music…");

  const { data, error } = await sb
    .from("songs")
    .select("id,title,artist,album,year,cover_url,cover_path,audio_path,created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    setStatus("Could not load music. Check Supabase setup and table policies.");
    songs = [];
  } else {
    songs = data || [];
    setStatus(songs.length
      ? "Tap a song to listen."
      : "Your collection is ready for its first song.");
  }

  render();
}

async function playSong(id) {
  const song = songs.find(item => item.id === id);
  if (!song) return;

  if (!sb || !song.audio_path) {
    toast("This song has no audio file yet.");
    return;
  }

  const { data } = sb.storage
    .from("music-audio")
    .getPublicUrl(song.audio_path);

  $("playerCover").src = coverOf(song);
  $("playerTitle").textContent = song.title;
  $("playerArtist").textContent = metaOf(song);

  const audio = $("audio");
  audio.src = data.publicUrl;
  $("miniPlayer").classList.remove("hidden");

  try {
    await audio.play();
  } catch {
    toast("Tap Play in the audio controls to start.");
  }
}

function setView(view) {
  currentView = view;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* Main buttons */
document.addEventListener("click", async event => {
  const playButton = event.target.closest("[data-play]");

  if (playButton) {
    await playSong(playButton.dataset.play);
    return;
  }

  const favButton = event.target.closest("[data-fav]");

  if (favButton) {
    const id = favButton.dataset.fav;

    favorites = favorites.includes(id)
      ? favorites.filter(item => item !== id)
      : [...favorites, id];

    saveFavorites();
    render();
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

$("searchInput").addEventListener("input", render);

$("clearSearch").addEventListener("click", () => {
  $("searchInput").value = "";
  render();
  $("searchInput").focus();
});

$("headerFav").addEventListener("click", () => setView("favorites"));

$("searchNav").addEventListener("click", () => {
  $("searchInput").focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

function openProfile() {
  $("profileCard").scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  if (!currentUser) openAuth();
}

$("profileTop").addEventListener("click", openProfile);
$("profileNav").addEventListener("click", openProfile);

$("profileAction").addEventListener("click", () => {
  if (currentUser) signOut();
  else openAuth();
});

$("closePlayer").addEventListener("click", () => {
  $("audio").pause();
  $("miniPlayer").classList.add("hidden");
});

/* Login and signup */
function openAuth() {
  if (!sb) {
    toast("Check Supabase setup in config.js.");
    return;
  }

  $("authMessage").textContent = "";
  $("authDialog").showModal();
}

$("toggleAuth").addEventListener("click", () => {
  authMode = authMode === "signin" ? "signup" : "signin";

  $("authTitle").textContent =
    authMode === "signin" ? "Sign in" : "Create account";

  $("authSubmit").textContent =
    authMode === "signin" ? "Sign in" : "Sign up";

  $("toggleAuth").textContent =
    authMode === "signin"
      ? "Need an account? Sign up"
      : "Already registered? Sign in";

  $("authPassword").autocomplete =
    authMode === "signin" ? "current-password" : "new-password";

  $("authMessage").textContent = "";
});

$("authForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!sb) return;

  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;

  $("authSubmit").disabled = true;
  $("authMessage").textContent = "Please wait…";

  let result;

  if (authMode === "signin") {
    result = await sb.auth.signInWithPassword({ email, password });
  } else {
    result = await sb.auth.signUp({ email, password });
  }

  $("authSubmit").disabled = false;

  if (result.error) {
    $("authMessage").textContent = result.error.message;
    return;
  }

  if (authMode === "signup" && !result.data.session) {
    $("authMessage").textContent =
      "Check your email to confirm your account, then sign in.";
    return;
  }

  $("authDialog").close();
  toast("Signed in successfully.");
  await refreshSession();
});

async function signOut() {
  if (!sb) return;

  const { error } = await sb.auth.signOut();

  if (error) {
    toast(error.message);
    return;
  }

  toast("Signed out.");
  await refreshSession();
}

async function refreshSession() {
  if (!sb) return;

  const { data } = await sb.auth.getSession();
  currentUser = data.session?.user || null;
  isAdmin = false;

  if (currentUser) {
    const { data: admin, error } = await sb
      .from("admin_users")
      .select("user_id")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    isAdmin = !!admin && !error;

    $("profileTitle").textContent = currentUser.email || "Your profile";
    $("profileText").textContent = isAdmin
      ? "Signed in as administrator. You can upload and delete songs."
      : "Signed in. Favorites are saved on this device.";

    $("profileAction").textContent = "Sign out";
  } else {
    $("profileTitle").textContent = "Profile";
    $("profileText").textContent =
      "Sign in to access your profile. Favorites are saved on this device.";

    $("profileAction").textContent = "Sign in";
  }

  render();
}

/* Upload songs */
async function uploadSong(event) {
  event.preventDefault();

  if (!sb || !currentUser || !isAdmin) {
    toast("Admin access required.");
    return;
  }

  const title = $("songTitle").value.trim();
  const artist = $("songArtist").value.trim();
  const album = $("songAlbum").value.trim();
  const year = $("songYear").value.trim();
  const cover = $("coverFile").files[0];
  const audio = $("audioFile").files[0];

  if (!title || !artist || !cover || !audio) {
    toast("Complete all required fields.");
    return;
  }

  if (cover.size > 5 * 1024 * 1024) {
    toast("Cover must be 5 MB or smaller.");
    return;
  }

  if (audio.size > 50 * 1024 * 1024) {
    toast("Audio must be 50 MB or smaller.");
    return;
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(cover.type)) {
    toast("Choose a JPG, PNG or WebP cover.");
    return;
  }

  if (![
    "audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/x-wav"
  ].includes(audio.type)) {
    toast("Choose an MP3, M4A, OGG or WAV file.");
    return;
  }

  const button = $("uploadBtn");
  button.disabled = true;
  button.textContent = "Uploading…";

  const cleanName = file =>
    file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-90);

  const prefix = crypto.randomUUID();
  const coverPath = `${prefix}/${cleanName(cover)}`;
  const audioPath = `${prefix}/${cleanName(audio)}`;

  try {
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
        contentType: audio.type
      });

    if (audioUpload.error) {
      await sb.storage.from("music-covers").remove([coverPath]);
      throw audioUpload.error;
    }

    const { data: coverData } = sb.storage
      .from("music-covers")
      .getPublicUrl(coverPath);

    const insertResult = await sb.from("songs").insert({
      title,
      artist,
      album: album || null,
      year: year ? Number(year) : null,
      cover_url: coverData.publicUrl,
      cover_path: coverPath,
      audio_path: audioPath
    });

    if (insertResult.error) {
      await sb.storage.from("music-covers").remove([coverPath]);
      await sb.storage.from("music-audio").remove([audioPath]);
      throw insertResult.error;
    }

    $("uploadForm").reset();
    toast("Song uploaded successfully.");
    await loadSongs();
  } catch (error) {
    console.error(error);
    toast("Upload failed: " + (error.message || "Check Supabase settings."));
  } finally {
    button.disabled = false;
    button.textContent = "Upload song";
  }
}

$("uploadForm").addEventListener("submit", uploadSong);

/* Delete songs */
async function deleteSong(id) {
  if (!sb || !isAdmin) {
    toast("Admin access required.");
    return;
  }

  if (!confirm("Delete this song and its files?")) return;

  const song = songs.find(item => item.id === id);
  if (!song) return;

  const { error } = await sb.from("songs").delete().eq("id", id);

  if (error) {
    console.error(error);
    toast("Delete failed. Check admin permissions.");
    return;
  }

  const tasks = [];

  if (song.audio_path) {
    tasks.push(sb.storage.from("music-audio").remove([song.audio_path]));
  }

  if (song.cover_path) {
    tasks.push(sb.storage.from("music-covers").remove([song.cover_path]));
  }

  await Promise.allSettled(tasks);

  favorites = favorites.filter(item => item !== id);
  saveFavorites();

  toast("Song deleted.");
  await loadSongs();
}

/* Supabase initialization */
async function init() {
  const config = window.ZG_SUPABASE_CONFIG;

  if (
    !window.supabase ||
    !config ||
    !config.url ||
    !config.anonKey
  ) {
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

/* Installable PWA */
window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstall = event;
  $("installBtn").classList.remove("hidden");
});

$("installBtn").addEventListener("click", async () => {
  if (!deferredInstall) return;

  deferredInstall.prompt();
  await deferredInstall.userChoice;

  deferredInstall = null;
  $("installBtn").classList.add("hidden");
});

/* Service worker */
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.warn);
  });
}

init();
