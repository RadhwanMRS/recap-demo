// Service worker minimal : ouvre/ferme le panneau lateral au clic sur l'icone
// de la barre d'outils, sans passer par un popup intermediaire.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error("[recap-demo] setPanelBehavior a echoue", error));
});
