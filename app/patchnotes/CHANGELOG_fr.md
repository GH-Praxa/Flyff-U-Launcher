# 📦 Notes de patch

---

## 🆕 Version 2.4.1

### ✨ Améliorations
- Killfeed : détection des monstres améliorée
  - Nouvelle pondération d’identification : PV du monstre > Niveau du monstre > Élément du monstre
- Killfeed : le suivi des monstres compte désormais les mobs tués
- Données de référence des monstres mises à jour
- Design du dialogue « Choisir une mise en page » optimisé
- Design du dialogue « Gérer les profils (déconnexion) » optimisé

### 🐛 Corrections
- Les overlays ne recouvrent plus la boîte de dialogue de fermeture

### 🧹 Nettoyage
- Architecture du renderer modularisée (restructuration interne)
- Dossier de données interne `api_fetch/` renommé en `cache/`
- Réorganisation d’AppData : les données sont désormais rangées dans AppData\Roaming\Flyff-U-Launcher\user
- Migration automatique : les données existantes sont migrées en douceur au premier lancement — avec indicateur de progression

:::accordion[Nouveaux chemins de stockage]
Toutes les données utilisateur se trouvent désormais sous `%APPDATA%\Flyff-U-Launcher\user\` :

- `user/config/settings.json` — Paramètres client
- `user/config/features.json` — Feature flags
- `user/profiles/profiles.json` — Profils du launcher
- `user/profiles/rois.json` — Calibrations ROI
- `user/profiles/ocr-timers.json` — Timers OCR
- `user/ui/themes.json` — Thèmes
- `user/ui/tab-layouts.json` — Dispositions des onglets
- `user/ui/tab-active-color.json` — Couleur de l'onglet actif
- `user/shopping/item-prices.json` — Prix de la liste d'achats premium
- `user/plugin-data/` — Paramètres des plugins
- `user/cache/` — Données et icônes API-Fetch
- `user/logs/` — Logs de diagnostic
:::

---

## 🆕 Version 2.3.0

### 🐛 Corrections

- Les valeurs OCR (panneau latéral) sont désormais correctement détectées lorsque le jeu est lancé dans une fenêtre multi-fenêtres distincte
- La calibration ROI n'ouvre plus par erreur une nouvelle session mais utilise la fenêtre de jeu existante
- L'OCR utilise désormais de manière fiable le Tesseract intégré — une installation séparée n'est plus nécessaire

### ✨ Améliorations

- Les accordéons de la documentation utilisent désormais des éléments HTML5 natifs (plus de JavaScript nécessaire)

---

## 🆕 Version 2.2.0

### ➕ Nouvelles fonctionnalités

**Mises en page**
- Fonction de mise en page revue, affichages de jeu pris en charge :
  - 1x1 fenêtre unique
  - 1x2 écran scindé
  - 1x3, 1x4, 2x2, 3+2, 2x3, 4+3, 2x4 multi-écrans
- Barre de progression ajoutée dans la barre d'onglets indiquant l'avancement lors de l'ouverture des écrans de jeu
- Système multi-fenêtres : plusieurs fenêtres de session indépendantes peuvent être ouvertes

**Raccourcis clavier** — combinaisons librement assignables (2-3 touches)
- Masquer les overlays
- Panneau latéral on/off
- Barre d'onglets on/off
- Enregistrer la capture de l'écran actif dans `C:\Users\<USER>\Pictures\Flyff-U-Launcher\`
- Onglet précédent / Onglet suivant
- Instance de fenêtre suivante
- Remettre le minuteur CD à 00:00, les icônes attendent un clic
- Ouvrir le calculateur FCoins
- Ouvrir la liste d’achats Premium

**Nouveaux paramètres client**
- Largeur / hauteur du launcher
- Charger les onglets de grille séquentiellement
- Affichage des onglets pour les mises en page
- Mettre en évidence la grille active
- Actualiser les mises en page lors des modifications
- Durée des messages d’état
- Taux de change des FCoins
- Mode d’affichage des mises en page d’onglets (Compact, Groupé, Séparé, Mini-grille)

**Menus & Outils**
- Nouveau menu « Tools (icône étoile) » ajouté à la barre d'onglets.
  Ce menu masque la vue du navigateur, les personnages restent connectés.
  - Outils internes : calculateur FCoins vers Penya, liste d’achats Premium
  - Liens externes : page d’accueil Flyff Universe, Flyffipedia, Flyffulator, Skillulator
- Nouveau menu dans la barre d'onglets (icône clavier) affichant les raccourcis configurés.
  Ce menu masque la vue du navigateur, les personnages restent connectés.

**Documentation**
- Nouvel onglet « Documentation » dans le menu des paramètres avec des explications en plusieurs langues :
  - Créer un profil, créer une mise en page, chemins de données & persistance, API fetch,
    minuteur CD, killfeed, FCoins <-> Penya, liste d’achats Premium
- Le texte est traduit dans toutes les langues disponibles. Certaines images manquent encore.
  Fallback : interface en anglais → interface en allemand.

**Divers**
- Nouveau thème « Steel Ruby » ajouté
- Le launcher affiche sous le flux d’actualités la liste des profils déjà ouverts
- Fonction de don ajoutée dans Paramètres → Support
- Le dialogue de fermeture en multi-onglets contient l’option « Scinder en onglets individuels »
- Lorsqu’un profil est ouvert alors qu’une session est déjà active, on demande s’il faut l’ajouter à la fenêtre actuelle ou créer une nouvelle fenêtre

### 🧹 Nettoyage

- La fenêtre du launcher a désormais une taille minimale et reste responsive jusqu’à ce seuil
- Taille par défaut du launcher modifiée de 980×640 à 1200×970
- Bouton « X » ajouté dans le menu des paramètres
- Taille de la fenêtre des paramètres ajustée
- Menu « Gérer » pour les profils et mises en page modifié. Il contient « Renommer » et « Supprimer »
- Bouton « Profils » ajouté dans la sélection de mise en page. Il affiche les profils contenus dans la mise en page
- Icône ajoutée pour le bouton d’agrandissement de la barre d’onglets
- Onglet actif mis en évidence dans le dialogue de fermeture

### 🐛 Corrections

- Correction d’un bug qui masquait le jeu lors du changement d’onglet

### 🐛 Problèmes connus

- Il arrive que les saisies de texte du panneau latéral n’arrivent pas correctement
- Les overlays s’affichent dans des fenêtres de dialogue, par ex. « Fermer » et « Choisir une mise en page » — corrigé en 2.4.1 ✅
- Le panneau latéral n’est pas affiché en mode fenêtré


---

## 🆕 Version 2.1.1

### ✨ Améliorations

- Les overlays ne recouvrent plus les fenêtres externes.
  Ils se masquent automatiquement lorsque la fenêtre est inactive.
- Clignotement des overlays lors du déplacement de la fenêtre corrigé.
  Là aussi les overlays sont correctement masqués.
- Le dernier onglet de la mise en page dispose désormais d'assez de temps de chargement avant l’activation du split screen.
- Toutes les actions du dialogue de sortie (sauf Annuler) sont maintenant marquées comme boutons dangereux (rouges).
  « Annuler » reste volontairement neutre.
- Onglet Patchnotes ajouté dans le menu des paramètres.
  L’affichage se fait dans la langue sélectionnée.

### ➕ Nouvelles fonctionnalités

- Bouton « + » ajouté à la fin du minuteur CD

### 🧹 Nettoyage

- Onglet inutilisé retiré du dialogue d’icônes
- Badge « RM-EXP » inutilisé en haut à droite supprimé

---

## 🔄 Version 2.1.0

### 🚀 Nouveautés

- Les mises à jour peuvent désormais être effectuées directement via le launcher

---

## 🔄 Version 2.0.2

### 🐛 Corrections

- Correction d’un bug affichant le panneau latéral vide
- Correction d’erreurs de traduction
