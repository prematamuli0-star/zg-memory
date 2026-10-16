
/* ZG Memory PWA. Configure Supabase values in config.js before use. */
let sb = null, currentUser = null, isAdmin = false, songs = [], currentView = "home", authMode = "signin", deferredInstall = null;
const $ = id => document.getElementById(id);
const FAV_KEY = "zg-memory-favorites-v1";
let favorites = readFavorites();

function readFavorites(){try{return JSON.parse(localStorage.getItem(FAV_KEY)||"[]")}catch{return []}}
function saveFavorites(){localStorage.setItem(FAV_KEY,JSON.stringify(favorites));updateFavCount()}
function updateFavCount(){$("favCount").textContent=favorites.length;$("favTabCount").textContent=favorites.length}
function toast(message){const t=$("toast");t.textContent=message;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2600)}
function setStatus(message){$("status").textContent=message}
function safeText(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function fallbackCover(){return "./icon.svg"}
function coverOf(s){return s.cover_url||fallbackCover()}
function artistOf(s){return s.artist||"Unknown artist"}
function metaOf(s){return [artistOf(s),s.album,s.year].filter(Boolean).join(" • ")}

function visibleSongs(){
  const q=$("searchInput").value.trim().toLowerCase();
  let list=songs.filter(s=>[s.title,s.artist,s.album,s.year].filter(Boolean).join(" ").toLowerCase().includes(q));
  if(currentView==="favorites")list=list.filter(s=>favorites.includes(s.id));
  return list;
}

function render(){
  const list=visibleSongs(), host=$("songList");
  updateFavCount();

  const titles={
    home:["YOUR COLLECTION","All songs"],
    library:["YOUR LIBRARY","Music library"],
    favorites:["SAVED FOR LATER","Your favorites"]
  };

  $("sectionEyebrow").textContent=titles[currentView][0];
  $("sectionTitle").textContent=titles[currentView][1];
  $("songCount").textContent=`${list.length} song${list.length===1?"":"s"}`;

  host.innerHTML=list.map((s,i)=>`
    <article class="song-card">
      <span class="song-number" style="display:inline-flex;align-items:center;justify-content:center;min-width:30px;margin-right:8px;color:#d9b56f;font-weight:700;font-size:16px">
        ${String(i+1).padStart(2,"0")}
      </span>
      <button class="song-main" type="button" data-play="${safeText(s.id)}" aria-label="Play ${safeText(s.title)}">
        <img class="song-cover" src="${safeText(coverOf(s))}" alt="" loading="lazy" onerror="this.src='./icon.svg'">
        <span class="song-copy">
          <h3>${safeText(s.title)}</h3>
          <p>${safeText(metaOf(s))}</p>
        </span>
      </button>
      <button class="play-button" type="button" data-play="${safeText(s.id)}" aria-label="Play">▶</button>
      <button class="heart-button ${favorites.includes(s.id)?"favorited":""}" type="button" data-fav="${safeText(s.id)}" aria-label="Toggle favorite">
        ${favorites.includes(s.id)?"♥":"♡"}
      </button>
    </article>`).join("");

  $("emptyState").classList.toggle("hidden",list.length!==0);
  $("songList").classList.toggle("hidden",list.length===0);
  document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===currentView));
  $("adminCard").classList.toggle("hidden",!isAdmin);
  renderAdminList();
}

function renderAdminList(){
  const el=$("adminSongList");
  if(!isAdmin){el.innerHTML="";return}

  el.innerHTML=songs.map((s,i)=>`
    <div class="admin-song-row">
      <span style="color:#d9b56f;font-weight:700;min-width:24px">${String(i+1).padStart(2,"0")}</span>
      <img src="${safeText(coverOf(s))}" alt="" onerror="this.src='./icon.svg'">
      <div class="song-copy">
        <h3>${safeText(s.title)}</h3>
        <p>${safeText(metaOf(s))}</p>
      </div>
      <button class="delete-button" data-delete="${safeText(s.id)}" type="button">Delete</button>
    </div>`).join("")||'<p class="muted">No songs uploaded yet.</p>';
}

async function loadSongs(){
  if(!sb){
    setStatus("Setup needed: add your Supabase project URL and anon/publishable key in config.js.");
    render();
    return;
  }

  setStatus("Loading music…");
  const {data,error}=await sb.from("songs")
    .select("id,title,artist,album,year,cover_url,audio_path,cover_path,created_at")
    .order("created_at",{ascending:false});

  if(error){
    setStatus("Could not load music. Check Supabase setup and table policies.");
    console.error(error);
    songs=[];
  }else{
    songs=data||[];
    setStatus(songs.length?"Tap a song to listen.":"Your collection is ready for its first song.");
  }
  render();
}

