# Recap Demo

Extension Chrome qui affiche un panneau latéral (côté droit de la fenêtre)
avec un texte libre et riche : le pense-bête de ce que vous êtes en train de
montrer pendant une démo en partage d'écran.

- Texte riche : gras, italique, souligné, titres, listes.
- Taille de police ajustable (petit / moyen / grand / très grand), utile en
  vidéoprojecteur.
- Sauvegarde automatique, synchronisée entre vos machines (avec repli local
  automatique si la synchronisation échoue — le texte n'est jamais perdu).
- Thème clair/sombre automatique.
- Aucune donnée envoyée où que ce soit : tout reste dans votre navigateur.

## Installation (mode développeur)

1. Cloner ce dépôt.
2. Ouvrir `chrome://extensions` dans Chrome (ou un navigateur basé sur
   Chromium récent, 114+).
3. Activer le « Mode développeur » (interrupteur en haut à droite).
4. Cliquer sur « Charger l'extension non empaquetée » et sélectionner le
   dossier du dépôt.
5. Cliquer sur l'icône Démonstration dans la barre d'outils : le panneau
   s'ouvre à droite et reste ouvert quand vous changez d'onglet.

## Utilisation

Écrivez ce que vous allez démontrer, mettez en forme avec la barre d'outils
du panneau, et gardez-le ouvert pendant votre partage d'écran comme
pense-bête permanent. Le texte est sauvegardé automatiquement au fil de la
frappe.

## Développement

Voir [CLAUDE.md](CLAUDE.md) pour l'architecture détaillée, les décisions
techniques et les instructions de test.

## Soutenir le projet

Si cette extension vous est utile, vous pouvez
[m'offrir un café ☕](https://buymeacoffee.com/radhwan.bm).

## Licence

[MIT](LICENSE)
