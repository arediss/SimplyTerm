/**
 * English translations for SimplyTerm
 *
 * Organization:
 * - common.*           - Shared buttons/actions (Cancel, Save, Delete, etc.)
 * - settings.*         - Settings sections (SettingsTab)
 * - vault.*            - VaultSetupModal, VaultUnlockModal
 * - connection.*       - ConnectionForm
 * - sidebar.*          - Sidebar
 * - hostKey.*          - HostKeyModal
 * - tunnelSidebar.*    - TunnelSidebar
 * - app.*              - App.tsx (tab titles, errors, empty state)
 */

export default {
  // ============================================
  // COMMON - Shared across multiple components
  // ============================================
  common: {
    // Button to cancel an action and close modal/form
    cancel: "Cancel",
    // Button to save/confirm changes
    save: "Save",
    // Button to delete an item
    delete: "Delete",
    // Button to close a modal or panel
    close: "Close",
    // Button to go back to previous step
    back: "Back",
    // Button to continue to next step
    continue: "Continue",
    // Button to confirm an action
    confirm: "Confirm",
    // Button to refresh data
    refresh: "Refresh",
    // Label shown when data is loading
    loading: "Loading...",
    // Label for active status
    active: "Active",
    // Label for inactive status
    inactive: "Inactive",
    // Label shown when there are no results
    noResults: "No results",
    // Generic error prefix
    error: "Error",
    // Generic success message
    success: "Success",
    // Label for enabled state
    enabled: "Enabled",
    // Label for disabled state
    disabled: "Disabled",
    // Label for configured state
    configured: "Configured",
    // Label for not configured state
    notConfigured: "Not configured",
    // Label for "coming soon" features
    comingSoon: "Coming soon",
    // Label for unsupported features
    notSupported: "Not supported",
    // Modify/Edit action
    modify: "Modify",
    // Remove action
    remove: "Remove",
    // Configure/Setup action
    configure: "Configure",
    // Create action
    create: "Create",
  },

  // ============================================
  // SETTINGS - SettingsTab.tsx
  // ============================================
  settings: {
    // Modal title
    title: "Settings",
    // Reset button in sidebar footer
    reset: "Reset",

    // --- Navigation sections ---
    sections: {
      // Appearance settings tab
      appearance: "Appearance",
      // Terminal settings tab
      terminal: "Terminal",
      // Connections management tab
      connections: "Connections",
      // Security/Vault settings tab
      security: "Security",
      // Plugins management tab
      plugins: "Plugins",
      // About the app tab
      about: "About",
    },

    // --- Appearance section ---
    appearance: {
      // Theme selection group title
      themeTitle: "Theme",
      // Theme selection description
      themeDesc: "Customize the application appearance",
      // Dark theme name
      themeDark: "Dark",
      // Light theme name
      themeLight: "Light",
      // Accent color group title
      accentTitle: "Accent color",
      // Accent color description
      accentDesc: "Color used for interactive elements",
      // Language selection group title
      languageTitle: "Language",
      // Language selection description
      languageDesc: "Choose your preferred language",
      // Window effect group title
      windowEffectTitle: "Window effect",
      // Window effect description
      windowEffectDesc: "Native transparency effect for the window",
      // Effect options
      effectNone: "None",
      effectAcrylic: "Acrylic",
      effectMica: "Mica",
      // Note about window effect
      windowEffectNote: "Acrylic adds blur to the background. Mica uses a tinted system backdrop. Windows 11 required for Mica.",
    },

    // --- Terminal section ---
    terminal: {
      // Font selection group title
      fontTitle: "Font",
      // Font selection description
      fontDesc: "Font used in the terminal",
      // Font size group title
      fontSizeTitle: "Font size",
      // Font size description
      fontSizeDesc: "Text size in the terminal",
      // Cursor style group title
      cursorTitle: "Cursor style",
      // Cursor style description
      cursorDesc: "Cursor appearance in the terminal",
      // Bar cursor style
      cursorBar: "Bar",
      // Block cursor style
      cursorBlock: "Block",
      // Underline cursor style
      cursorUnderline: "Underline",
      // Cursor blink setting title
      cursorBlinkTitle: "Cursor blink",
      // Cursor blink description
      cursorBlinkDesc: "Make the cursor blink",
      // Scrollback history group title
      scrollbackTitle: "History (scrollback)",
      // Scrollback description
      scrollbackDesc: "Number of lines retained",
    },

    // --- Connections section ---
    connections: {
      // Saved sessions group title
      savedTitle: "Saved sessions",
      // Saved sessions description
      savedDesc: "Manage your saved connections",
      // {{count}} session(s) saved - singular
      savedCount_one: "{{count}} session saved",
      // {{count}} sessions saved - plural
      savedCount_other: "{{count}} sessions saved",
      // Credentials storage info
      storedSecurely: "Stored locally with secured credentials",
      // Delete data group title
      deleteTitle: "Delete data",
      // Delete data description
      deleteDesc: "Clear all saved sessions and their credentials",
      // Delete all button
      deleteAll: "Delete all",
      // Confirm deletion button
      confirmDelete: "Confirm deletion",
      // Warning after clicking delete
      deleteWarning: "Click again to confirm. This action is irreversible.",
    },

    // --- Bastions section ---
    bastions: {
      // Section title
      title: "Jump Hosts (Bastions)",
      // Section description
      description: "Configure SSH jump hosts for tunneled connections",
      // No bastions message
      noBastions: "No jump hosts configured",
      // Count message
      count_one: "{{count}} jump host configured",
      count_other: "{{count}} jump hosts configured",
      // Add button
      add: "Add",
      // Create form title
      create: "New jump host",
      // Edit form title
      edit: "Edit jump host",
      // Name field
      name: "Name",
      // Leave empty to keep current value
      leaveEmptyToKeep: "leave empty to keep",
      // Vault locked warning
      vaultLocked: "Unlock the vault to manage jump hosts",
    },

    // --- Security section ---
    security: {
      // Vault not configured group title
      vaultNotConfigured: "Vault not configured",
      // Vault not configured description
      vaultNotConfiguredDesc: "Protect your passwords with an encrypted vault",
      // Warning when vault is not set up
      noVaultWarning: "Without a vault, connection passwords won't be saved. You'll need to enter them on each connection.",
      // Configure vault button
      configureVault: "Configure vault",
      // Vault status group title
      vaultStatusTitle: "Vault status",
      // Vault status description
      vaultStatusDesc: "Encrypted storage for your credentials",
      // Vault unlocked status
      vaultUnlocked: "Vault unlocked",
      // Vault locked status
      vaultLocked: "Vault locked",
      // Lock vault button
      lock: "Lock",
      // Unlock methods label
      methods: "Methods",
      // Master password method name
      methodPassword: "Password",
      // PIN method name
      methodPin: "PIN",
      // Security key method name
      methodSecurityKey: "Security Key",
      // Auto-lock group title
      autoLockTitle: "Auto-lock",
      // Auto-lock description
      autoLockDesc: "Delay before automatic locking",
      // Auto-lock option: Never
      autoLockNever: "Never",
      // Auto-lock option: 1 minute
      autoLock1min: "1 minute",
      // Auto-lock option: 5 minutes
      autoLock5min: "5 minutes",
      // Auto-lock option: 10 minutes
      autoLock10min: "10 minutes",
      // Auto-lock option: 30 minutes
      autoLock30min: "30 minutes",
      // Auto-lock option: 1 hour
      autoLock1hour: "1 hour",
      // Security tabs
      tabVault: "Vault",
      tabSshKeys: "SSH Keys",
      tabAuthentication: "Authentication",
      // SSH Keys section
      sshKeysTitle: "SSH Keys",
      sshKeysDesc: "Manage your SSH key profiles stored in the vault",
      sshKeysAddKey: "Add SSH Key",
      sshKeysEditKey: "Edit key",
      sshKeysDeleteKey: "Delete key",
      sshKeysName: "Name",
      sshKeysKeyPath: "Key path",
      sshKeysPassphrase: "Passphrase",
      sshKeysAlwaysAskPassphrase: "Always ask passphrase",
      sshKeysAlwaysAskPassphraseDesc: "Prompt for passphrase on every connection instead of storing it",
      sshKeysNoKeys: "No SSH keys saved yet",
      sshKeysConfirmDelete: "Are you sure you want to delete this SSH key?",
      sshKeysPassphraseRequired: "Passphrase required",
      sshKeysEnterPassphraseFor: "Enter passphrase for",
      sshKeysCustomKey: "Custom key...",
      sshKeysSelectKey: "Select an SSH key",
      sshKeysNamePlaceholder: "My server key",
      sshKeysKeyPathPlaceholder: "~/.ssh/id_rsa",
      // Maximum security mode group title
      maxSecurityTitle: "Maximum security mode",
      // Maximum security mode description
      maxSecurityDesc: "Require vault unlock on every SSH connection",
      // Max security mode enabled message
      maxSecurityEnabled: "Vault will be locked after each connection",
      // Max security mode disabled message
      maxSecurityDisabled: "Credentials remain accessible based on timeout",
      // Max security warning
      maxSecurityWarning: "You'll need to enter your PIN/password on each SSH connection",
      // PIN code group title
      pinTitle: "PIN code",
      // PIN code description
      pinDesc: "Quick unlock with a PIN code",
      // PIN configured status
      pinConfigured: "PIN configured",
      // PIN not configured status
      pinNotConfigured: "PIN not configured",
      // PIN quick unlock enabled
      pinQuickUnlock: "Quick unlock enabled",
      // PIN setup prompt
      pinSetupPrompt: "Add a PIN for quick access",
      // New PIN placeholder
      newPinPlaceholder: "New PIN (4-6 digits)",
      // Confirm PIN placeholder
      confirmPinPlaceholder: "Confirm PIN",
      // PIN validation error
      pinValidationError: "PIN must be 4 to 6 digits",
      // PIN mismatch error
      pinMismatchError: "PINs don't match",
      // PIN setup success
      pinSetupSuccess: "PIN configured successfully",
      // PIN setup error
      pinSetupError: "Error setting up PIN",
      // PIN remove error
      pinRemoveError: "Error removing PIN",
      // Biometric auth group title
      biometricTitle: "Biometric authentication",
      // Biometric auth description
      biometricDesc: "Unlock with Windows Hello or Touch ID",
      // Windows Hello name
      windowsHello: "Windows Hello",
      // Touch ID name
      touchId: "Touch ID",
      // Biometric label
      biometric: "Biometric",
      // Biometric not available message
      biometricNotAvailable: "Not available on this system",
      // FIDO2 security key group title
      fido2Title: "FIDO2 Security Key",
      // FIDO2 description
      fido2Desc: "Unlock by touching your key (YubiKey, SoloKey, etc.)",
      // FIDO2 key label
      fido2Key: "FIDO2 Key",
      // FIDO2 configured status
      fido2Configured: "Configured - Touch to unlock",
      // FIDO2 not configured status
      fido2NotConfigured: "Hardware security key",
      // Touch your key prompt
      touchKey: "Touch your security key...",
      // No security key detected warning
      noKeyDetected: "No security key detected",
      // Insert key prompt
      insertKeyPrompt: "Insert a FIDO2 key (YubiKey, SoloKey, Google Titan, etc.)",
      // Windows WebAuthn ready message
      windowsWebAuthnReady: "Ready to configure",
      // Windows WebAuthn hint
      windowsWebAuthnHint: "Click Configure to use Windows Hello or plug in your USB security key",
      // Key detected - singular
      keyDetected_one: "{{count}} key detected",
      // Keys detected - plural
      keyDetected_other: "{{count}} keys detected",
      // Setup steps title
      setupSteps: "Setup in 2 steps:",
      // Setup step 1
      setupStep1: "Touch your key to register it",
      // Setup step 2
      setupStep2: "Touch it again to confirm",
      // Refresh key list
      refreshKeyList: "Refresh list",
      // Security key setup success
      keySetupSuccess: "Security key configured successfully",
      // Security key setup error
      keySetupError: "Error setting up security key",
      // Security key remove error
      keyRemoveError: "Error removing security key",
      // Master password group title
      masterPasswordTitle: "Master password",
      // Master password description
      masterPasswordDesc: "Change your master password",
      // Change password button
      changePassword: "Change password",
      // Current password placeholder
      currentPasswordPlaceholder: "Current password",
      // New password placeholder
      newPasswordPlaceholder: "New password (min. 8 char.)",
      // Confirm new password placeholder
      confirmNewPasswordPlaceholder: "Confirm new password",
      // Password too short error
      passwordTooShort: "New password must be at least 8 characters",
      // Password mismatch error
      passwordMismatchError: "Passwords don't match",
      // Password change success
      passwordChangeSuccess: "Password changed successfully",
      // Password change error
      passwordChangeError: "Error changing password",
      // Delete vault group title
      deleteVaultTitle: "Delete vault",
      // Delete vault description
      deleteVaultDesc: "Permanently delete all your encrypted data",
      // Delete vault button
      deleteVault: "Delete vault",
      // Delete vault warning
      deleteVaultWarning: "This action is irreversible. All your credentials will be lost.",
      // Delete vault password prompt
      deleteVaultPasswordPrompt: "Enter your master password to confirm",
      // Delete vault confirm button
      deletePermanently: "Delete permanently",
      // Incorrect password error
      incorrectPassword: "Incorrect password",
      // Creating status
      creating: "Creating...",
      // Create vault button
      createVault: "Create vault",
    },

    // --- Plugins section ---
    plugins: {
      // Installed plugins group title
      installedTitle: "Installed plugins",
      // Installed plugins description
      installedDesc: "Extensions adding functionality to SimplyTerm",
      // Plugin count - singular
      pluginCount_one: "{{count}} plugin found",
      // Plugin count - plural
      pluginCount_other: "{{count}} plugins found",
      // No plugins installed message
      noPlugins: "No plugins installed",
      // Plugin directory hint
      pluginDirHint: "Place your plugins in",
      // Plugin author prefix
      byAuthor: "by {{author}}",
      // Installation group title
      installationTitle: "Installation",
      // Installation description
      installationDesc: "How to add new plugins",
      // Installation step 1
      installStep1: "Create the folder",
      // Installation step 2
      installStep2: "Add a folder for each plugin with:",
      // Manifest file description
      manifestFile: "Metadata",
      // Index file description
      indexFile: "Plugin code",
      // Installation step 3
      installStep3: "Refresh the list and enable the plugin",
      // Tabs
      tabInstalled: "Installed",
      tabBrowse: "Browse",
      tabUpdates: "Updates",
      // Browse tab
      searchPlaceholder: "Search plugins...",
      browseDesc: "Discover and install plugins from the registry",
      featured: "Available",
      noResults: "No plugins found",
      noResultsHint: "Try a different search term or check your registry configuration",
      install: "Install",
      installing: "Installing...",
      installed: "Installed",
      // Updates tab
      updatesDesc: "Keep your plugins up to date",
      updatesAvailable_one: "{{count}} update available",
      updatesAvailable_other: "{{count}} updates available",
      noUpdates: "All plugins are up to date",
      updateAll: "Update all",
      update: "Update",
      updating: "Updating...",
      updateTo: "v{{version}} available",
      updateAvailableSingular: "plugin update available",
      updateAvailablePlural: "plugin updates available",
      // Categories
      categoryAll: "All",
      categoryThemes: "Themes",
      categoryProductivity: "Productivity",
      categorySecurity: "Security",
      categoryDevops: "DevOps",
      categoryTools: "Tools",
      // Errors
      registryError: "Failed to connect to plugin registry",
      installError: "Failed to install plugin",
      updateError: "Failed to update plugin",
      // Uninstall
      uninstall: "Uninstall",
      uninstalling: "Uninstalling...",
      uninstallConfirm: "Are you sure you want to uninstall \"{{name}}\"?",
      uninstallError: "Failed to uninstall plugin",
      openSettings: "Plugin settings",
      // Developer Mode
      devModeTitle: "Developer Mode",
      devModeDesc: "Load plugins directly from a local folder for development",
      devPathLabel: "Dev plugins path",
      devPathPlaceholder: "Path to dev plugins folder...",
      devScan: "Scan",
      devBadge: "DEV",
      devNoPath: "Set a dev plugins path to get started",
      devNoPlugins: "No dev plugins found. Click Scan after setting the path.",
      tabDev: "Dev",
    },

    // --- About section ---
    about: {
      // App version label
      version: "Version {{version}}",
      // App tagline
      tagline: "Modern, fast, and elegant SSH terminal",
      // Technologies group title
      techTitle: "Technologies",
      // Technologies description
      techDesc: "Built with",
      // Links group title
      linksTitle: "Links",
      // Links description
      linksDesc: "Resources and community",
      // Source code link title
      sourceCode: "Source code",
      // Source code description
      viewOnGithub: "View on GitHub",
      // Documentation link title
      documentation: "Documentation",
      // Documentation description
      userGuide: "User guide",
      // Footer text
      footer: "Made with passion. Open source under MIT license.",
      // Update section
      updateTitle: "Updates",
      updateDesc: "Check for new versions",
      upToDate: "You're up to date",
      latestVersion: "latest",
      checking: "Checking for updates...",
      updateAvailable: "Update available!",
      downloading: "Downloading...",
      installing: "Installing update...",
      readyToInstall: "Update ready",
      checkNow: "Check now",
      updateAndRestart: "Update & Restart",
      later: "Later",
      updateError: "Update check failed",
      retry: "Retry",
      releaseNotes: "Release notes",
    },
  },

  // ============================================
  // VAULT - VaultSetupModal, VaultUnlockModal
  // ============================================
  vault: {
    setup: {
      // Modal title
      title: "Vault Setup",
      // Intro screen title
      introTitle: "Protect your connections",
      // Intro screen description
      introDesc: "The vault encrypts and stores your passwords locally. You can reconnect to your servers without re-entering them.",
      // AES-256 encryption feature title
      encryptionTitle: "AES-256 encryption",
      // AES-256 encryption description
      encryptionDesc: "Your secrets never leave your machine",
      // Quick unlock feature title
      quickUnlockTitle: "Quick unlock",
      // Quick unlock description
      quickUnlockDesc: "Optional PIN code for easy access",
      // Configure vault button
      configureVault: "Configure vault",
      // Skip for now button
      skipForNow: "Skip for now",
      // Skip warning message
      skipWarning: "Without a vault, passwords won't be saved. You can configure it later in settings.",
      // Password step info
      passwordInfo: "Create a master password to protect your credentials. You'll need it to unlock the vault.",
      // Master password label
      masterPassword: "Master password",
      // Master password placeholder
      passwordPlaceholder: "At least 8 characters",
      // Confirm password label
      confirmPassword: "Confirm password",
      // Confirm password placeholder
      confirmPlaceholder: "Confirm your password",
      // Password too short error
      passwordTooShort: "Password must be at least 8 characters",
      // Passwords don't match error
      passwordMismatch: "Passwords don't match",
      // PIN step info - not enabled
      pinInfoDisabled: "Set up a PIN code for quick vault unlock.",
      // PIN step info - entering PIN
      pinInfoEnter: "Enter a PIN code (4-6 digits) for quick unlock.",
      // PIN step info - confirming PIN
      pinInfoConfirm: "Confirm your PIN code.",
      // Setup PIN button
      setupPin: "Set up a PIN code",
      // Skip this step button
      skipStep: "Skip this step",
      // PIN mismatch error
      pinMismatch: "PINs don't match",
      // Settings step info
      settingsInfo: "Configure auto-lock to secure your credentials.",
      // Auto-lock label
      autoLockLabel: "Auto-lock after",
      // Summary title
      summaryTitle: "Summary",
      // Master password configured
      passwordConfigured: "Master password configured",
      // PIN configured status
      pinConfigured: "PIN configured",
      // PIN not configured status
      pinNotConfigured: "PIN not configured",
      // Auto-lock summary
      autoLockSummary: "Auto-lock: {{value}}",
      // Create vault button
      createVault: "Create vault",
      // Creating status
      creating: "Creating...",
      // Creation error
      creationError: "Error creating vault",
    },
    unlock: {
      // Modal title
      title: "Unlock Vault",
      // PIN locked warning (used in component)
      pinLocked: "PIN locked. Use your master password or security key.",
      // FIDO2 tab label (used in component)
      fido2Key: "FIDO2 Key",
      // PIN tab label (used in component)
      pin: "PIN",
      // Password tab label (used in component)
      password: "Password",
      // Security key prompt (used in component)
      insertSecurityKey: "Insert your security key and touch it",
      // Unlock with FIDO2 button
      unlockWithFido2: "Unlock with FIDO2 key",
      // Touch your key status
      touchingKey: "Touch your key...",
      // Touch key error fallback (used in component)
      touchSecurityKey: "Touch your security key",
      // PIN prompt (used in component)
      enterPin: "Enter your PIN code to unlock",
      // PIN attempts remaining - singular
      attemptsRemaining_one: "{{count}} attempt remaining",
      // PIN attempts remaining - plural
      attemptsRemaining_other: "{{count}} attempts remaining",
      // Master password label
      masterPassword: "Master password",
      // Password placeholder (used in component)
      enterPassword: "Enter your password",
      // Incorrect password error
      incorrectPassword: "Incorrect password",
      // Incorrect PIN error
      incorrectPin: "Incorrect PIN",
      // Unlock button
      unlock: "Unlock",
      // Unlocking status
      unlocking: "Unlocking...",
      // Continue without unlocking button
      continueWithout: "Continue without unlocking",
      // Continue without unlock warning (used in component)
      passwordsUnavailable: "Saved passwords won't be available",
    },
  },

  // ============================================
  // CONNECTION - ConnectionForm.tsx
  // ============================================
  connection: {
    // Modal title for new connection
    newTitle: "New SSH connection",
    // Modal title for editing connection
    editTitle: "Edit connection",
    // Modal title for reconnection
    reconnectTitle: "SSH Reconnection",
    // Modal title for SFTP connection
    sftpTitle: "SFTP Connection",
    // Name field label (optional)
    nameOptional: "Name (optional)",
    // Name field placeholder
    namePlaceholder: "My server",
    // Host field label
    host: "Host",
    // Host field placeholder
    hostPlaceholder: "192.168.1.1",
    // Port field label
    port: "Port",
    // Username field label
    username: "Username",
    // Username field placeholder
    usernamePlaceholder: "root",
    // Authentication section label
    authentication: "Authentication",
    // Password auth tab
    password: "Password",
    // SSH key auth tab
    sshKey: "SSH Key",
    // Key path field label
    keyPath: "Key path",
    // Key path placeholder
    keyPathPlaceholder: "~/.ssh/id_rsa",
    // Passphrase field label (optional)
    passphraseOptional: "Passphrase (optional)",
    // Connect button
    connect: "Connect",
    // Save & Connect button (edit mode)
    saveAndConnect: "Save & Connect",
    // Connecting status
    connecting: "Connecting...",
    // Enter password prompt for saved session
    enterPassword: "Enter your password to connect",
    // Enter password prompt for SFTP
    enterPasswordSftp: "Enter your password to open SFTP",
    // Telnet warning about unencrypted connection
    telnetWarning: "Telnet connections are not encrypted. Use SSH whenever possible for security.",
    // Jump Host (Bastion) configuration
    jumpHost: {
      title: "Jump Host (Bastion)",
      host: "Jump Host",
      port: "Port",
      username: "Username",
      sameAsDestination: "Same as destination",
      sameAuth: "Use same authentication as destination",
      none: "None (direct connection)",
      configureInSettings: "Configure jump hosts in Settings",
    },
    // Connection type labels
    types: {
      ssh: "SSH",
      sshDesc: "Secure Shell",
      telnet: "Telnet",
      telnetDesc: "Unencrypted",
      serial: "Serial",
      serialDesc: "COM / TTY",
      newTelnet: "New Telnet Connection",
      newSerial: "New Serial Connection",
    },
    // Serial connection fields
    serial: {
      port: "Port",
      baudRate: "Baud Rate",
      dataBits: "Data Bits",
      stopBits: "Stop Bits",
      parity: "Parity",
      parityNone: "None",
      parityOdd: "Odd",
      parityEven: "Even",
      flowControl: "Flow Control",
      flowNone: "None",
      flowHardware: "Hardware (RTS/CTS)",
      flowSoftware: "Software (XON/XOFF)",
      noPorts: "No ports available",
    },
  },

  // ============================================
  // SIDEBAR - Sidebar.tsx
  // ============================================
  sidebar: {
    // Search placeholder
    searchPlaceholder: "Search...",
    // All sessions tab label
    allSessions: "All",
    // Saved sessions section header
    saved: "Saved",
    // Recent sessions section header
    recent: "Recent",
    // New folder tooltip
    newFolder: "New folder",
    // Folder name placeholder
    folderNamePlaceholder: "Folder name...",
    // No saved connections message
    noSavedConnections: "No saved connections",
    // No recent connections message
    noRecentConnections: "No recent connections",
    // Clear recent sessions button
    clear: "Clear",
    // Settings button
    settings: "Settings",
    // No results found in search
    noResults: "No results",
    // Context menu: Connect
    connect: "Connect",
    // Context menu: Open SFTP
    openSftp: "Open SFTP",
    // Context menu: Tunnel Only
    tunnelOnly: "Tunnel Only",
    // Context menu: Move to
    moveTo: "Move to",
    // Context menu: Root folder
    root: "Root",
    // Context menu: Edit session
    edit: "Edit",
    // Context menu: Delete folder
    deleteFolder: "Delete folder",
    // Relative time: now
    timeNow: "now",
    // Relative time: minutes ago
    timeMinutesAgo: "{{count}}min ago",
    // Relative time: hours ago
    timeHoursAgo: "{{count}}h ago",
    // Relative time: days ago
    timeDaysAgo: "{{count}}d ago",
    // Vault button and tooltips
    vault: "Vault",
    connecting: "Connecting...",
    vaultLocked: "Vault locked - Click to unlock",
    vaultUnlocked: "Vault unlocked - Click to lock",
    pin: "Pin sidebar",
    unpin: "Unpin sidebar",
  },

  // ============================================
  // HOST KEY - HostKeyModal.tsx
  // ============================================
  hostKey: {
    // Title for unknown host
    unknownHost: "Unknown Host",
    // Title for host key change
    keyChanged: "Host Key Changed",
    // Warning title for security risk
    warningTitle: "Warning: Potential Security Risk",
    // Warning description for key mismatch
    warningDesc: "The host key for this server has changed. This could indicate a man-in-the-middle attack, or the server may have been reconfigured.",
    // Message for first connection
    unknownHostDesc: "The authenticity of host {{host}} cannot be established. This is the first time you're connecting to this server.",
    // Host label
    host: "Host",
    // Key type label
    keyType: "Key Type",
    // Fingerprint label for new key
    newFingerprint: "New Fingerprint",
    // Fingerprint label
    fingerprint: "Fingerprint",
    // Expected fingerprint label
    expectedFingerprint: "Expected Fingerprint",
    // Question for trusting host
    trustPrompt: "Do you want to trust this host and add it to your known hosts?",
    // Warning before proceeding with mismatch
    mismatchWarning: "Only proceed if you are certain the server key has legitimately changed.",
    // Trust & Connect button
    trustConnect: "Trust & Connect",
    // Update & Connect button
    updateConnect: "Update & Connect",
    // Processing status
    processing: "Processing...",
  },

  // ============================================
  // TUNNEL SIDEBAR - TunnelSidebar.tsx
  // ============================================
  tunnelSidebar: {
    // Panel title
    title: "Port Forwarding",
    // New tunnel button
    newTunnel: "New tunnel",
    // SSH connection field label
    sshConnection: "SSH Connection",
    // Select connection placeholder
    selectPlaceholder: "Select...",
    // Select connection error
    selectConnection: "Select a connection",
    // Tunnel type field label
    type: "Type",
    // Local port field label
    localPort: "Local port",
    // Remote port field label
    remotePort: "Remote port",
    // Remote host field label
    remoteHost: "Remote host",
    // Vault locked error
    vaultLocked: "Vault locked - unlock the vault first",
    // Password not found error
    passwordNotFound: "Password not found in vault",
    // Active tunnels section
    active: "Active",
    // History section
    history: "History",
    // No active tunnels message
    noActiveTunnels: "No active tunnels",
    // Create tunnel hint
    createTunnelHint: "Create a tunnel to access remote services",
    // Stop tunnel tooltip
    stop: "Stop",
  },

  // ============================================
  // STATUS BAR - StatusBar.tsx
  // ============================================
  statusBar: {
    // Show status bar button
    show: "Show status bar",
    // Hide status bar button
    hide: "Hide status bar",
    // Vault locked state
    locked: "Locked",
    // Vault unlocked state
    unlocked: "Unlocked",
    // Vault locked tooltip
    vaultLocked: "Vault is locked - Click to unlock",
    // Vault unlocked tooltip
    vaultUnlocked: "Vault is unlocked - Click to lock",
  },

  // ============================================
  // COMMAND PALETTE - CommandPalette.tsx
  // ============================================
  commandPalette: {
    // Search input placeholder
    searchPlaceholder: "Search commands...",
    // No results message
    noResults: "No commands found",
    // Footer hint: navigate
    navigate: "navigate",
    // Footer hint: execute
    execute: "select",
    // Footer hint: close
    close: "close",
    // Command labels
    commands: {
      // New SSH connection command
      newSshConnection: "New SSH Connection",
      // Close current tab
      closeTab: "Close Tab",
      // Duplicate current tab
      duplicateTab: "Duplicate Tab",
      // Rename current tab
      renameTab: "Rename Tab",
      // Split pane vertically
      splitPane: "Split Pane",
      // Focus next pane
      focusNextPane: "Focus Next Pane",
      // Focus previous pane
      focusPrevPane: "Focus Previous Pane",
      // Go to next tab
      nextTab: "Next Tab",
      // Go to previous tab
      prevTab: "Previous Tab",
      // Open settings
      openSettings: "Open Settings",
      // Open SFTP browser
      openSftp: "Open SFTP Browser",
    },
  },

  // ============================================
  // APP - App.tsx (empty state, modals, tabs)
  // ============================================
  app: {
    // App name
    appName: "SimplyTerm",
    // App tagline in empty state
    tagline: "Modern, fast, and elegant SSH terminal",
    // New connection button
    newConnection: "New connection",
    // Keyboard shortcut hint
    shortcutHint: "Press {{modifier}} + N to create a connection",
    // Terminal tab title
    terminalTab: "Terminal",
    // SFTP tab title prefix
    sftpTab: "SFTP - {{name}}",
    // Tunnels tab title prefix
    tunnelsTab: "Tunnels - {{name}}",
    // Connection modal: edit connection title
    editConnection: "Edit connection",
    // Connection modal: SFTP connection title
    sftpConnection: "SFTP Connection",
    // Connection modal: reconnect SSH title
    reconnectSsh: "SSH Reconnection",
    // Connection modal: new SSH connection title
    newSshConnection: "New SSH Connection",
    // Save session modal title
    saveConnection: "Save connection?",
    // Update session modal title
    updateConnection: "Update connection?",
    // Save session prompt
    saveConnectionDesc: "Do you want to save this connection for quick access?",
    // Update session prompt
    updateConnectionDesc: "Do you want to update this connection with the new information?",
    // No thanks button
    noThanks: "No thanks",
    // Update button
    update: "Update",
    // SFTP error prefix
    sftpError: "SFTP Error: {{error}}",
    // Enter password for SFTP
    enterPasswordSftp: "Enter your password to open SFTP",
    // Enter password to connect
    enterPasswordConnect: "Enter your password to connect",
    // Please enter password
    pleaseEnterPassword: "Please enter your password",
  },

  // ============================================
  // HEADER - HeaderBar.tsx / PaneGroupTabBar.tsx
  // ============================================
  header: {
    // Menu button tooltip
    menu: "Menu",
    // Tunnels button tooltip
    tunnels: "Port Forwarding (Tunnels)",
    // New SSH connection button tooltip
    newSshConnection: "New SSH connection",
    // Quick connections dropdown tooltip
    quickConnections: "Quick connections",
    // Home button tooltip
    home: "Home",
    // Window controls
    minimize: "Minimize",
    maximize: "Maximize",
    restore: "Restore",
    close: "Close",
    splitVertical: "Split vertically",
    splitHorizontal: "Split horizontally",
    closePane: "Close pane",
  },

  // ============================================
  // TERMINAL VIEW - Terminal.tsx
  // ============================================
  terminalView: {
    // Session ended message
    sessionEnded: "[Session ended]",
    // Error prefix
    errorPrefix: "Error: ",
    // Search: case sensitive tooltip
    caseSensitive: "Case sensitive (Aa)",
    // Search: regex tooltip
    regex: "Regular expression (.*)",
    // Search: previous result tooltip
    previousResult: "Previous (Shift+Enter)",
    // Search: next result tooltip
    nextResult: "Next (Enter)",
  },

  // ============================================
  // SFTP - SftpBrowser.tsx
  // ============================================
  sftp: {
    // Toolbar
    home: "Home",
    goUp: "Go up",
    refresh: "Refresh",
    newFolder: "New folder",
    newFolderPlaceholder: "New folder name...",
    // Column headers
    colName: "Name",
    colSize: "Size",
    colModified: "Modified",
    // Empty states
    emptyDirectory: "Empty directory",
    allHidden: "All files are hidden",
    // Drag & drop overlay
    dropToUpload: "Drop files to upload",
    uploadTo: "Upload to {{path}}",
    uploading: "Uploading",
    // Context menu
    download: "Download",
    open: "Open",
    editExternally: "Edit externally",
    openInEditor: "Open in editor",
    copyPath: "Copy path",
    pathCopied: "Path copied",
    rename: "Rename",
    watching: "watching",
    // Delete
    deleteTitle: "Delete {{type}}",
    deleteConfirm: "Are you sure you want to delete \"{{name}}\"? This action cannot be undone.",
    // Hidden files toggle
    showHidden: "Show hidden files",
    hideHidden: "Hide hidden files",
    // Status bar
    connected: "Connected",
    items: "{{count}} items",
    itemsHidden: "{{count}} items ({{hidden}} hidden)",
    editing: "{{count}} editing",
    folder: "Folder",
    // Download notice
    downloaded: "Downloaded {{name}}",
  },
};
