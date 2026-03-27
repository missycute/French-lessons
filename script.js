import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

/* =========================
   1) FIREBASE CONFIG
   Replace with your own
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

/* =========================
   2) DOM REFERENCES
========================= */
const wordsTab = document.getElementById("wordsTab");
const sentencesTab = document.getElementById("sentencesTab");

const wordForm = document.getElementById("wordForm");
const sentenceForm = document.getElementById("sentenceForm");

const authorInput = document.getElementById("authorInput");

const wordFrench = document.getElementById("wordFrench");
const wordMeaning = document.getElementById("wordMeaning");
const wordCategory = document.getElementById("wordCategory");
const wordExample = document.getElementById("wordExample");

const sentenceFrench = document.getElementById("sentenceFrench");
const sentenceMeaning = document.getElementById("sentenceMeaning");
const sentenceCategory = document.getElementById("sentenceCategory");

const entries = document.getElementById("entries");
const searchInput = document.getElementById("searchInput");

const wordCount = document.getElementById("wordCount");
const sentenceCount = document.getElementById("sentenceCount");
const visibleCount = document.getElementById("visibleCount");

const showAnswerBtn = document.getElementById("showAnswerBtn");
const nextBtn = document.getElementById("nextBtn");
const studyFrench = document.getElementById("studyFrench");
const studyMeaning = document.getElementById("studyMeaning");
const studyAnswer = document.getElementById("studyAnswer");
const studyExtra = document.getElementById("studyExtra");
const statusLine = document.getElementById("statusLine");

const roomName = document.getElementById("roomName");
const copyRoomBtn = document.getElementById("copyRoomBtn");

/* =========================
   3) APP STATE
========================= */
let currentTab = "words";
let studyIndex = 0;
let allEntries = [];
let unsubscribe = null;

/* =========================
   4) ROOM FROM URL
   Example:
   ?room=mysharedclass
========================= */
const params = new URLSearchParams(window.location.search);
const currentRoom = (params.get("room") || "default-room").trim();

roomName.textContent = currentRoom;

/* =========================
   5) SAVE NAME LOCALLY
========================= */
authorInput.value = localStorage.getItem("french_author_name") || "";

authorInput.addEventListener("input", () => {
  localStorage.setItem("french_author_name", authorInput.value.trim());
});

/* =========================
   6) FIRESTORE COLLECTION
   rooms/{room}/entries
========================= */
function getEntriesCollection() {
  return collection(db, "rooms", currentRoom, "entries");
}

/* =========================
   7) REALTIME LISTENER
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
      renderEntries();
      renderStudyCard();
    },
    (error) => {
      console.error(error);
      statusLine.textContent = "Could not load data. Check Firebase config and Firestore rules.";
    }
  );
}

/* =========================
   8) HELPERS
========================= */
function escapeHtml(text = "") {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setTab(tab) {
  currentTab = tab;
  studyIndex = 0;
  studyAnswer.style.display = "none";

  if (tab === "words") {
    wordsTab.classList.add("active");
    sentencesTab.classList.remove("active");
    wordForm.style.display = "block";
    sentenceForm.style.display = "none";
  } else {
    sentencesTab.classList.add("active");
    wordsTab.classList.remove("active");
    wordForm.style.display = "none";
    sentenceForm.style.display = "block";
  }

  renderEntries();
  renderStudyCard();
}

function getFilteredItems() {
  const queryText = searchInput.value.toLowerCase().trim();

  return allEntries.filter((item) => {
    if (item.type !== currentTab.slice(0, -1)) return false;

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
   9) RENDER ENTRIES
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
    const card = document.createElement("div");
    card.className = "entry-card";

    const categoryHtml = item.category
      ? `<span class="category-tag">${escapeHtml(item.category)}</span>`
      : "";

    const authorHtml = item.author
      ? `<span class="author-tag">By ${escapeHtml(item.author)}</span>`
      : `<span class="author-tag">By anonymous</span>`;

    const typeHtml =
      item.type === "word"
        ? `<span class="type-tag">Word</span>`
        : `<span class="type-tag">Sentence</span>`;

    if (item.type === "word") {
      card.innerHTML = `
        <div class="entry-top">
          <div>
            <h3>${escapeHtml(item.french)}</h3>
            <p>${escapeHtml(item.meaning)}</p>
            <div class="meta">
              ${typeHtml}
              ${categoryHtml}
              ${authorHtml}
            </div>
          </div>
          <button class="delete-btn" data-id="${item.id}">Delete</button>
        </div>
        ${
          item.example
            ? `<div class="example"><p class="muted">Example</p><p>${escapeHtml(item.example)}</p></div>`
            : ""
        }
      `;
    } else {
      card.innerHTML = `
        <div class="entry-top">
          <div>
            <h3>${escapeHtml(item.french)}</h3>
            <div class="translation">
              <p class="muted">Meaning</p>
              <p>${escapeHtml(item.meaning)}</p>
            </div>
            <div class="meta">
              ${typeHtml}
              ${categoryHtml}
              ${authorHtml}
            </div>
          </div>
          <button class="delete-btn" data-id="${item.id}">Delete</button>
        </div>
      `;
    }

    entries.appendChild(card);
  });

  const deleteButtons = document.querySelectorAll(".delete-btn");
  deleteButtons.forEach((button) => {
    button.addEventListener("click", async function () {
      const id = this.dataset.id;
      await deleteEntry(id);
    });
  });
}

