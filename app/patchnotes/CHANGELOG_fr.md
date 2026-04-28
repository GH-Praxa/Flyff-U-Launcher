# 📦 Notes de patch

---
## 🐛 Version 3.4.1

### 🐛 Corrections de bugs

**Plusieurs fenêtres de layout en même temps**
- Cliquer « Play » sur un layout enregistré ouvre désormais une fenêtre **supplémentaire** — celle en cours reste ouverte
- Le titre de la fenêtre affiche le nom du layout
- Si un profil est déjà ouvert dans une autre fenêtre, la cellule affiche une note avec un bouton « Aller à la fenêtre » — pas de second login, pas de personnage éjecté

🙏 Merci à **@ODevil97** pour le rapport de bug détaillé (GitHub)

---
## 🆕 Version 3.4.0

### ✨ Nouvelles fonctionnalités

**Disposition personnalisée (Custom)**
- Nouveau type de disposition « Personnalisé » dans le sélecteur de disposition — permet l'agencement libre de 1 à 8 BrowserViews avec position et taille individuelles
- Éditeur visuel avec glisser-déposer : positionnez les cellules sur un canevas (16:9) et redimensionnez via les poignées aux coins et bords
- Grille ajustable (snap) : précision de 1 %, 5 % ou 10 % lors du déplacement et du redimensionnement
- Ligne de curseur optionnelle (horizontale ou verticale) pour ajuster la répartition en temps réel
- Les cellules superposées sont empilées (la cellule du dessus reçoit les entrées)
- Les dispositions personnalisées enregistrées affichent un aperçu ASCII dynamique basé sur l'agencement réel des cellules

**Curseur ajustable pour les dispositions 1×3**
- La fenêtre centrale dans la disposition 1×3 (row-3) peut être redimensionnée via un curseur — les fenêtres latérales se partagent l'espace restant à parts égales

### ⚙️ Améliorations

- Documentation enrichie avec l'éditeur de disposition personnalisée (les 8 langues)

### 🐛 Corrections de bugs

- **Polices** : Les polices intégrées (Josefin Sans, Roboto, Open Sans, etc.) n'étaient pas correctement appliquées aux navigateurs de jeu ; `@font-face` est maintenant chargé dans l'author origin
- **Connexion** : La connexion via Facebook et Apple chargeait indéfiniment

---
## 🐛 Version 3.3.0

### 🐛 Corrections de bugs

- **Retour à une version antérieure** : Le retour à une ancienne version échouait avec "TypeError: this.currentVersion.format is not a function" — le gestionnaire de mise à jour écrasait incorrectement les données de version internes avec une chaîne simple au lieu d'un objet version
- **Retour à une version antérieure** : La sélection d'une version spécifique plus ancienne trouvait toujours la dernière version — utilise désormais une URL directe des ressources pour la version cible, permettant d'installer n'importe quelle version disponible

---
## 🆕 Version 3.2.0

### ⚙️ Améliorations

- **Quest Guide : affichage EXP** — les valeurs d'EXP sont affichées en pourcentage avec 4 décimales ; le niveau OCR est toujours utilisé pour le calcul de l'EXP, le mode niveau ne contrôle que le filtrage des quêtes

### 🐛 Corrections de bugs

- **API-Fetch** : la sélection des endpoints (cases à cocher) était ignorée — paramètre manquant dans les handlers IPC corrigé
- **API-Fetch** : les tuiles de la carte du monde (`tile_grid`) sont désormais téléchargées correctement
- Les rapports d'erreurs peuvent désormais être envoyés même sans entrées de journal existantes
- Le bouton d'envoi du journal d'erreurs affiche désormais un retour après l'envoi

---
## 🐛 Version 3.1.1

### 🐛 Corrections de bugs

- Interface du Sidepanel complètement cassée dans le build empaqueté (fond blanc, styles manquants) — la Content Security Policy bloquait les styles inline dans les fichiers HTML temporaires

---
## 🆕 Version 3.1.0

### ✨ Nouvelles fonctionnalités

**Nouveaux types de mise en page**
- Mises en page verticales : 2x1, 3x1, 4x1 (vues empilées)
- Mises en page asymétriques : fenêtre principale + 2–3 fenêtres secondaires à droite (`main-r2`, `main-r3`) ou en bas (`main-b2`, `main-b3`)
- Répartition des mises en page asymétriques ajustable via un slider (min 20% / max 80%)
- Sélecteur de mise en page avec aperçu ASCII : un diagramme du layout s'affiche au survol

