## Fonctionnalités de base

:::accordion[Créer un profil]

**Étape 1 — Créer un nouveau profil :**
- Clique sur **"Nouveau profil"** dans l'en-tête.

![Description](create_profil/create_profil_1_de.png)

**Étape 2 — Saisir le nom du profil :**
- Saisis un nom pour le profil et clique sur **"Ajouter"**.
- Avec **"Fermer"**, le dialogue se ferme sans créer de profil.

![Description](create_profil/create_profil_2_de.png)

**Étape 3 — Comprendre la carte du profil :**

Chaque profil est affiché sous forme de carte dans la liste des profils :

![Description](create_profil/create_profil_3_de.png)

| N° | Élément | Description |
|----|---------|-------------|
| ❶ | Poignée de glissement | Trier les profils par glisser-déposer dans la liste |
| ❷ | Cible Overlay | Détermine quel profil reçoit les overlays OCR et le Sidepanel |
| ❸ | Cible Supporter | Détermine quel profil sert de vue supporter pour le CD-Timer |
| ❹ | Mode de lancement | Indique si le profil s'ouvre en mode onglet ou fenêtre |
| ❺ | Engrenage | Ouvrir les paramètres du profil |
| ❻ | Jouer | Lancer une session de jeu avec ce profil |

**Étape 4 — Paramètres du profil :**

Clique sur l'engrenage ❺ pour ouvrir les paramètres :

![Description](create_profil/create_profil_4_de.png)

| N° | Élément | Description |
|----|---------|-------------|
| ❶ | Nom du profil | Modifier le nom du profil |
| ❷ | Classe + nom du personnage | Choisir la classe via le menu déroulant et saisir le nom du personnage. Chaque personnage reçoit sa propre classe. |
| ❸ | Ajouter un personnage | Ajouter un autre nom de personnage au profil (avec le bouton "Ajouter") |
| ❹ | Utiliser dans les onglets | Activé : le profil peut être utilisé dans des layouts à plusieurs onglets. Désactivé : le profil n'ouvre qu'une fenêtre dédiée. |
| ❺ | Enregistrer | Appliquer les modifications |
| ❻ | Copier le profil | Crée une copie du profil avec tous les paramètres |
| ❼ | Supprimer | Supprimer définitivement le profil |
| ❽ | Fermer | Fermer le dialogue |

Si tu souhaites utiliser un profil à la fois en onglets et en mode fenêtre, copie-le avec ❻ et utilise une copie par mode.

**Étape 5 — Liste des profils avec personnages :**

Les profils configurés sont affichés dans la liste avec leurs noms de personnages et icônes de classe :

![Description](create_profil/create_profil_5_de.png)

- Chaque personnage est affiché sous forme de badge avec icône de classe sous le nom du profil.
- Le filtre de classe et la recherche par nom dans l'en-tête parcourent tous les personnages de tous les profils.
- Les plugins comme le Killfeed utilisent les noms de personnages enregistrés via une liste déroulante.

Tu peux créer autant de profils que tu veux. Chaque profil possède sa propre session Flyff sauvegardée.
Les paramètres en jeu ne sont pas transférés vers d'autres sessions comme dans un navigateur.

**Export/Import de profils :**

![small](create_profil/create_profil_6.png)

| N° | Élément | Description |
|----|---------|-------------|
| ❶ | Exporter | Enregistrer le profil en fichier `.flyffprofile` |
| ❷ | Importer | Charger un fichier `.flyffprofile` et créer un nouveau profil |

Le fichier exporté contient :

- Métadonnées du profil (nom, classe, paramètres)
- Cookies de session Electron (données de connexion)
- Données localStorage (paramètres du jeu)

Cela permet les sauvegardes et le transfert entre ordinateurs.
:::

:::accordion[Créer un layout]

**Étape 1 — Démarrer un layout :**

Clique sur **"Jouer"** sur un profil dont les onglets sont activés.

![Description](create_layout/create_layout_1_de.png)

**Étape 2 — Choisir la grille du layout :**

Sélectionne la grille souhaitée. Au survol, un **aperçu ASCII** de la grille s'affiche à droite.

![Description](create_layout/create_layout_2.png)

*Layouts symétriques :*
- **1×1** — Fenêtre unique
- **1×2 / 2×1** — Deux fenêtres côte à côte / empilées
- **1×3 / 3×1** — Trois fenêtres côte à côte / empilées
- **1×4 / 4×1** — Quatre fenêtres côte à côte / empilées
- **2×2** — Quatre fenêtres en grille
- **3+2** — Trois en haut, deux en bas
- **2×3** — Six fenêtres en grille
- **4+3** — Quatre en haut, trois en bas
- **2×4** — Huit fenêtres en grille

