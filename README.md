# Planche de Marquage

> Projet personnel open source — développé pour apprendre et pratiquer Node.js, TypeScript et PostgreSQL en conditions réelles.

Application web de comptage des scores pour des parties de jeu en temps réel.

## Objectif

Le créateur d'une partie saisit les scores tour par tour. Les autres joueurs accèdent à la partie via un lien unique (QR code ou lien WhatsApp) et suivent le tableau des scores en temps réel.
Chacun dispose de ses statistiques historisées dans son taleau de bord.

## Stack technique

- **Runtime** : Node.js
- **Langage** : TypeScript
- **Framework** : Express
- **Moteur de templates** : Handlebars (express-handlebars)
- **Base de données** : PostgreSQL
- **Authentification** : Sessions (express-session) + bcrypt
- **QR Code** : qrcode
- **Infrastructure** : VPS IONOS, Nginx, PM2

## Fonctionnalités

- Inscription et connexion avec mot de passe hashé
- Création de parties avec type de jeu personnalisable
- Génération d'un lien unique et QR code par partie
- Redirection automatique vers la partie après login via QR code
- Tableau des scores tour par tour
- Vue créateur (saisie des scores) et vue joueur (lecture seule)
- Actualisation automatique par polling toutes les minutes
- Historique des parties dans l'espace joueur

## Cinématique

1. Le joueur arrive sur la page d'accueil et se connecte
2. Il crée une nouvelle partie (nom, type de jeu, nombre de tours)
3. Un QR code et un lien sont générés — il les partage aux autres joueurs
4. Les joueurs rejoignent la partie en scannant le QR code et en s'inscrivant
5. Le créateur saisit les scores tour par tour
6. Les joueurs suivent le tableau en temps réel
7. En fin de partie, le classement s'affiche avec une animation pour le vainqueur

## Installation locale

### Prérequis

- Node.js v18+
- PostgreSQL 16+

### Installation

```bash
git clone https://github.com/guillaume-deloris/planche_de_marquage.git
cd planche_de_marquage
npm install
```

### Configuration

Crée un fichier `.env` à la racine :

```
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=planche_dev
DB_USER=postgres
DB_PASSWORD=ton_mdp
SESSION_SECRET=une_chaine_aleatoire_longue
```

### Base de données

```sql
CREATE TABLE public.game_scores (
    id integer NOT NULL,
    game_id integer NOT NULL,
    player_id integer NOT NULL,
    round_number integer NOT NULL,
    score integer,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    play_order integer
);

CREATE TABLE public.game_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    default_rounds integer NOT NULL,
    creator_id integer
);

CREATE TABLE public.games (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    creator_id integer NOT NULL,
    game_type_id integer NOT NULL,
    round_count integer NOT NULL,
    status character varying(30) DEFAULT 'draft'::character varying NOT NULL,
    started_at timestamp without time zone,
    unique_link uuid DEFAULT gen_random_uuid(),
    created_at timestamp without time zone DEFAULT now()
);

CREATE TABLE public.players (
    id integer NOT NULL,
    username character varying(100) NOT NULL,
    password character varying(255) NOT NULL,
    creator_id integer,
    win_count integer DEFAULT 0,
    game_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);
```

### Lancement

```bash
npm run dev
```

Le serveur tourne sur `http://localhost:3000`.

## Structure du projet

```
src/
├── controllers/
│   ├── dashboardController.ts
│   ├── gameController.ts
├── middlewares/
│   └── auth.ts
├── routes/
│   ├── auth.ts
│   ├── dashboard.ts
│   └── games.ts
├── types/
│   ├── index.ts
│   └── session.d.ts
├── db.ts
└── server.ts
views/
├── games/
│   ├── new.hbs
│   ├── players.hbs
│   └── view.hbs
├── layouts/
│   └── main.hbs
├── dashboard.hbs
├── home.hbs
├── login.hbs
└── register.hbs
```

## Licence

MIT — libre d'utilisation, de modification et de distribution.

## Auteur

Guillaume Deloris — [guillaumedeloris.fr](https://guillaumedeloris.fr)