**Export/Import de profils**
- Exporter et importer des profils sous forme de fichier `.flyffprofile`
- Contient les métadonnées du profil, les cookies de session Electron et les données localStorage
- Permet la sauvegarde et le transfert entre ordinateurs

**Noms de personnages et classes par personnage**
- Enregistrer des noms de personnages et classes par personnage dans le profil — affichage sous forme de badges avec icône de classe dans la liste des profils, filtrable et sélectionnable via liste déroulante dans les plugins

**Annonces du launcher**
- Nouvelle section dans le panneau droit affichant des messages du développeur sans mise à jour de l'application — par ex. bugs connus, développements en cours ou fonctionnalités prévues ; disponible en allemand et en anglais, désactivable dans les paramètres
- Les profils ouverts dans le panneau droit sont repliables et dépliables

**Paramètre de police**
- Nouveau paramètre "Police des overlays et de l'UI" dans les paramètres client — polices disponibles : Josefin Sans, Roboto, Open Sans, Lato, Montserrat, Raleway, Nunito, Ubuntu, Cinzel ; la police est appliquée aux overlays du launcher et aux éléments UI basés sur le DOM dans le jeu

**Paramètre de taille de police**
- Nouveau paramètre "Taille de police du launcher" : taille du texte dans la fenêtre du launcher ajustable (75–150%), pas dans le jeu lui-même

**Journal d'erreurs et message au développeur**
- Fenêtre de logs déplacée du Sidepanel vers la barre d'onglets — permet d'afficher, enregistrer et supprimer les logs d'erreurs ainsi que d'envoyer un message au développeur (les erreurs affichées sont envoyées avec) ; cooldown de 60 secondes

**Plugin Quest Guide**
- Nouveau plugin dans le Sidepanel : affiche les quêtes avec NPC de début/fin, objectif et récompenses avec marqueur de carte — nécessite les données de quêtes, NPC, monstres et items via API-Fetch

**Calculateur d'upgrade unifié**
- Calculateur d'upgrade étendu avec des calculs supplémentaires pour les armes, bijoux, piercing d'armure, piercing d'arme, Ultimate incluant le système de Pity, FWC et bonus d'événement ainsi que les tentatives déjà effectuées

**Tooltips et icônes d'aide UI**
- Tous les éléments importants du launcher ont des tooltips (dans les 8 langues)
- Icônes d'aide (?) pour les fonctions complexes : nom de profil, mode onglet/fenêtre, noms de personnages
- Indications pour la largeur/hauteur du launcher, les filtres, la sélection de mise en page et les cellules de grille

**Télémétrie**
- Statistiques de démarrage anonymes optionnelles (version, système d'exploitation, ID aléatoire)
- Activée par défaut, aucune donnée personnelle, désactivable à tout moment

**Vérification des mises à jour et rollback de version**
- Nouveau paramètre : vérifier automatiquement les mises à jour au démarrage (on/off)
- Bouton "Vérifier maintenant" manuel dans les paramètres
- Rollback de version : les anciennes versions du launcher (à partir de 3.0.5) peuvent être installées directement depuis les paramètres
- Menu déroulant avec toutes les releases GitHub disponibles, date et marquage de la version actuelle

### 🚀 Performance

**Système OCR optimisé**
- Méthode de capture d'écran sécurisée par plateforme : `xwd` sur Linux (pas de contact GPU), `capturePage()` sur Win/Mac — empêche les blocages GPU et les freezes du jeu
- En cas d'erreur de capture sur Linux, le scan est ignoré au lieu de geler le jeu
- Cache de hash de pixels : l'OCR est ignoré lorsque le frame n'a pas changé — réduit la charge CPU sur les contenus de jeu statiques
- Les résultats OCR vides sont correctement mis en cache — pas de répétitions Tesseract inutiles sur des pixels inchangés
- Limite globale de concurrence Tesseract (max. 1 simultané) — empêche la famine CPU du processus GPU
- Caches en mémoire pour les profils, le ROI-Store et le ROI-Visibility-Store au lieu de lectures fréquentes de la base de données

**Optimisation des overlays**
- Polling d'overlay efficace : changements d'opacité minimisés et intervalles réduits
- Linux : évitement des cycles Show/Hide inutiles pour les overlays transparents

### ⚙️ Améliorations

- **Cartes de mise en page améliorées** : aperçu ASCII du type de mise en page directement dans la carte ; affichage "X profils" au lieu de "X onglets" ; présentation plus compacte
- **Cartes de profil plus compactes** : hauteur de carte réduite, personnages avec icônes de classe en badges horizontaux sous le nom du profil
- **Paramètres entièrement refondus** : nouveau layout avec barre latérale et sous-pages catégorisées, toggle-switches et slider-cards
- **Affichage RAM** : paramètre "Afficher l'utilisation RAM" avec détails mémoire par profil, plugin et processus système
- **Overlay Killfeed positionnable** : déplacer l'overlay par glisser-déposer, la position est sauvegardée (x/y dans le layout)
- **Sélection de personnage Killfeed** : les noms de personnages sont choisis via liste déroulante depuis le profil
- **Bouton Sidepanel** dans la barre d'onglets de session (au lieu de dans l'overlay)
- **Onglets Killfeed et Scan dans le Sidepanel simplifiés** : affichage plus clair et complexité réduite