*Layouts asymétriques :*
- **1+2 →** — Fenêtre principale à gauche, 2 fenêtres secondaires empilées à droite
- **1+3 →** — Fenêtre principale à gauche, 3 fenêtres secondaires empilées à droite
- **1+2 ↓** — Fenêtre principale en haut, 2 fenêtres secondaires en dessous côte à côte
- **1+3 ↓** — Fenêtre principale en haut, 3 fenêtres secondaires en dessous côte à côte

Pour les layouts asymétriques, un **slider** apparaît dans la barre d'onglets, permettant d'ajuster la répartition entre fenêtre principale et fenêtres secondaires (min. 20 % / max. 80 %).

![small](create_layout/create_layout_slider.png)

**Étape 3 — Assigner les profils :**

Assigne un profil à chaque cellule. Les cellules non nécessaires peuvent rester vides.

![Description](create_layout/create_layout_3_de.png)

| N° | Élément | Description |
|----|---------|-------------|
| ❶ | Cellules du layout | Affiche les cellules de la grille choisie. Clique sur une cellule pour lui assigner un profil de la liste ci-dessous. |
| ❷ | Liste des profils | Tous les profils activés pour les onglets. Clique sur un profil pour l'assigner à la cellule sélectionnée. |
| ❸ | Suivant | Confirme l'assignation et lance le layout avec les profils assignés. |

**Étape 4 — Enregistrer le layout :**

Le bouton indiqué dans l'image (dans la barre de titre) ouvre le dialogue d'enregistrement.

![Description](create_layout/create_layout_4.png)

Donne un nom au layout et clique sur **"Enregistrer"**.

![Description](create_layout/create_layout_5_de.png)

**Étape 5 — Carte du layout dans le launcher :**

Les layouts enregistrés sont affichés sous forme de carte dans la liste des profils :

![Description](create_layout/create_layout_6_de.png)

- La carte affiche le **nom du layout**, le **nombre de profils** et une **miniature de la grille**.
- Via **"Jouer"**, le layout complet est lancé.
- Via l'**engrenage**, les paramètres du layout peuvent être ajustés (nom, assignation des profils, grille).

**Disposition personnalisée (Custom) :**

En plus des grilles prédéfinies, l'option **« Personnalisé »** permet de créer une disposition libre. L'éditeur permet de placer et redimensionner librement 1 à 8 cellules sur un canevas.

![Description](custom_layout_editor.png)

| N° | Élément | Description |
|-----|---------|-------------|
| ❶ | Ajouter une cellule | Ajoute une nouvelle cellule (max. 8). |
| ❷ | Grille | Précision d'accrochage lors du déplacement/redimensionnement (1 %, 5 % ou 10 %). |
| ❸ | Curseur | Définit une ligne de séparation ajustable : horizontale (↔), verticale (↕) ou aucune (—). La ligne verte peut être déplacée dans l'éditeur et permet un ajustement en temps réel. |
| ❹ | Cellules | Chaque cellule numérotée peut être déplacée et redimensionnée à l'aide des poignées sur les coins et les bords. |
| ❺ | Propriétés | Position X/Y et largeur/hauteur de la cellule sélectionnée en pourcentage. Les valeurs peuvent aussi être saisies directement. |
| ❻ | Supprimer la cellule | Supprime la cellule actuellement sélectionnée. |

Les cellules superposées sont empilées — la cellule du dessus reçoit les entrées. Après confirmation de la disposition, l'attribution des profils suit comme pour les grilles prédéfinies.

**Paramètres associés** (sous Paramètres / Layout) :
- **Charger les onglets de grille séquentiellement** — Démarrer les onglets un par un au lieu de simultanément
- **Actualiser les layouts lors de modifications** — Enregistrer automatiquement les modifications du layout
- **Mettre en surbrillance la vue de grille active** — Mettre en évidence l'onglet actuellement focalisé
- **Affichage des onglets pour les layouts** — Mode d'affichage des onglets de layout dans le launcher
- **Délai de layout** — Délai lors du changement d'onglet

**Raccourcis associés** (sous Paramètres / Raccourcis) :
- **Onglet précédent** / **Onglet suivant** — Changer d'onglet
- **Fenêtre suivante** — Basculer le focus entre les fenêtres ouvertes
- **Barre d'onglets on/off** — Afficher/masquer la barre d'onglets dans la fenêtre de session

**Multi-fenêtres :**

Outre les layouts, plusieurs fenêtres de session indépendantes peuvent être ouvertes en parallèle. Lors de l'ouverture d'un profil alors qu'une session est déjà active, il est demandé s'il faut l'ajouter à la fenêtre actuelle ou en créer une nouvelle.
:::

