# Recap Demo — spécification du projet

Extension Chrome (Manifest V3) qui affiche un panneau latéral (côté droit du
navigateur) contenant un texte libre et **riche** (mise en forme), pensé pour
rester visible en permanence pendant une démo en partage d'écran : c'est le
pense-bête de ce que la personne est en train de montrer.

Ce fichier est la spécification de référence du projet — architecture,
décisions techniques et leurs raisons, limites connues, et comment
développer/tester. Toute évolution significative doit être reflétée ici.

## Objectif et non-objectifs

**Objectif** : un panneau ancré à droite, toujours accessible en un clic sur
l'icône de la barre d'outils, avec une zone de texte riche persistée
automatiquement.

**Non-objectifs volontaires** (pour rester simple et garder un dépôt public
sans risque) :
- Pas de comptes ni de backend : uniquement les API `chrome.storage` locales
  au navigateur.
- Pas de plusieurs notes nommées / historique de démos — une seule note
  permanente que l'on réédite avant chaque démo.
- Pas d'appel réseau, pas de télémétrie, pas de dépendance npm/CDN.
- Pas de collage de HTML riche externe (voir « Sécurité et vie privée »).

## Architecture

```
recap-demo/
├── manifest.json          # Manifest V3 : permissions storage + sidePanel
├── src/
│   ├── background.js      # Service worker : ouvre le panneau au clic sur l'icône
│   ├── sidepanel.html      # Structure du panneau (barre d'outils, zone editable, statut)
│   ├── sidepanel.css       # Thème clair/sombre automatique, tailles de police
│   ├── sidepanel.js        # Logique UI : barre d'outils, autosave, indicateurs
│   └── storage.js          # Persistance : découpage sync + repli local (voir plus bas)
├── icons/                  # PNG générés (voir tools/generate_icons.py)
├── tools/generate_icons.py # Régénère les icônes en code (pas d'image tierce)
├── README.md               # Installation et usage, orienté utilisateur
└── LICENSE                 # MIT
```

Aucun bundler, aucune étape de build : les fichiers sous `src/` sont chargés
tels quels par Chrome. `sidepanel.js` et `storage.js` sont des modules ES
(`<script type="module">`), supportés nativement par les pages d'extension
Manifest V3.

## Pourquoi `chrome.sidePanel`

L'API `chrome.sidePanel` (Chrome 114+) est faite pour ce cas précis : un
panneau ancré à droite de la fenêtre, qui reste affiché quand on change
d'onglet dans la même fenêtre. Alternatives écartées :
- **Popup classique** : se ferme dès qu'on clique ailleurs — inutilisable
  pendant une démo où on doit interagir avec la page.
- **Iframe injectée via content script** : demanderait des
  `host_permissions` sur tous les sites, plus fragile (CSP des pages
  visitées, réinjection à chaque navigation).

`chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` est
appelé une fois dans `background.js` (`onInstalled`) pour que le clic sur
l'icône de la barre d'outils ouvre/ferme directement le panneau, sans popup
intermédiaire.

## Éditeur riche sans dépendance

La zone `#note` est un `contenteditable` piloté par `document.execCommand`
pour le gras/italique/souligné/titres/listes/surlignage/suppression de mise
en forme (`src/sidepanel.js`, fonction `wireToolbar`).

`execCommand` est **officiellement déprécié** côté spec HTML, mais reste
implémenté et fonctionnel dans Chrome. Le choix assumé ici est de na pas
introduire une librairie d'édition riche (Quill, TipTap, ProseMirror...) :
- Zéro dépendance npm → zéro risque de supply-chain sur un dépôt public.
- Pas de bundler → pas de build à maintenir pour un outil aussi simple.
- Le besoin réel (gras/italique/titres/listes/surlignage) est entièrement
  couvert par `execCommand`.

Si `execCommand` est un jour retiré de Chrome, il faudra migrer vers une
implémentation manuelle de commandes sur `Selection`/`Range`, ou introduire
une petite librairie — à ce moment-là seulement.

Les raccourcis clavier `Ctrl+B` / `Ctrl+I` / `Ctrl+U` fonctionnent nativement
sur un `contenteditable`, sans code additionnel.

## Stockage : découpage `sync` + repli `local` (`src/storage.js`)

Contrainte de départ : `chrome.storage.sync` limite chaque valeur à
`QUOTA_BYTES_PER_ITEM` (8192 octets) et le total à `QUOTA_BYTES` (102 400
octets, ~100 Ko). Un texte riche (HTML) dépasse facilement 8 Ko.

Design retenu :
1. **Découpage** : le HTML est coupé en chunks d'environ 6000 octets
   (`SYNC_CHUNK_MAX_BYTES`), stockés sous les clés `note_chunk_0`,
   `note_chunk_1`, ... Le découpage se fait par *code point* Unicode (pas
   par unité UTF-16) pour ne jamais couper une paire de substitution
   (emoji, etc.) au milieu.