async function playSong(id){
  const s=songs.find(x=>x.id===id);
  if(!s)return;

  if(!sb||!s.audio_path){
    toast("This song has no audio file yet.");
    return;
  }

  const {data}=sb.storage.from("music-audio").getPublicUrl(s.audio_path);
  $("playerCover").src=coverOf(s);
  $("playerTitle").textContent=s.title;
  $("playerArtist").textContent=metaOf(s);

  const audio=$("audio");
  audio.src=data.publicUrl;
  $("miniPlayer").classList.remove("hidden");

  try{await audio.play()}
  catch{toast("Tap Play in the audio controls to start.")}
}

function setView(view){
  currentView=view;
  render();
  window.scrollTo({top:0,behavior:"smooth"});
}

document.addEventListener("click",async e=>{
  const play=e.target.closest("[data-play]");
  if(play){playSong(play.dataset.play);return}

  const fav=e.target.closest("[data-fav]");
  if(fav){
    const id=fav.dataset.fav;
    favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];
    saveFavorites();
    render();
    return;
  }

  const del=e.target.closest("[data-delete]");
  if(del){await deleteSong(del.dataset.delete);return}

  const view=e.target.closest("[data-view]");
  if(view){setView(view.dataset.view);return}
});

$("searchInput").addEventListener("input",render);
$("clearSearch").addEventListener("click",()=>{
  $("searchInput").value="";
  render();
  $("searchInput").focus();
});
$("headerFav").addEventListener("click",()=>setView("favorites"));
$("searchNav").addEventListener("click",()=>{
  $("searchInput").focus();
  window.scrollTo({top:0,behavior:"smooth"});
});
$("profileTop").addEventListener("click",()=>openProfile());
$("profileNav").addEventListener("click",()=>openProfile());
$("profileAction").addEventListener("click",()=>currentUser?signOut():openAuth());
$("closePlayer").addEventListener("click",()=>{
  $("audio").pause();
  $("miniPlayer").classList.add("hidden");
});

function openProfile(){
  document.querySelector("#profileCard").scrollIntoView({behavior:"smooth",block:"center"});
  if(!currentUser)openAuth();
}

function openAuth(){
  if(!sb){toast("First complete Supabase setup.");return}
  $("authMessage").textContent="";
  $("authDialog").showModal();
}

$("toggleAuth").addEventListener("click",()=>{
  authMode=authMode==="signin"?"signup":"signin";
  $("authTitle").textContent=authMode==="signin"?"Sign in":"Create account";
  $("authSubmit").textContent=authMode==="signin"?"Sign in":"Sign up";
  $("toggleAuth").textContent=authMode==="signin"?"Need an account? Sign up":"Already registered? Sign in";
  $("authPassword").autocomplete=authMode==="signin"?"current-password":"new-password";
  $("authMessage").textContent="";
});

$("authForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(!sb)return;

  const email=$("authEmail").value.trim();
  const password=$("authPassword").value;

  $("authSubmit").disabled=true;
  $("authMessage").textContent="Please wait…";

  let result=authMode==="signin"
    ?await sb.auth.signInWithPassword({email,password})
    :await sb.auth.signUp({email,password});

  $("authSubmit").disabled=false;

  if(result.error){
    $("authMessage").textContent=result.error.message;
    return;
  }

  if(authMode==="signup"&&!result.data.session){
    $("authMessage").textContent="Check your email to confirm the account, then sign in.";
    return;
  }

  $("authDialog").close();
  toast("Signed in.");
  await refreshSession();
});

async function signOut(){
  if(!sb)return;
  await sb.auth.signOut();
  toast("Signed out.");
  await refreshSession();
}

async function refreshSession(){
  if(!sb)return;

  const {data}=await sb.auth.getSession();
  currentUser=data.session?.user||null;
  isAdmin=false;

  if(currentUser){
    const {data:row,error}=await sb.from("admin_users")
      .select("user_id").eq("user_id",currentUser.id).maybeSingle();

    isAdmin=!!row&&!error;
    $("profileTitle").textContent=currentUser.email||"Your profile";
    $("profileText").textContent=isAdmin
      ?"Signed in as administrator. You can upload and delete songs."
      :"Signed in. Favorites are saved on this device.";
    $("profileAction").textContent="Sign out";
  }else{
    $("profileTitle").textContent="Profile";
    $("profileText").textContent="Sign in to access your profile. Favorites are saved on this device.";
    $("profileAction").textContent="Sign in";
  }

  render();
}

