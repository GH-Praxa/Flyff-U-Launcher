# 📦 Notes de patch

---

## 🐛 Version 3.0.4

### 🐛 Bug Fixes (macOS)
- Fixed: "damaged and can't be opened" error — the app inside the DMG is now ad-hoc signed before the DMG is assembled.
- Fixed: Signing order is now correct: `package → sign → make DMG`.
- Note: macOS still shows an "unidentified developer" prompt. Right-click the app → **Open** → **Open Anyway**.

---

## 🆕 Version 2.5.1

### 🆕 Nouvelle fonctionnalité : Giant Tracker
Fenêtre autonome dans le plugin Killfeed — capture et visualise les statistiques de kills pour les **Giants**, **Violets** et **Bosses**.

**Onglets de filtre**
- 5 onglets : **Tous** · **Giants** · **Violets** · **Bosses** · **Drops**
- **Bosses** — filtre sur le rang `boss` (bordure de carte rouge, style d'icône dédié)
- **Drops** — affiche uniquement les monstres avec des drops enregistrés, y compris un aperçu du loot pool (top 5 des objets par rareté) directement dans la carte

**Statistiques de kills**
- Vue en cartes avec modes Compact et Étendu
- Périodes : Aujourd'hui, Semaine, Mois, Année, Total
- Infos monstre : Icône, Nom, Niveau, Élément, Rang, HP, ATK

**Suivi des drops**
- Enregistrement des drops via le loot pool du monstre (avec filtre de rareté)
- Historique des drops par monstre : nom de l'objet, compteur de kills, horodatage
- Statistiques : Ø kills/drop, kills depuis le dernier drop

**Time to Kill (TTK)**
- Mesure automatiquement la durée du combat contre les Giants, Violets et Bosses
- Délai de grâce de 10 s lors de la désélection de la cible (buff, soin, etc.) — le temps de pause n'est pas compté dans le TTK
- Empreinte nom du monstre + HP max : la cible est reconnue de façon fiable
- Affichage : Dernier TTK, Ø TTK, Plus rapide
- Persisté dans l'historique des kills (colonne CSV `TTK_ms`)

**Autres**
- Tri par kills, nom ou niveau
- Champ de recherche pour filtrer par nom de monstre

### ✨ Améliorations supplémentaires
- Killfeed : détection des monstres améliorée
- Nouvelle pondération d'identification : HP du monstre > Niveau du monstre > Élément du monstre
- Killfeed : le suivi des monstres compte désormais les mobs tués
- Killfeed : historique introduit (par profil)
  - Fichier quotidien par date avec kills individuels (`Date/Heure`, `Personnage`, `Niveau`, `Monster-ID`, `Rang`, `Monstre`, `Élément`, `Gain EXP`, `EXP attendue`, `TTK_ms`)
  - Vue quotidienne agrégée avec `Kills`, `EXP totale`, `Répartition des monstres`, `Premier/Dernier kill`
- Killfeed : le suivi des monstres dans le panneau latéral se met maintenant à jour immédiatement après les kills (sans changement d'onglet)
- Killfeed : dans les accordéons de suivi des monstres, chaque rang dispose maintenant d'un bouton Kills avec une ListView des kills individuels.
  Les kills individuels peuvent être supprimés directement dans la ListView.
  Lors de la suppression de kills individuels, les fichiers d'historique AppData (daily/YYYY-MM-DD.csv, history.csv) et l'état du panneau latéral sont mis à jour.
- Killfeed : le panneau latéral suit maintenant de façon stable le profil cible de l'overlay (plus de saut entre les IDs de profil)
- Données de référence des monstres mises à jour
- Design de la boîte de dialogue "Choisir une mise en page" optimisé
- Design de la boîte de dialogue "Gérer les profils (déconnexion)" optimisé

### 🐛 Corrections
- Les overlays ne recouvrent plus la boîte de dialogue de fermeture
- Les accordéons de la documentation s'affichent correctement
- La migration de la version 2.3.0 vers la nouvelle structure AppData (`user/`) fonctionne désormais de manière fiable
- Killfeed : les sauts négatifs d'EXP OCR sont désormais filtrés comme bruit OCR et ne faussent plus la détection des kills

### 🧹 Nettoyage
- Architecture du renderer modularisée (restructuration interne)
- Dossier de données interne `api_fetch/` renommé en `cache/`
- Structure du répertoire AppData réorganisée : les données sont désormais triées dans le sous-dossier AppData\Roaming\Flyff-U-Launcher\user
- Migration automatique : les données existantes sont migrées de façon transparente au premier lancement — avec indicateur de progression
- Les données statiques (dont les données de référence) sont intégrées au build afin d'être disponibles de façon fiable dans les builds de release
- Réduction des logs de debug Killfeed/overlay pour rendre la console plus lisible

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
- `user/plugin-data/killfeed/history/<profile-id>/history.csv` — Vue quotidienne Killfeed par profil
- `user/plugin-data/killfeed/history/<profile-id>/daily/YYYY-MM-DD.csv` — Historique détaillé Killfeed par kill et par jour
- `user/cache/` — Données API fetch & icônes
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
