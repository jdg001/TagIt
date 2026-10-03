// Collaboration Models for Frontend

export interface CollaborationUser {
  connectionId: string;
  userId: number;
  userName: string;
  userEmail: string;
  color: string;
  currentTemplateId: number; // Template user is currently working on
  currentTemplateName: string;
  joinedAt: Date;
  lastSeen: Date;
  isActive: boolean;
  cursorPosition?: CursorPosition;
}

export interface CursorPosition {
  x: number;
  y: number;
  timestamp: Date;
}

export interface CollaborationSession {
  sessionId: string;
  templateId: number; // Primary template (first user's template)
  templateName: string;
  connectedUsers: CollaborationUser[];
  activeTemplates: SessionTemplate[]; // All templates being worked on
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
}

export interface SessionTemplate {
  templateId: number;
  templateName: string;
  activeUserIds: number[]; // Users currently working on this template
  lastActivity: Date;
}

export interface CanvasUpdate {
  sessionId: string;
  userId: string;
  updateType: string; // "element_add", "element_update", "element_delete", "element_move"
  elementId: string;
  elementData?: any;
  timestamp: Date;
  operationId: string;
}

export interface CanvasState {
  sessionId: string;
  elements: any[];
  lastUpdated: Date;
  version: number;
}

export interface JoinSessionRequest {
  templateId: number;
  userId: number;
  sessionId?: string;
}

export interface JoinSessionResponse {
  success: boolean;
  sessionId?: string;
  errorMessage?: string;
  connectedUsers?: CollaborationUser[];
  currentCanvasState?: CanvasState;
}

export interface LeaveSessionRequest {
  sessionId: string;
  userId: number;
}

export interface UpdateCursorRequest {
  sessionId: string;
  userId: number;
  x: number;
  y: number;
}

export interface CanvasElementUpdate {
  elementId: string;
  updateType: string;
  elementData?: any;
  operationId: string;
  timestamp: Date;
}

export interface UserPresenceUpdate {
  userId: number;
  userName: string;
  userEmail: string;
  color: string;
  action: string; // "joined", "left", "cursor_moved"
  cursorPosition?: CursorPosition;
  timestamp: Date;
}

export interface TemplateSaveNotification {
  userId: number;
  userName: string;
  templateId: number;
  templateName: string;
  action: string; // "saved", "saved_as_new"
  timestamp: Date;
}

export interface CollaborationState {
  isConnected: boolean;
  isInSession: boolean;
  currentSessionId: string | null;
  connectedUsers: CollaborationUser[];
  currentUser: CollaborationUser | null;
  canvasState: CanvasState | null;
  lastError: string | null;
}
