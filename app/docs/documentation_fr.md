## Fonctionnalités de base

:::accordion[Créer un profil]

- Clique sur **« Nouveau profil »** dans l’en-tête.

![Description](create_profil/create_profil_1_fr.png)

- Saisis un nom de profil puis clique sur **« Ajouter »**.

![Description](create_profil/create_profil_2_fr.png)

- Clique sur l’icône engrenage pour ouvrir les paramètres du profil.

![Description](create_profil/create_profil_3_fr.png)

Dans ce menu tu peux :

- changer le nom du profil ;
- choisir une classe (détermine l’emblème et sert de filtre de recherche) ;
- définir si le profil peut être ouvert plusieurs fois en même temps.

Si **« Utiliser dans les onglets »** est activé, le profil peut être utilisé plusieurs fois en parallèle.  
Sinon il s’ouvre dans une seule fenêtre.

Si tu veux les deux variantes, duplique le profil : une copie avec l’option activée, une sans.  
Remarque : une seule variante d’un même profil peut être utilisée simultanément.

![Description](create_profil/create_profil_4_fr.png)

Tu peux créer autant de profils que tu veux. Chaque profil possède sa propre session Flyff.  
Les réglages en jeu ne sont pas partagés entre sessions comme dans un navigateur.
:::

:::accordion[Créer une mise en page]

- Clique sur **« Jouer »** dans l’onglet d’un profil créé. Assure-toi que ce profil est autorisé pour les onglets.  
![Description](create_layout/create_layout_1_fr.png)

- Choisis la grille de mise en page souhaitée.  
![Description](create_layout/create_layout_3.png)

- Choisis un profil pour chaque cellule puis clique sur **« Suivant »**.  
![Description](create_layout/create_layout_4_fr.png)

- Clique sur **« + »** pour ajouter d’autres onglets de mise en page.  
![Description](create_layout/create_layout_5.png)

- Enregistre la mise en page pour la lancer depuis le launcher.  
![Description](create_layout/create_layout_6.png)  
![Description](create_layout/create_layout_7.png)

- Les onglets peuvent être renommés par clic droit.
- Les onglets peuvent être chargés séquentiellement ou simultanément.  
  -> Paramètres / Client Settings / Charger les onglets de grille séquentiellement
:::

:::accordion[Chemins de données & persistance (Windows)]

Toutes les données utilisateur sont stockées par défaut dans `%APPDATA%/Flyff-U-Launcher/` (Electron `userData`). Fichiers/dossiers importants :

| Fonction/Fichier            | Rôle                                           | Chemin relatif à `%APPDATA%/Flyff-U-Launcher` |
|-----------------------------|------------------------------------------------|-----------------------------------------------|
| Données & icônes API-Fetch  | Données/icônes brutes pour plugins (items, monstres…) | `api_fetch/<endpoint>/...`                    |
| Prix Premium Shopping List  | Prix FCoin par item                            | `item-prices.json`                            |
| Profils                     | Profils du launcher (nom, classe, flags)       | `profiles.json`                               |
| Layouts                     | Grilles d’onglets                              | `tabLayouts.json`                             |
| Calibrations ROI            | Définitions ROI pour OCR/Killfeed              | `rois.json`                                   |
| Timers OCR                  | Taux d’échantillonnage OCR (Killfeed/CD-Timer) | `ocr-timers.json`                             |
| Paramètres plugins          | Réglages par plugin (killfeed, cd-timer, …)    | `plugin-data/<pluginId>/settings.json`        |
| Thèmes & couleurs d’onglet  | Thèmes perso / couleur d’onglet actif          | `themes.json`, `tabActiveColor.json`          |

:::

## Plugins

Les plugins ont en général besoin de données et d’icônes API. Télécharge-les via API-Fetch.

:::accordion[API-Fetch]

- Ouvre **« API-Fetch »**.  
![Description](api_fetch/api_fetch_1.png)  
![Description](api_fetch/api_fetch_2.png)

- Les plugins attendent les données API dans un dossier précis. Vérifie qu’il est indiqué en sortie.  
![Description](api_fetch/api_fetch_3.png)

- Sélectionne les endpoints nécessaires puis clique sur **« Start »**.  
![Description](api_fetch/api_fetch_4.png)

:::

:::accordion[CD-Timer]
- Suit les temps de recharge de tes compétences/objets. À expiration, une icône à bord rouge invite à appuyer sur la touche configurée.
- API-Fetch requis pour afficher les icônes : "Item" + "Skill".

- Assure-toi que CD-Timer est activé.  
![Description](cd_timer/cd_timer_1_de.png)

