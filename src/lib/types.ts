export interface Folder {
  id: string;
  name: string;
  icon: string; // Emoji ou icône pour le dossier
  color: string; // Couleur du dossier (code hexadécimal)
  isExpanded?: boolean; // État d'expansion du dossier dans l'UI
  parentId?: string; // ID du dossier parent, undefined si à la racine
}

export interface TOTPEntry {
  id: string;
  name: string;
  secret: string;
  icon: string; // Peut être un nom d'icône ou une image base64
  isCustomIcon?: boolean; // Flag pour indiquer si l'icône est une image base64
  period?: number;
  digits?: number;
  folderId?: string; // ID du dossier parent, null/undefined si à la racine
}

export interface VaultData {
  entries: TOTPEntry[];
  folders: Folder[];
}

export interface User {
  id: number;
  loginId: string;
  name: string;
  logo?: string;
}

export interface ExportedVault {
  data: string;
  timestamp: string;
  format: string;
}
