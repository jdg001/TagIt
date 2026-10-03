import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';
import { HttpClient } from '@angular/common/http';
import { ApiConfigService } from './api-config.service';
import {
  CollaborationState,
  CollaborationUser,
  CanvasState,
  JoinSessionRequest,
  JoinSessionResponse,
  LeaveSessionRequest,
  UpdateCursorRequest,
  CanvasElementUpdate,
  UserPresenceUpdate,
  CursorPosition,
  TemplateSaveNotification
} from '../models/collaboration.models';

@Injectable({
  providedIn: 'root'
})
export class CollaborationService implements OnDestroy {
  private hubConnection: HubConnection | null = null;
  private baseUrl: string = '';

  // State management
  private stateSubject = new BehaviorSubject<CollaborationState>({
    isConnected: false,
    isInSession: false,
    currentSessionId: null,
    connectedUsers: [],
    currentUser: null,
    canvasState: null,
    lastError: null
  });

  // Event subjects
  private canvasUpdateSubject = new Subject<CanvasElementUpdate>();
  private userPresenceUpdateSubject = new Subject<UserPresenceUpdate>();
  private sessionJoinedSubject = new Subject<JoinSessionResponse>();
  private sessionJoinFailedSubject = new Subject<string>();
  private canvasStateReceivedSubject = new Subject<any>();
  private templateSaveNotificationSubject = new Subject<TemplateSaveNotification>();

  // Public observables
  public state$ = this.stateSubject.asObservable();
  public canvasUpdate$ = this.canvasUpdateSubject.asObservable();
  public userPresenceUpdate$ = this.userPresenceUpdateSubject.asObservable();
  public sessionJoined$ = this.sessionJoinedSubject.asObservable();
  public sessionJoinFailed$ = this.sessionJoinFailedSubject.asObservable();
  public canvasStateReceived$ = this.canvasStateReceivedSubject.asObservable();
  public templateSaveNotification$ = this.templateSaveNotificationSubject.asObservable();

  constructor(
    private http: HttpClient,
    private apiConfig: ApiConfigService
  ) {
    this.initializeBaseUrl();
  }

  private async initializeBaseUrl(): Promise<void> {
    this.baseUrl = await this.apiConfig.getApiUrl();
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  /**
   * Initialize the SignalR connection
   */
  async initializeConnection(): Promise<void> {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      return;
    }

    // Ensure baseUrl is initialized
    if (!this.baseUrl) {
      await this.initializeBaseUrl();
    }

    try {
      // Remove /api from baseUrl for SignalR connection since SignalR hub is mapped to root path
      const signalRUrl = this.baseUrl.replace('/api', '');
      console.log('[COLLABORATION] SignalR URL:', `${signalRUrl}/collaborationHub`);
      this.hubConnection = new HubConnectionBuilder()
        .withUrl(`${signalRUrl}/collaborationHub`, {
          accessTokenFactory: () => {
            // Get JWT token from localStorage using the correct key from AuthService
            const token = localStorage.getItem('tagit_auth_token') || '';
            console.log('[COLLABORATION] JWT Token found:', token ? 'Yes' : 'No', token ? `(${token.substring(0, 20)}...)` : '');
            return token;
          }
        })
        .withAutomaticReconnect()
        .build();

      this.setupHubEventHandlers();
      await this.hubConnection.start();

      this.updateState({ isConnected: true, lastError: null });
      console.log('[COLLABORATION] Connected to SignalR hub');
    } catch (error) {
      console.error('[COLLABORATION] Error connecting to SignalR hub:', error);
      this.updateState({ isConnected: false, lastError: 'Failed to connect to collaboration server' });
    }
  }

