
/* ZG Memory — Complete app.js */
"use strict";

let sb = null;
let currentUser = null;
let isAdmin = false;
let songs = [];
let currentView = "home";
let authMode = "signin";
let deferredInstall = null;
let currentSongId = null;

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

  return list;
}

function render() {
  if (!$("songList")) return;

  const list = visibleSongs();
  const titles = {
    home: ["YOUR COLLECTION", "All songs"],
    library: ["YOUR LIBRARY", "Music library"],
    favorites: ["SAVED FOR LATER", "Your favorites"]
  };
  const heading = titles[currentView] || titles.home;

  $("sectionEyebrow").textContent = heading[0];
  $("sectionTitle").textContent = heading[1];
  $("songCount").textContent = `${list.length} song${list.length === 1 ? "" : "s"}`;

  updateFavCount();

  $("songList").innerHTML = list.map((song, index) => `
    <article class="song-card">
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
      <button class="heart-button ${favorites.includes(String(song.id)) ? "favorited" : ""}"
        type="button" data-fav="${safeText(song.id)}"
        aria-label="Toggle favorite">
        ${favorites.includes(String(song.id)) ? "♥" : "♡"}
      </button>
    </article>
  `).join("");

  $("emptyState")?.classList.toggle("hidden", list.length > 0);
  $("songList").classList.toggle("hidden", list.length === 0);

  document.querySelectorAll("[data-view]").forEach(button => {
    button.classList.toggle("active", button.dataset.view === currentView);
  });

  $("adminCard")?.classList.toggle("hidden", !isAdmin);
  renderAdminList();
}

