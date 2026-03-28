import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

/* =========================
   1) FIREBASE CONFIG
========================= */
const firebaseConfig = {
  apiKey: "AIzaSyApLzuy67AF3CzxvEgZWeFTu6hYtnaSfN8",
  authDomain: "french-lesson-117de.firebaseapp.com",
  projectId: "french-lesson-117de",
  storageBucket: "french-lesson-117de.firebasestorage.app",
  messagingSenderId: "1005222773906",
  appId: "1:1005222773906:web:4d150b23b70daaede3d24b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

/* =========================
   2) DOM REFERENCES
========================= */
const wordsTab = document.getElementById("wordsTab");
const sentencesTab = document.getElementById("sentencesTab");

const entryForm = document.getElementById("entryForm");
const formTitle = document.getElementById("formTitle");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const saveBtn = document.getElementById("saveBtn");

const editingId = document.getElementById("editingId");
const authorInput = document.getElementById("authorInput");
const frenchInput = document.getElementById("frenchInput");
const meaningInput = document.getElementById("meaningInput");
const categoryInput = document.getElementById("categoryInput");
const exampleInput = document.getElementById("exampleInput");
const exampleField = document.getElementById("exampleField");

const authNotice = document.getElementById("authNotice");
const signInBtn = document.getElementById("signInBtn");
const signOutBtn = document.getElementById("signOutBtn");
const userInfo = document.getElementById("userInfo");
const userAvatar = document.getElementById("userAvatar");
const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");

const entries = document.getElementById("entries");
const searchInput = document.getElementById("searchInput");
const statusLine = document.getElementById("statusLine");

const wordCount = document.getElementById("wordCount");
const sentenceCount = document.getElementById("sentenceCount");
const visibleCount = document.getElementById("visibleCount");

const roomName = document.getElementById("roomName");
const copyRoomBtn = document.getElementById("copyRoomBtn");

const showAnswerBtn = document.getElementById("showAnswerBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const markKnownBtn = document.getElementById("markKnownBtn");
const markHardBtn = document.getElementById("markHardBtn");
const studySpeakBtn = document.getElementById("studySpeakBtn");
const shuffleToggle = document.getElementById("shuffleToggle");
const hardOnlyToggle = document.getElementById("hardOnlyToggle");

const studyFrench = document.getElementById("studyFrench");
const studyMeaning = document.getElementById("studyMeaning");
const studyExtra = document.getElementById("studyExtra");
const studyAnswer = document.getElementById("studyAnswer");
const knownCount = document.getElementById("knownCount");
const hardCount = document.getElementById("hardCount");
const queueCount = document.getElementById("queueCount");

/* =========================
   3) APP STATE
========================= */
let currentUser = null;
let currentTab = "words";
let allEntries = [];
let unsubscribe = null;

let studyQueue = [];
let studyIndex = 0;

/* =========================
   4) ROOM FROM URL
========================= */
const params = new URLSearchParams(window.location.search);
const currentRoom = (params.get("room") || "default-room").trim();
roomName.textContent = currentRoom;

/* =========================
   5) LOCAL HELPERS
========================= */
function getProgressKey() {
  const uid = currentUser?.uid || "guest";
  return `french_progress_${currentRoom}_${uid}`;
}

function getStudyProgress() {
  try {
    return JSON.parse(localStorage.getItem(getProgressKey())) || {};
  } catch {
    return {};
  }
}

function saveStudyProgress(progress) {
  localStorage.setItem(getProgressKey(), JSON.stringify(progress));
}

function setEntryStatus(entryId, status) {
  const progress = getStudyProgress();
  progress[entryId] = status;
  saveStudyProgress(progress);
  rebuildStudyQueue();
  renderStudyCard();
}

function getEntryStatus(entryId) {
  const progress = getStudyProgress();
  return progress[entryId] || "";
}

function defaultAuthorName() {
  return currentUser?.displayName || "";
}

/* =========================
   6) FIRESTORE COLLECTION
========================= */
function getEntriesCollection() {
  return collection(db, "rooms", currentRoom, "entries");
}

/* =========================
   7) AUTH
========================= */
async function handleSignIn() {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error(error);
    alert("Could not sign in.");
  }
}

async function handleSignOut() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error(error);
    alert("Could not sign out.");
  }
}

