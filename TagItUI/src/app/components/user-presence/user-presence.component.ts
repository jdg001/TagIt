import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CollaborationUser } from '../../models/collaboration.models';
import { CollaborationService } from '../../services/collaboration.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-user-presence',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="user-presence-container">
      <div class="presence-header">
        <span class="presence-title">Collaborating</span>
        <span class="user-count" *ngIf="connectedUsers.length > 0">{{ connectedUsers.length }} user{{ connectedUsers.length > 1 ? 's' : '' }}</span>
        <span class="user-count" *ngIf="connectedUsers.length === 0">Waiting for users...</span>
      </div>
      
      <div class="users-list" *ngIf="connectedUsers.length > 0">
        <div 
          *ngFor="let user of connectedUsers" 
          class="user-item"
          [style.border-left-color]="user.color">
          <div class="user-avatar" [style.background-color]="user.color">
            {{ getUserInitials(user.userName) }}
          </div>
          <div class="user-info">
            <div class="user-name">{{ user.userName }}</div>
            <div class="user-template">{{ user.currentTemplateName }}</div>
            <div class="user-status" [class.active]="user.isActive">
              {{ user.isActive ? 'Active' : 'Away' }}
            </div>
          </div>
          <div class="user-cursor" *ngIf="user.cursorPosition" 
               [style.left.px]="user.cursorPosition.x" 
               [style.top.px]="user.cursorPosition.y"
               [style.border-color]="user.color">
            <div class="cursor-pointer" [style.background-color]="user.color"></div>
          </div>
        </div>
      </div>
      
      <div class="session-info" *ngIf="sessionId">
        <div class="session-id-label">Session ID:</div>
        <div class="session-id-value" (click)="copySessionId()" title="Click to copy">
          {{ sessionId }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .user-presence-container {
      position: fixed;
      top: 80px;
      right: 20px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      z-index: 1000;
      min-width: 200px;
      max-width: 300px;
    }

    .presence-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border-color);
    }

    .presence-title {
      font-weight: 600;
      color: var(--text-primary);
      font-size: 14px;
    }

    .user-count {
      background: var(--primary-color);
      color: white;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .users-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .user-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px;
      border-radius: 8px;
      border-left: 3px solid transparent;
      transition: all 0.2s ease;
      position: relative;
    }

    .user-item:hover {
      background: var(--bg-secondary);
    }

    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 12px;
      flex-shrink: 0;
    }

    .user-info {
      flex: 1;
      min-width: 0;
    }

    .user-name {
      font-weight: 500;
      color: var(--text-primary);
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-template {
      font-size: 11px;
      color: var(--primary-color);
      font-weight: 500;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-status {
      font-size: 11px;
      color: var(--text-secondary);
      margin-top: 2px;
    }

    .user-status.active {
      color: #10b981;
    }

    .user-cursor {
      position: absolute;
      pointer-events: none;
      z-index: 1001;
    }

    .cursor-pointer {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
    }

    .waiting-message {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px;
      text-align: center;
    }

    .waiting-icon {
      font-size: 24px;
      margin-bottom: 8px;
      opacity: 0.6;
    }

    .waiting-text {
      font-size: 12px;
      color: var(--text-secondary);
      line-height: 1.4;
      margin-bottom: 12px;
    }

    .share-button {
      background: var(--primary-color);
      color: white;
      border: none;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
    }

    .share-button:hover:not(:disabled) {
      background: var(--primary-color-dark, #2563eb);
      transform: translateY(-1px);
    }

    .share-button:disabled {
      background: var(--text-secondary);
      cursor: not-allowed;
      opacity: 0.6;
    }

    .share-icon {
      font-size: 12px;
    }

    .session-info {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--border-color);
    }

    .session-id-label {
      font-size: 10px;
      color: var(--text-secondary);
      margin-bottom: 4px;
      font-weight: 500;
    }

    .session-id-value {
      font-size: 11px;
      font-family: monospace;
      background: var(--bg-secondary);
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid var(--border-color);
    }

    .session-id-value:hover {
      background: var(--bg-tertiary);
      border-color: var(--primary-color);
    }

    .join-session-section {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--border-color);
    }

    .join-session-label {
      font-size: 11px;
      color: var(--text-secondary);
      margin-bottom: 8px;
      font-weight: 500;
    }

    .join-session-input-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .join-session-input {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      font-size: 11px;
      background: var(--bg-secondary);
      color: var(--text-primary);
      transition: all 0.2s ease;
    }

    .join-session-input:focus {
      outline: none;
      border-color: var(--primary-color);
      background: var(--bg-primary);
    }

    .join-session-input::placeholder {
      color: var(--text-secondary);
    }

    .join-session-button {
      background: var(--secondary-color, #6b7280);
      color: white;
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .join-session-button:hover:not(:disabled) {
      background: var(--secondary-color-dark, #4b5563);
      transform: translateY(-1px);
    }

    .join-session-button:disabled {
      background: var(--text-secondary);
      cursor: not-allowed;
      opacity: 0.6;
    }

    /* Dark theme adjustments */
    :host-context(.dark-theme) .user-presence-container {
      background: #1f2937;
      border-color: #374151;
    }

    :host-context(.dark-theme) .presence-title {
      color: #f9fafb;
    }

    :host-context(.dark-theme) .user-name {
      color: #f9fafb;
    }

    :host-context(.dark-theme) .user-template {
      color: #60a5fa;
    }

    :host-context(.dark-theme) .user-status {
      color: #9ca3af;
    }

    :host-context(.dark-theme) .user-item:hover {
      background: #374151;
    }

    :host-context(.dark-theme) .waiting-text {
      color: #9ca3af;
    }

    :host-context(.dark-theme) .session-id-value {
      background: #374151;
      border-color: #4b5563;
    }

    :host-context(.dark-theme) .session-id-value:hover {
      background: #4b5563;
      border-color: #3b82f6;
    }

    :host-context(.dark-theme) .join-session-section {
      border-top-color: #374151;
    }

    :host-context(.dark-theme) .join-session-label {
      color: #9ca3af;
    }

    :host-context(.dark-theme) .join-session-input {
      background: #374151;
      border-color: #4b5563;
      color: #f9fafb;
    }

    :host-context(.dark-theme) .join-session-input:focus {
      background: #1f2937;
      border-color: #3b82f6;
    }

    :host-context(.dark-theme) .join-session-input::placeholder {
      color: #9ca3af;
    }
  `]
})
export class UserPresenceComponent implements OnInit, OnDestroy {
  @Input() connectedUsers: CollaborationUser[] = [];
  
  sessionId: string | null = null;
  sessionLinkInput: string = '';
  private destroy$ = new Subject<void>();

  constructor(private collaborationService: CollaborationService) {}

  ngOnInit(): void {
    // Subscribe to collaboration state changes
    this.collaborationService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        console.log('[USER-PRESENCE] State updated:', state);
        this.connectedUsers = state.connectedUsers;
        this.sessionId = state.currentSessionId;
        console.log('[USER-PRESENCE] Connected users count:', this.connectedUsers.length);
        console.log('[USER-PRESENCE] Session ID:', this.sessionId);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getUserInitials(userName: string): string {
    return userName
      .split(' ')
      .map(name => name.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  async shareSession(): Promise<void> {
    if (!this.sessionId) {
      console.warn('[COLLABORATION] No session ID available for sharing');
      return;
    }

    // Create a shareable URL with the session ID
    const currentUrl = window.location.href;
    const shareUrl = `${currentUrl}?collaboration=true&sessionId=${this.sessionId}`;

    try {
      // Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      
      // Show success feedback (you could add a toast notification here)
      console.log('[COLLABORATION] Session link copied to clipboard:', shareUrl);
      
      // Optional: Show a temporary success message
      this.showTemporaryMessage('Session link copied to clipboard!');
      
    } catch (error) {
      console.error('[COLLABORATION] Failed to copy session link:', error);
      // Fallback: show the URL in an alert
      alert(`Share this URL with others:\n${shareUrl}`);
    }
  }

  async copySessionId(): Promise<void> {
    if (!this.sessionId) return;

    try {
      await navigator.clipboard.writeText(this.sessionId);
      this.showTemporaryMessage('Session ID copied!');
    } catch (error) {
      console.error('[COLLABORATION] Failed to copy session ID:', error);
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = this.sessionId;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      this.showTemporaryMessage('Session ID copied!');
    }
  }

  onSessionLinkPaste(event: ClipboardEvent): void {
    // Auto-extract session ID from pasted URL
    const pastedText = event.clipboardData?.getData('text') || '';
    const sessionId = this.extractSessionIdFromUrl(pastedText);
    if (sessionId) {
      this.sessionLinkInput = sessionId;
      // Auto-join session after a short delay
      setTimeout(() => {
        this.joinExistingSession();
      }, 500);
    }
  }

  async joinExistingSession(): Promise<void> {
    if (!this.sessionLinkInput.trim()) {
      this.showTemporaryMessage('Please enter a session link or ID');
      return;
    }

    try {
      // Extract session ID from the input (could be a full URL or just the session ID)
      const sessionId = this.extractSessionIdFromUrl(this.sessionLinkInput) || this.sessionLinkInput.trim();
      
      console.log('[COLLABORATION] Attempting to join existing session:', sessionId);
      
      // Get current template ID (or use default)
      const currentTemplateId = 1; // TODO: Get from current template
      const userId = 1; // TODO: Get from auth service
      
      // Join the existing session
      await this.collaborationService.joinSession(currentTemplateId, userId, sessionId);
      
      this.showTemporaryMessage('Successfully joined session!');
      this.sessionLinkInput = ''; // Clear the input
      
    } catch (error) {
      console.error('[COLLABORATION] Failed to join session:', error);
      this.showTemporaryMessage('Failed to join session. Please check the session link.');
    }
  }

  private extractSessionIdFromUrl(url: string): string | null {
    try {
      // If it's a full URL, extract the sessionId parameter
      if (url.includes('sessionId=')) {
        const urlObj = new URL(url);
        return urlObj.searchParams.get('sessionId');
      }
      
      // If it's just a session ID (GUID format), return as is
      if (url.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)) {
        return url.trim();
      }
      
      return null;
    } catch (error) {
      console.error('[COLLABORATION] Error extracting session ID from URL:', error);
      return null;
    }
  }

  private showTemporaryMessage(message: string): void {
    // Simple temporary message - you could replace this with a proper toast service
    const messageEl = document.createElement('div');
    messageEl.textContent = message;
    messageEl.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      z-index: 10000;
      animation: fadeInOut 2s ease-in-out;
    `;
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translateY(-10px); }
        20% { opacity: 1; transform: translateY(0); }
        80% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-10px); }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
      document.body.removeChild(messageEl);
      document.head.removeChild(style);
    }, 2000);
  }
}