async function uploadSong(e){
  e.preventDefault();

  if(!sb||!currentUser||!isAdmin){
    toast("Admin access required.");
    return;
  }

  const title=$("songTitle").value.trim();
  const artist=$("songArtist").value.trim();
  const album=$("songAlbum").value.trim();
  const year=$("songYear").value.trim();
  const cover=$("coverFile").files[0];
  const audio=$("audioFile").files[0];

  if(!title||!artist||!cover||!audio){
    toast("Complete all required fields.");
    return;
  }
  if(cover.size>5*1024*1024){toast("Cover must be 5 MB or smaller.");return}
  if(audio.size>50*1024*1024){toast("Audio must be 50 MB or smaller.");return}

  const allowedCover=["image/jpeg","image/png","image/webp"];
  const allowedAudio=["audio/mpeg","audio/mp4","audio/ogg","audio/wav","audio/x-wav"];

  if(!allowedCover.includes(cover.type)){
    toast("Choose a JPG, PNG or WebP cover.");
    return;
  }
  if(!allowedAudio.includes(audio.type)){
    toast("Choose an MP3, M4A, OGG or WAV file.");
    return;
  }

  const btn=$("uploadBtn");
  btn.disabled=true;
  btn.textContent="Uploading…";

  const cleanName=f=>f.name.toLowerCase().replace(/[^a-z0-9._-]+/g,"-").slice(-90);
  const prefix=crypto.randomUUID();
  const coverPath=`${prefix}/${cleanName(cover)}`;
  const audioPath=`${prefix}/${cleanName(audio)}`;

  try{
    let {error:ce}=await sb.storage.from("music-covers")
      .upload(coverPath,cover,{upsert:false,contentType:cover.type});
    if(ce)throw ce;

    let {error:ae}=await sb.storage.from("music-audio")
      .upload(audioPath,audio,{upsert:false,contentType:audio.type});

    if(ae){
      await sb.storage.from("music-covers").remove([coverPath]);
      throw ae;
    }

    const {data:coverData}=sb.storage.from("music-covers").getPublicUrl(coverPath);

    const {error:dbError}=await sb.from("songs").insert({
      title,
      artist,
      album:album||null,
      year:year?Number(year):null,
      cover_url:coverData.publicUrl,
      cover_path:coverPath,
      audio_path:audioPath
    });

    if(dbError){
      await sb.storage.from("music-covers").remove([coverPath]);
      await sb.storage.from("music-audio").remove([audioPath]);
      throw dbError;
    }

    $("uploadForm").reset();
    toast("Song uploaded successfully.");
    await loadSongs();
  }catch(err){
    console.error(err);
    toast("Upload failed: "+(err.message||"check Supabase setup and storage policies"));
  }finally{
    btn.disabled=false;
    btn.textContent="Upload song";
  }
}

async function deleteSong(id){
  if(!sb||!isAdmin||!confirm("Delete this song and its files?"))return;

  const s=songs.find(x=>x.id===id);
  if(!s)return;

  const {error}=await sb.from("songs").delete().eq("id",id);
  if(error){
    toast("Delete failed. Check admin permissions.");
    console.error(error);
    return;
  }

  const files=[];
  if(s.audio_path)files.push(sb.storage.from("music-audio").remove([s.audio_path]));
  if(s.cover_path)files.push(sb.storage.from("music-covers").remove([s.cover_path]));

  await Promise.allSettled(files);
  favorites=favorites.filter(x=>x!==id);
  saveFavorites();
  toast("Song deleted.");
  await loadSongs();
}

$("uploadForm").addEventListener("submit",uploadSong);

async function init(){
  if(!window.supabase||!window.ZG_SUPABASE_CONFIG||!window.ZG_SUPABASE_CONFIG.url||!window.ZG_SUPABASE_CONFIG.anonKey){
    await loadSongs();
    return;
  }

  try{
    sb=window.supabase.createClient(window.ZG_SUPABASE_CONFIG.url,window.ZG_SUPABASE_CONFIG.anonKey);
    sb.auth.onAuthStateChange(()=>{setTimeout(refreshSession,0)});
    await refreshSession();
    await loadSongs();
  }catch(e){
    console.error(e);
    setStatus("Could not initialize Supabase. Check config.js.");
  }
}

window.addEventListener("beforeinstallprompt",e=>{
  e.preventDefault();
  deferredInstall=e;
  $("installBtn").classList.remove("hidden");
});

$("installBtn").addEventListener("click",async()=>{
  if(!deferredInstall)return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall=null;
  $("installBtn").classList.add("hidden");
});

if("serviceWorker" in navigator && location.protocol.startsWith("http")){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(console.warn));
}

init();