function updateAuthUI() {
  const signedIn = !!currentUser;

  signInBtn.classList.toggle("hidden", signedIn);
  signOutBtn.classList.toggle("hidden", !signedIn);
  userInfo.classList.toggle("hidden", !signedIn);

  if (signedIn) {
    userAvatar.src = currentUser.photoURL || "";
    userName.textContent = currentUser.displayName || "Signed in";
    userEmail.textContent = currentUser.email || "";
    authorInput.value = authorInput.value || defaultAuthorName();
    authNotice.textContent = "You can add, edit, and delete only your own entries.";
  } else {
    userAvatar.src = "";
    userName.textContent = "";
    userEmail.textContent = "";
    authorInput.value = "";
    authNotice.textContent = "Sign in to add, edit, or delete your own items.";
  }
}

onAuthStateChanged(auth, (user) => {
  currentUser = user || null;
  updateAuthUI();
  rebuildStudyQueue();
  renderEntries();
  renderStudyCard();
});

/* =========================
   8) REALTIME LISTENER
========================= */
function startRealtimeListener() {
  if (unsubscribe) unsubscribe();

  statusLine.textContent = "Connecting...";

  const q = query(getEntriesCollection(), orderBy("createdAt", "desc"));

  unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      allEntries = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data()
      }));

      statusLine.textContent = `Live sync active • ${allEntries.length} total item(s) in this room`;
      rebuildStudyQueue();
      renderEntries();
      renderStudyCard();
    },
    (error) => {
      console.error(error);
      statusLine.textContent = "Could not load data. Check Firebase config, Auth setup, and Firestore rules.";
    }
  );
}

/* =========================
   9) HELPERS
========================= */
function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setTab(tab) {
  currentTab = tab;
  clearEditingState();

  wordsTab.classList.toggle("active", tab === "words");
  sentencesTab.classList.toggle("active", tab === "sentences");

  formTitle.textContent = tab === "words" ? "Add a word" : "Add a sentence";
  exampleField.classList.toggle("hidden", tab !== "words");
  frenchInput.placeholder = tab === "words" ? "French word" : "French sentence";

  searchInput.dispatchEvent(new Event("input"));
}

function isOwner(item) {
  return !!currentUser && item.userId === currentUser.uid;
}

function getFilteredItems() {
  const queryText = searchInput.value.toLowerCase().trim();
  const targetType = currentTab === "words" ? "word" : "sentence";

  return allEntries.filter((item) => {
    if (item.type !== targetType) return false;

    const blob = [
      item.french || "",
      item.meaning || "",
      item.category || "",
      item.example || "",
      item.author || ""
    ]
      .join(" ")
      .toLowerCase();

    return blob.includes(queryText);
  });
}

function getWordCount() {
  return allEntries.filter((item) => item.type === "word").length;
}

function getSentenceCount() {
  return allEntries.filter((item) => item.type === "sentence").length;
}

/* =========================
   10) SPEAK
========================= */
function speakFrench(text) {
  if (!text || !text.trim()) return;

  if (!("speechSynthesis" in window)) {
    alert("Your browser does not support voice playback.");
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  utterance.rate = 0.9;
  utterance.pitch = 1;

  const voices = window.speechSynthesis.getVoices();
  const frenchVoice =
    voices.find((voice) => voice.lang && voice.lang.toLowerCase().startsWith("fr")) || null;

  if (frenchVoice) utterance.voice = frenchVoice;

  window.speechSynthesis.speak(utterance);
}

if ("speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

/* =========================
   11) RENDER ENTRIES
========================= */
function renderEntries() {
  const filtered = getFilteredItems();
  entries.innerHTML = "";

  wordCount.textContent = getWordCount();
  sentenceCount.textContent = getSentenceCount();
  visibleCount.textContent = filtered.length;

  if (!filtered.length) {
    entries.innerHTML = `<div class="empty">No items found in this tab yet.</div>`;
    return;
  }

  filtered.forEach((item) => {
    const status = getEntryStatus(item.id);
    const statusTag = status
      ? `<span class="tag tag-category">${status === "known" ? "Known" : "Hard"}</span>`
      : "";

    const extraHtml =
      item.type === "word" && item.example
        ? `<div class="entry-extra"><p class="muted small">Example</p><p>${escapeHtml(item.example)}</p></div>`
        : "";

    const ownerActions = isOwner(item)
      ? `
        <button class="edit-btn" data-edit-id="${item.id}">Edit</button>
        <button class="delete-btn" data-delete-id="${item.id}">Delete</button>
      `
      : "";

    const card = document.createElement("div");
    card.className = "entry-card";
    card.innerHTML = `
      <div class="entry-top">
        <div class="entry-main">
          <h4>${escapeHtml(item.french)}</h4>
          <p>${escapeHtml(item.meaning)}</p>
          <div class="meta">
            <span class="tag tag-type">${item.type === "word" ? "Word" : "Sentence"}</span>
            ${item.category ? `<span class="tag tag-category">${escapeHtml(item.category)}</span>` : ""}
            <span class="tag tag-author">By ${escapeHtml(item.author || "anonymous")}</span>
            ${statusTag}
          </div>
          ${extraHtml}
        </div>

        <div class="entry-actions">
          <button class="listen-btn" data-speak="${escapeHtml(item.french)}">🔊 Listen</button>
          ${ownerActions}
        </div>
      </div>
    `;

    entries.appendChild(card);
  });

  document.querySelectorAll("[data-speak]").forEach((button) => {
    button.addEventListener("click", () => {
      speakFrench(button.dataset.speak);
    });
  });

  document.querySelectorAll("[data-edit-id]").forEach((button) => {
    button.addEventListener("click", () => {
      startEditing(button.dataset.editId);
    });
  });

  document.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await deleteEntry(button.dataset.deleteId);
    });
  });
}

