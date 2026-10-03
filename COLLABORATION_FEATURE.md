# Collaborative Mode Feature

## Overview

The collaborative mode feature allows multiple users to work on the same canvas simultaneously, similar to Microsoft Office's collaborative editing. Users can see each other's changes in real-time and view who is currently editing.

## Features Implemented

### 1. Backend (ASP.NET Core)
- **SignalR Hub**: Real-time communication using `CollaborationHub`
- **Collaboration Service**: Manages shared sessions and user presence
- **Session Management**: Handles joining/leaving sessions
- **Canvas State Synchronization**: Broadcasts canvas updates to all connected users
- **User Presence Tracking**: Tracks who is currently editing and their cursor position

### 2. Frontend (Angular)
- **Collaboration Service**: Manages SignalR connection and collaboration state
- **Collaboration Toggle**: Button in the header to enable/disable collaboration mode
- **User Presence Component**: Shows who is currently editing with avatars and status
- **Canvas Synchronization**: Real-time updates when other users make changes
- **Conflict Resolution**: Basic conflict resolution using operation IDs

## How to Use

### 1. Enable Collaboration Mode
1. Open the designer page with a template
2. Click the collaboration toggle button in the header (users icon)
3. The button will turn green when collaboration is active
4. A user presence panel will appear on the right side

### 2. Collaborate with Others
1. Share the template ID or session ID with other users
2. Other users can join the same session by enabling collaboration mode
3. All users will see each other's changes in real-time
4. User avatars and status will be displayed in the presence panel

### 3. Real-time Features
- **Canvas Updates**: Changes to elements are synchronized across all users
- **User Presence**: See who is currently editing
- **Cursor Tracking**: View other users' cursor positions (when implemented)
- **Session Management**: Automatic cleanup of inactive sessions

## Technical Implementation

### Backend Components

#### CollaborationHub.cs
- SignalR hub for real-time communication
- Handles joining/leaving sessions
- Broadcasts canvas updates and user presence changes
- Manages connection lifecycle

#### CollaborationService.cs
- In-memory session management
- User presence tracking
- Canvas state synchronization
- Session cleanup and maintenance

#### CollaborationController.cs
- REST API endpoints for session management
- HTTP-based session operations

### Frontend Components

#### CollaborationService
- SignalR client connection management
- State management using RxJS observables
- Event handling for real-time updates

#### UserPresenceComponent
- Displays connected users with avatars
- Shows user status (active/away)
- Real-time updates when users join/leave

#### DesignerComponent Integration
- Collaboration mode toggle handling
- Canvas synchronization
- Remote update processing

## Configuration

### Backend Configuration
1. Add SignalR package: `Microsoft.AspNetCore.SignalR`
2. Register services in `Program.cs`:
   ```csharp
   builder.Services.AddSignalR();
   builder.Services.AddScoped<ICollaborationService, CollaborationService>();
   ```
3. Map SignalR hub:
   ```csharp
   app.MapHub<CollaborationHub>("/collaborationHub");
   ```

### Frontend Configuration
1. Add SignalR package: `@microsoft/signalr`
2. Import collaboration service in components
3. Configure API URL in `ApiConfigService`

## Security Considerations

- JWT authentication required for SignalR connections
- User authorization for template access
- Session isolation by template ID
- Automatic session cleanup for inactive users

## Future Enhancements

1. **Advanced Conflict Resolution**: Implement operational transforms for better conflict handling
2. **Cursor Tracking**: Show other users' cursor positions in real-time
3. **Element Locking**: Prevent simultaneous editing of the same element
4. **Chat Integration**: Add real-time chat within collaboration sessions
5. **Version History**: Track changes and allow rollback
6. **Offline Support**: Handle network disconnections gracefully
7. **Performance Optimization**: Implement delta updates instead of full state sync

## Testing

To test the collaboration feature:

1. Start the backend API
2. Start the Angular frontend
3. Open two browser windows/tabs
4. Navigate to the designer page in both windows
5. Enable collaboration mode in both windows
6. Make changes in one window and observe real-time updates in the other
7. Check the user presence panel to see connected users

## Troubleshooting

### Common Issues

1. **Connection Failed**: Check if SignalR hub is properly configured and running
2. **Authentication Error**: Ensure JWT token is valid and properly configured
3. **Updates Not Syncing**: Check browser console for SignalR connection errors
4. **User Presence Not Showing**: Verify collaboration service is properly initialized

### Debug Information

Enable console logging to see collaboration events:
- `[COLLABORATION]` - General collaboration service events
- `[DESIGNER]` - Designer component collaboration events
- SignalR connection events are automatically logged

## API Endpoints

### Collaboration Controller
- `POST /api/collaboration/join-session` - Join a collaboration session
- `POST /api/collaboration/leave-session` - Leave a collaboration session
- `GET /api/collaboration/session/{sessionId}/users` - Get session users
- `GET /api/collaboration/session/{sessionId}` - Get session details
- `GET /api/collaboration/session/{sessionId}/canvas-state` - Get canvas state

### SignalR Hub Methods
- `JoinSession` - Join a collaboration session
- `LeaveSession` - Leave a collaboration session
- `UpdateCanvas` - Send canvas updates
- `UpdateCursor` - Update cursor position
- `RequestCanvasState` - Request current canvas state

### SignalR Hub Events
- `SessionJoined` - Successfully joined a session
- `SessionJoinFailed` - Failed to join a session
- `CanvasUpdate` - Canvas update from another user
- `UserPresenceUpdate` - User joined/left/moved cursor
- `CanvasStateReceived` - Canvas state received from server