### 🐛 Corrections de bugs

- Avertissements d'assertion GLib/GTK supprimés sur Linux (messages internes inoffensifs de Chromium)

### 📦 Support Linux

- Binaires et bibliothèques Tesseract inclus pour Linux
- Fichiers de langue tessdata inclus pour Linux

### 🌐 Traductions

- Traductions étendues

---
## 🐛 Version 3.0.5

### 🐛 Corrections de bugs
- Corrigé : problème de connexion avec un compte Google

---
## 🐛 Version 3.0.4

### 🐛 Corrections de bugs (macOS)
- Corrigé : erreur "damaged and can't be opened" — l'application dans le DMG est désormais signée ad-hoc avant l'assemblage du DMG (auparavant, l'étape de signature n'avait lieu qu'après le DMG finalisé).
- Corrigé : l'ordre est désormais correct : `package → sign → créer le DMG`.
- Remarque : macOS affiche toujours le dialogue "Développeur non identifié" au premier lancement. Clic droit sur l'application → **Ouvrir** → **Ouvrir quand même**, ou utiliser la commande Terminal du README.

---
## 🆕 Version 3.0.0

### 🆕 Nouvel outil : Calculateur de coûts d'upgrade
- Calcule les coûts estimés pour les upgrades d'items de +0 à +10
incluant les matériaux nécessaires, le nombre de tentatives et la comparaison entre Low Sprotect et Sprotect.

### ✨ Nouvelles fonctionnalités
- Nouvel onglet Logs dans le Sidepanel avec journal d'erreurs en direct (Warn/Error) ainsi qu'actions de suppression et de sauvegarde.
- Plugin API-Fetch 3.0.0 avec nouvelle interface native dans le Sidepanel (plus de fenêtre UI Python séparée).

### 🚀 Plateforme & Distribution - Support Linux et Mac
- Pipeline de build/release pour Windows, macOS et Linux dans GitHub Actions.
- Nouveaux formats de paquets : macOS DMG ainsi que Linux AppImage/DEB/RPM.
- Bundling Tesseract spécifique par plateforme (win32, darwin, linux) avec détection/fallback runtime adaptés.

### 🐛 Corrections de bugs
- Taux de change Fcoin vers Penya corrigé
- Killfeed : conditions de course lors de mises à jour OCR rapides réduites (sérialisation par profil), les mises à jour broadcast ne sont plus ignorées.

### 📦 Runtime & Dépendances
- Bibliothèque Sharp pour le traitement d'images incluse dans le paquet (pas d'installation séparée nécessaire).

### ⚙️ Améliorations
- La détection de monstres du Killfeed priorise désormais les HP du monstre (avec tolérance), puis l'élément/niveau.
- Détection de cible TTK plus robuste grâce à la tolérance HP ; fenêtre de grâce du monstre ajustée de 5s à 2s.
- Le moteur de stats distingue mieux entre le bruit de niveau OCR et les vrais changements de niveau.
- ### D'autres améliorations du Killfeed suivront
- API-Fetch reconstruit dans le cadre de la plateforme. Toujours accessible dans les paramètres, en plus dans le Sidepanel.
- Paramètres → Documentation étendue.