/* =========================
   12) EDITING
========================= */
function startEditing(id) {
  const item = allEntries.find((entry) => entry.id === id);
  if (!item || !isOwner(item)) return;

  currentTab = item.type === "word" ? "words" : "sentences";
  wordsTab.classList.toggle("active", currentTab === "words");
  sentencesTab.classList.toggle("active", currentTab === "sentences");

  formTitle.textContent = item.type === "word" ? "Edit word" : "Edit sentence";
  exampleField.classList.toggle("hidden", item.type !== "word");
  frenchInput.placeholder = item.type === "word" ? "French word" : "French sentence";

  editingId.value = item.id;
  authorInput.value = item.author || defaultAuthorName();
  frenchInput.value = item.french || "";
  meaningInput.value = item.meaning || "";
  categoryInput.value = item.category || "";
  exampleInput.value = item.example || "";

  saveBtn.textContent = "Update";
  cancelEditBtn.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clearEditingState() {
  editingId.value = "";
  entryForm.reset();
  formTitle.textContent = currentTab === "words" ? "Add a word" : "Add a sentence";
  saveBtn.textContent = "Save";
  cancelEditBtn.classList.add("hidden");
  if (currentUser) authorInput.value = defaultAuthorName();
}

async function deleteEntry(id) {
  const item = allEntries.find((entry) => entry.id === id);
  if (!item || !isOwner(item)) return;

  try {
    await deleteDoc(doc(db, "rooms", currentRoom, "entries", id));
    if (editingId.value === id) clearEditingState();
  } catch (error) {
    console.error(error);
    alert("Could not delete this item.");
  }
}

/* =========================
   13) SAVE / UPDATE ENTRY
========================= */
entryForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUser) {
    alert("Please sign in first.");
    return;
  }

  const type = currentTab === "words" ? "word" : "sentence";

  const payload = {
    type,
    french: frenchInput.value.trim(),
    meaning: meaningInput.value.trim(),
    category: categoryInput.value.trim(),
    example: type === "word" ? exampleInput.value.trim() : "",
    author: authorInput.value.trim() || defaultAuthorName() || "anonymous",
    userId: currentUser.uid,
    userEmail: currentUser.email || "",
    updatedAt: serverTimestamp()
  };

  if (!payload.french || !payload.meaning) return;

  try {
    if (editingId.value) {
      const existing = allEntries.find((entry) => entry.id === editingId.value);
      if (!existing || !isOwner(existing)) {
        alert("You can only edit your own entries.");
        return;
      }

      await updateDoc(doc(db, "rooms", currentRoom, "entries", editingId.value), payload);
    } else {
      await addDoc(getEntriesCollection(), {
        ...payload,
        createdAt: serverTimestamp()
      });
    }

    clearEditingState();
  } catch (error) {
    console.error(error);
    alert("Could not save this entry.");
  }
});

