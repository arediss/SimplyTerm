# 🔌 SimplyTerm Plugin Development Guide

> **Créez des plugins puissants pour SimplyTerm en quelques minutes.**

---

## 📚 Table des matières

1. [Quick Start](#-quick-start)
2. [Structure d'un plugin](#-structure-dun-plugin)
3. [Le fichier manifest.json](#-le-fichier-manifestjson)
4. [L'API Plugin](#-lapi-plugin)
5. [Permissions](#-permissions)
6. [Exemples pratiques](#-exemples-pratiques)
7. [Bonnes pratiques](#-bonnes-pratiques)
8. [Debugging](#-debugging)
9. [FAQ](#-faq)

---

## 🚀 Quick Start

### 1. Créez votre dossier plugin

```bash
mkdir -p ~/.simplyterm/plugins/mon-plugin
cd ~/.simplyterm/plugins/mon-plugin
```

### 2. Créez le manifest.json

```json
{
  "id": "mon-plugin",
  "name": "Mon Super Plugin",
  "version": "1.0.0",
  "author": "Votre Nom",
  "description": "Description courte de votre plugin",
  "main": "index.js",
  "permissions": ["panel:register"]
}
```

### 3. Créez index.js

```javascript
function init(api) {
  api.onLoad(() => {
    console.log('Plugin chargé !');
    api.showNotification('Mon plugin est actif !', 'success');
  });

  api.registerPanel({
    id: 'mon-panel',
    render: (container) => {
      container.innerHTML = '<h2>Hello World!</h2>';
    }
  });
}

module.exports.default = init;
```

### 4. Activez le plugin

1. Ouvrez SimplyTerm
2. Allez dans **Paramètres** → **Plugins**
3. Cliquez sur **Actualiser**
4. Activez votre plugin

🎉 **C'est fait !** Votre plugin est maintenant actif.

---

## 📁 Structure d'un plugin

```
~/.simplyterm/plugins/
└── mon-plugin/
    ├── manifest.json      # ⚡ REQUIS - Métadonnées du plugin
    ├── index.js           # ⚡ REQUIS - Point d'entrée
    ├── styles.css         # Optionnel - Styles personnalisés
    ├── icon.svg           # Optionnel - Icône du plugin
    └── assets/            # Optionnel - Ressources additionnelles
```

---

## 📋 Le fichier manifest.json

Le manifest définit les métadonnées et les permissions de votre plugin.

### Structure complète

```json
{
  "id": "mon-plugin",
  "name": "Mon Plugin",
  "version": "1.0.0",
  "author": "Développeur",
  "description": "Une description claire et concise",
  "main": "index.js",
  "permissions": [
    "panel:register",
    "terminal:read",
    "terminal:write",
    "session:info",
    "storage:read",
    "storage:write",
    "command:register",
    "backend:exec"
  ],
  "panels": [
    {
      "id": "stats-panel",
      "title": "Statistiques",
      "icon": "icon.svg",
      "position": "right"
    }
  ],
  "commands": [
    {
      "id": "refresh-data",
      "title": "Rafraîchir les données",
      "shortcut": "Ctrl+Shift+R"
    }
  ]
}
```

### Champs obligatoires

| Champ | Type | Description |
|-------|------|-------------|
| `id` | string | Identifiant unique (kebab-case recommandé) |
| `name` | string | Nom affiché dans l'UI |
| `version` | string | Version semver (ex: "1.0.0") |

### Champs optionnels

| Champ | Type | Description |
|-------|------|-------------|
| `author` | string | Nom de l'auteur |
| `description` | string | Description courte |
| `main` | string | Fichier d'entrée (défaut: "index.js") |
| `permissions` | string[] | Permissions requises |
| `panels` | PanelConfig[] | Configuration des panels |
| `commands` | CommandConfig[] | Commandes personnalisées |

---

## 🔧 L'API Plugin

Votre fonction `init` reçoit l'objet `api` qui donne accès à toutes les fonctionnalités.

### Lifecycle (Cycle de vie)

```javascript
function init(api) {
  // Appelé quand le plugin est chargé
  api.onLoad(() => {
    console.log('Plugin activé !');
  });

  // Appelé quand le plugin est désactivé
  api.onUnload(() => {
    console.log('Plugin désactivé !');
    // Nettoyez vos ressources ici
  });
}
```

---

### 📊 Panels

Créez des interfaces utilisateur dans des panels latéraux.

```javascript
api.registerPanel({
  id: 'mon-panel',
  render: (container) => {
    // container est un élément DOM
    container.innerHTML = `
      <div style="padding: 16px;">
        <h2>Mon Panel</h2>
        <button id="my-btn">Cliquez-moi</button>
      </div>
    `;

    // Ajoutez des event listeners
    container.querySelector('#my-btn').addEventListener('click', () => {
      api.showNotification('Bouton cliqué !', 'success');
    });

    // Retournez une fonction de cleanup (optionnel)
    return () => {
      console.log('Panel fermé');
    };
  }
});

// Afficher/masquer un panel
api.showPanel('mon-panel');
api.hidePanel('mon-panel');
```

**Permission requise :** `panel:register`

---

### ⌨️ Commands

Enregistrez des commandes accessibles via raccourcis clavier.

```javascript
api.registerCommand({
  id: 'ma-commande',
  handler: () => {
    console.log('Commande exécutée !');
    api.showNotification('Action effectuée', 'info');
  }
});

// Exécuter une commande programmatiquement
api.executeCommand('ma-commande');
```

**Permission requise :** `command:register`

---

### 💻 Terminal

Interagissez avec le terminal actif.

#### Lire la sortie du terminal

```javascript
// Écouter tout ce qui s'affiche dans le terminal
const unsubscribe = api.onTerminalOutput(sessionId, (data) => {
  console.log('Output:', data);

  // Exemple: détecter une erreur
  if (data.includes('error')) {
    api.showNotification('Erreur détectée !', 'error');
  }
});

// Pour arrêter d'écouter
unsubscribe();
```

**Permission requise :** `terminal:read`

#### Écrire dans le terminal

```javascript
// Envoyer une commande
await api.writeToTerminal(sessionId, 'ls -la\n');

// Envoyer du texte sans exécuter
await api.writeToTerminal(sessionId, 'echo "Hello"');
```

**Permission requise :** `terminal:write`

---

### 🔗 Sessions

Accédez aux informations des sessions actives.

```javascript
// Session active
const session = api.getActiveSession();
// Retourne: { id, type, host, port, username, status }

if (session) {
  console.log(`Connecté à ${session.username}@${session.host}`);
}

// Toutes les sessions
const sessions = api.getAllSessions();
sessions.forEach(s => console.log(s.id, s.type));
```

#### Événements de session

```javascript
// Quand une nouvelle session se connecte
api.onSessionConnect((session) => {
  console.log('Nouvelle session:', session.type);
  if (session.type === 'ssh') {
    console.log(`SSH vers ${session.host}`);
  }
});

// Quand une session se déconnecte
api.onSessionDisconnect((sessionId) => {
  console.log('Session fermée:', sessionId);
});
```

**Permission requise :** `session:info`

---

### 💾 Storage

Stockez des données persistantes (scoped par plugin).

```javascript
// Sauvegarder
await api.storage.set('config', { theme: 'dark', interval: 5000 });
await api.storage.set('counter', 42);

// Récupérer
const config = await api.storage.get('config');
// { theme: 'dark', interval: 5000 }

const counter = await api.storage.get('counter');
// 42

// Supprimer
await api.storage.delete('counter');
```

**Permissions requises :** `storage:read`, `storage:write`

---

### 🔔 Notifications

Affichez des notifications toast.

```javascript
api.showNotification('Opération réussie !', 'success');
api.showNotification('Attention...', 'warning');
api.showNotification('Erreur !', 'error');
api.showNotification('Information', 'info');
```

**Aucune permission requise**

---

### 🦀 Backend (Avancé)

Appelez des fonctions Rust du backend.

```javascript
try {
  const result = await api.invokeBackend('get_session_info', {
    session_id: 'ssh-123'
  });
  console.log(result);
} catch (error) {
  console.error('Erreur backend:', error);
}
```

**Permission requise :** `backend:exec`

**Commandes disponibles :**
- `get_session_info` - Infos de session
- `exec_ssh_command` - Exécuter commande SSH (à venir)

---

## 🔐 Permissions

Les permissions contrôlent ce que votre plugin peut faire.

| Permission | Description |
|------------|-------------|
| `terminal:read` | Lire la sortie du terminal |
| `terminal:write` | Écrire dans le terminal |
| `panel:register` | Créer des panels UI |
| `command:register` | Créer des commandes |
| `session:info` | Accéder aux infos de session |
| `storage:read` | Lire le storage du plugin |
| `storage:write` | Écrire dans le storage |
| `backend:exec` | Appeler des fonctions Rust |

### Principe de moindre privilège

> ⚠️ **N'ajoutez que les permissions dont vous avez besoin.**

```json
// ❌ Mauvais - trop de permissions
"permissions": ["terminal:read", "terminal:write", "backend:exec", "storage:read", "storage:write"]

// ✅ Bon - juste ce qu'il faut
"permissions": ["panel:register", "session:info"]
```

---

## 💡 Exemples pratiques

### Plugin "Compteur de connexions"

```javascript
function init(api) {
  let connectionCount = 0;

  api.onLoad(async () => {
    // Charger le compteur sauvegardé
    const saved = await api.storage.get('count');
    if (saved !== null) connectionCount = saved;
  });

  api.onSessionConnect(async (session) => {
    if (session.type === 'ssh') {
      connectionCount++;
      await api.storage.set('count', connectionCount);
      api.showNotification(`Connexion #${connectionCount}`, 'info');
    }
  });

  api.registerPanel({
    id: 'counter-panel',
    render: (container) => {
      container.innerHTML = `
        <div style="padding: 20px; text-align: center;">
          <h2 style="font-size: 48px; color: #7da6e8;">${connectionCount}</h2>
          <p>connexions SSH</p>
        </div>
      `;
    }
  });
}

module.exports.default = init;
```

### Plugin "Quick Commands"

```javascript
function init(api) {
  const quickCommands = [
    { name: 'Disk Usage', cmd: 'df -h\n' },
    { name: 'Memory', cmd: 'free -m\n' },
    { name: 'Processes', cmd: 'ps aux | head -20\n' },
  ];

  api.registerPanel({
    id: 'quick-commands',
    render: (container) => {
      container.innerHTML = `
        <div style="padding: 12px;">
          <h3 style="margin: 0 0 12px 0;">Quick Commands</h3>
          ${quickCommands.map((c, i) => `
            <button
              data-index="${i}"
              style="
                display: block;
                width: 100%;
                padding: 8px 12px;
                margin-bottom: 8px;
                background: rgba(255,255,255,0.1);
                border: none;
                border-radius: 6px;
                color: #fff;
                cursor: pointer;
                text-align: left;
              "
            >${c.name}</button>
          `).join('')}
        </div>
      `;

      container.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', async () => {
          const session = api.getActiveSession();
          if (session) {
            const cmd = quickCommands[btn.dataset.index].cmd;
            await api.writeToTerminal(session.id, cmd);
          } else {
            api.showNotification('Aucune session active', 'warning');
          }
        });
      });
    }
  });
}

module.exports.default = init;
```

---

## ✨ Bonnes pratiques

### 1. Nettoyez vos ressources

```javascript
api.onUnload(() => {
  // Arrêtez les intervals
  if (myInterval) clearInterval(myInterval);

  // Les subscriptions sont automatiquement nettoyées
  // mais vous pouvez aussi le faire manuellement
});
```

### 2. Gérez les erreurs

```javascript
try {
  await api.writeToTerminal(sessionId, 'command\n');
} catch (error) {
  api.showNotification('Erreur: ' + error.message, 'error');
  console.error('[MonPlugin]', error);
}
```

### 3. Vérifiez la session avant d'agir

```javascript
const session = api.getActiveSession();
if (!session) {
  api.showNotification('Connectez-vous d\'abord', 'warning');
  return;
}

if (session.type !== 'ssh') {
  api.showNotification('Fonctionne uniquement en SSH', 'info');
  return;
}
```

### 4. Préfixez vos logs

```javascript
console.log('[MonPlugin] Message...');
console.error('[MonPlugin] Erreur:', error);
```

### 5. Utilisez des styles inline

Les panels n'ont pas accès aux styles globaux de l'app.

```javascript
container.innerHTML = `
  <div style="
    font-family: system-ui, sans-serif;
    padding: 16px;
    color: #fff;
  ">
    Contenu stylé
  </div>
`;
```

---

## 🐛 Debugging

### Console développeur

1. Lancez SimplyTerm
2. Ouvrez les DevTools : `Ctrl+Shift+I` (Windows/Linux) ou `Cmd+Option+I` (Mac)
3. Allez dans l'onglet **Console**

### Logs utiles

```javascript
// Vérifier que le plugin se charge
api.onLoad(() => {
  console.log('[MonPlugin] ✅ Chargé avec succès');
  console.log('[MonPlugin] Session active:', api.getActiveSession());
});

// Logger les événements
api.onSessionConnect((s) => {
  console.log('[MonPlugin] Session connectée:', s);
});
```

### Erreurs courantes

| Erreur | Cause | Solution |
|--------|-------|----------|
| "Plugin not found" | ID invalide dans manifest | Vérifiez que l'ID correspond au dossier |
| "Permission denied" | Permission manquante | Ajoutez la permission au manifest |
| "Missing session_id" | Session non vérifiée | Vérifiez `getActiveSession()` avant d'agir |

---

## ❓ FAQ

### Comment recharger mon plugin après modification ?

1. Désactivez le plugin dans Paramètres → Plugins
2. Cliquez sur "Actualiser"
3. Réactivez le plugin

### Puis-je utiliser des frameworks (React, Vue) ?

Non, les plugins s'exécutent dans un contexte simple. Utilisez du JavaScript vanilla et des templates string.

### Où sont stockées mes données ?

```
~/.simplyterm/plugin-data/<plugin-id>/
```

### Comment distribuer mon plugin ?

Créez un zip de votre dossier plugin. Les utilisateurs le décompressent dans `~/.simplyterm/plugins/`.

### Les plugins peuvent-ils communiquer entre eux ?

Non, chaque plugin est isolé pour des raisons de sécurité.

---

## 📝 Template de démarrage

Copiez ce template pour commencer rapidement :

```javascript
/**
 * Mon Plugin pour SimplyTerm
 * @version 1.0.0
 */

function init(api) {
  // === État du plugin ===
  let isActive = false;

  // === Lifecycle ===
  api.onLoad(async () => {
    console.log('[MonPlugin] Chargé');
    isActive = true;

    // Charger les données sauvegardées
    const savedData = await api.storage.get('data');
    if (savedData) {
      console.log('[MonPlugin] Données restaurées:', savedData);
    }
  });

  api.onUnload(() => {
    console.log('[MonPlugin] Déchargé');
    isActive = false;
  });

  // === Panel ===
  api.registerPanel({
    id: 'mon-panel',
    render: (container) => {
      updateUI(container);
      return () => {
        // Cleanup si nécessaire
      };
    }
  });

  // === Événements ===
  api.onSessionConnect((session) => {
    console.log('[MonPlugin] Nouvelle session:', session.type);
  });

  // === Fonctions ===
  function updateUI(container) {
    const session = api.getActiveSession();
    container.innerHTML = `
      <div style="padding: 16px; font-family: system-ui;">
        <h2 style="color: #fff; margin: 0 0 16px 0;">Mon Plugin</h2>
        <p style="color: #888;">
          ${session ? `Connecté à ${session.host}` : 'Non connecté'}
        </p>
        <button id="action-btn" style="
          padding: 8px 16px;
          background: #7da6e8;
          border: none;
          border-radius: 6px;
          color: #1a1a1a;
          cursor: pointer;
        ">Action</button>
      </div>
    `;

    container.querySelector('#action-btn')?.addEventListener('click', handleAction);
  }

  async function handleAction() {
    api.showNotification('Action exécutée !', 'success');
  }
}

// Export CommonJS
module.exports.default = init;
```

---

## 🔗 Ressources

- [Code source SimplyTerm](https://github.com/...)
- [Exemples de plugins](~/.simplyterm/plugins/)
- [Signaler un bug](https://github.com/.../issues)

---

<div align="center">

**Made with ❤️ for the SimplyTerm community**

</div>