- L’onglet CD-Timer apparaît alors dans le panneau latéral :
![Description](cd_timer/cd_timer_2_de.png)
- « 0/0 aktiv » indique combien de timers sont configurés et actifs.
- La case « Alle aktiv » active tous les timers.
- Le bouton « Alle abgelaufen » remet tous les timers à 0:00:00, en attente de la touche.

- L’affichage des icônes est paramétrable : position X/Y, taille, nombre de colonnes.

- Clique sur « + » pour ajouter un timer.

- ![Description](cd_timer/cd_timer_3_de.png)
- La case active ce timer.
- Le bouton « Icon » ouvre la sélection d’icône.
- Le texte saisi s’affiche sur l’icône. Astuce : indique la touche attendue (ex. « F1 »).
- Après avoir réglé durée et hotkey, choisis la cible :  
  Main (icône épée dans le launcher) ou vue Support (icône bâton).  
  Cela définit dans quelle fenêtre la touche est attendue. L’icône s’affiche toujours dans la fenêtre Main.  
  Tu peux ainsi configurer des timers pour les buffs RM et afficher dans le Main qu’ils doivent être relancés.


- ![Description](cd_timer/cd_timer_4_de.png)

- Les timers visant la vue Support ont une lueur orange pour les distinguer.


- ![Description](cd_timer/cd_timer_5_de.png)
:::

:::accordion[Killfeed]
- Suit les kills et l’EXP en temps réel via OCR.
- API-Fetch requis pour les données monstres : "Monster".

**Fonctionnalités :**
- Détection des kills par OCR (changements d’EXP détectés automatiquement)
- Statistiques session et globales (kills, EXP, kills/h, EXP/h, etc.)
- Badges d’overlay affichés directement dans la fenêtre de jeu

**Remarque :**
- Actuellement, le killfeed ne supporte que le leveling 1v1.
- Plus tard : extension à l’AOE et suivi par groupe de monstres et boss.

**Configuration :**

1. **Si nécessaire : télécharger les données API**
   - Ouvre le plugin [API-Fetch](action:openPlugin:api-fetch) et coche l’endpoint **« Monster »**.
   - Lance le téléchargement. Les données monstres servent à valider les kills via la table d’EXP.  
     (voir documentation API-Fetch)
2. **Activer le plugin**
   - Dans le launcher, ouvre les paramètres plugins et active **Killfeed**.  
   ![Description](killfeed/killfeed_1_de.png)

3. **Calibrer les zones OCR** (une fois par profil)
   - Lance une fenêtre de jeu avec le « bouton épée » depuis le launcher.  
    ![Description](killfeed/killfeed_2_de.png)
   - Ouvre le calibrage ROI dans le panneau latéral.
   - Trace des zones autour des éléments :
     - **EXP%** – affichage d’expérience
     - **Level** – niveau
     - **Character name** – nom du personnage
   - Sauvegarde les zones. Elles sont stockées par profil et ne se font qu’une fois.  
    ![Description](killfeed/killfeed_3_de.png)
   - Clic gauche pour déplacer les ROI.
   - Après un ROI, appuie sur TAB pour sélectionner le suivant.  
    ![Description](killfeed/killfeed_4_de.png)
   - Pour Killfeed, définis : LVL, NAME, EXP, ENEMY (niveau ennemi), ENEMY HP
   - Appuie sur « Schließen » ou ESC pour finir.  
    ![Description](killfeed/killfeed_5_de.png)
   - Les ROI peuvent être affinés après tracé.  
    ![Description](killfeed/killfeed_6_de.png)
   - Les valeurs reconnues sont visibles en direct dans le panneau.
   - Les plus importantes : LVL et EXP ; ENEMY et ENEMY HP sont surtout utiles pour l’avenir.
   - Si le niveau affiché est faux, règle-le manuellement : la valeur manuelle prime sur l’OCR.
   - Si l’OCR « avale » l’EXP (p. ex. changement de perso), remets-le à la main ;  
     les règles EXP peuvent bloquer la correction auto.
   - ![Description](killfeed/killfeed_7_de.png)


4. **Choisir le profil dans le panneau**
   - Ouvre le panneau latéral, onglet **Killfeed**.
   - Sélectionne le profil à suivre dans la liste.  
    ![Description](killfeed/killfeed_8_de.png)


5. **Jouer**
   - En tuant des monstres, l’OCR détecte les changements d’EXP.
   - Kills et stats s’affichent automatiquement en overlay et dans le panneau.