### 🧹 Nettoyage
- Anciens artefacts Python d'API-Fetch supprimés (.py, .exe) au profit de la variante JS/Sidepanel.
- Ressources Tesseract restructurées dans les nouveaux sous-dossiers par plateforme.

:::accordion[Chemins de stockage par plateforme]
Toutes les données utilisateur se trouvent dans les répertoires suivants selon la plateforme :

| **Windows** | `%APPDATA%\Flyff-U-Launcher\user\` |
| **macOS** | `~/Library/Application Support/Flyff-U-Launcher/user/` |
| **Linux** | `~/.config/Flyff-U-Launcher/user/` |

**Nouveaux fichiers depuis 2.5.1 :**
- `user/tools/upgrades/upgrade_cost_calc.json` — Calculateur de coûts d'upgrade
- `user/logs/errors-*.txt` — Journaux d'erreurs
- `user/logs/ocr/` — Logs de debug OCR

:::

---
## 🆕 Version 2.5.1

### 🆕 Nouvelle fonctionnalité : Giant Tracker
Fenêtre autonome dans le plugin Killfeed — capture et visualise les statistiques de kills pour les **Giants**, **Violets** et **Bosses**.

**Onglets de filtre**
- 5 onglets : **Tous** · **Giants** · **Violets** · **Bosses** · **Drops**
- **Bosses** — filtre par rang `boss` (bordure de carte rouge, style d'icône dédié)
- **Drops** — affiche uniquement les monstres avec des drops enregistrés, y compris un aperçu du loot pool (top 5 items par rareté) directement dans la carte

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
- Délai de grâce de 10s lors de la désélection de la cible (buff, soin, etc.) — le temps de pause n'est pas compté dans le TTK
- Empreinte nom du monstre + HP max : la cible est reconnue de façon fiable
- Affichage : Dernier TTK, Ø TTK, Plus rapide
- Persisté dans l'historique des kills (colonne CSV `TTK_ms`)

**Divers**
- Tri par kills, nom ou niveau
- Champ de recherche pour filtrer par nom de monstre

### ✨ Améliorations supplémentaires
- Killfeed : détection des monstres améliorée
- Nouvelle pondération d'identification : HP du monstre > Niveau du monstre > Élément du monstre
- Killfeed : le suivi des monstres compte désormais les mobs tués
- Killfeed : historique introduit (par profil)
  - Fichier quotidien par date avec kills individuels (`Date/Heure`, `Personnage`, `Niveau`, `Monster-ID`, `Rang`, `Monstre`, `Élément`, `Gain EXP`, `EXP attendue`, `TTK_ms`)
  - Vue quotidienne agrégée avec `Kills`, `EXP totale`, `Répartition des monstres`, `Premier/Dernier kill`
- Killfeed : le suivi des monstres dans le Sidepanel se met maintenant à jour immédiatement après les kills (pas de changement d'onglet nécessaire)
- Killfeed : dans les accordéons de suivi des monstres, chaque rang dispose désormais d'un bouton Kills avec une ListView des kills individuels.
  Les kills individuels peuvent être supprimés directement dans la ListView.
  Lors de la suppression de kills individuels, les fichiers d'historique AppData (daily/YYYY-MM-DD.csv, history.csv) et l'état du Sidepanel sont mis à jour.
- Killfeed : le Sidepanel suit désormais de façon stable le profil cible de l'overlay (plus de saut entre les IDs de profil)
- Données de référence des monstres mises à jour
- Design du dialogue "Choisir un layout" optimisé
- Design du dialogue "Gérer les profils (déconnexion)" optimisé

### 🐛 Corrections de bugs
- Les overlays ne recouvrent plus le dialogue de fermeture
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
- `user/cache/` — Données API-Fetch & icônes
- `user/logs/` — Logs de diagnostic
:::

---

## 🆕 Version 2.3.0

### 🐛 Corrections de bugs

- Les valeurs OCR (Sidepanel) sont désormais correctement détectées lorsque le jeu tourne dans une fenêtre multi-fenêtres séparée
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
- Sidepanel on/off
- Barre d'onglets on/off
- Enregistrer une capture d'écran de la fenêtre active dans `C:\Users\<USER>\Pictures\Flyff-U-Launcher\`
- Onglet précédent / Onglet suivant
- Instance de fenêtre suivante
- Remettre le CD-Timer à 00:00, les icônes attendent un clic
- Ouvrir le calculateur FCoins
- Ouvrir la liste d'achats Premium

**Nouveaux paramètres client**
- Largeur / hauteur du launcher
- Charger les onglets de grille séquentiellement
- Affichage des onglets pour les mises en page
- Mettre en évidence la vue de grille active
- Actualiser les mises en page lors des modifications
- Durée des messages d'état
- Taux de change FCoins
- Mode d'affichage des onglets de mise en page (Compact, Groupé, Séparé, Mini-grille)

**Menus & Outils**
- Nouveau menu "Tools (icône étoile)" ajouté à la barre d'onglets.
  Ce menu masque la vue navigateur, les personnages restent connectés.
  - Outils internes : calculateur FCoins vers Penya, liste d'achats Premium
  - Liens externes : page d'accueil Flyff Universe, Flyffipedia, Flyffulator, Skillulator
- Nouveau menu dans la barre d'onglets (icône clavier) affichant les raccourcis configurés.
  Ce menu masque la vue navigateur, les personnages restent connectés.

**Documentation**
- Nouvel onglet "Documentation" dans le menu des paramètres avec des explications en plusieurs langues :
  - Créer un profil, créer une mise en page, chemins de données & persistance, API-Fetch,
    CD-Timer, Killfeed, FCoins <-> Penya, liste d'achats Premium
- Le texte est traduit dans toutes les langues disponibles. Certaines images manquent encore.
  Fallback : interface en anglais → interface en allemand.

**Divers**
- Nouveau thème "Steel Ruby" ajouté
- Le launcher affiche sous le fil d'actualités la liste des profils déjà ouverts
- Fonction de don ajoutée dans Paramètres → Support
- Le dialogue de fermeture en multi-onglets contient l'option "Séparer en onglets individuels"
- Lors de l'ouverture d'un profil alors qu'une session est déjà active, il est demandé s'il faut l'ajouter à la fenêtre actuelle ou créer une nouvelle fenêtre

### 🧹 Nettoyage

- La fenêtre du launcher a désormais une taille minimale et reste responsive jusqu'à ce seuil
- Taille par défaut du launcher modifiée de 980×640 à 1200×970
- Bouton "X" ajouté dans le menu des paramètres
- Taille de la fenêtre des paramètres ajustée
- Menu "Gérer" pour les profils et mises en page modifié. Il contient "Renommer" et "Supprimer"
- Bouton "Profils" ajouté dans la sélection de mise en page. Il affiche les profils contenus dans la mise en page
- Icône ajoutée pour le bouton d'agrandissement de la barre d'onglets
- Onglet actif mis en évidence dans le dialogue de fermeture

### 🐛 Corrections de bugs

- Correction d'un bug qui masquait le jeu lors du changement d'onglet

### 🐛 Problèmes connus

- Il arrive que les saisies de texte dans le Sidepanel n'arrivent pas correctement
- Les overlays s'affichent dans les fenêtres de dialogue, par ex. "Fermer" et "Choisir un layout"     ✅ corrigé en 2.4.1
- Le Sidepanel n'est pas affiché en mode fenêtre


---

## 🆕 Version 2.1.1

### ✨ Améliorations

- Les overlays ne recouvrent plus les fenêtres externes.
  Ils se masquent automatiquement lorsque la fenêtre est inactive.
- Scintillement des overlays lors du déplacement de la fenêtre corrigé.
  Là aussi, les overlays sont désormais correctement masqués.
- Le dernier onglet du layout dispose désormais d'un temps de chargement suffisant avant l'activation du splitscreen.
- Toutes les actions du dialogue de fermeture (sauf Annuler) sont désormais marquées comme boutons dangereux (rouges).
  "Annuler" reste volontairement neutre.
- Onglet Patchnotes ajouté dans le menu des paramètres.
  L'affichage se fait dans la langue sélectionnée.

### ➕ Nouvelles fonctionnalités

- Bouton "+" ajouté à la fin du CD-Timer

### 🧹 Nettoyage

- Onglet inutilisé retiré du dialogue d'icônes
- Badge "RM-EXP" inutilisé en haut à droite supprimé

---

## 🔄 Version 2.1.0

### 🚀 Nouveautés

- Les mises à jour peuvent désormais être effectuées directement via le launcher

---

## 🔄 Version 2.0.2

### 🐛 Corrections de bugs

- Correction d'un bug affichant le Sidepanel vide
- Correction d'erreurs de traduction