/* =========================
   10) DELETE ENTRY
========================= */
async function deleteEntry(id) {
  try {
    await deleteDoc(doc(db, "rooms", currentRoom, "entries", id));
  } catch (error) {
    console.error(error);
    alert("Could not delete this item.");
  }
}

/* =========================
   11) STUDY MODE
========================= */
function renderStudyCard() {
  const filtered = getFilteredItems();

  if (!filtered.length) {
    studyFrench.textContent = "Nothing to review yet";
    studyMeaning.textContent = "";
    studyExtra.innerHTML = "";
    studyAnswer.style.display = "none";
    return;
  }

  if (studyIndex >= filtered.length) {
    studyIndex = 0;
  }

  const item = filtered[studyIndex];
  studyFrench.textContent = item.french || "";
  studyMeaning.textContent = item.meaning || "";
  studyExtra.innerHTML = "";

  let extra = "";

  if (item.example) {
    extra += `
      <div style="margin-top:10px;">
        <p class="muted">Example</p>
        <p>${escapeHtml(item.example)}</p>
      </div>
    `;
  }

  if (item.category) {
    extra += `
      <div style="margin-top:10px;">
        <p class="muted">Category</p>
        <p>${escapeHtml(item.category)}</p>
      </div>
    `;
  }

  if (item.author) {
    extra += `
      <div style="margin-top:10px;">
        <p class="muted">Added by</p>
        <p>${escapeHtml(item.author)}</p>
      </div>
    `;
  }

  studyExtra.innerHTML = extra;
}

/* =========================
   12) ADD WORD
========================= */
wordForm.addEventListener("submit", async function (e) {
  e.preventDefault();

  const newWord = {
    type: "word",
    french: wordFrench.value.trim(),
    meaning: wordMeaning.value.trim(),
    category: wordCategory.value.trim(),
    example: wordExample.value.trim(),
    author: authorInput.value.trim(),
    createdAt: serverTimestamp()
  };

  if (!newWord.french || !newWord.meaning) return;

  try {
    await addDoc(getEntriesCollection(), newWord);
    wordForm.reset();
    authorInput.value = localStorage.getItem("french_author_name") || "";
  } catch (error) {
    console.error(error);
    alert("Could not save word. Check Firebase setup.");
  }
});

/* =========================
   13) ADD SENTENCE
========================= */
sentenceForm.addEventListener("submit", async function (e) {
  e.preventDefault();

  const newSentence = {
    type: "sentence",
    french: sentenceFrench.value.trim(),
    meaning: sentenceMeaning.value.trim(),
    category: sentenceCategory.value.trim(),
    author: authorInput.value.trim(),
    createdAt: serverTimestamp()
  };

  if (!newSentence.french || !newSentence.meaning) return;

  try {
    await addDoc(getEntriesCollection(), newSentence);
    sentenceForm.reset();
    authorInput.value = localStorage.getItem("french_author_name") || "";
  } catch (error) {
    console.error(error);
    alert("Could not save sentence. Check Firebase setup.");
  }
});

/* =========================
   14) UI EVENTS
========================= */
searchInput.addEventListener("input", function () {
  studyIndex = 0;
  studyAnswer.style.display = "none";
  renderEntries();
  renderStudyCard();
});

showAnswerBtn.addEventListener("click", function () {
  studyAnswer.style.display = "block";
});

nextBtn.addEventListener("click", function () {
  const filtered = getFilteredItems();
  if (!filtered.length) return;

  studyIndex = (studyIndex + 1) % filtered.length;
  studyAnswer.style.display = "none";
  renderStudyCard();
});

wordsTab.addEventListener("click", function () {
  setTab("words");
});

sentencesTab.addEventListener("click", function () {
  setTab("sentences");
});

copyRoomBtn.addEventListener("click", async function () {
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
   15) START
========================= */
startRealtimeListener();
renderEntries();
renderStudyCard();
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
