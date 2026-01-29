# 📖 SimplyTerm Plugin API Reference

> **Référence technique complète de l'API Plugin**

---

## Table des matières

- [Types TypeScript](#types-typescript)
- [Méthodes de l'API](#méthodes-de-lapi)
- [Événements](#événements)
- [Manifest Schema](#manifest-schema)

---

## Types TypeScript

### SessionInfo

```typescript
interface SessionInfo {
  id: string;                                    // Identifiant unique de la session
  type: 'local' | 'ssh' | 'sftp';               // Type de connexion
  host?: string;                                 // Hôte (SSH uniquement)
  port?: number;                                 // Port (SSH uniquement)
  username?: string;                             // Utilisateur (SSH uniquement)
  status: 'connected' | 'disconnected' | 'connecting';
}
```

### PanelRegistration

```typescript
interface PanelRegistration {
  id: string;                                    // ID unique du panel
  render: (container: HTMLElement) => void | (() => void);
  // render reçoit un élément DOM et peut retourner une fonction de cleanup
}
```

### CommandRegistration

```typescript
interface CommandRegistration {
  id: string;                                    // ID unique de la commande
  handler: () => void | Promise<void>;          // Fonction exécutée
}
```

### NotificationType

```typescript
type NotificationType = 'info' | 'success' | 'error' | 'warning';
```

### ModalConfig

```typescript
interface ModalConfig {
  title: string;
  content: string | HTMLElement;
  buttons?: ModalButton[];
}

interface ModalButton {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick?: () => void | Promise<void>;
}
```

---

## Méthodes de l'API

### Lifecycle

#### `onLoad(callback)`

Enregistre une fonction appelée quand le plugin est activé.

```typescript
onLoad(callback: () => void): void
```

| Paramètre | Type | Description |
|-----------|------|-------------|
| `callback` | `() => void` | Fonction appelée au chargement |

**Exemple :**
```javascript
api.onLoad(() => {
  console.log('Plugin ready!');
});
```

---

#### `onUnload(callback)`

Enregistre une fonction appelée quand le plugin est désactivé.

```typescript
onUnload(callback: () => void): void
```

| Paramètre | Type | Description |
|-----------|------|-------------|
| `callback` | `() => void` | Fonction de cleanup |

**Exemple :**
```javascript
api.onUnload(() => {
  clearInterval(myInterval);
});
```

---

### Panels

#### `registerPanel(config)`

Enregistre un nouveau panel dans l'interface.

```typescript
registerPanel(config: PanelRegistration): void
```

| Paramètre | Type | Description |
|-----------|------|-------------|
| `config.id` | `string` | Identifiant unique du panel |
| `config.render` | `(container: HTMLElement) => void \| (() => void)` | Fonction de rendu |

**Permission requise :** `panel:register`

**Exemple :**
```javascript
api.registerPanel({
  id: 'my-panel',
  render: (container) => {
    container.innerHTML = '<h1>Hello</h1>';

    // Optionnel: retourner une fonction de cleanup
    return () => {
      console.log('Panel closed');
    };
  }
});
```

---

#### `showPanel(panelId)`

Affiche un panel.

```typescript
showPanel(panelId: string): void
```

---

#### `hidePanel(panelId)`

Masque un panel.

```typescript
hidePanel(panelId: string): void
```

---

### Commands

#### `registerCommand(config)`

Enregistre une commande personnalisée.

```typescript
registerCommand(config: CommandRegistration): void
```

| Paramètre | Type | Description |
|-----------|------|-------------|
| `config.id` | `string` | Identifiant unique |
| `config.handler` | `() => void \| Promise<void>` | Fonction exécutée |

**Permission requise :** `command:register`

---

#### `executeCommand(commandId)`

Exécute une commande enregistrée.

```typescript
executeCommand(commandId: string): void
```

---

### Terminal

#### `onTerminalOutput(sessionId, callback)`

Écoute la sortie du terminal.

```typescript
onTerminalOutput(
  sessionId: string,
  callback: (data: string) => void
): Unsubscribe
```

| Paramètre | Type | Description |
|-----------|------|-------------|
| `sessionId` | `string` | ID de la session à écouter |
| `callback` | `(data: string) => void` | Appelée à chaque output |

**Retourne :** `() => void` - Fonction pour arrêter l'écoute

**Permission requise :** `terminal:read`

**Exemple :**
```javascript
const unsubscribe = api.onTerminalOutput(session.id, (data) => {
  if (data.includes('error')) {
    api.showNotification('Erreur détectée', 'error');
  }
});

// Plus tard...
unsubscribe();
```

---

#### `onTerminalInput(sessionId, callback)`

Écoute les entrées utilisateur dans le terminal.

```typescript
onTerminalInput(
  sessionId: string,
  callback: (data: string) => void
): Unsubscribe
```

**Permission requise :** `terminal:read`

---

#### `writeToTerminal(sessionId, data)`

Écrit dans le terminal.

```typescript
writeToTerminal(sessionId: string, data: string): Promise<void>
```

| Paramètre | Type | Description |
|-----------|------|-------------|
| `sessionId` | `string` | ID de la session cible |
| `data` | `string` | Texte à envoyer (inclure `\n` pour exécuter) |

**Permission requise :** `terminal:write`

**Exemple :**
```javascript
// Exécuter une commande
await api.writeToTerminal(session.id, 'ls -la\n');

// Envoyer du texte sans exécuter
await api.writeToTerminal(session.id, 'echo "hello"');
```

---

### Sessions

#### `getActiveSession()`

Retourne la session actuellement active.

```typescript
getActiveSession(): SessionInfo | null
```

**Permission requise :** `session:info`

**Exemple :**
```javascript
const session = api.getActiveSession();
if (session && session.type === 'ssh') {
  console.log(`Connected to ${session.username}@${session.host}`);
}
```

---

#### `getAllSessions()`

Retourne toutes les sessions ouvertes.

```typescript
getAllSessions(): SessionInfo[]
```

**Permission requise :** `session:info`

---

#### `onSessionConnect(callback)`

Écoute les nouvelles connexions.

```typescript
onSessionConnect(callback: (session: SessionInfo) => void): Unsubscribe
```

**Permission requise :** `session:info`

---

#### `onSessionDisconnect(callback)`

Écoute les déconnexions.

```typescript
onSessionDisconnect(callback: (sessionId: string) => void): Unsubscribe
```

**Permission requise :** `session:info`

---

### Storage

L'API storage permet de persister des données JSON. Les données sont isolées par plugin.

#### `storage.get(key)`

Récupère une valeur.

```typescript
storage.get<T>(key: string): Promise<T | null>
```

**Permission requise :** `storage:read`

---

#### `storage.set(key, value)`

Sauvegarde une valeur.

```typescript
storage.set<T>(key: string, value: T): Promise<void>
```

**Permission requise :** `storage:write`

---

#### `storage.delete(key)`

Supprime une valeur.

```typescript
storage.delete(key: string): Promise<void>
```

**Permission requise :** `storage:write`

**Exemples :**
```javascript
// Stocker des données
await api.storage.set('settings', { theme: 'dark' });
await api.storage.set('counter', 42);
await api.storage.set('items', ['a', 'b', 'c']);

// Récupérer
const settings = await api.storage.get('settings'); // { theme: 'dark' }
const counter = await api.storage.get('counter');   // 42
const missing = await api.storage.get('unknown');   // null

// Supprimer
await api.storage.delete('counter');
```

---

### UI

#### `showNotification(message, type?)`

Affiche une notification toast.

```typescript
showNotification(message: string, type?: NotificationType): void
```

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `message` | `string` | - | Texte à afficher |
| `type` | `NotificationType` | `'info'` | Style de notification |

**Aucune permission requise**

**Exemple :**
```javascript
api.showNotification('Opération réussie', 'success');
api.showNotification('Attention !', 'warning');
api.showNotification('Erreur critique', 'error');
api.showNotification('Information', 'info');
```

---

#### `showModal(config)` *(à venir)*

Affiche une modale personnalisée.

```typescript
showModal(config: ModalConfig): Promise<unknown>
```

---

### Backend

#### `invokeBackend(command, args?)`

Appelle une fonction du backend Rust.

```typescript
invokeBackend<T>(command: string, args?: Record<string, unknown>): Promise<T>
```

| Paramètre | Type | Description |
|-----------|------|-------------|
| `command` | `string` | Nom de la commande backend |
| `args` | `object` | Arguments optionnels |

**Permission requise :** `backend:exec`

**Commandes disponibles :**

| Commande | Arguments | Description |
|----------|-----------|-------------|
| `get_session_info` | `{ session_id: string }` | Infos de session |

---

## Événements

### Liste des événements

| Événement | Payload | Description |
|-----------|---------|-------------|
| `session-connect` | `SessionInfo` | Nouvelle session connectée |
| `session-disconnect` | `string` (sessionId) | Session fermée |
| `pty-output-{sessionId}` | `string` | Output du terminal |
| `pty-input-{sessionId}` | `string` | Input utilisateur |
| `pty-exit-{sessionId}` | `void` | Terminal fermé |

---

## Manifest Schema

### JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "name", "version"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$",
      "description": "Unique plugin identifier (kebab-case)"
    },
    "name": {
      "type": "string",
      "description": "Display name"
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "Semantic version"
    },
    "author": {
      "type": "string",
      "description": "Author name"
    },
    "description": {
      "type": "string",
      "description": "Short description"
    },
    "main": {
      "type": "string",
      "default": "index.js",
      "description": "Entry point file"
    },
    "permissions": {
      "type": "array",
      "items": {
        "enum": [
          "terminal:read",
          "terminal:write",
          "panel:register",
          "command:register",
          "backend:exec",
          "storage:read",
          "storage:write",
          "session:info"
        ]
      }
    },
    "panels": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "title"],
        "properties": {
          "id": { "type": "string" },
          "title": { "type": "string" },
          "icon": { "type": "string" },
          "position": { "enum": ["left", "right", "bottom"], "default": "right" }
        }
      }
    },
    "commands": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "title"],
        "properties": {
          "id": { "type": "string" },
          "title": { "type": "string" },
          "shortcut": { "type": "string" }
        }
      }
    }
  }
}
```

### Exemple complet

```json
{
  "id": "server-monitor",
  "name": "Server Monitor",
  "version": "2.1.0",
  "author": "Dev Team",
  "description": "Real-time server monitoring for SSH sessions",
  "main": "index.js",
  "permissions": [
    "terminal:read",
    "terminal:write",
    "panel:register",
    "command:register",
    "session:info",
    "storage:read",
    "storage:write"
  ],
  "panels": [
    {
      "id": "monitor-panel",
      "title": "Monitor",
      "icon": "chart.svg",
      "position": "right"
    }
  ],
  "commands": [
    {
      "id": "refresh-stats",
      "title": "Refresh Statistics",
      "shortcut": "Ctrl+Shift+R"
    },
    {
      "id": "export-report",
      "title": "Export Report"
    }
  ]
}
```

---

## Chemins des fichiers

| Chemin | Description |
|--------|-------------|
| `~/.simplyterm/plugins/` | Dossier des plugins |
| `~/.simplyterm/plugins/<id>/manifest.json` | Manifest du plugin |
| `~/.simplyterm/plugins/<id>/index.js` | Code du plugin |
| `~/.simplyterm/plugin-data/<id>/` | Données persistantes du plugin |
| `~/.simplyterm/plugin-settings.json` | Plugins activés/désactivés |

---

<div align="center">

**SimplyTerm Plugin API v1.0**

</div>
