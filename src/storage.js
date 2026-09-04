// Persistance de la note avec repli automatique local <-> sync.
//
// chrome.storage.sync impose ~8 Ko par item et 100 Ko au total (voir
// chrome.storage.sync.QUOTA_BYTES / QUOTA_BYTES_PER_ITEM). Un texte riche
// (HTML) depasse vite 8 Ko : on le decoupe donc en plusieurs cles.
// A chaque sauvegarde, une copie complete est aussi ecrite dans
// chrome.storage.local (quota bien plus large, pas de decoupage necessaire)
// pour ne jamais perdre le texte si la sync echoue, est desactivee par une
// policy d'entreprise, ou si l'appareil est hors-ligne.

const META_KEY = "note_meta";
const CHUNK_PREFIX = "note_chunk_";
const LOCAL_BACKUP_KEY = "note_local_backup";
const SETTINGS_KEY = "note_settings";

const SYNC_CHUNK_MAX_BYTES = 6000; // marge de securite sous QUOTA_BYTES_PER_ITEM (8192)
// Marge de securite sous QUOTA_BYTES (102400) pour laisser de la place a
// note_meta et note_settings dans le meme quota total.
export const SYNC_TOTAL_QUOTA_SAFE = 90 * 1024;

function chunkString(str, maxBytes) {
  const encoder = new TextEncoder();
  const chunks = [];
  let current = "";
  let currentBytes = 0;
  for (const ch of str) {
    // iterer par code point (pas par unite UTF-16) pour ne jamais couper
    // une paire de substitution (emoji, etc.) au milieu.
    const chBytes = encoder.encode(ch).length;
    if (currentBytes + chBytes > maxBytes && current.length > 0) {
      chunks.push(current);
      current = "";
      currentBytes = 0;
    }
    current += ch;
    currentBytes += chBytes;
  }
  if (current.length > 0 || chunks.length === 0) chunks.push(current);
  return chunks;
}

export async function loadNote() {
  try {
    const metaResult = await chrome.storage.sync.get(META_KEY);
    const meta = metaResult[META_KEY];
    if (meta && typeof meta.chunkCount === "number" && meta.chunkCount > 0) {
      const chunkKeys = Array.from({ length: meta.chunkCount }, (_, i) => CHUNK_PREFIX + i);
      const chunkResult = await chrome.storage.sync.get(chunkKeys);
      const html = chunkKeys.map((key) => chunkResult[key] ?? "").join("");
      return { html, source: "sync", updatedAt: meta.updatedAt };
    }
  } catch (error) {
    console.warn("[recap-demo] lecture sync impossible, repli sur la sauvegarde locale", error);
  }

  const localResult = await chrome.storage.local.get(LOCAL_BACKUP_KEY);
  const backup = localResult[LOCAL_BACKUP_KEY];
  if (backup) {
    return { html: backup.html, source: "local", updatedAt: backup.updatedAt };
  }
  return { html: "", source: "empty", updatedAt: null };
}

export async function saveNote(html) {
  const updatedAt = Date.now();
  const byteLength = new TextEncoder().encode(html).length;

  // Toujours ecrire la sauvegarde locale en premier : quoi qu'il arrive
  // ensuite avec la sync, le texte ne doit jamais etre perdu.
  await chrome.storage.local.set({ [LOCAL_BACKUP_KEY]: { html, updatedAt } });

  if (byteLength > SYNC_TOTAL_QUOTA_SAFE) {
    return { ok: true, synced: false, reason: "too-large", byteLength };
  }

  try {
    const previousMeta = (await chrome.storage.sync.get(META_KEY))[META_KEY];
    const previousCount = previousMeta?.chunkCount ?? 0;

    const chunks = chunkString(html, SYNC_CHUNK_MAX_BYTES);
    const toSet = { [META_KEY]: { chunkCount: chunks.length, updatedAt, byteLength } };
    chunks.forEach((chunk, i) => {
      toSet[CHUNK_PREFIX + i] = chunk;
    });
    await chrome.storage.sync.set(toSet);

    if (previousCount > chunks.length) {
      const toRemove = [];
      for (let i = chunks.length; i < previousCount; i += 1) toRemove.push(CHUNK_PREFIX + i);
      await chrome.storage.sync.remove(toRemove);
    }
    return { ok: true, synced: true, byteLength };
  } catch (error) {
    console.warn("[recap-demo] echec de la sauvegarde synchronisee, texte conserve en local uniquement", error);
    return { ok: true, synced: false, reason: "sync-error", byteLength };
  }
}

export async function clearNote() {
  try {
    const meta = (await chrome.storage.sync.get(META_KEY))[META_KEY];
    const keysToRemove = [META_KEY];
    if (meta?.chunkCount) {
      for (let i = 0; i < meta.chunkCount; i += 1) keysToRemove.push(CHUNK_PREFIX + i);
    }
    await chrome.storage.sync.remove(keysToRemove);
  } catch (error) {
    console.warn("[recap-demo] nettoyage sync partiel", error);
  }
  await chrome.storage.local.remove(LOCAL_BACKUP_KEY);
}

export async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get(SETTINGS_KEY);
    if (result[SETTINGS_KEY]) return result[SETTINGS_KEY];
  } catch (error) {
    console.warn("[recap-demo] lecture des reglages sync impossible", error);
  }
  const localResult = await chrome.storage.local.get(SETTINGS_KEY);
  return localResult[SETTINGS_KEY] || {};
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  try {
    await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
  } catch (error) {
    console.warn("[recap-demo] reglages sauvegardes en local uniquement", error);
  }
}

export function isNoteStorageKey(key) {
  return key === META_KEY || key.startsWith(CHUNK_PREFIX);
}