  /**
   * Setup event handlers for SignalR hub events
   */
  private setupHubEventHandlers(): void {
    if (!this.hubConnection) return;

    // Session events
    this.hubConnection.on('SessionJoined', (response: JoinSessionResponse) => {
      console.log('[COLLABORATION] Session joined:', response);
      console.log('[COLLABORATION] Session ID from response:', response.sessionId);
      this.updateState({
        isInSession: true,
        currentSessionId: response.sessionId || null,
        connectedUsers: response.connectedUsers || [],
        canvasState: response.currentCanvasState || null
      });
      this.sessionJoinedSubject.next(response);
    });

    this.hubConnection.on('SessionJoinFailed', (errorMessage: string) => {
      console.error('[COLLABORATION] Session join failed:', errorMessage);
      this.updateState({ lastError: errorMessage });
      this.sessionJoinFailedSubject.next(errorMessage);
    });

    // Canvas events
    this.hubConnection.on('CanvasUpdate', (update: CanvasElementUpdate) => {
      console.log('[COLLABORATION] Canvas update received:', update);
      this.canvasUpdateSubject.next(update);
    });

    this.hubConnection.on('CanvasStateReceived', (canvasState: CanvasState) => {
      console.log('[COLLABORATION] Canvas state received:', canvasState);
      this.updateState({ canvasState });
      this.canvasStateReceivedSubject.next(canvasState);
    });

    // User presence events
    this.hubConnection.on('UserPresenceUpdate', (update: UserPresenceUpdate) => {
      console.log('[COLLABORATION] User presence update:', update);
      this.handleUserPresenceUpdate(update);
      this.userPresenceUpdateSubject.next(update);
    });

    // Template save notification events
    this.hubConnection.on('TemplateSaveNotification', (notification: TemplateSaveNotification) => {
      console.log('[COLLABORATION] Template save notification received:', notification);
      this.templateSaveNotificationSubject.next(notification);
    });

    // Connection events
    this.hubConnection.onclose((error: any) => {
      console.log('[COLLABORATION] Connection closed:', error);
      this.updateState({ isConnected: false, isInSession: false, currentSessionId: null });
    });

    this.hubConnection.onreconnecting((error: any) => {
      console.log('[COLLABORATION] Reconnecting:', error);
      this.updateState({ isConnected: false });
    });

    this.hubConnection.onreconnected((connectionId: any) => {
      console.log('[COLLABORATION] Reconnected:', connectionId);
      this.updateState({ isConnected: true, lastError: null });
    });
  }