:::accordion[Raccourcis clavier]

Les raccourcis clavier sont des combinaisons de touches librement assignables (2–3 touches) qui fonctionnent même lorsque la fenêtre de jeu est active.

**Configuration :**
- Ouvre **Paramètres → Raccourcis clavier**.
- Clique sur le badge à côté d'une action et appuie sur la combinaison de touches souhaitée.
- Les conflits sont automatiquement détectés et affichés.

![Description](hotkeys/hotkeys_settings_de.png)

**Actions disponibles :**

| Action | Description |
|--------|-------------|
| Overlays on/off | Afficher ou masquer tous les overlays |
| Sidepanel on/off | Ouvrir ou fermer le Sidepanel |
| Barre d'onglets on/off | Afficher/masquer la barre d'onglets dans la fenêtre de session |
| Onglet précédent | Passer à l'onglet précédent |
| Onglet suivant | Passer à l'onglet suivant |
| Fenêtre suivante | Basculer le focus entre les fenêtres ouvertes |
| CD-Timer expiré | Remettre tous les CD-Timers à 00:00 (attendre l'appui sur la touche) |
| Capture d'écran | Enregistrer une capture d'écran de la fenêtre active |
| Calculateur FCoins | Ouvrir le calculateur FCoins |
| Liste d'achats | Ouvrir la liste d'achats Premium |

Les raccourcis configurés peuvent être consultés à tout moment via l'**icône clavier** dans la barre d'onglets.

![Description](hotkeys/hotkeys_menu_de.png)
:::

:::accordion[Chemins de données & persistance]

Toutes les données utilisateur se trouvent dans les répertoires suivants selon la plateforme :

| Plateforme | Chemin |
|------------|--------|
| **Windows** | `%APPDATA%\Flyff-U-Launcher\user\` |
| **macOS** | `~/Library/Application Support/Flyff-U-Launcher/user/` |
| **Linux** | `~/.config/Flyff-U-Launcher/user/` |

**Fichiers et dossiers importants :**

| Fonction | Rôle | Chemin relatif |
|----------|------|----------------|
| Profils | Profils du launcher (nom, classe, flags) | `user/profiles/profiles.json` |
| Calibrations ROI | Définitions ROI pour OCR/Killfeed | `user/profiles/rois.json` |
| Timers OCR | Taux d'échantillonnage OCR | `user/profiles/ocr-timers.json` |
| Layouts | Grilles de layouts pour les onglets | `user/ui/tab-layouts.json` |
| Thèmes | Thèmes utilisateur | `user/ui/themes.json` |
| Couleur d'onglet active | Paramètre de couleur d'onglet | `user/ui/tab-active-color.json` |
| Paramètres client | Tous les paramètres du launcher | `user/config/settings.json` |
| Feature flags | Fonctionnalités activées | `user/config/features.json` |
| Liste d'achats Premium | Prix FCoin par item | `user/shopping/item-prices.json` |
| Paramètres plugins | Réglages par plugin | `user/plugin-data/<pluginId>/settings.json` |
| Historique Killfeed | Vue quotidienne par profil | `user/plugin-data/killfeed/history/<id>/history.csv` |
| Kills individuels Killfeed | Historique détaillé par kill et par jour | `user/plugin-data/killfeed/history/<id>/daily/YYYY-MM-DD.csv` |
| Données API-Fetch | Données brutes/icônes pour les plugins | `user/cache/` |
| Journaux d'erreurs | Logs de diagnostic | `user/logs/` |
| Calculateur d'upgrade | Prix/paramètres sauvegardés | `user/tools/upgrades/upgrade_cost_calc.json` |

:::

## Plugins

Les plugins nécessitent en général des données et icônes de l'API. Tu peux les télécharger avec API-Fetch.

:::accordion[API-Fetch]

API-Fetch télécharge des données et icônes depuis l'API de Flyff Universe. D'autres plugins (Killfeed, CD-Timer, Quest Guide, liste d'achats Premium) ont besoin de ces données.

- Ouvre **"API-Fetch"** dans le menu des paramètres ou dans le Sidepanel.
![Description](api_fetch/api_fetch_1.png)

- Sélectionne les endpoints nécessaires et clique sur **"Start"**.
![Description](api_fetch/api_fetch_2.png)

La progression peut être suivie en direct. Le statut indique quels endpoints ont déjà été traités.
En raison de la limite de l'API, de courtes pauses sont effectuées pour respecter les taux.
![Description](api_fetch/api_fetch_3.png)

API-Fetch est également disponible dans le Sidepanel.
![Description](api_fetch/api_fetch_4.png)

**Endpoints disponibles :**

| Endpoint | Requis par |
|----------|------------|
| **Monster** | Killfeed, Giant Tracker |
| **Item** | CD-Timer, liste d'achats Premium, Quest Guide |
| **Skill** | CD-Timer |
| **Quest** | Quest Guide |
| **NPC** | Quest Guide |

:::

:::accordion[CD-Timer]
- Suit les cooldowns de tes compétences/objets. À l'expiration d'un timer, une icône avec un bord rouge invite à appuyer sur la touche correspondante.
- API-Fetch requis pour afficher les icônes : "Item" + "Skill".

- Assure-toi que le CD-Timer est activé.
![Description](cd_timer/cd_timer_1_de.png)

- L'onglet CD-Timer est alors disponible dans le Sidepanel :
![Description](cd_timer/cd_timer_2_de.png)
- "0/0 actifs" indique combien de timers sont configurés et combien sont actifs.
- La case "Tous actifs" active tous les timers.
- Le bouton "Tous expirés" remet tous les timers à 0:00:00,
  c'est-à-dire qu'il attend l'appui sur la touche configurée.

- L'affichage des icônes de timer est configurable : position X et Y, taille des icônes et nombre de colonnes.

- Clique sur "+" pour créer un nouveau timer.

- ![Description](cd_timer/cd_timer_3_de.png)
- La case active ce timer.
- Le bouton "Icône" ouvre un dialogue pour choisir l'icône.
- Le texte du champ de saisie est affiché sur l'icône.
  Astuce : indique la touche attendue, par ex. "F1"
- Après avoir réglé la durée et le raccourci, la cible peut être sélectionnée.
  Main (icône épée dans le launcher) ou vue Support (icône bâton dans le launcher)
 Ce paramètre détermine dans quelle fenêtre l'appui sur la touche est attendu.
  L'icône est toujours affichée dans la fenêtre du Main.
 Tu peux donc configurer des timers pour les buffs RM et afficher dans le Main qu'ils doivent être renouvelés.


- ![Description](cd_timer/cd_timer_4_de.png)

- Les timers ciblant la vue Support ont un reflet orange pour les distinguer.


- ![Description](cd_timer/cd_timer_5_de.png)
:::

:::accordion[Killfeed]
- Suit les kills et les points d'expérience (EXP) en temps réel à l'aide du système OCR.
- API-Fetch requis pour afficher les données des monstres : "Monster"

**Fonctionnalités :**
- Détection de kills via OCR (les changements d'EXP sont automatiquement détectés)
- Statistiques de session et globales (kills, EXP, kills/heure, EXP/heure, etc.)
- Badges overlay affichés directement dans la fenêtre de jeu

**Remarque :**
- Actuellement, le Killfeed ne supporte que le leveling 1v1.
- Un changement de personnage peut causer des confusions.

**Configuration :**

1. **Si ce n'est pas déjà fait : télécharger les données API**
   - Ouvre le plugin [API-Fetch](action:openPlugin:api-fetch) et assure-toi que l'endpoint **"Monster"** est sélectionné.
   - Lance le téléchargement. Les données des monstres sont nécessaires pour valider les kills par rapport à la table d'EXP.
     (voir documentation API-Fetch)
2. **Activer le plugin**
   - Ouvre les paramètres de plugins dans le launcher et assure-toi que **Killfeed** est activé.

3. **Calibrer les régions OCR** (une fois par profil)
   - Lance une fenêtre de jeu avec le "bouton épée" actif depuis le launcher.
   - Ouvre la calibration ROI (Region of Interest) dans le Sidepanel.
   - Trace des zones autour des affichages suivants dans le jeu :
     - **EXP%** — l'affichage des points d'expérience
     - **Level** — l'affichage du niveau
     - **Nom du personnage** — le nom du personnage
   - Enregistre les régions. Elles sont sauvegardées par profil et ne doivent être configurées qu'une seule fois.
   - Les ROI peuvent être déplacés avec le clic gauche.
   - Après avoir défini un ROI, appuie sur TAB pour sélectionner le suivant.
   - Définis pour le Killfeed : LVL, NAME, EXP, ENEMY (niveau de l'ennemi), ENEMY HP
   - Appuie sur "Fermer" ou ESC pour terminer la saisie des ROI.
   - Les ROI peuvent encore être ajustés finement après le tracé.
   - Les valeurs reconnues peuvent être consultées en direct dans le Sidepanel.
   - Les plus importants sont LVL et EXP ; ENEMY et ENEMY HP n'ont qu'un rôle de support pour l'instant et seront plus importants à l'avenir.
   - Si le niveau affiché dans l'OCR en direct n'est pas correctement reconnu, il peut être défini manuellement ;
    la valeur définie manuellement a la priorité sur la valeur OCR.
   - Si l'OCR fait une erreur sur la valeur EXP (par ex. lors d'un changement de personnage), celle-ci peut être réinitialisée manuellement.
     Les règles EXP pourraient empêcher la correction automatique.



4. **Sélectionner le profil dans le Sidepanel**
   - Ouvre le Sidepanel et sélectionne l'onglet **Killfeed**.
   - Choisis dans le menu déroulant le profil à suivre.
   - Les noms de personnages sont choisis via une liste déroulante depuis le profil — pas besoin de les saisir manuellement.


5. **Jouer**
   - Dès que tu vaincs des monstres, le système OCR détecte les changements d'EXP.
   - Les kills et statistiques sont automatiquement affichés dans l'overlay et le Sidepanel.

**Sidepanel :**
- Active ou désactive des badges individuels (par ex. kills/session, EXP/heure, kills avant level-up).
- Ajuste l'échelle de l'overlay (0.6x – 1.6x).
- Choisis sur combien de lignes les badges doivent être affichés.
- L'overlay peut être déplacé par glisser-déposer à n'importe quelle position dans la fenêtre de jeu. La position est sauvegardée.
- Réinitialise les statistiques de session avec le bouton Reset.
- Les données de chaque session sont sauvegardées localement sur ton ordinateur.



- Chaque kill reconnu est affiché dans le Sidepanel et sauvegardé de façon permanente.
- La sauvegarde se fait par profil dans des fichiers CSV sous AppData :
  - `user/plugin-data/killfeed/history/<profile-id>/daily/YYYY-MM-DD.csv` (kills individuels)
  - `user/plugin-data/killfeed/history/<profile-id>/history.csv` (vue quotidienne)
- Dans les accordéons de suivi des monstres, un bouton `Kills` est disponible par rang.
- `Kills` ouvre une ListView avec les kills individuels du rang sélectionné.
-

- Dans la ListView, les kills individuels peuvent être supprimés (`Supprimer` -> `Confirmer`).
- Lors de la suppression, l'affichage du Sidepanel et les fichiers d'historique Killfeed (`daily/YYYY-MM-DD.csv` et `history.csv`) sont directement mis à jour.



**Détection de kill — règles :**
Un kill est compté lorsque toutes les conditions suivantes sont remplies :
- Le niveau n'a pas changé (pas de level-up / level-down).
- L'EXP a augmenté de plus de 0,001% (seuil epsilon).
- Le saut d'EXP est de maximum 40% (seuil de suspicion). Les sauts au-dessus sont marqués comme suspects et rejetés.
- Dans les dernières 1500 ms, une barre de PV ennemie a été détectée (OCR). Alternativement : sans barre de PV, un kill est accepté si l'intervalle depuis le dernier kill est d'au moins 2250 ms.
- Si des données de monstres d'API-Fetch sont disponibles : le gain d'EXP doit être entre 10% et 10 fois la valeur attendue de la table d'EXP des monstres. Les valeurs en dehors sont rejetées comme erreurs OCR.

**Changements d'EXP rejetés :**
- Level-up ou level-down : pas de kill compté.
- EXP en baisse : ignoré (bruit OCR).
- Saut d'EXP supérieur à 40% : marqué comme suspect et non compté.
- Pas de barre de PV et moins de 2250 ms depuis le dernier kill : pas de kill compté.

**Remarques :**
- Le système OCR doit être actif pour que les kills soient détectés.
- Les statistiques comme kills/heure sont calculées sur une fenêtre glissante de 5 minutes.
:::

:::accordion[Killfeed : Giant Tracker]
# ATTENTION :
## Jusqu'au premier kill enregistré d'un Giant, Violet ou Boss, des données d'exemple sont affichées pour présenter la fonction.
---
Le Giant Tracker est une fenêtre autonome au sein du plugin Killfeed. Il capture et visualise les statistiques de kills pour les **Giants**, **Violets** et **Bosses** — incluant les périodes, les drops et le Time to Kill (TTK). Les cinq onglets de filtre (Tous, Giants, Violets, Bosses, Drops) permettent un filtrage ciblé par rang ou par drops enregistrés.

**Ouverture :**
- Le bouton **"Giant Tracker"** se trouve dans le Sidepanel du Killfeed.
- Un clic ouvre une fenêtre séparée avec l'aperçu de tous les monstres boss suivis.
- S'il n'y a pas encore de données de kills réelles, des données d'exemple sont affichées.

![Description](killfeed_giant_tracker/killfeed_giant_tracker_1_de.png)

---

**Filtrage et tri :**
- La barre de filtres permet de restreindre l'affichage :
  - **Tous** / **Giants** / **Violets** / **Bosses** / **Drops** — filtre par rang de monstre ou par drops.
  - **Bosses** — affiche uniquement les monstres de rang `boss` (par ex. Clockworks, Meteonyker). Les cartes de boss ont une bordure rouge.
  - **Drops** — affiche uniquement les monstres ayant au moins un drop enregistré. De plus, un aperçu du loot pool (top 5 items par rareté) est affiché directement dans la carte.
  - **Tri** — par kills (croissant/décroissant), nom (A–Z / Z–A) ou niveau (croissant/décroissant).
  - **Champ de recherche** — filtre les cartes par nom de monstre.

![Description](killfeed_giant_tracker/killfeed_giant_tracker_2_de.png)

---

**Vues des cartes :**

Chaque monstre suivi est affiché sous forme de carte. Il existe deux vues :

*Carte compacte (vue par défaut) :*
- Icône du monstre, nom, niveau, élément, rang
- Valeurs de combat (PV, ATQ)
- Aperçu des kills : Aujourd'hui / Total
- Affichage TTK (si des mesures sont disponibles) : `TTK: 45.2s (Ø 52.3s)`
- Dernier kill (indication de temps), nombre de drops
- Bouton **"Détails"** pour développer

![Description](killfeed_giant_tracker/killfeed_giant_tracker_3_de.png)

*Carte étendue (vue détaillée) :*
- Tous les champs de la carte compacte
- Statistiques de kills par période : Aujourd'hui, Semaine, Mois, Année, Total
- Statistiques TTK : Ø TTK, Dernier TTK, Plus rapide
- Section drops : Nombre de drops, Ø kills par drop, kills depuis le dernier drop
- Historique des drops (repliable/dépliable) : drops individuels avec nom d'item, compteur de kills et horodatage
- Bouton **"Enregistrer un drop"** pour enregistrer un drop
- Bouton **"Réduire"** pour fermer la vue détaillée

![Description](killfeed_giant_tracker/killfeed_giant_tracker_4_de.png)

---

**Suivi des drops :**

Le bouton **"Enregistrer un drop"** dans la carte étendue ouvre un dialogue :
- Affiche le loot pool du monstre (si les données des monstres ont été téléchargées via API-Fetch).
- Les items peuvent être recherchés par nom et filtrés par rareté (Commun, Peu commun, Rare, Très rare, Unique, Ultime).
- Un clic sur un item enregistre le drop avec l'horodatage actuel et le compteur de kills.
- Les drops déjà enregistrés peuvent être supprimés individuellement dans l'historique des drops.

![Description](killfeed_giant_tracker/killfeed_giant_tracker_5_de.png)
![Description](killfeed_giant_tracker/killfeed_giant_tracker_6_de.png)

---

**Time to Kill (TTK) :**

Le TTK mesure automatiquement la durée du combat contre un monstre boss — du premier coup au kill.

*Fonctionnement :*
- **Début :** La barre de PV ennemie est détectée avec `actuel < max` (combat commencé).
- **Fin :** Le kill est confirmé via la détection d'EXP. Le temps de combat accumulé est sauvegardé.
- **Pause :** La barre de PV disparaît (par ex. en désélectionnant la cible pour buff ou soin). Un délai de grâce de 10 secondes commence.
- **Reprise :** Si le même monstre boss est re-ciblé dans le délai de 10 secondes, le timer continue. Le temps de pause n'est pas compté dans le TTK.
- **Abandon :** Si le délai de grâce expire sans que le boss soit re-ciblé, la mesure TTK est annulée.

*Identification de la cible :*
- Au début du combat, le nom du monstre et les PV max sont sauvegardés.
- Lors d'un re-ciblage, il est vérifié si le nom et les PV max correspondent — ce n'est qu'alors que le timer reprend.
- Si un autre monstre boss est ciblé, la mesure en cours est annulée et une nouvelle commence.
- Si un monstre normal est ciblé, le timer du boss se met en pause ; les kills normaux continuent d'être comptés.

*Affichage et statistiques :*
- Carte compacte : `TTK: [dernier kill] (Ø [moyenne])`
- Carte étendue : Ø TTK, Dernier TTK, Plus rapide
- Les valeurs TTK sont sauvegardées par kill dans l'historique CSV (colonne `TTK_ms`) et agrégées par monstre.

*Limitation :*
- La mesure TTK n'est active que pour les Giants, Violets et Bosses. Les monstres normaux ne sont pas mesurés.
- La précision dépend du taux d'échantillonnage OCR (typique : toutes les 500–1000 ms).

---

**Sources de données :**
- Les données de kills proviennent de l'historique CSV Killfeed (`daily/YYYY-MM-DD.csv`).
- Les logs de drops sont stockés séparément par profil.
- Les détails des monstres (icône, PV, ATQ, loot pool) proviennent des données téléchargées via API-Fetch.

:::


:::accordion[Quest Guide]
- Affiche les quêtes disponibles filtrées par niveau, région et type — avec visualisation de chaîne et suivi de progression par profil.
- API-Fetch requis : **Quest**, **NPC**, **Monster**, **Item**

**Configuration :**
1. Assure-toi que le plugin **Quest Guide** est activé.
2. Télécharge les données API nécessaires via API-Fetch (Quest, NPC, Monster, Item).
3. Sélectionne l'onglet **Quest Guide** dans le Sidepanel.

**Filtre & recherche :**
- **Champ de recherche** — filtre par nom de quête, NPC ou item
- **Mode de niveau :**
  - *OCR ±* — affiche les quêtes correspondant au niveau actuellement reconnu par OCR (avec tolérance ajustable, par défaut : ±5)
  - *Manuel* — saisir le niveau et la tolérance manuellement
  - *Min–Max* — définir une fenêtre de niveau fixe (par défaut : 1–30)
- **Région** — restreint l'affichage à une région de jeu spécifique
- **Filtre de type** — Tous / Chaîne / Quotidienne / Répétable / Catégorie
- **Sous-catégorie** — Pour les quêtes répétables : Animaux domestiques, Collection, Chasse aux monstres, Livraison, Divers

**Suivi de progression :**
- Marquer les quêtes comme terminées — la progression est sauvegardée par profil
- Case "Afficher les terminées" pour afficher/masquer
- Case "Afficher les non disponibles" pour afficher/masquer
- Bouton Reset pour réinitialiser la progression

**Barre de statistiques :**
Affiche le nombre total de quêtes, disponibles et terminées en un coup d'œil.

**Carte des quêtes :**
- Ouvre une carte interactive avec les emplacements des quêtes via le bouton carte dans le Sidepanel.

![Description](quest_guide/quest_guide_sidepanel_de.png)
![Description](quest_guide/quest_guide_map_de.png)
:::

## Outils

Les outils peuvent être ouverts soit par raccourci clavier, soit dans la barre d'onglets via le menu (étoile).

:::accordion[Fcoin <-> Penya]

![Description](tools/fcoin_zu_penya/fcoin_zu_penya_1.png)
- Convertit les FCoins en Penya et inversement.
- Saisis le taux actuel de Penya par FCoin. Le taux est sauvegardé et automatiquement rechargé à la prochaine ouverture.
- Modifie le montant de FCoins ou le résultat en Penya — le calcul s'effectue automatiquement dans les deux sens.

![Description](tools/fcoin_zu_penya/fcoin_zu_penya_2.png)

:::

:::accordion[Liste d'achats Premium]
- Outil de planification pour les achats dans la boutique Premium ; utile pour calculer les besoins avant l'achat de FCoins. Les pop-ups doivent être autorisés.
- Pré-requis : charger l'endpoint API-Fetch **"Item"** avec les icônes ; sans ces données, la recherche reste vide.
![Description](tools/premium_shopping_list/premium_shopping_list_1.png)
- Utilisation :
  1. Ouvre l'outil dans le menu (étoile) et saisis le nom de l'item dans le champ de recherche.
  2. La liste de résultats (max. 20) affiche l'icône, le nom et la catégorie ; ajouter avec **"+ Add"** ou augmenter la quantité.
  ![Description](tools/premium_shopping_list/premium_shopping_list_2.png)
  3. Dans la liste, définis le prix (FCoins) et la quantité par item ; le prix est sauvegardé en quittant le champ et pré-rempli lors des futures recherches.
  4. La case à cocher marque les items terminés/achetés, "X" supprime une entrée.
  5. La barre en bas affiche la somme de toutes les entrées (`prix × quantité`) en FCoins.
- Stockage : les prix sont sauvegardés de façon permanente dans le dossier de données du launcher ; la liste elle-même est renouvelée à chaque session.

:::

:::accordion[Calculateur d'upgrade]

Tous les types d'upgrade dans une seule fenêtre avec navigation par barre latérale. Calcule les coûts estimés, les quantités de matériaux et le nombre de tentatives.

![Description](tools/upgrade_cost_calc/upgrade_cost_calc_1.png)

**Sections de la barre latérale :**

| Section | Dé | Protection |
|---------|-----|------------|
| **Arme / Armure / Bouclier** | Powerdice 4/6 ou 12 | S-Protect / Low S-Protect |
| **Bijou** | Dice 8 | A-Protect |
| **Piercing d'armure** | Dice 8 | G-Protect |
| **Piercing d'arme/bouclier** | Dice 8 | G-Protect |
| **Arme Ultimate** | – | Ultimate Orb + XProtect |
| **Bijou Ultimate** | – | Ultimate Orb + XProtect |

**Paramètres (Arme / Armure) :**

- **Type de dé :** Powerdice 4/6 (standard) ou Powerdice 12 (chance de succès plus élevée)
- **Du niveau / Au niveau :** Définir la plage d'upgrade (par ex. +3 → +7)
- **Mode :**
  - **Comparer** — Affiche les coûts des deux systèmes de protection côte à côte
  - **SProtect** — Calcule avec les scrolls S-Protect classiques
  - **Low SProtect** — Calcule avec les scrolls Low SProtect moins chers

**Prix des matériaux :**

Sous "Matériaux", les prix actuels du marché peuvent être saisis. Avec la case "Possédé", les matériaux sont exclus du calcul des coûts.

![Description](tools/upgrade_cost_calc/upgrade_cost_calc_2.png)

**Résultat :**

Après un clic sur "Calculer", un tableau détaillé par niveau d'upgrade apparaît :

| Colonne | Signification |
|---------|---------------|
| Niveau | Niveau d'upgrade cible |
| Chance | Chance de succès en pourcentage |
| Tentatives | Nombre de tentatives attendu |
| Minéral | Minéraux nécessaires |
| Eron | Erons nécessaires |
| Penya | Coûts en Penya |
| Protections | Scrolls de protection nécessaires |
| Coût total | Somme de tous les coûts en Penya |

![Description](tools/upgrade_cost_calc/upgrade_cost_calc_3.png)

En mode comparaison, les deux systèmes de protection sont affichés côte à côte — l'option la moins chère est mise en surbrillance en vert.

**Stockage :** Les prix et paramètres sont automatiquement sauvegardés.

:::

## Divers

:::accordion[Annonces]

Dans le panneau droit du launcher, des messages du développeur sont affichés — sans qu'une mise à jour de l'application soit nécessaire. Exemples : bugs connus, développements en cours ou fonctionnalités prévues. L'affichage est disponible en allemand et en anglais et peut être désactivé dans les paramètres.

![Description](announcements/announcements_de.png)
:::

:::accordion[Messages et journal d'erreurs (Logs)]

Via l'**icône de log** dans la barre d'onglets, une fenêtre séparée s'ouvre avec le journal d'erreurs.

**Fonctionnalités :**
- Affiche tous les messages d'avertissement et d'erreur avec horodatage : `[HH:MM:SS] [LEVEL] [MODULE] Message`
- **Supprimer** — Effacer toutes les entrées de log
- **Enregistrer** — Exporter les logs en fichier `.txt` (sous `user/logs/`)
- **Envoyer un message** — Envoyer les logs directement au développeur (Discord)
  - Optionnel : ajouter une description et un nom ingame/Discord
  - Cooldown de 60 secondes pour éviter les envois multiples accidentels

![Description](logs/logs_window_de.png)
:::

:::accordion[Vérification des mises à jour et rollback de version]

**Mises à jour automatiques :**
- Le launcher vérifie au démarrage si une nouvelle version est disponible (configurable dans les paramètres).
- Si une mise à jour est disponible, un dialogue avec possibilité de téléchargement s'affiche.
- Pendant le téléchargement, la progression est affichée sous forme de barre de pourcentage.
- Après le téléchargement, la mise à jour est installée au prochain redémarrage.

**Vérification manuelle :**
- Sous **Paramètres → Comportement** se trouve un bouton **"Vérifier maintenant"**.

**Rollback de version :**
- Les anciennes versions du launcher (à partir de 3.0.5) peuvent être installées directement depuis les paramètres.
- Un menu déroulant affiche toutes les releases GitHub disponibles avec la date et le marquage de la version actuelle.
- Après sélection d'une version, celle-ci est téléchargée et installée au redémarrage.

![Description](settings/settings_update_de.png)
:::

:::accordion[Affichage RAM]

Sous **Paramètres → Affichage → "Afficher l'utilisation RAM"**, un affichage mémoire peut être activé dans la barre d'onglets.

**Fonctionnalités :**
- Affiche la consommation mémoire totale en Mo.
- Un clic ouvre une ventilation détaillée :
  - Consommation mémoire par profil
  - Consommation mémoire des plugins (estimée, car partagée)
  - Overhead système (launcher + OCR)

![Description](ram/ram_display_de.png)
:::
