import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { addDoc, collection, doc, getFirestore, increment, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDRtu1zZoVVd5GsHCUVPbsECXItsLs6LQ0",
  authDomain: "one-kind-word-20260613.firebaseapp.com",
  projectId: "one-kind-word-20260613",
  storageBucket: "one-kind-word-20260613.firebasestorage.app",
  messagingSenderId: "69946126268",
  appId: "1:69946126268:web:8b3a3c0d66c2e05d6b05b9",
};
const THEME_KEY = "maeum-feed-theme";
const REACTED_KEY = "maeum-feed-reacted";
const REACTIONS = ["💪", "❤️", "👏"];
const AVATAR_COLORS = ["#e8d9b7", "#cddcc6", "#d6d2e5", "#e7c9c2", "#c9dce2"];
const AUTHORS = ["Kind Heart", "One Step", "Here & Now", "A Little Courage"];
const db = getFirestore(initializeApp(firebaseConfig));
const postsCollection = collection(db, "posts");
const $ = (selector) => document.querySelector(selector);
const elements = {
  root: document.documentElement,
  themeColor: $("meta[name='theme-color']"),
  themeToggle: $("#theme-toggle"), form: $("#post-form"), textarea: $("#post-text"),
  submit: $(".submit-button"), characterCount: $("#character-count"), postCount: $("#post-count"),
  feed: $("#feed"), emptyState: $("#empty-state"), template: $("#post-template"), toast: $("#toast"),
};
let posts = [];
let toastTimer;
let reactedPosts = loadReactedPosts();

function loadReactedPosts() {
  try { return JSON.parse(localStorage.getItem(REACTED_KEY)) || {}; } catch { return {}; }
}
function saveReactedPosts() { localStorage.setItem(REACTED_KEY, JSON.stringify(reactedPosts)); }
function getInitialTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function setTheme(theme) {
  const dark = theme === "dark";
  elements.root.dataset.theme = theme;
  elements.themeToggle.setAttribute("aria-label", `Switch to ${dark ? "light" : "dark"} mode`);
  elements.themeColor.content = dark ? "#111210" : "#f7f7f5";
  localStorage.setItem(THEME_KEY, theme);
}
function formatTime(timestamp) {
  if (!timestamp) return "Just now";
  const milliseconds = timestamp.toMillis();
  const minutes = Math.floor(Math.max(0, Date.now() - milliseconds) / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(milliseconds);
}
function notify(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2600);
}
function createReactionButton(post, emoji) {
  const button = document.createElement("button");
  const count = post.reactions?.[emoji] || 0;
  const active = Boolean(reactedPosts[post.id]?.includes(emoji));
  button.type = "button";
  button.className = `reaction-button${active ? " active" : ""}`;
  button.dataset.action = "react";
  button.dataset.emoji = emoji;
  button.setAttribute("aria-pressed", String(active));
  button.setAttribute("aria-label", `${emoji}, ${count} reactions`);
  button.append(emoji);
  const countElement = document.createElement("span");
  countElement.textContent = count;
  button.append(countElement);
  return button;
}
function createPostElement(post, index) {
  const fragment = elements.template.content.cloneNode(true);
  const article = fragment.querySelector(".post");
  const avatar = fragment.querySelector(".post-avatar");
  article.dataset.id = post.id;
  avatar.textContent = post.author.slice(0, 1);
  avatar.style.backgroundColor = AVATAR_COLORS[index % AVATAR_COLORS.length];
  fragment.querySelector(".post-author").textContent = post.author;
  const time = fragment.querySelector(".post-time");
  time.textContent = formatTime(post.createdAt);
  if (post.createdAt) time.dateTime = post.createdAt.toDate().toISOString();
  fragment.querySelector(".post-text").textContent = post.text;
  const reactions = fragment.querySelector(".reactions");
  REACTIONS.forEach((emoji) => reactions.append(createReactionButton(post, emoji)));
  return fragment;
}
function render() {
  elements.feed.replaceChildren(...posts.map(createPostElement));
  elements.postCount.textContent = `${posts.length} ${posts.length === 1 ? "post" : "posts"}`;
  elements.feed.hidden = !posts.length;
  elements.emptyState.hidden = Boolean(posts.length);
}
function friendlyError(error) {
  console.error(error);
  if (error.code === "permission-denied") return "Posting is temporarily unavailable.";
  if (error.code === "unavailable") return "Check your connection and try again.";
  return "Something went wrong. Please try again.";
}

setTheme(getInitialTheme());
const feedQuery = query(postsCollection, orderBy("createdAt", "desc"), limit(100));
onSnapshot(feedQuery, (snapshot) => {
  posts = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  render();
}, (error) => notify(friendlyError(error)));
elements.themeToggle.addEventListener("click", () => setTheme(elements.root.dataset.theme === "dark" ? "light" : "dark"));
elements.textarea.addEventListener("input", () => { elements.characterCount.textContent = elements.textarea.value.length; });
elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = elements.textarea.value.trim();
  if (!text) { notify("Write something first."); return; }
  elements.submit.disabled = true;
  try {
    await addDoc(postsCollection, {
      author: AUTHORS[Math.floor(Math.random() * AUTHORS.length)], text,
      createdAt: serverTimestamp(), reactions: { "💪": 0, "❤️": 0, "👏": 0 },
    });
    elements.form.reset();
    elements.characterCount.textContent = "0";
    notify("Your post has been shared.");
  } catch (error) { notify(friendlyError(error)); }
  finally { elements.submit.disabled = false; }
});
elements.feed.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action='react']");
  if (!button || button.disabled) return;
  const id = button.closest(".post").dataset.id;
  const emoji = button.dataset.emoji;
  const current = reactedPosts[id] || [];
  const active = current.includes(emoji);
  button.disabled = true;
  try {
    await updateDoc(doc(db, "posts", id), { [`reactions.${emoji}`]: increment(active ? -1 : 1) });
    reactedPosts[id] = active ? current.filter((item) => item !== emoji) : [...current, emoji];
    saveReactedPosts();
  } catch (error) { notify(friendlyError(error)); }
  finally { button.disabled = false; }
});