**Panneau latéral :**
- Active/désactive chaque badge (kills/session, EXP/h, kills avant level-up, etc.).
![Description](killfeed/killfeed_9_de.png)
- Ajuste l’échelle de l’overlay (0.6x–1.6x).
- Choisis sur combien de lignes les badges s’étalent.
![Description](killfeed/killfeed_10_de.png)
- Remets à zéro les stats de session via le bouton Reset.
- Chaque session est sauvegardée localement.

![Description](killfeed/killfeed_11_de.png)

- Chaque kill détecté est affiché dans le panneau latéral et enregistré de façon persistante.
- L’enregistrement se fait par profil dans des fichiers CSV sous AppData :
  - `user/plugin-data/killfeed/history/<profile-id>/daily/YYYY-MM-DD.csv` (kills individuels)
  - `user/plugin-data/killfeed/history/<profile-id>/history.csv` (résumé journalier)
- Les accordéons de suivi des monstres proposent un bouton `Kills` pour chaque rang.
- `Kills` ouvre une vue liste des kills individuels du rang sélectionné.

![Description](killfeed/killfeed_12_de.png)

- Dans la vue liste, les kills individuels peuvent être supprimés (`Delete` -> `Confirm`).
- La suppression met à jour directement l’affichage du panneau latéral et les fichiers d’historique Killfeed (`daily/YYYY-MM-DD.csv` et `history.csv`).

![Description](killfeed/killfeed_13_de.png)


**Détection d’un kill – règles :**
Un kill est compté si toutes les conditions suivantes sont vraies :
- Le niveau n’a pas changé (pas de level-up/down).
- L’EXP a augmenté de plus de 0,001% (epsilon).
- Le saut d’EXP est ≤ 40% (suspect). Au-dessus, marqué suspect et ignoré.
- Dans les 1500 ms dernières, une barre de PV ennemie a été détectée (OCR). Sinon : sans barre, un kill est accepté si ≥ 2250 ms depuis le dernier kill.
- Si données monstres API-Fetch présentes : le gain EXP doit être entre 10% et 10× de la valeur attendue de la table EXP. Sinon considéré comme erreur OCR.

**EXP rejetées :**
- Level-up/down : pas de kill compté.
- EXP en baisse : ignorée (bruit OCR).
- Saut d’EXP > 40% : suspect, non compté.
- Pas de barre HP et < 2250 ms depuis le dernier kill : non compté.

**Notes :**
- L’OCR doit être actif pour détecter les kills.
- Les stats type kills/h sont calculées sur une fenêtre roulante de 5 minutes.
:::

:::accordion[Killfeed : Giant Tracker]
# ATTENTION :
## Jusqu'au premier kill enregistré d'un Giant, Violet ou Boss, des données d'exemple sont affichées pour présenter la fonction.
---
Le Giant Tracker est une fenêtre autonome dans le plugin Killfeed. Il suit et visualise les statistiques de kill pour les **Giants**, **Violets** et **Bosses** — y compris les périodes, les drops et le Time to Kill (TTK). Les cinq onglets de filtre (Tous, Giants, Violets, Bosses, Drops) permettent un filtrage ciblé par rang ou par drops enregistrés.

**Ouverture :**
- Le bouton **« Giant Tracker »** se trouve dans le panneau latéral Killfeed.
- Un clic ouvre une fenêtre séparée avec l'aperçu de tous les monstres boss suivis.
- S'il n'y a pas encore de données de kill réelles, des données d'exemple sont affichées.

![Description](killfeed_giant_tracker/killfeed_giant_tracker_1_de.png)

---

**Filtrage et tri :**
- La barre de filtres permet de restreindre l'affichage :
  - **Tous** / **Giants** / **Violets** / **Bosses** / **Drops** — filtre par rang de monstre ou par drops.
  - **Bosses** — affiche uniquement les monstres de rang `boss` (ex. Clockworks, Meteonyker). Les cartes boss ont une bordure rouge.
  - **Drops** — affiche uniquement les monstres ayant au moins un drop enregistré. De plus, un aperçu du loot pool (top 5 items par rareté) est affiché directement dans la carte.
  - **Tri** — par kills (croissant/décroissant), nom (A–Z / Z–A) ou niveau (croissant/décroissant).
  - **Champ de recherche** — filtre les cartes par nom de monstre.

![Description](killfeed_giant_tracker/killfeed_giant_tracker_2_de.png)

---

**Vues des cartes :**

Chaque monstre suivi est affiché sous forme de carte. Il existe deux vues :

*Carte compacte (vue par défaut) :*
- Icône du monstre, nom, niveau, élément, rang
- Statistiques de combat (PV, ATQ)
- Aperçu des kills : Aujourd'hui / Total
- Affichage TTK (si des mesures sont disponibles) : `TTK: 45.2s (Moy 52.3s)`
- Dernier kill (heure), nombre de drops
- Bouton **« Détails »** pour développer