2. **Métadonnées** : une clé `note_meta` garde `{ chunkCount, updatedAt,
   byteLength }`, utilisée pour savoir combien de chunks relire et pour
   nettoyer les chunks excédentaires si la note rétrécit.
3. **Miroir local systématique** : à chaque sauvegarde, la note complète
   (non découpée) est aussi écrite dans `chrome.storage.local` sous
   `note_local_backup`, **avant** même de tenter la sync. `chrome.storage
   .local` a un quota bien plus large et n'a pas besoin de découpage.
4. **Lecture résiliente** : au chargement, `loadNote()` tente d'abord
   `sync`, et si l'appel échoue ou qu'aucune méta n'existe, retombe sur le
   backup local.
5. **Garde-fou de taille** : `SYNC_TOTAL_QUOTA_SAFE` (90 Ko) est un plafond
   conservateur sous les 100 Ko réels, pour laisser de la marge à
   `note_meta` et `note_settings` dans le même quota total. Au-delà, la
   sauvegarde sync est simplement sautée (la note reste sauvegardée en
   local) et l'utilisateur voit un message dans la barre de statut.
6. **Erreurs sync silencieuses côté Chrome** (quota dépassé, sync
   désactivée par une policy d'entreprise, hors-ligne) : capturées, la note
   reste sauvegardée en local, un message clair s'affiche
   (`reasonToMessage` dans `sidepanel.js`).

Le principe directeur : **le texte ne doit jamais être perdu**, même si la
synchronisation échoue pour une raison quelconque — c'est un pense-bête
utilisé en pleine démo live.

`chrome.storage.onChanged` est écouté pour rafraîchir automatiquement le
panneau si la note est modifiée depuis une autre machine synchronisée,
sauf si l'utilisateur est en train de taper dans le panneau actif (évite
d'écraser une frappe en cours).

## Sécurité et vie privée

- Aucune `host_permissions`, aucun appel réseau (`fetch`/`XMLHttpRequest`)
  nulle part dans le code.
- Les extensions Manifest V3 ont un CSP strict par défaut
  (`script-src 'self'`) : aucun script inline, aucun `eval`, aucun code
  distant — respecté nativement puisque tout le JS est dans des fichiers
  `.js` externes avec `addEventListener` (pas d'attributs `onclick=...`).
- **Collage en texte brut uniquement** (`wireNote` dans `sidepanel.js`,
  écoute de l'évènement `paste`) : le HTML éventuellement collé depuis une
  autre source est délibérément ignoré, seul le texte brut est inséré. Ça
  évite d'importer des styles exotiques, des balises `<img>` pointant vers
  des ressources externes, ou tout autre contenu HTML non maîtrisé dans la
  note.
- Dépôt **public** : ne jamais committer de secret, token, URL interne ou
  donnée personnelle. Voir la checklist ci-dessous avant chaque push.

### Checklist avant un push sur ce dépôt public

- [ ] `git status` / `git diff --cached` relus : rien d'inattendu.
- [ ] Aucun fichier `.env`, token, clé API, capture d'écran contenant des
      données sensibles.
- [ ] Aucune URL interne (VPN, intranet, `*.pc-scol.fr`, etc.).
- [ ] Le message de commit ne référence pas d'information confidentielle.

## Développer et tester en local

1. Ouvrir `chrome://extensions`.
2. Activer le « Mode développeur » (en haut à droite).
3. Cliquer sur « Charger l'extension non empaquetée » et sélectionner le
   dossier `recap-demo`.
4. Cliquer sur l'icône de l'extension dans la barre d'outils Chrome : le
   panneau s'ouvre à droite.
5. Après une modification de code, revenir sur `chrome://extensions` et
   cliquer sur l'icône de rechargement de l'extension.

Pour régénérer les icônes après modification de `tools/generate_icons.py` :

```bash
python3 tools/generate_icons.py
```

(nécessite Python 3 et le paquet `Pillow`, ex. `pip install pillow`).

## Vérifications manuelles avant de considérer un changement terminé

- Taper du texte, appliquer gras/italique/souligné/titre/liste/surlignage,
  vérifier le rendu et le raccourci clavier correspondant.
- Changer d'onglet dans la même fenêtre → le panneau reste ouvert avec le
  contenu intact.
- Recharger l'extension puis rouvrir le panneau → le contenu est toujours
  là (persistance).
- Coller un très gros bloc de texte (plus de ~90 Ko une fois mis en HTML)
  → l'indicateur de taille passe au rouge et le message de statut indique
  que la sauvegarde reste locale uniquement, sans perte de texte.
- Forcer `prefers-color-scheme: dark` dans les DevTools → vérifier la
  lisibilité en thème sombre.
- Cliquer sur « Tout effacer » → une confirmation est demandée avant toute
  suppression.