  /**
   * Join a collaboration session
   */
  async joinSession(templateId: number, userId: number, existingSessionId?: string): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) {
      await this.initializeConnection();
    }

    if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) {
      throw new Error('Unable to connect to collaboration server');
    }

    const request: JoinSessionRequest = {
      templateId,
      userId,
      sessionId: existingSessionId
    };

    try {
      console.log('[COLLABORATION] Attempting to join session with request:', request);
      await this.hubConnection.invoke('JoinSession', request);
      console.log('[COLLABORATION] Join session request sent successfully');
    } catch (error) {
      console.error('[COLLABORATION] Error joining session:', error);
      throw error;
    }
  }

  /**
   * Leave the current collaboration session
   */
  async leaveSession(): Promise<void> {
    const currentState = this.stateSubject.value;
    if (!this.hubConnection || !currentState.currentSessionId || !currentState.currentUser) {
      return;
    }

    const request: LeaveSessionRequest = {
      sessionId: currentState.currentSessionId,
      userId: currentState.currentUser.userId
    };

    try {
      await this.hubConnection.invoke('LeaveSession', request);
      this.updateState({
        isInSession: false,
        currentSessionId: null,
        connectedUsers: [],
        currentUser: null,
        canvasState: null
      });
    } catch (error) {
      console.error('[COLLABORATION] Error leaving session:', error);
    }
  }

  /**
   * Send a canvas update to other users
   */
  async sendCanvasUpdate(update: CanvasElementUpdate): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) {
      console.warn('[COLLABORATION] Cannot send canvas update - not connected');
      return;
    }

    try {
      await this.hubConnection.invoke('UpdateCanvas', update);
    } catch (error) {
      console.error('[COLLABORATION] Error sending canvas update:', error);
    }
  }

  /**
   * Update cursor position
   */
  async updateCursor(x: number, y: number): Promise<void> {
    const currentState = this.stateSubject.value;
    if (!this.hubConnection || !currentState.currentSessionId || !currentState.currentUser) {
      return;
    }

    const request: UpdateCursorRequest = {
      sessionId: currentState.currentSessionId,
      userId: currentState.currentUser.userId,
      x,
      y
    };

    try {
      await this.hubConnection.invoke('UpdateCursor', request);
    } catch (error) {
      console.error('[COLLABORATION] Error updating cursor:', error);
    }
  }

  /**
   * Request current canvas state
   */
  async requestCanvasState(): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) {
      return;
    }

    try {
      await this.hubConnection.invoke('RequestCanvasState');
    } catch (error) {
      console.error('[COLLABORATION] Error requesting canvas state:', error);
    }
  }

  /**
   * Disconnect from the collaboration service
   */
  async disconnect(): Promise<void> {
    if (this.hubConnection) {
      await this.leaveSession();
      await this.hubConnection.stop();
      this.hubConnection = null;
      this.updateState({
        isConnected: false,
        isInSession: false,
        currentSessionId: null,
        connectedUsers: [],
        currentUser: null,
        canvasState: null
      });
    }
  }

  /**
   * Get current collaboration state
   */
  getCurrentState(): CollaborationState {
    return this.stateSubject.value;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.hubConnection?.state === HubConnectionState.Connected;
  }

  /**
   * Check if currently in a session
   */
  isInSession(): boolean {
    return this.stateSubject.value.isInSession;
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null {
    return this.stateSubject.value.currentSessionId;
  }

  /**
   * Get connected users
   */
  getConnectedUsers(): CollaborationUser[] {
    return this.stateSubject.value.connectedUsers;
  }

  /**
   * Handle user presence updates
   */
  private handleUserPresenceUpdate(update: UserPresenceUpdate): void {
    const currentState = this.stateSubject.value;
    let updatedUsers = [...currentState.connectedUsers];

    switch (update.action) {
      case 'joined':
        // Check if user already exists (prevent duplicates)
        const existingUserIndex = updatedUsers.findIndex(u => u.userId === update.userId);
        if (existingUserIndex === -1) {
          const newUser: CollaborationUser = {
            connectionId: '', // Will be set by the server
            userId: update.userId,
            userName: update.userName,
            userEmail: update.userEmail,
            color: update.color,
            currentTemplateId: 0, // Will be set by the server
            currentTemplateName: '', // Will be set by the server
            joinedAt: update.timestamp,
            lastSeen: update.timestamp,
            isActive: true,
            cursorPosition: update.cursorPosition
          };
          updatedUsers.push(newUser);
          console.log('[COLLABORATION] User added to presence list:', update.userName, 'User ID:', update.userId);
        } else {
          console.log('[COLLABORATION] User already in presence list, skipping duplicate:', update.userName);
        }
        break;

      case 'left':
        updatedUsers = updatedUsers.filter(user => user.userId !== update.userId);
        break;

      case 'cursor_moved':
        const userIndex = updatedUsers.findIndex(user => user.userId === update.userId);
        if (userIndex !== -1) {
          updatedUsers[userIndex] = {
            ...updatedUsers[userIndex],
            cursorPosition: update.cursorPosition,
            lastSeen: update.timestamp
          };
        }
        break;
    }

    this.updateState({ connectedUsers: updatedUsers });
  }

  /**
   * Notify other users about template save
   */
  async notifyTemplateSave(templateId: number, templateName: string, action: string = 'saved'): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) {
      console.warn('[COLLABORATION] Cannot notify template save - not connected to hub');
      return;
    }

    try {
      console.log('[COLLABORATION] Notifying template save:', { templateId, templateName, action });
      await this.hubConnection.invoke('NotifyTemplateSave', templateId, templateName, action);
    } catch (error) {
      console.error('[COLLABORATION] Failed to notify template save:', error);
    }
  }

  /**
   * Update the collaboration state
   */
  private updateState(partialState: Partial<CollaborationState>): void {
    const currentState = this.stateSubject.value;
    this.stateSubject.next({ ...currentState, ...partialState });
  }
}
