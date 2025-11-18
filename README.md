# 🌌 LDSS - Local Distributed Storage System

**99% Local, 1% Cloud, 100% Fast**

> Architecture hybride de stockage permettant aux développeurs de créer des applications ultra-rapides avec sync cloud optionnel.

![LDSS Architecture](https://img.shields.io/badge/Architecture-NEXUS_AXION_3.5-00d9ff?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Production_Ready-00ff88?style=for-the-badge)

---

## 🎯 Concept

LDSS résout le problème fondamental des bases de données cloud : **la latence**.

### Le Problème Traditionnel

```
User clicks button
    ↓
Request to Cloud DB (100-500ms)
    ↓
Process data
    ↓
Response (100-500ms)
    ↓
Total: 200-1000ms ❌
```

### La Solution LDSS

```
User clicks button
    ↓
Local IndexedDB (~0-5ms) ✅
    ↓
Background sync to Cloud (optional)
    ↓
Total: ~5ms ⚡
```

---

## 🏗️ Architecture

### 3 Workers Locaux + Backend Cloud Optionnel

```
┌─────────────────────────────────────────────────┐
│          USER BROWSER (Client-Side)             │
├─────────────────────────────────────────────────┤
│                                                 │
│  📦 Worker 1: IndexedDB (Primary Storage)      │
│     ├─ Structured data                         │
│     ├─ Capacity: 500MB - 2GB                   │
│     └─ Use: User data, todos, posts, etc.      │
│                                                 │
│  💾 Worker 2: LocalStorage (Cache)             │
│     ├─ Quick access data                       │
│     ├─ Capacity: 5-10 MB                       │
│     └─ Use: Tokens, settings, sessions         │
│                                                 │
│  🔍 Worker 3: In-Memory Search                 │
│     ├─ Full-text search index                  │
│     ├─ Capacity: Variable (RAM)                │
│     └─ Use: Search bars, autocomplete          │
│                                                 │
└─────────────────────────────────────────────────┘
          ↕️ SYNC (optional)
┌─────────────────────────────────────────────────┐
│           LDSS BACKEND (Render.com)             │
├─────────────────────────────────────────────────┤
│  • API Gateway (routing)                        │
│  • Authentication                               │
│  • Backend Adapter (multi-provider)            │
└─────────────────────────────────────────────────┘
          ↕️ PERSISTENCE
┌─────────────────────────────────────────────────┐
│      CLOUD DATABASE (Your Choice)               │
├─────────────────────────────────────────────────┤
│  🔹 Turso (LibSQL) - Recommended               │
│  🔹 PlanetScale (MySQL)                         │
│  🔹 Neon (PostgreSQL)                           │
│  🔹 Supabase (PostgreSQL + Auth)                │
│  🔹 Custom API                                  │
│  🔹 None (Local-only mode)                      │
└─────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/ldss-mvp.git
cd ldss-mvp
npm install
```

### 2. Setup Turso Database

```bash
# Installer Turso CLI
npm install -g @libsql/client

# Login
turso auth login

# Créer database
turso db create ldss-database

# Obtenir URL
turso db show ldss-database --url

# Créer token
turso db tokens create ldss-database
```

### 3. Configure Environment

Copier `.env.example` → `.env` et remplir :

```bash
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=eyJ...
PASSWORD_SALT=change_me_in_production
NODE_ENV=development
```

### 4. Run Locally

```bash
npm start
```

Ouvrir http://localhost:3000

---

## 📦 Déploiement sur Render

### Étape 1 : Préparer le Repo

```bash
# Vérifier structure (fichiers à la racine!)
ls
# Tu DOIS voir : index.html  api.js  server.js  package.json

# Commit & Push
git add .
git commit -m "LDSS MVP ready for deployment"
git push origin main
```

### Étape 2 : Créer Web Service

1. Aller sur https://render.com
2. New → Web Service
3. Connect GitHub repo
4. Configuration :
   - **Name**: `ldss-api`
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node api.js`
   - **Plan**: Free

### Étape 3 : Variables d'Environnement

Dans Render Dashboard → Environment :

```
TURSO_DATABASE_URL = libsql://your-db.turso.io
TURSO_AUTH_TOKEN = eyJ...
PASSWORD_SALT = your_secure_salt
NODE_ENV = production
```

**⚠️ NE PAS ajouter PORT** (géré automatiquement)

### Étape 4 : Deploy

Click "Create Web Service" → Render va builder et déployer

URL finale : `https://ldss-api.onrender.com`

---

## 📖 Utilisation

### Pour les Développeurs LDSS (Dashboard)

#### 1. Créer un Compte

```
Ouvrir https://ldss-api.onrender.com
    ↓
Register avec email/password
    ↓
Login
```

#### 2. Créer un Projet

```
Dashboard → Nouveau Projet
    ↓
Nom: "MyTodoApp"
    ↓
Obtenir token: ldss_abc123xyz
```

#### 3. Configurer Backend (Optionnel)

```
Projet → Configuration Backend
    ↓
Sélectionner provider (Turso, PlanetScale, etc.)
    ↓
Coller credentials
    ↓
Test Connection → Save
```

### Pour les Utilisateurs Finaux (Intégration SDK)

#### Installation

```bash
npm install ldss-client
```

#### Utilisation

```javascript
import LDSS from 'ldss-client';

// Initialize
const db = new LDSS({
  token: 'ldss_abc123xyz', // Token from dashboard
  serverUrl: 'https://ldss-api.onrender.com'
});

await db.init(); // Creates 3 workers in browser

// Store data (instant, local)
await db.store('todos', {
  id: '1',
  text: 'Buy milk',
  done: false
});

// Query data (instant, local)
const todos = await db.query('todos');

// Search (instant, local)
const results = await db.search('milk');

// Sync manually (if backend configured)
await db.sync();
```

---

## 🎯 Use Cases

### ✅ Parfait Pour

- **Todo Apps** : Latence zéro, fonctionne offline
- **Note-taking Apps** : Écriture instantanée, sync optionnel
- **Blogs/CMS** : Édition rapide, publication cloud
- **Forms** : Sauvegarde automatique locale
- **Chat Apps** : Messages instantanés, sync background
- **Shopping Carts** : Modifications rapides, checkout cloud
- **Analytics Dashboards** : Cache local, refresh cloud

### ❌ Pas Recommandé Pour

- **Collaborative real-time** (utiliser WebSocket natif)
- **Financial transactions** (nécessite garanties ACID strictes)
- **Données hautement sensibles** (besoin chiffrement hardware)
- **Big Data processing** (utiliser cloud natif)

---

## 🔒 Sécurité

### Authentication

- **Password hashing** : SHA-256 + salt (MVP)
- **Sessions** : Token-based, expire après 30 jours
- **TODO Production** : Migrer vers bcrypt + refresh tokens

### Data Storage

- **Local data** : Stockée dans browser (IndexedDB)
- **Cloud data** : Chiffrée en transit (HTTPS)
- **TODO Production** : Chiffrement at-rest

### Backend Configuration

- **Credentials** : Stockées en DB (à chiffrer en prod)
- **Tokens** : Validés à chaque requête
- **Rate limiting** : TODO pour production

---

## 🧪 Tests

### Health Check

```bash
curl https://ldss-api.onrender.com/api/health
```

Réponse attendue :

```json
{
  "timestamp": "2025-11-18T14:23:45.123Z",
  "status": "ok",
  "services": {
    "database": "connected"
  },
  "memory": {
    "heapUsed": "120 MB",
    "heapTotal": "150 MB"
  }
}
```

### Test Auth

```bash
# Register
curl -X POST https://ldss-api.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# Login
curl -X POST https://ldss-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

---

## 📊 Métriques

### Performance

- **Opération locale** : ~5ms
- **Sync cloud** : ~100-300ms
- **Multi-device sync** : <1s

### Capacité

- **IndexedDB** : 500MB - 2GB par domain
- **LocalStorage** : 5-10 MB
- **Cloud** : Illimité (selon provider)

### Coûts

- **LDSS Backend** : Free tier Render ($0)
- **Turso DB** : Free tier 500MB ($0)
- **Total** : $0/mois jusqu'à ~1000 users

---

## 🎓 Architecture NEXUS AXION 3.5

LDSS utilise l'architecture **NEXUS AXION 3.5** :

### 3 Fichiers à la Racine

```
ldss-mvp/
├── index.html          # Frontend (Dashboard)
├── api.js              # API Gateway (Point d'entrée)
├── server.js           # Backend Service
├── package.json        # Dépendances
├── .env               # Variables (local)
└── README.md          # Cette documentation
```

**PAS de dossiers** `src/`, `backend/`, `frontend/`, `public/`

### Pourquoi ?

- ✅ **Deploy instantané** : Render/Railway voient directement les fichiers
- ✅ **Debugging facile** : Moins de navigation
- ✅ **Git simple** : Pas de sous-dossiers complexes
- ✅ **Scalable** : Ajouter fichiers au besoin (jamais de dossiers)

---

## 🤝 Contribution

### Roadmap

- [ ] **v1.1** : Chiffrement at-rest
- [ ] **v1.2** : WebSocket temps réel
- [ ] **v1.3** : Conflict resolution automatique
- [ ] **v1.4** : Offline-first advanced (service workers)
- [ ] **v1.5** : Analytics dashboard

### Comment Contribuer

1. Fork le repo
2. Créer branch : `git checkout -b feature/amazing`
3. Commit : `git commit -m 'Add amazing feature'`
4. Push : `git push origin feature/amazing`
5. Open Pull Request

---

## 📞 Support

### Documentation

- **GitHub** : https://github.com/yourusername/ldss-mvp
- **Docs** : https://ldss-docs.dev (TODO)

### Contact

- **Email** : anzizdaouda0@gmail.com
- **GitHub** : @Tryboy869
- **Twitter** : @ldss_dev (TODO)

---

## 📄 Licence

MIT License - Libre d'utilisation pour projets personnels et commerciaux.

---

## 🙏 Remerciements

- **Turso** : Pour LibSQL et l'edge-first approach
- **Render** : Pour l'hébergement fiable
- **Community** : Pour les tests et feedback

---

## 🌟 Pitch Deck (Pour Partenariats)

### Slide 1 : Le Problème

**Les bases de données cloud sont lentes et coûteuses pour les utilisateurs finaux**

- Latence : 200-1000ms par opération
- Coûts : $25-100/mois pour petites apps
- Complexité : Setup backend difficile

### Slide 2 : La Solution

**LDSS = Stockage hybride intelligent**

- 99% des opérations locales (~5ms)
- 1% sync cloud (optionnel)
- Coûts minimaux ($0 jusqu'à 1000 users)

### Slide 3 : Innovation Technique

**Architecture 3 Workers + Backend Adaptatif**

- Worker 1 : IndexedDB (stockage structuré)
- Worker 2 : LocalStorage (cache rapide)
- Worker 3 : In-memory search
- Backend : Choix du provider (Turso, PlanetScale, etc.)

### Slide 4 : Market Opportunity

**Target : Indie hackers, startups, side projects**

- 10M+ développeurs dans le monde
- Besoin : Backend facile + performant + pas cher
- LDSS : Solution clé-en-main

### Slide 5 : Traction

- ✅ MVP déployé : https://ldss-api.onrender.com
- ✅ Architecture validée (3 workers)
- ✅ Multi-provider support
- ✅ Open-source ready

### Slide 6 : Pourquoi Turso ?

**Turso = Partenaire idéal pour LDSS**

- Edge-first : Aligné avec notre vision
- LibSQL : Compatible SQLite = familier
- Performance : Latence minimale
- Pricing : Fair pour indie devs

### Slide 7 : Ce qu'on propose

**Partnership Win-Win**

- Featured case study sur turso.tech
- Co-marketing (blog posts, tutorials)
- Drive adoption Turso (indie devs community)
- Feedback loop (improve both products)

---

**🌌 LDSS - L'avenir du stockage web est hybride**

> "Un seul esprit, toutes les sagesses"  
> - NEXUS AXION Philosophy

---

**Fait avec ❤️ par Anzize Daouda**  
**Powered by NEXUS AXION 3.5**