/* =========================
   14) STUDY MODE
========================= */
function rebuildStudyQueue() {
  const filtered = getFilteredItems();
  const progress = getStudyProgress();

  let queue = filtered;

  if (hardOnlyToggle.checked) {
    queue = queue.filter((item) => progress[item.id] === "hard");
  }

  if (shuffleToggle.checked) {
    queue = [...queue];
    for (let i = queue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
  }

  studyQueue = queue;
  if (studyIndex >= studyQueue.length) studyIndex = 0;

  renderStudyStats();
}

function renderStudyStats() {
  const progress = getStudyProgress();
  const currentTabType = currentTab === "words" ? "word" : "sentence";
  const relevant = allEntries.filter((item) => item.type === currentTabType);

  knownCount.textContent = relevant.filter((item) => progress[item.id] === "known").length;
  hardCount.textContent = relevant.filter((item) => progress[item.id] === "hard").length;
  queueCount.textContent = studyQueue.length;
}

function renderStudyCard() {
  if (!studyQueue.length) {
    studyFrench.textContent = hardOnlyToggle.checked
      ? "No hard items yet"
      : "No items yet";
    studyMeaning.textContent = "";
    studyExtra.innerHTML = "";
    studyAnswer.classList.add("hidden");
    return;
  }

  const item = studyQueue[studyIndex];
  const status = getEntryStatus(item.id);

  studyFrench.textContent = item.french || "";
  studyMeaning.textContent = item.meaning || "";
  studyExtra.innerHTML = `
    ${item.category ? `<div class="entry-extra"><p class="muted small">Category</p><p>${escapeHtml(item.category)}</p></div>` : ""}
    ${item.example ? `<div class="entry-extra"><p class="muted small">Example</p><p>${escapeHtml(item.example)}</p></div>` : ""}
    ${item.author ? `<div class="entry-extra"><p class="muted small">Added by</p><p>${escapeHtml(item.author)}</p></div>` : ""}
    ${status ? `<div class="entry-extra"><p class="muted small">Your status</p><p>${status === "known" ? "Known" : "Hard"}</p></div>` : ""}
  `;
}

function moveStudy(step) {
  if (!studyQueue.length) return;
  studyIndex = (studyIndex + step + studyQueue.length) % studyQueue.length;
  studyAnswer.classList.add("hidden");
  renderStudyCard();
}

/* =========================
   15) EVENTS
========================= */
signInBtn.addEventListener("click", handleSignIn);
signOutBtn.addEventListener("click", handleSignOut);

wordsTab.addEventListener("click", () => {
  currentTab = "words";
  setTab("words");
});

sentencesTab.addEventListener("click", () => {
  currentTab = "sentences";
  setTab("sentences");
});

cancelEditBtn.addEventListener("click", clearEditingState);

searchInput.addEventListener("input", () => {
  studyIndex = 0;
  studyAnswer.classList.add("hidden");
  rebuildStudyQueue();
  renderEntries();
  renderStudyCard();
});

shuffleToggle.addEventListener("change", () => {
  studyIndex = 0;
  rebuildStudyQueue();
  renderStudyCard();
});

hardOnlyToggle.addEventListener("change", () => {
  studyIndex = 0;
  rebuildStudyQueue();
  renderStudyCard();
});

showAnswerBtn.addEventListener("click", () => {
  studyAnswer.classList.remove("hidden");
});

prevBtn.addEventListener("click", () => moveStudy(-1));
nextBtn.addEventListener("click", () => moveStudy(1));

markKnownBtn.addEventListener("click", () => {
  if (!studyQueue.length) return;
  setEntryStatus(studyQueue[studyIndex].id, "known");
});

markHardBtn.addEventListener("click", () => {
  if (!studyQueue.length) return;
  setEntryStatus(studyQueue[studyIndex].id, "hard");
});

studySpeakBtn.addEventListener("click", () => {
  if (!studyQueue.length) return;
  speakFrench(studyQueue[studyIndex].french || "");
});

copyRoomBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    copyRoomBtn.textContent = "Link copied";
    setTimeout(() => {
      copyRoomBtn.textContent = "Copy room link";
    }, 1400);
  } catch {
    alert("Could not copy the link.");
  }
});

/* =========================
   16) START
========================= */
setTab("words");
startRealtimeListener();
renderEntries();
rebuildStudyQueue();
renderStudyCard();
