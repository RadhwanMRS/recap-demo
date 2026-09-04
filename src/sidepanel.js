import { loadNote, saveNote, clearNote, loadSettings, saveSettings, SYNC_TOTAL_QUOTA_SAFE, isNoteStorageKey } from "./storage.js";

const noteEl = document.getElementById("note");
const saveStatusEl = document.getElementById("saveStatus");
const sizeIndicatorEl = document.getElementById("sizeIndicator");
const fontSizeSelect = document.getElementById("fontSize");
const clearBtn = document.getElementById("clearBtn");

let saveTimer = null;

function setSaveStatus(text) {
  saveStatusEl.textContent = text;
}

function updateSizeIndicator(byteLength) {
  if (typeof byteLength !== "number") return;
  const kb = (byteLength / 1024).toFixed(1);
  sizeIndicatorEl.textContent = `${kb} Ko`;
  sizeIndicatorEl.classList.remove("size-ok", "size-warn", "size-danger");
  const ratio = byteLength / SYNC_TOTAL_QUOTA_SAFE;
  if (ratio < 0.6) sizeIndicatorEl.classList.add("size-ok");
  else if (ratio < 0.9) sizeIndicatorEl.classList.add("size-warn");
  else sizeIndicatorEl.classList.add("size-danger");
}

function reasonToMessage(reason) {
  if (reason === "too-large") return "Trop volumineux pour la synchro - sauvegarde locale uniquement";
  if (reason === "sync-error") return "Synchro indisponible - sauvegarde locale uniquement";
  return "Enregistre";
}

function scheduleSave() {
  setSaveStatus("Enregistrement...");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(doSave, 500);
}

async function doSave() {
  const html = noteEl.innerHTML;
  const result = await saveNote(html);
  updateSizeIndicator(result.byteLength);
  setSaveStatus(result.synced ? "Enregistre" : reasonToMessage(result.reason));
}

function applyFontSize(size) {
  noteEl.dataset.fontSize = size;
}

function wireToolbar() {
  document.querySelectorAll("[data-cmd]").forEach((btn) => {
    btn.addEventListener("click", () => {
      noteEl.focus();
      document.execCommand(btn.dataset.cmd, false, btn.dataset.value || null);
      scheduleSave();
    });
  });
}

function wireNote() {
  noteEl.addEventListener("input", scheduleSave);

  // Coller en texte brut : evite d'importer des styles ou ressources
  // externes exotiques depuis la source du copier-coller.
  noteEl.addEventListener("paste", (event) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  });
}

function wireFontSize() {
  fontSizeSelect.addEventListener("change", async () => {
    applyFontSize(fontSizeSelect.value);
    await saveSettings({ fontSize: fontSizeSelect.value });
  });
}

function wireClear() {
  clearBtn.addEventListener("click", async () => {
    const confirmed = window.confirm("Effacer definitivement tout le texte du panneau ? Cette action est irreversible.");
    if (!confirmed) return;
    noteEl.innerHTML = "";
    await clearNote();
    updateSizeIndicator(0);
    setSaveStatus("Enregistre");
    noteEl.focus();
  });
}

function wireRemoteUpdates() {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    const noteChanged = Object.keys(changes).some((key) => isNoteStorageKey(key));
    if (!noteChanged) return;
    // On evite d'ecraser une frappe en cours sur cette machine.
    if (document.activeElement === noteEl) return;
    loadNote().then(({ html }) => {
      noteEl.innerHTML = html || "";
      updateSizeIndicator(new TextEncoder().encode(html || "").length);
    });
  });
}

async function init() {
  wireToolbar();
  wireNote();
  wireFontSize();
  wireClear();
  wireRemoteUpdates();

  const [{ html }, settings] = await Promise.all([loadNote(), loadSettings()]);
  noteEl.innerHTML = html || "";

  const fontSize = settings.fontSize || "medium";
  fontSizeSelect.value = fontSize;
  applyFontSize(fontSize);

  updateSizeIndicator(new TextEncoder().encode(html || "").length);
}

init();