function renderAdminList() {
  const host = $("adminSongList");
  if (!host) return;

  if (!isAdmin) {
    host.innerHTML = "";
    return;
  }

  host.innerHTML = songs.map((song, index) => `
    <div class="admin-song-row">
      <span class="song-number">${String(index + 1).padStart(2, "0")}</span>
      <img src="${safeText(coverOf(song))}" alt=""
        onerror="this.onerror=null;this.src='./icon.svg'">
      <div class="song-copy">
        <h3>${safeText(song.title)}</h3>
        <p>${safeText(metaOf(song))}</p>
      </div>
      <button class="edit-button" type="button"
        data-edit="${safeText(song.id)}">Edit</button>
      <button class="delete-button" type="button"
        data-delete="${safeText(song.id)}">Delete</button>
    </div>
  `).join("") || '<p class="muted">No songs uploaded yet.</p>';
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
    .select("id,title,artist,album,year,cover_url,cover_path,audio_path,created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    setStatus("Could not load music. Check Supabase setup and table policies.");
    return;
  }

  songs = data || [];
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
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.addEventListener("click", async event => {
  const play = event.target.closest("[data-play]");
  if (play) {
    await playSong(play.dataset.play);
    return;
  }

  const fav = event.target.closest("[data-fav]");
  if (fav) {
    const id = String(fav.dataset.fav);
    favorites = favorites.includes(id)
      ? favorites.filter(item => item !== id)
      : [...favorites, id];
    saveFavorites();
    render();
    return;
  }

  const edit = event.target.closest("[data-edit]");
  if (edit) {
    await editSong(edit.dataset.edit);
    return;
  }

  const del = event.target.closest("[data-delete]");
  if (del) {
    await deleteSong(del.dataset.delete);
    return;
  }

  const view = event.target.closest("[data-view]");
  if (view) setView(view.dataset.view);
});

$("searchInput")?.addEventListener("input", render);

$("clearSearch")?.addEventListener("click", () => {
  $("searchInput").value = "";
  render();
  $("searchInput").focus();
});

$("headerFav")?.addEventListener("click", () => setView("favorites"));

$("searchNav")?.addEventListener("click", () => {
  $("searchInput").focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

/* Profile and authentication */
function openProfile() {
  $("profileCard")?.scrollIntoView({ behavior: "smooth", block: "center" });
  if (!currentUser) openAuth();
}

$("profileTop")?.addEventListener("click", openProfile);
$("profileNav")?.addEventListener("click", openProfile);

$("profileAction")?.addEventListener("click", () => {
  if (currentUser) signOut();
  else openAuth();
});

function openAuth() {
  if (!sb) {
    toast("Check Supabase setup in config.js.");
    return;
  }
  $("authMessage").textContent = "";
  $("authDialog").showModal();
}

$("toggleAuth")?.addEventListener("click", () => {
  authMode = authMode === "signin" ? "signup" : "signin";
  $("authTitle").textContent = authMode === "signin" ? "Sign in" : "Create account";
  $("authSubmit").textContent = authMode === "signin" ? "Sign in" : "Sign up";
  $("toggleAuth").textContent = authMode === "signin"
    ? "Need an account? Sign up"
    : "Already registered? Sign in";
  $("authPassword").autocomplete =
    authMode === "signin" ? "current-password" : "new-password";
  $("authMessage").textContent = "";
});

$("authForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!sb) return;

  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;
  $("authSubmit").disabled = true;
  $("authMessage").textContent = "Please wait…";

  try {
    const result = authMode === "signin"
      ? await sb.auth.signInWithPassword({ email, password })
      : await sb.auth.signUp({ email, password });

    if (result.error) {
      $("authMessage").textContent = result.error.message;
      return;
    }

    if (authMode === "signup" && !result.data.session) {
      $("authMessage").textContent =
        "Check your email to confirm the account, then sign in.";
      return;
    }

    $("authDialog").close();
    toast("Signed in successfully.");
    await refreshSession();
  } catch (error) {
    $("authMessage").textContent = error.message || "Authentication failed.";
  } finally {
    $("authSubmit").disabled = false;
  }
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
    const { data: admin, error } = await sb.from("admin_users")
      .select("user_id")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    isAdmin = !!admin && !error;
    $("profileTitle").textContent = currentUser.email || "Your profile";
    $("profileText").textContent = isAdmin
      ? "Signed in as administrator. You can manage songs."
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
  const yearText = $("songYear").value.trim();
  const cover = $("coverFile").files[0];
  const audio = $("audioFile").files[0];

  if (!title || !artist || !cover || !audio) {
    toast("Complete all required fields.");
    return;
  }

  if (cover.size > 5 * 1024 * 1024 || audio.size > 50 * 1024 * 1024) {
    toast("Cover limit: 5 MB. Audio limit: 50 MB.");
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
  button.disabled = true;
  button.textContent = "Uploading…";

  const cleanName = file =>
    file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-90);

  const prefix = crypto.randomUUID();
  const coverPath = `${prefix}/${cleanName(cover)}`;
  const audioPath = `${prefix}/${cleanName(audio)}`;

  try {
    const coverUpload = await sb.storage.from("music-covers")
      .upload(coverPath, cover, { upsert: false, contentType: cover.type });
    if (coverUpload.error) throw coverUpload.error;

    const audioUpload = await sb.storage.from("music-audio")
      .upload(audioPath, audio, { upsert: false, contentType: audio.type || "audio/mpeg" });

    if (audioUpload.error) {
      await sb.storage.from("music-covers").remove([coverPath]);
      throw audioUpload.error;
    }

    const { data: coverData } = sb.storage.from("music-covers").getPublicUrl(coverPath);

    const result = await sb.from("songs").insert({
      title,
      artist,
      album: album || null,
      year,
      cover_url: coverData.publicUrl,
      cover_path: coverPath,
      audio_path: audioPath
    });

    if (result.error) {
      await sb.storage.from("music-covers").remove([coverPath]);
      await sb.storage.from("music-audio").remove([audioPath]);
      throw result.error;
    }

    $("uploadForm").reset();
    toast("Song uploaded successfully.");
    await loadSongs();
  } catch (error) {
    console.error(error);
    toast("Upload failed: " + (error.message || "Check Supabase policies."));
  } finally {
    button.disabled = false;
    button.textContent = "Upload song";
  }
}

$("uploadForm")?.addEventListener("submit", uploadSong);

/* Admin edit song details and optional cover */
async function editSong(id) {
  if (!sb || !isAdmin) {
    toast("Admin access required.");
    return;
  }

  const song = songs.find(item => String(item.id) === String(id));
  if (!song) return;

  const title = prompt("Song title:", song.title || "");
  if (title === null) return;
  const artist = prompt("Artist / singer:", song.artist || "");
  if (artist === null) return;
  const album = prompt("Album:", song.album || "");
  if (album === null) return;
  const yearText = prompt("Year:", song.year || "");
  if (yearText === null) return;

  if (!title.trim() || !artist.trim()) {
    toast("Title and artist are required.");
    return;
  }

  const year = yearText.trim() ? Number(yearText.trim()) : null;
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

  if (!confirm("Change this song's cover image too?")) return;

  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = "image/jpeg,image/png,image/webp";

  picker.onchange = async () => {
    const file = picker.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast("Cover must be 5 MB or smaller.");
      return;
    }

    const path = `${crypto.randomUUID()}/${file.name
      .toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-90)}`;

    const upload = await sb.storage.from("music-covers").upload(path, file, {
      upsert: false,
      contentType: file.type
    });

    if (upload.error) {
      toast("Cover upload failed: " + upload.error.message);
      return;
    }

    const { data } = sb.storage.from("music-covers").getPublicUrl(path);
    const update = await sb.from("songs").update({
      cover_url: data.publicUrl,
      cover_path: path
    }).eq("id", song.id);

    if (update.error) {
      await sb.storage.from("music-covers").remove([path]);
      toast("Could not save cover: " + update.error.message);
      return;
    }

    if (song.cover_path) {
      await sb.storage.from("music-covers").remove([song.cover_path]);
    }

    toast("Cover updated.");
    await loadSongs();
  };

  picker.click();
}

/* Delete songs */
async function deleteSong(id) {
  if (!sb || !isAdmin) {
    toast("Admin access required.");
    return;
  }
  if (!confirm("Delete this song and its files?")) return;

  const song = songs.find(item => String(item.id) === String(id));
  if (!song) return;

  const { error } = await sb.from("songs").delete().eq("id", song.id);
  if (error) {
    toast("Delete failed: " + error.message);
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

  favorites = favorites.filter(item => item !== String(id));
  saveFavorites();

  if (String(currentSongId) === String(id)) {
    $("audio").pause();
    $("miniPlayer").classList.add("hidden");
    currentSongId = null;
  }

  toast("Song deleted.");
  await loadSongs();
}

/* Supabase setup */
async function init() {
  const config = window.ZG_SUPABASE_CONFIG;

  if (!window.supabase || !config?.url || !config?.anonKey) {
    setStatus("Setup needed: check config.js.");
    render();
    return;
  }

  try {
    sb = window.supabase.createClient(config.url, config.anonKey);
    sb.auth.onAuthStateChange(() => setTimeout(refreshSession, 0));
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
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.warn);
  });
}

init();