![Description](killfeed_giant_tracker/killfeed_giant_tracker_3_de.png)

*Carte étendue (vue détaillée) :*
- Tous les champs de la carte compacte
- Statistiques de kills par période : Aujourd'hui, Semaine, Mois, Année, Total
- Statistiques TTK : Moy. TTK, Dernier TTK, Plus rapide
- Section drops : Nombre de drops, moy. kills par drop, kills depuis le dernier drop
- Historique des drops (repliable) : Drops individuels avec nom d'item, compteur de kills et horodatage
- Bouton **« Enregistrer drop »** pour enregistrer un drop
- Bouton **« Réduire »** pour fermer la vue détaillée

![Description](killfeed_giant_tracker/killfeed_giant_tracker_4_de.png)

---

**Suivi des drops :**

Le bouton **« Enregistrer drop »** dans la carte étendue ouvre un dialogue :
- Affiche le loot pool du monstre (si les données ont été téléchargées via API-Fetch).
- Les items peuvent être recherchés par nom et filtrés par rareté (Commun, Peu commun, Rare, Très rare, Unique, Ultime).
- Un clic sur un item enregistre le drop avec l'horodatage actuel et le compteur de kills.
- Les drops déjà enregistrés peuvent être supprimés individuellement depuis l'historique.

![Description](killfeed_giant_tracker/killfeed_giant_tracker_5_de.png)
![Description](killfeed_giant_tracker/killfeed_giant_tracker_6_de.png)

---

**Time to Kill (TTK) :**

Le TTK mesure automatiquement la durée de combat contre un monstre boss — du premier coup au kill.

*Fonctionnement :*
- **Début :** La barre de PV ennemie est détectée avec `actuel < max` (combat commencé).
- **Fin :** Le kill est confirmé via la détection d'EXP. Le temps de combat accumulé est sauvegardé.
- **Pause :** La barre de PV disparaît (ex. en désélectionnant la cible pour buff ou soin). Un délai de grâce de 10 secondes commence.
- **Reprise :** Si le même monstre boss est re-ciblé dans le délai de 10 secondes, le timer continue. Le temps de pause n'est pas compté dans le TTK.
- **Abandon :** Si le délai de grâce expire sans re-cibler le boss, la mesure TTK est annulée.

*Identification de la cible :*
- Au début du combat, le nom du monstre et les PV max sont sauvegardés.
- Lors d'un re-ciblage, le nom et les PV max sont comparés — le timer ne reprend que si ils correspondent.
- Si un autre monstre boss est ciblé, la mesure en cours est annulée et une nouvelle commence.
- Si un monstre normal est ciblé, le timer boss se met en pause ; les kills normaux continuent d'être comptés.

*Affichage et statistiques :*
- Carte compacte : `TTK: [dernier kill] (Moy [moyenne])`
- Carte étendue : Moy. TTK, Dernier TTK, Plus rapide
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

## Outils

Les outils s’ouvrent via un raccourci ou le menu étoile dans la barre d’onglets.

:::accordion[Fcoin <-> Penya]

![Description](tools/fcoin_zu_penya/fcoin_zu_penya_1.png)
- Convertit FCoins en Penya et inversement.
- Entre le taux Penya par FCoin. Il est sauvegardé et rechargé automatiquement.
- Modifie le montant FCoin ou le résultat en Penya : le calcul est bidirectionnel.

![Description](tools/fcoin_zu_penya/fcoin_zu_penya_2.png)

:::

:::accordion[Liste d’achats Premium]
- Outil de planification pour la boutique Premium ; utile pour estimer avant d’acheter des FCoins. Les pop-ups doivent être autorisées.
- Pré-requis : endpoint API-Fetch **« Item »** avec icônes ; sinon la recherche est vide.
![Description](tools/premium_shopping_list/premium_shopping_list_1.png)
- Utilisation :
  1. Ouvre l’outil via le menu étoile, saisis le nom de l’item.
  2. La liste (max. 20) affiche icône, nom, catégorie ; ajoute via **« + Add »** ou augmente la quantité.  
  ![Description](tools/premium_shopping_list/premium_shopping_list_2.png)
  3. Dans la liste, fixe prix (FCoins) et quantité ; le prix est enregistré en quittant le champ et prérempli ensuite.
  4. La case coche un item acheté/terminé, « X » supprime la ligne.
  5. La barre inférieure affiche la somme (`prix × quantité`) en FCoins.
- Stockage : les prix sont persistants dans le dossier données du launcher (`%APPDATA%/Flyff-U-Launcher/item-prices.json`) ; la liste est propre à la session.

:::
