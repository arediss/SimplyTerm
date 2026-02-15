/**
 * French translations for SimplyTerm
 *
 * Organization:
 * - common.*           - Boutons/actions partagés (Annuler, Enregistrer, Supprimer, etc.)
 * - settings.*         - Sections Settings (SettingsTab)
 * - vault.*            - VaultSetupModal, VaultUnlockModal
 * - connection.*       - ConnectionForm
 * - sidebar.*          - Sidebar
 * - hostKey.*          - HostKeyModal
 * - tunnelSidebar.*    - TunnelSidebar
 * - app.*              - App.tsx (titres onglets, erreurs, état vide)
 */

export default {
  // ============================================
  // COMMON - Partagé entre plusieurs composants
  // ============================================
  common: {
    // Bouton pour annuler une action et fermer le modal/formulaire
    cancel: "Annuler",
    // Bouton pour sauvegarder/confirmer les changements
    save: "Enregistrer",
    // Bouton pour supprimer un élément
    delete: "Supprimer",
    // Bouton pour fermer un modal ou panneau
    close: "Fermer",
    // Bouton pour revenir à l'étape précédente
    back: "Retour",
    // Bouton pour continuer à l'étape suivante
    continue: "Continuer",
    // Bouton pour confirmer une action
    confirm: "Confirmer",
    // Bouton pour rafraîchir les données
    refresh: "Actualiser",
    // Label affiché lors du chargement
    loading: "Chargement...",
    // Label pour le statut actif
    active: "Actif",
    // Label pour le statut inactif
    inactive: "Inactif",
    // Label affiché quand il n'y a pas de résultats
    noResults: "Aucun résultat",
    // Préfixe d'erreur générique
    error: "Erreur",
    // Message de succès générique
    success: "Succès",
    // Label pour l'état activé
    enabled: "Activé",
    // Label pour l'état désactivé
    disabled: "Désactivé",
    // Label pour l'état configuré
    configured: "Configuré",
    // Label pour l'état non configuré
    notConfigured: "Non configuré",
    // Label pour les fonctionnalités "bientôt disponibles"
    comingSoon: "Bientôt",
    // Label pour les fonctionnalités non supportées
    notSupported: "Non supporté",
    // Action Modifier
    modify: "Modifier",
    // Action Supprimer
    remove: "Supprimer",
    // Action Configurer
    configure: "Configurer",
    // Action Créer
    create: "Créer",
  },

  // ============================================
  // SETTINGS - SettingsTab.tsx
  // ============================================
  settings: {
    // Titre du modal
    title: "Paramètres",
    // Bouton réinitialiser dans le pied de la sidebar
    reset: "Réinitialiser",

    // --- Sections de navigation ---
    sections: {
      // Onglet paramètres d'apparence
      appearance: "Apparence",
      // Onglet paramètres du terminal
      terminal: "Terminal",
      // Onglet gestion des connexions
      connections: "Connexions",
      // Onglet paramètres sécurité/vault
      security: "Sécurité",
      // Onglet gestion des plugins
      plugins: "Plugins",
      // Onglet aide
      help: "Aide",
      // Onglet à propos de l'app
      about: "À propos",
    },

    // --- Section Apparence ---
    appearance: {
      // Titre du groupe sélection de thème
      themeTitle: "Thème",
      // Description de la sélection de thème
      themeDesc: "Personnalisez l'apparence de l'application",
      // Nom du thème sombre
      themeDark: "Sombre",
      // Nom du thème clair
      themeLight: "Clair",
      // Titre du groupe couleur d'accent
      accentTitle: "Couleur d'accent",
      // Description de la couleur d'accent
      accentDesc: "Couleur utilisée pour les éléments interactifs",
      // Titre du groupe sélection de langue
      languageTitle: "Langue",
      // Description de la sélection de langue
      languageDesc: "Choisissez votre langue préférée",
      // Titre du groupe effet de fenêtre
      windowEffectTitle: "Effet de fenêtre",
      // Description de l'effet de fenêtre
      windowEffectDesc: "Effet de transparence natif pour la fenêtre",
      // Options d'effet
      effectNone: "Aucun",
      effectAcrylic: "Acrylique",
      effectMica: "Mica",
      // Note sur l'effet de fenêtre
      windowEffectNote: "Acrylique ajoute un flou à l'arrière-plan. Mica utilise un fond système teinté. Windows 11 requis pour Mica.",
    },

    // --- Section Terminal ---
    terminal: {
      // Titre du groupe sélection de police
      fontTitle: "Police",
      // Description de la sélection de police
      fontDesc: "Police utilisée dans le terminal",
      // Titre du groupe taille de police
      fontSizeTitle: "Taille de police",
      // Description de la taille de police
      fontSizeDesc: "Taille du texte dans le terminal",
      // Titre du groupe style de curseur
      cursorTitle: "Style du curseur",
      // Description du style de curseur
      cursorDesc: "Apparence du curseur dans le terminal",
      // Style de curseur barre
      cursorBar: "Barre",
      // Style de curseur bloc
      cursorBlock: "Bloc",
      // Style de curseur souligné
      cursorUnderline: "Souligné",
      // Titre du paramètre clignotement du curseur
      cursorBlinkTitle: "Clignotement du curseur",
      // Description du clignotement du curseur
      cursorBlinkDesc: "Faire clignoter le curseur",
      // Titre du groupe historique de défilement
      scrollbackTitle: "Historique (scrollback)",
      // Description de l'historique
      scrollbackDesc: "Nombre de lignes conservées",
    },

    // --- Section Connexions ---
    connections: {
      // Titre du groupe sessions sauvegardées
      savedTitle: "Sessions sauvegardées",
      // Description des sessions sauvegardées
      savedDesc: "Gérez vos connexions enregistrées",
      // {{count}} session(s) sauvegardée(s) - singulier
      savedCount_one: "{{count}} session sauvegardée",
      // {{count}} sessions sauvegardées - pluriel
      savedCount_other: "{{count}} sessions sauvegardées",
      // Info stockage des credentials
      storedSecurely: "Stockées localement avec credentials sécurisés",
      // Titre du groupe suppression des données
      deleteTitle: "Supprimer les données",
      // Description de la suppression
      deleteDesc: "Effacer toutes les sessions sauvegardées et leurs credentials",
      // Bouton tout supprimer
      deleteAll: "Tout supprimer",
      // Bouton confirmer la suppression
      confirmDelete: "Confirmer la suppression",
      // Avertissement après clic sur supprimer
      deleteWarning: "Cliquez à nouveau pour confirmer. Cette action est irréversible.",
    },


    // --- Section Sécurité ---
    security: {
      // Titre du groupe vault non configuré
      vaultNotConfigured: "Vault non configuré",
      // Description du vault non configuré
      vaultNotConfiguredDesc: "Protégez vos mots de passe avec un vault chiffré",
      // Avertissement quand le vault n'est pas configuré
      noVaultWarning: "Sans vault, les mots de passe de vos connexions ne seront pas sauvegardés. Vous devrez les saisir à chaque connexion.",
      // Bouton configurer le vault
      configureVault: "Configurer le vault",
      // Titre du groupe statut du vault
      vaultStatusTitle: "État du vault",
      // Description du statut du vault
      vaultStatusDesc: "Stockage chiffré de vos credentials",
      // Statut vault déverrouillé
      vaultUnlocked: "Vault déverrouillé",
      // Statut vault verrouillé
      vaultLocked: "Vault verrouillé",
      // Bouton verrouiller
      lock: "Verrouiller",
      // Label méthodes de déverrouillage
      methods: "Méthodes",
      // Nom de la méthode mot de passe principal
      methodPassword: "Mot de passe",
      // Nom de la méthode PIN
      methodPin: "PIN",
      // Nom de la méthode clé de sécurité
      methodSecurityKey: "Clé de sécurité",
      // Titre du groupe verrouillage auto
      autoLockTitle: "Verrouillage automatique",
      // Description du verrouillage auto
      autoLockDesc: "Délai avant le verrouillage automatique",
      // Option verrouillage auto : Jamais
      autoLockNever: "Jamais",
      // Option verrouillage auto : 1 minute
      autoLock1min: "1 minute",
      // Option verrouillage auto : 5 minutes
      autoLock5min: "5 minutes",
      // Option verrouillage auto : 10 minutes
      autoLock10min: "10 minutes",
      // Option verrouillage auto : 30 minutes
      autoLock30min: "30 minutes",
      // Option verrouillage auto : 1 heure
      autoLock1hour: "1 heure",
      // Onglets sécurité
      tabVault: "Coffre",
      tabSshKeys: "Clés SSH",
      tabAuthentication: "Authentification",
      // Section clés SSH
      sshKeysTitle: "Clés SSH",
      sshKeysDesc: "Gérez vos profils de clés SSH stockés dans le vault",
      sshKeysAddKey: "Ajouter une clé SSH",
      sshKeysEditKey: "Modifier la clé",
      sshKeysDeleteKey: "Supprimer la clé",
      sshKeysName: "Nom",
      sshKeysKeyPath: "Chemin de la clé",
      sshKeysPassphrase: "Phrase de passe",
      sshKeysAlwaysAskPassphrase: "Toujours demander la phrase de passe",
      sshKeysAlwaysAskPassphraseDesc: "Demander la phrase de passe à chaque connexion au lieu de la stocker",
      sshKeysNoKeys: "Aucune clé SSH enregistrée",
      sshKeysConfirmDelete: "Êtes-vous sûr de vouloir supprimer cette clé SSH ?",
      sshKeysPassphraseRequired: "Phrase de passe requise",
      sshKeysEnterPassphraseFor: "Entrez la phrase de passe pour",
      sshKeysCustomKey: "Clé personnalisée...",
      sshKeysSelectKey: "Sélectionner une clé SSH",
      sshKeysNamePlaceholder: "Ma clé serveur",
      sshKeysKeyPathPlaceholder: "~/.ssh/id_rsa",
      // Titre du groupe mode sécurité maximale
      maxSecurityTitle: "Mode sécurité maximale",
      // Description du mode sécurité maximale
      maxSecurityDesc: "Exige le déverrouillage du vault à chaque connexion SSH",
      // Message mode sécurité activé
      maxSecurityEnabled: "Le vault sera verrouillé après chaque connexion",
      // Message mode sécurité désactivé
      maxSecurityDisabled: "Les credentials restent accessibles selon le timeout",
      // Avertissement mode sécurité maximale
      maxSecurityWarning: "Vous devrez saisir votre PIN/mot de passe à chaque connexion SSH",
      // Titre du groupe code PIN
      pinTitle: "Code PIN",
      // Description du code PIN
      pinDesc: "Déverrouillage rapide avec un code PIN",
      // Statut PIN configuré
      pinConfigured: "PIN configuré",
      // Statut PIN non configuré
      pinNotConfigured: "PIN non configuré",
      // Déverrouillage rapide activé
      pinQuickUnlock: "Déverrouillage rapide activé",
      // Invitation à configurer un PIN
      pinSetupPrompt: "Ajoutez un PIN pour un accès rapide",
      // Placeholder nouveau PIN
      newPinPlaceholder: "Nouveau PIN (4-6 chiffres)",
      // Placeholder confirmer PIN
      confirmPinPlaceholder: "Confirmer le PIN",
      // Erreur de validation du PIN
      pinValidationError: "Le PIN doit contenir 4 à 6 chiffres",
      // Erreur PIN ne correspondent pas
      pinMismatchError: "Les PINs ne correspondent pas",
      // Succès configuration PIN
      pinSetupSuccess: "PIN configuré avec succès",
      // Erreur configuration PIN
      pinSetupError: "Erreur lors de la configuration du PIN",
      // Erreur suppression PIN
      pinRemoveError: "Erreur lors de la suppression du PIN",
      // Titre du groupe authentification biométrique
      biometricTitle: "Authentification biométrique",
      // Description authentification biométrique
      biometricDesc: "Déverrouillez avec Windows Hello ou Touch ID",
      // Nom Windows Hello
      windowsHello: "Windows Hello",
      // Nom Touch ID
      touchId: "Touch ID",
      // Label biométrie
      biometric: "Biométrie",
      // Message biométrie non disponible
      biometricNotAvailable: "Non disponible sur ce système",
      // Titre du groupe clé de sécurité FIDO2
      fido2Title: "Clé de sécurité FIDO2",
      // Description FIDO2
      fido2Desc: "Déverrouillez en touchant votre clé (YubiKey, SoloKey, etc.)",
      // Label clé FIDO2
      fido2Key: "Clé FIDO2",
      // Statut FIDO2 configuré
      fido2Configured: "Configurée - Touch to unlock",
      // Statut FIDO2 non configuré
      fido2NotConfigured: "Clé de sécurité matérielle",
      // Invitation à toucher la clé
      touchKey: "Touchez votre clé de sécurité...",
      // Avertissement aucune clé détectée
      noKeyDetected: "Aucune clé de sécurité détectée",
      // Invitation à insérer une clé
      insertKeyPrompt: "Insérez une clé FIDO2 (YubiKey, SoloKey, Google Titan, etc.)",
      // Windows WebAuthn prêt
      windowsWebAuthnReady: "Prêt à configurer",
      // Windows WebAuthn indication
      windowsWebAuthnHint: "Cliquez sur Configurer pour utiliser Windows Hello ou branchez votre clé USB",
      // Clé(s) détectée(s) - singulier
      keyDetected_one: "{{count}} clé détectée",
      // Clés détectées - pluriel
      keyDetected_other: "{{count}} clés détectées",
      // Titre des étapes de configuration
      setupSteps: "Configuration en 2 étapes :",
      // Étape 1 de configuration
      setupStep1: "Touchez votre clé pour l'enregistrer",
      // Étape 2 de configuration
      setupStep2: "Touchez-la à nouveau pour confirmer",
      // Rafraîchir la liste des clés
      refreshKeyList: "Actualiser la liste",
      // Succès configuration clé de sécurité
      keySetupSuccess: "Clé de sécurité configurée avec succès",
      // Erreur configuration clé de sécurité
      keySetupError: "Erreur lors de la configuration de la clé de sécurité",
      // Erreur suppression clé de sécurité
      keyRemoveError: "Erreur lors de la suppression de la clé de sécurité",
      // Titre du groupe mot de passe principal
      masterPasswordTitle: "Mot de passe principal",
      // Description du mot de passe principal
      masterPasswordDesc: "Modifiez votre mot de passe principal",
      // Bouton changer le mot de passe
      changePassword: "Changer le mot de passe",
      // Placeholder mot de passe actuel
      currentPasswordPlaceholder: "Mot de passe actuel",
      // Placeholder nouveau mot de passe
      newPasswordPlaceholder: "Nouveau mot de passe (min. 8 car.)",
      // Placeholder confirmer nouveau mot de passe
      confirmNewPasswordPlaceholder: "Confirmer le nouveau mot de passe",
      // Erreur mot de passe trop court
      passwordTooShort: "Le nouveau mot de passe doit contenir au moins 8 caractères",
      // Erreur mots de passe ne correspondent pas
      passwordMismatchError: "Les mots de passe ne correspondent pas",
      // Succès changement de mot de passe
      passwordChangeSuccess: "Mot de passe modifié avec succès",
      // Erreur changement de mot de passe
      passwordChangeError: "Erreur lors du changement de mot de passe",
      // Titre du groupe supprimer le vault
      // Sauvegarde / Restauration
      backupTitle: "Sauvegarde & Restauration",
      backupDesc: "Exporter ou importer votre coffre chiffré",
      exportVault: "Exporter le coffre",
      importVault: "Importer un coffre",
      exportSuccess: "Exporté !",
      importSuccess: "Importé !",
      exportError: "Erreur lors de l'export du coffre",
      importError: "Erreur lors de l'import du coffre",
      backupHint: "Le fichier exporté est chiffré avec votre mot de passe principal.",
      // Vault Manager
      vaultContentsTitle: "Contenu du coffre",
      vaultItems: "éléments",
      vaultLockedTitle: "Coffre verrouillé",
      vaultLockedDesc: "Déverrouillez pour voir le contenu",
      emptyFolder: "Dossier vide",
      emptyVault: "Votre coffre est vide",
      emptyVaultDesc: "Les sessions et clés SSH apparaîtront ici",
      settingsLabel: "Paramètres",
      selectedCount: "sélectionné(s)",
      includeCredentials: "Inclure les identifiants (mots de passe)",
      includeSshKeys: "Inclure les clés SSH",
      // Avertissements import
      importWarning: "Les éléments importés seront fusionnés avec votre coffre existant",
      importToFolder: "Importer dans un nouveau dossier",
      importFolderName: "Nom du dossier",
      unlock: "Déverrouiller",
      // Dossiers
      foldersTitle: "Dossiers",
      foldersDesc: "Organisez les éléments de votre coffre en dossiers",
      createFolder: "Nouveau dossier",
      renameFolder: "Renommer",
      deleteFolder: "Supprimer",
      folderNamePlaceholder: "Nom du dossier",
      folderDeleteConfirm: "Supprimer ce dossier ? Les éléments seront désassignés.",
      noFolder: "Sans dossier",
      itemCount: "{{count}} élément(s)",
      // Export sélectif
      selectiveExportTitle: "Export sélectif",
      selectiveExportDesc: "Choisissez les éléments à exporter avec un mot de passe dédié",
      selectAll: "Tout sélectionner",
      nothingSelected: "Aucune sélection",
      exportPassword: "Mot de passe d'export",
      exportPasswordConfirm: "Confirmer le mot de passe",
      exportPasswordHint: "Ce mot de passe chiffre le fichier d'export. Partagez-le avec le destinataire.",
      exporting: "Export en cours...",
      exportSelectiveSuccess: "Export terminé !",
      // Import sélectif
      selectiveImportTitle: "Import sélectif",
      chooseFile: "Choisir un fichier",
      importPassword: "Mot de passe d'import",
      preview: "Prévisualiser",
      previewDesc: "Contenu trouvé dans le fichier d'export :",
      importConfirm: "Importer",
      importing: "Import en cours...",
      importResultTitle: "Import terminé",
      itemsAdded: "{{count}} ajouté(s)",
      duplicatesSkipped: "{{count}} doublon(s) ignoré(s)",
      wrongPassword: "Mot de passe incorrect ou fichier corrompu",
      // Titre du groupe supprimer le vault
      deleteVaultTitle: "Supprimer le vault",
      // Description supprimer le vault
      deleteVaultDesc: "Supprime toutes vos données chiffrées de manière irréversible",
      // Bouton supprimer le vault
      deleteVault: "Supprimer le vault",
      // Avertissement suppression vault
      deleteVaultWarning: "Cette action est irréversible. Toutes vos credentials seront perdues.",
      // Invitation à entrer le mot de passe pour confirmer
      deleteVaultPasswordPrompt: "Entrez votre mot de passe principal pour confirmer",
      // Bouton supprimer définitivement
      deletePermanently: "Supprimer définitivement",
      // Erreur mot de passe incorrect
      incorrectPassword: "Mot de passe incorrect",
      // Statut création
      creating: "Création...",
      // Bouton créer le vault
      createVault: "Créer le vault",
    },

    // --- Section Plugins ---
    plugins: {
      // Titre du groupe plugins installés
      installedTitle: "Plugins installés",
      // Description des plugins installés
      installedDesc: "Extensions ajoutant des fonctionnalités à SimplyTerm",
      // Nombre de plugins - singulier
      pluginCount_one: "{{count}} plugin trouvé",
      // Nombre de plugins - pluriel
      pluginCount_other: "{{count}} plugins trouvés",
      // Message aucun plugin installé
      noPlugins: "Aucun plugin installé",
      // Indication du dossier plugins
      pluginDirHint: "Placez vos plugins dans",
      // Préfixe auteur du plugin
      byAuthor: "par {{author}}",
      // Titre du groupe installation
      installationTitle: "Installation",
      // Description de l'installation
      installationDesc: "Comment ajouter de nouveaux plugins",
      // Étape 1 d'installation
      installStep1: "Créez le dossier",
      // Étape 2 d'installation
      installStep2: "Ajoutez un dossier pour chaque plugin avec :",
      // Description fichier manifest
      manifestFile: "Métadonnées",
      // Description fichier index
      indexFile: "Code du plugin",
      // Étape 3 d'installation
      installStep3: "Actualisez la liste et activez le plugin",
      tabPlugins: "Plugins",
      tabInstalled: "Installés",
      tabBrowse: "Parcourir",
      tabUpdates: "Mises à jour",
      // Filtres de statut
      filterAll: "Tous",
      filterInstalled: "Installés",
      filterAvailable: "Disponibles",
      filterDev: "Développement",
      searchPlaceholder: "Rechercher des plugins...",
      browseDesc: "Découvrez et installez des plugins depuis le registre",
      featured: "Disponibles",
      noResults: "Aucun plugin trouvé",
      noResultsHint: "Essayez un autre terme de recherche ou vérifiez la configuration du registre",
      install: "Installer",
      installing: "Installation...",
      installed: "Installé",
      installConfirmTitle: "Installer le plugin",
      installOnly: "Installer",
      installAndActivate: "Installer et activer",
      noPermissions: "Aucune permission spéciale requise",
      permissionsRequired: "Permissions demandées",
      highRiskWarning: "Ce plugin demande des permissions sensibles. Installez-le uniquement si vous faites confiance à la source.",
      viewSource: "Voir la source",
      updatesDesc: "Gardez vos plugins à jour",
      updatesAvailable_one: "{{count}} mise à jour disponible",
      updatesAvailable_other: "{{count}} mises à jour disponibles",
      noUpdates: "Tous les plugins sont à jour",
      updateAll: "Tout mettre à jour",
      update: "Mettre à jour",
      updating: "Mise à jour...",
      updateTo: "v{{version}} disponible",
      updateAvailableSingular: "mise à jour disponible",
      updateAvailablePlural: "mises à jour disponibles",
      categoryAll: "Tous",
      categoryThemes: "Thèmes",
      categoryProductivity: "Productivité",
      categorySecurity: "Sécurité",
      categoryDevops: "DevOps",
      categoryTools: "Outils",
      registryError: "Impossible de se connecter au registre de plugins",
      installError: "Échec de l'installation du plugin",
      updateError: "Échec de la mise à jour du plugin",
      uninstall: "Désinstaller",
      uninstalling: "Désinstallation...",
      uninstallConfirm: "Êtes-vous sûr de vouloir désinstaller \"{{name}}\" ?",
      uninstallError: "Échec de la désinstallation du plugin",
      openSettings: "Paramètres du plugin",
      // Mode Développeur
      devModeTitle: "Mode développeur",
      devModeDesc: "Charger les plugins directement depuis un dossier local pour le développement",
      devPathLabel: "Chemin des plugins dev",
      devPathPlaceholder: "Chemin vers le dossier de plugins dev...",
      devScan: "Scanner",
      devBadge: "DEV",
      devNoPath: "Définissez un chemin de plugins dev pour commencer",
      devNoPlugins: "Aucun plugin dev trouvé. Cliquez Scanner après avoir défini le chemin.",
      tabDev: "Dev",
    },

    // --- Section Aide ---
    help: {
      shortcutsTitle: "Raccourcis clavier",
      shortcutsDesc: "Tous les raccourcis clavier disponibles",
      groupGeneral: "Général",
      groupTabs: "Onglets",
      groupPanes: "Panneaux",
      groupTerminal: "Terminal",
      commandPalette: "Palette de commandes",
      openSettings: "Ouvrir les paramètres",
      newSshConnection: "Nouvelle connexion SSH",
      newLocalTerminal: "Nouveau terminal local",
      closeTab: "Fermer l'onglet",
      nextTab: "Onglet suivant",
      prevTab: "Onglet précédent",
      splitVertical: "Scinder verticalement",
      splitHorizontal: "Scinder horizontalement",
      focusNextPane: "Panneau suivant",
      focusPrevPane: "Panneau précédent",
      searchInTerminal: "Rechercher dans le terminal",
      tip: "Appuyez sur Ctrl+Shift+P pour ouvrir la Palette de commandes et accéder rapidement à toutes les actions.",
    },

    // --- Section À propos ---
    about: {
      // Label version de l'app
      version: "Version {{version}}",
      // Slogan de l'app
      tagline: "Terminal SSH moderne, rapide et élégant",
      // Titre du groupe technologies
      techTitle: "Technologies",
      // Description des technologies
      techDesc: "Construit avec",
      // Titre du groupe liens
      linksTitle: "Liens",
      // Description des liens
      linksDesc: "Ressources et communauté",
      // Titre du lien code source
      sourceCode: "Code source",
      // Description voir sur GitHub
      viewOnGithub: "Voir sur GitHub",
      // Titre du lien documentation
      documentation: "Documentation",
      // Description guide d'utilisation
      userGuide: "Guide d'utilisation",
      // Texte du pied de page
      footer: "Fait avec passion. Open source sous licence MIT.",
      // Section mise à jour
      updateTitle: "Mises à jour",
      updateDesc: "Vérifier les nouvelles versions",
      upToDate: "Vous êtes à jour",
      latestVersion: "dernière version",
      checking: "Recherche de mises à jour...",
      updateAvailable: "Mise à jour disponible !",
      downloading: "Téléchargement...",
      installing: "Installation de la mise à jour...",
      readyToInstall: "Mise à jour prête",
      checkNow: "Vérifier",
      updateAndRestart: "Mettre à jour et redémarrer",
      later: "Plus tard",
      updateError: "Échec de la vérification",
      retry: "Réessayer",
      releaseNotes: "Notes de version",
      // Mode Développeur
      devModeTitle: "Mode développeur",
      devModeDesc: "Pour les développeurs de plugins",
      devModeToggle: "Activer le mode développeur",
      devModeToggleDesc: "Afficher l'onglet Développement dans Plugins pour charger des plugins locaux",
    },
  },

  // ============================================
  // VAULT - VaultSetupModal, VaultUnlockModal
  // ============================================
  vault: {
    setup: {
      // Titre du modal
      title: "Configuration du Vault",
      // Titre de l'écran d'introduction
      introTitle: "Protégez vos connexions",
      // Description de l'écran d'introduction
      introDesc: "Le vault chiffre et stocke vos mots de passe localement. Vous pourrez vous reconnecter à vos serveurs sans les ressaisir.",
      // Titre fonctionnalité chiffrement AES-256
      encryptionTitle: "Chiffrement AES-256",
      // Description chiffrement AES-256
      encryptionDesc: "Vos secrets ne quittent jamais votre machine",
      // Titre fonctionnalité déverrouillage rapide
      quickUnlockTitle: "Déverrouillage rapide",
      // Description déverrouillage rapide
      quickUnlockDesc: "Code PIN optionnel pour un accès facile",
      // Bouton configurer le vault
      configureVault: "Configurer le vault",
      // Bouton passer pour l'instant
      skipForNow: "Passer pour l'instant",
      // Message d'avertissement si on passe
      skipWarning: "Sans vault, les mots de passe ne seront pas sauvegardés. Vous pourrez le configurer plus tard dans les paramètres.",
      // Info étape mot de passe
      passwordInfo: "Créez un mot de passe principal pour protéger vos credentials. Vous en aurez besoin pour déverrouiller le vault.",
      // Label mot de passe principal
      masterPassword: "Mot de passe principal",
      // Placeholder mot de passe
      passwordPlaceholder: "Au moins 8 caractères",
      // Label confirmer le mot de passe
      confirmPassword: "Confirmer le mot de passe",
      // Placeholder confirmation
      confirmPlaceholder: "Confirmez votre mot de passe",
      // Erreur mot de passe trop court
      passwordTooShort: "Le mot de passe doit contenir au moins 8 caractères",
      // Erreur mots de passe ne correspondent pas
      passwordMismatch: "Les mots de passe ne correspondent pas",
      // Info étape PIN - non activé
      pinInfoDisabled: "Configurez un code PIN pour déverrouiller rapidement le vault.",
      // Info étape PIN - saisie du PIN
      pinInfoEnter: "Entrez un code PIN (4-6 chiffres) pour un déverrouillage rapide.",
      // Info étape PIN - confirmation du PIN
      pinInfoConfirm: "Confirmez votre code PIN.",
      // Bouton configurer un PIN
      setupPin: "Configurer un code PIN",
      // Bouton passer cette étape
      skipStep: "Passer cette étape",
      // Erreur PINs ne correspondent pas
      pinMismatch: "Les PINs ne correspondent pas",
      // Info étape paramètres
      settingsInfo: "Configurez le verrouillage automatique pour sécuriser vos credentials.",
      // Label verrouillage auto
      autoLockLabel: "Verrouillage automatique après",
      // Titre récapitulatif
      summaryTitle: "Récapitulatif",
      // Mot de passe principal configuré
      passwordConfigured: "Mot de passe principal configuré",
      // Statut PIN configuré
      pinConfigured: "Code PIN configuré",
      // Statut PIN non configuré
      pinNotConfigured: "Code PIN non configuré",
      // Récapitulatif verrouillage auto
      autoLockSummary: "Verrouillage auto : {{value}}",
      // Bouton créer le vault
      createVault: "Créer le vault",
      // Statut création
      creating: "Création...",
      // Erreur création
      creationError: "Erreur lors de la création du vault",
    },
    unlock: {
      // Titre du modal
      title: "Déverrouiller le Vault",
      // Avertissement PIN verrouillé (utilisé dans le composant)
      pinLocked: "Code PIN verrouillé. Utilisez votre mot de passe principal ou clé de sécurité.",
      // Label onglet FIDO2 (utilisé dans le composant)
      fido2Key: "Clé FIDO2",
      // Label onglet PIN (utilisé dans le composant)
      pin: "PIN",
      // Label onglet mot de passe (utilisé dans le composant)
      password: "Mot de passe",
      // Invitation clé de sécurité (utilisé dans le composant)
      insertSecurityKey: "Insérez votre clé de sécurité et touchez-la",
      // Bouton déverrouiller avec FIDO2
      unlockWithFido2: "Déverrouiller avec clé FIDO2",
      // Statut touche ta clé
      touchingKey: "Touchez votre clé...",
      // Erreur fallback touche ta clé (utilisé dans le composant)
      touchSecurityKey: "Touchez votre clé de sécurité",
      // Invitation PIN (utilisé dans le composant)
      enterPin: "Entrez votre code PIN pour déverrouiller",
      // Tentatives restantes - singulier
      attemptsRemaining_one: "{{count}} tentative restante",
      // Tentatives restantes - pluriel
      attemptsRemaining_other: "{{count}} tentatives restantes",
      // Label mot de passe principal
      masterPassword: "Mot de passe principal",
      // Placeholder mot de passe (utilisé dans le composant)
      enterPassword: "Entrez votre mot de passe",
      // Erreur mot de passe incorrect
      incorrectPassword: "Mot de passe incorrect",
      // Erreur PIN incorrect
      incorrectPin: "Code PIN incorrect",
      // Bouton déverrouiller
      unlock: "Déverrouiller",
      // Statut déverrouillage
      unlocking: "Déverrouillage...",
      // Bouton continuer sans déverrouiller
      continueWithout: "Continuer sans déverrouiller",
      // Avertissement continuer sans déverrouiller (utilisé dans le composant)
      passwordsUnavailable: "Les mots de passe sauvegardés ne seront pas disponibles",
    },
  },

  // ============================================
  // CONNECTION - ConnectionForm.tsx
  // ============================================
  connection: {
    // Titre du modal pour nouvelle connexion
    newTitle: "Nouvelle connexion SSH",
    // Titre du modal pour édition de connexion
    editTitle: "Modifier la connexion",
    // Titre du modal pour reconnexion
    reconnectTitle: "Reconnexion SSH",
    // Titre du modal pour connexion SFTP
    sftpTitle: "Connexion SFTP",
    // Label du champ nom (optionnel)
    nameOptional: "Nom (optionnel)",
    // Placeholder du champ nom
    namePlaceholder: "Mon serveur",
    // Label du champ hôte
    host: "Hôte",
    // Placeholder du champ hôte
    hostPlaceholder: "192.168.1.1",
    // Label du champ port
    port: "Port",
    // Label du champ utilisateur
    username: "Utilisateur",
    // Placeholder du champ utilisateur
    usernamePlaceholder: "root",
    // Label de la section authentification
    authentication: "Authentification",
    // Onglet authentification par mot de passe
    password: "Mot de passe",
    // Onglet authentification par clé SSH
    sshKey: "Clé SSH",
    // Label du champ chemin de la clé
    keyPath: "Chemin de la clé",
    // Placeholder du chemin de la clé
    keyPathPlaceholder: "~/.ssh/id_rsa",
    // Label du champ passphrase (optionnel)
    passphraseOptional: "Passphrase (optionnel)",
    // Bouton connecter
    connect: "Se connecter",
    // Bouton sauvegarder et connecter (mode édition)
    saveAndConnect: "Sauvegarder & Connecter",
    // Statut connexion en cours
    connecting: "Connexion...",
    // Invitation à entrer le mot de passe pour session sauvegardée
    enterPassword: "Entrez votre mot de passe pour vous connecter",
    // Invitation à entrer le mot de passe pour SFTP
    enterPasswordSftp: "Entrez votre mot de passe pour ouvrir SFTP",
    // Avertissement Telnet connexion non chiffrée
    telnetWarning: "Les connexions Telnet ne sont pas chiffrées. Utilisez SSH autant que possible pour la sécurité.",
    // Configuration Jump Host (Bastion)
    jumpHost: {
      title: "Jump Host (Bastion)",
      host: "Hôte de rebond",
      port: "Port",
      username: "Utilisateur",
      sameAsDestination: "Identique à la destination",
      sameAuth: "Même authentification que la destination",
      none: "Aucun (connexion directe)",
      configureInSettings: "Configurer les jump hosts dans les Paramètres",
    },
    // Labels des types de connexion
    types: {
      ssh: "SSH",
      sshDesc: "Secure Shell",
      telnet: "Telnet",
      telnetDesc: "Non chiffré",
      serial: "Série",
      serialDesc: "COM / TTY",
      newTelnet: "Nouvelle connexion Telnet",
      newSerial: "Nouvelle connexion série",
    },
    // Champs de connexion série
    serial: {
      port: "Port",
      baudRate: "Débit",
      dataBits: "Bits de données",
      stopBits: "Bits d'arrêt",
      parity: "Parité",
      parityNone: "Aucune",
      parityOdd: "Impaire",
      parityEven: "Paire",
      flowControl: "Contrôle de flux",
      flowNone: "Aucun",
      flowHardware: "Matériel (RTS/CTS)",
      flowSoftware: "Logiciel (XON/XOFF)",
      noPorts: "Aucun port disponible",
    },
  },

  // ============================================
  // SIDEBAR - Sidebar.tsx
  // ============================================
  sidebar: {
    // Placeholder de recherche
    searchPlaceholder: "Rechercher...",
    // Label onglet toutes les sessions
    allSessions: "Toutes",
    // En-tête section sessions sauvegardées
    saved: "Sauvegardées",
    // En-tête section sessions récentes
    recent: "Récentes",
    // Infobulle nouveau dossier
    newFolder: "Nouveau dossier",
    // Placeholder nom du dossier
    folderNamePlaceholder: "Nom du dossier...",
    // Message aucune connexion sauvegardée
    noSavedConnections: "Aucune connexion sauvegardée",
    // Message aucune connexion récente
    noRecentConnections: "Aucune connexion récente",
    // Bouton effacer les sessions récentes
    clear: "Effacer",
    // Bouton paramètres
    settings: "Paramètres",
    // Aucun résultat trouvé
    noResults: "Aucun résultat",
    // Menu contextuel : Connecter
    connect: "Connecter",
    // Menu contextuel : Ouvrir SFTP
    openSftp: "Ouvrir SFTP",
    // Menu contextuel : Tunnel Only
    tunnelOnly: "Tunnel Only",
    // Menu contextuel : Déplacer vers
    moveTo: "Déplacer vers",
    // Menu contextuel : Dossier racine
    root: "Racine",
    // Menu contextuel : Modifier
    edit: "Modifier",
    // Menu contextuel : Supprimer le dossier
    deleteFolder: "Supprimer le dossier",
    // Temps relatif : maintenant
    timeNow: "maintenant",
    // Temps relatif : il y a X minutes
    timeMinutesAgo: "il y a {{count}}min",
    // Temps relatif : il y a X heures
    timeHoursAgo: "il y a {{count}}h",
    // Temps relatif : il y a X jours
    timeDaysAgo: "il y a {{count}}j",
    // Bouton et info-bulles du coffre
    vault: "Coffre",
    connecting: "Connexion en cours...",
    vaultLocked: "Coffre verrouillé - Cliquer pour déverrouiller",
    vaultUnlocked: "Coffre déverrouillé - Cliquer pour verrouiller",
    pin: "Épingler la barre latérale",
    unpin: "Détacher la barre latérale",
  },

  // ============================================
  // HOST KEY - HostKeyModal.tsx
  // ============================================
  hostKey: {
    // Titre pour hôte inconnu
    unknownHost: "Hôte inconnu",
    // Titre pour changement de clé
    keyChanged: "Clé d'hôte modifiée",
    // Titre avertissement risque de sécurité
    warningTitle: "Attention : Risque de sécurité potentiel",
    // Description avertissement pour changement de clé
    warningDesc: "La clé d'hôte de ce serveur a changé. Cela pourrait indiquer une attaque man-in-the-middle, ou le serveur a peut-être été reconfiguré.",
    // Message pour première connexion
    unknownHostDesc: "L'authenticité de l'hôte {{host}} ne peut pas être établie. C'est la première fois que vous vous connectez à ce serveur.",
    // Label hôte
    host: "Hôte",
    // Label type de clé
    keyType: "Type de clé",
    // Label empreinte nouvelle clé
    newFingerprint: "Nouvelle empreinte",
    // Label empreinte
    fingerprint: "Empreinte",
    // Label empreinte attendue
    expectedFingerprint: "Empreinte attendue",
    // Question pour faire confiance à l'hôte
    trustPrompt: "Voulez-vous faire confiance à cet hôte et l'ajouter à vos hôtes connus ?",
    // Avertissement avant de procéder avec un changement
    mismatchWarning: "Ne continuez que si vous êtes certain que la clé du serveur a légitimement changé.",
    // Bouton faire confiance et connecter
    trustConnect: "Faire confiance et connecter",
    // Bouton mettre à jour et connecter
    updateConnect: "Mettre à jour et connecter",
    // Statut traitement
    processing: "Traitement...",
  },

  // ============================================
  // TUNNEL SIDEBAR - TunnelSidebar.tsx
  // ============================================
  tunnelSidebar: {
    // Titre du panneau
    title: "Port Forwarding",
    // Bouton nouveau tunnel
    newTunnel: "Nouveau tunnel",
    // Label champ connexion SSH
    sshConnection: "Connexion SSH",
    // Placeholder sélection connexion
    selectPlaceholder: "Sélectionner...",
    // Erreur sélection connexion
    selectConnection: "Sélectionnez une connexion",
    // Label champ type de tunnel
    type: "Type",
    // Label champ port local
    localPort: "Port local",
    // Label champ port distant
    remotePort: "Port distant",
    // Label champ hôte distant
    remoteHost: "Hôte distant",
    // Erreur vault verrouillé
    vaultLocked: "Vault verrouillé - déverrouillez le vault d'abord",
    // Erreur mot de passe non trouvé
    passwordNotFound: "Mot de passe non trouvé dans le vault",
    // Section tunnels actifs
    active: "Actifs",
    // Section historique
    history: "Historique",
    // Message aucun tunnel actif
    noActiveTunnels: "Aucun tunnel actif",
    // Indication créer un tunnel
    createTunnelHint: "Créez un tunnel pour accéder à des services distants",
    // Infobulle arrêter le tunnel
    stop: "Arrêter",
  },

  // ============================================
  // STATUS BAR - StatusBar.tsx
  // ============================================
  statusBar: {
    // Bouton afficher la barre de statut
    show: "Afficher la barre de statut",
    // Bouton masquer la barre de statut
    hide: "Masquer la barre de statut",
    // État vault verrouillé
    locked: "Verrouillé",
    // État vault déverrouillé
    unlocked: "Déverrouillé",
    // Tooltip vault verrouillé
    vaultLocked: "Vault verrouillé - Cliquez pour déverrouiller",
    // Tooltip vault déverrouillé
    vaultUnlocked: "Vault déverrouillé - Cliquez pour verrouiller",
  },

  // ============================================
  // COMMAND PALETTE - CommandPalette.tsx
  // ============================================
  commandPalette: {
    // Placeholder de recherche
    searchPlaceholder: "Rechercher une commande...",
    // Message aucun résultat
    noResults: "Aucune commande trouvée",
    // Indication footer : naviguer
    navigate: "naviguer",
    // Indication footer : exécuter
    execute: "sélectionner",
    // Indication footer : fermer
    close: "fermer",
    // Labels des commandes
    commands: {
      // Nouvelle connexion SSH
      newSshConnection: "Nouvelle connexion SSH",
      // Fermer l'onglet actuel
      closeTab: "Fermer l'onglet",
      // Dupliquer l'onglet actuel
      duplicateTab: "Dupliquer l'onglet",
      // Renommer l'onglet actuel
      renameTab: "Renommer l'onglet",
      // Diviser le panneau
      splitPane: "Diviser le panneau",
      // Focus panneau suivant
      focusNextPane: "Focus panneau suivant",
      // Focus panneau précédent
      focusPrevPane: "Focus panneau précédent",
      // Onglet suivant
      nextTab: "Onglet suivant",
      // Onglet précédent
      prevTab: "Onglet précédent",
      // Ouvrir les paramètres
      openSettings: "Ouvrir les paramètres",
      // Ouvrir le navigateur SFTP
      openSftp: "Ouvrir le navigateur SFTP",
    },
  },

  // ============================================
  // APP - App.tsx (état vide, modals, onglets)
  // ============================================
  app: {
    // Nom de l'app
    appName: "SimplyTerm",
    // Slogan dans l'état vide
    tagline: "Terminal SSH moderne, rapide et élégant",
    // Bouton nouvelle connexion
    newConnection: "Nouvelle connexion",
    // Indication raccourci clavier
    shortcutHint: "Appuyez sur {{modifier}} + N pour créer une connexion",
    // Titre onglet terminal
    terminalTab: "Terminal",
    // Préfixe titre onglet SFTP
    sftpTab: "SFTP - {{name}}",
    // Préfixe titre onglet tunnels
    tunnelsTab: "Tunnels - {{name}}",
    // Titre modal connexion : éditer connexion
    editConnection: "Modifier la connexion",
    // Titre modal connexion : SFTP
    sftpConnection: "Connexion SFTP",
    // Titre modal connexion : reconnexion SSH
    reconnectSsh: "Reconnexion SSH",
    // Titre modal connexion : nouvelle connexion SSH
    newSshConnection: "Nouvelle connexion SSH",
    // Titre modal sauvegarder session
    saveConnection: "Sauvegarder la connexion ?",
    // Titre modal mettre à jour session
    updateConnection: "Mettre à jour la connexion ?",
    // Invitation à sauvegarder la session
    saveConnectionDesc: "Voulez-vous sauvegarder cette connexion pour y accéder rapidement ?",
    // Invitation à mettre à jour la session
    updateConnectionDesc: "Voulez-vous mettre à jour cette connexion avec les nouvelles informations ?",
    // Bouton non merci
    noThanks: "Non merci",
    // Bouton mettre à jour
    update: "Mettre à jour",
    // Préfixe erreur SFTP
    sftpError: "Erreur SFTP : {{error}}",
    // Entrer le mot de passe pour SFTP
    enterPasswordSftp: "Entrez votre mot de passe pour ouvrir SFTP",
    // Entrer le mot de passe pour se connecter
    enterPasswordConnect: "Entrez votre mot de passe pour vous connecter",
    // Veuillez entrer votre mot de passe
    pleaseEnterPassword: "Veuillez entrer votre mot de passe",
  },

  // ============================================
  // HEADER - HeaderBar.tsx / PaneGroupTabBar.tsx
  // ============================================
  header: {
    // Tooltip bouton menu
    menu: "Menu",
    // Tooltip bouton tunnels
    tunnels: "Port Forwarding (Tunnels)",
    // Tooltip bouton nouvelle connexion SSH
    newSshConnection: "Nouvelle connexion SSH",
    // Tooltip dropdown connexions rapides
    quickConnections: "Connexions rapides",
    // Tooltip bouton accueil
    home: "Accueil",
    // Contrôles de fenêtre
    minimize: "Réduire",
    maximize: "Agrandir",
    restore: "Restaurer",
    close: "Fermer",
    splitVertical: "Scinder verticalement",
    splitHorizontal: "Scinder horizontalement",
    closePane: "Fermer le panneau",
  },

  // ============================================
  // TERMINAL VIEW - Terminal.tsx
  // ============================================
  terminalView: {
    // Message session terminée
    sessionEnded: "[Session terminée]",
    // Préfixe erreur
    errorPrefix: "Erreur : ",
    // Recherche: tooltip sensible à la casse
    caseSensitive: "Sensible à la casse (Aa)",
    // Recherche: tooltip regex
    regex: "Expression régulière (.*)",
    // Recherche: tooltip résultat précédent
    previousResult: "Précédent (Shift+Enter)",
    // Recherche: tooltip résultat suivant
    nextResult: "Suivant (Enter)",
  },

  // ============================================
  // SFTP - SftpBrowser.tsx
  // ============================================
  sftp: {
    // Barre d'outils
    home: "Accueil",
    goUp: "Dossier parent",
    refresh: "Actualiser",
    newFolder: "Nouveau dossier",
    newFolderPlaceholder: "Nom du dossier...",
    // En-têtes de colonnes
    colName: "Nom",
    colSize: "Taille",
    colModified: "Modifié",
    // États vides
    emptyDirectory: "Dossier vide",
    allHidden: "Tous les fichiers sont masqués",
    // Overlay glisser-déposer
    dropToUpload: "Déposer les fichiers pour envoyer",
    uploadTo: "Envoyer dans {{path}}",
    uploading: "Envoi en cours",
    // Menu contextuel
    download: "Télécharger",
    open: "Ouvrir",
    editExternally: "Éditer en externe",
    openInEditor: "Ouvrir dans l'éditeur",
    copyPath: "Copier le chemin",
    pathCopied: "Chemin copié",
    rename: "Renommer",
    watching: "suivi actif",
    // Suppression
    deleteTitle: "Supprimer {{type}}",
    deleteConfirm: "Voulez-vous vraiment supprimer \"{{name}}\" ? Cette action est irréversible.",
    // Toggle fichiers cachés
    showHidden: "Afficher les fichiers cachés",
    hideHidden: "Masquer les fichiers cachés",
    // Barre de statut
    connected: "Connecté",
    items: "{{count}} éléments",
    itemsHidden: "{{count}} éléments ({{hidden}} masqués)",
    editing: "{{count}} en édition",
    folder: "Dossier",
    // Notification de téléchargement
    downloaded: "{{name}} téléchargé",
  },
};
