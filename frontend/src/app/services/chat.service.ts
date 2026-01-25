import { Injectable, signal, computed, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface UserPreview {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture?: string;
  isOnline?: boolean;
}

export interface LastMessage {
  content: string;
  sender?: UserPreview;
  sentAt: Date | null;
  type: 'text' | 'image' | 'document';
}

export interface Conversation {
  _id: string;
  participants: UserPreview[];
  type: 'direct' | 'group';
  name?: string;
  lastMessage: LastMessage;
  unreadCount: number;
  otherParticipant?: UserPreview;
  createdAt: Date;
  updatedAt: Date;
}

export interface Attachment {
  url: string;
  publicId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface Message {
  _id: string;
  conversation: string;
  sender: UserPreview;
  content: string;
  type: 'text' | 'image' | 'document';
  attachment?: Attachment;
  readBy: Record<string, Date>;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessagesResponse {
  messages: Message[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface TypingEvent {
  conversationId: string;
  userId: string;
  userName: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService implements OnDestroy {
  private readonly API_URL = `${environment.apiUrl}/api/chat`;
  private readonly SOCKET_URL = environment.socketUrl;

  private socket: Socket | null = null;

  // Signals
  conversations = signal<Conversation[]>([]);
  currentConversation = signal<Conversation | null>(null);
  messages = signal<Message[]>([]);
  isConnected = signal(false);
  typingUsers = signal<Map<string, TypingEvent>>(new Map());
  totalUnread = signal(0);

  // Computed
  sortedConversations = computed(() => {
    return [...this.conversations()].sort((a, b) => {
      const dateA = a.lastMessage?.sentAt ? new Date(a.lastMessage.sentAt).getTime() : 0;
      const dateB = b.lastMessage?.sentAt ? new Date(b.lastMessage.sentAt).getTime() : 0;
      return dateB - dateA;
    });
  });

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    // Connect when user is authenticated
    if (this.authService.isAuthenticated()) {
      this.connect();
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  // Socket.io Connection
  connect(): void {
    const token = this.authService.getToken();
    if (!token || this.socket?.connected) return;

    this.socket = io(this.SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.isConnected.set(true);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this.isConnected.set(false);
    });

    this.socket.on('error', (error: { message: string }) => {
      console.error('Socket error:', error.message);
    });

    // Message events
    this.socket.on('message:new', (data: { message: Message; conversationId: string }) => {
      this.handleNewMessage(data.message, data.conversationId);
    });

    this.socket.on('conversation:updated', (data: { conversation: Conversation }) => {
      this.updateConversationInList(data.conversation);
    });

    // Typing events
    this.socket.on('typing:start', (data: TypingEvent) => {
      const typingMap = new Map(this.typingUsers());
      typingMap.set(`${data.conversationId}-${data.userId}`, data);
      this.typingUsers.set(typingMap);
    });

    this.socket.on('typing:stop', (data: { conversationId: string; userId: string }) => {
      const typingMap = new Map(this.typingUsers());
      typingMap.delete(`${data.conversationId}-${data.userId}`);
      this.typingUsers.set(typingMap);
    });

    // Read events
    this.socket.on('message:read', (data: { conversationId: string; userId: string }) => {
      // Update messages readBy if needed
      if (this.currentConversation()?._id === data.conversationId) {
        const updatedMessages = this.messages().map(msg => {
          if (!msg.readBy[data.userId]) {
            return { ...msg, readBy: { ...msg.readBy, [data.userId]: new Date() } };
          }
          return msg;
        });
        this.messages.set(updatedMessages);
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected.set(false);
    }
  }

  // Join/Leave conversation room
  joinConversation(conversationId: string): void {
    this.socket?.emit('conversation:join', { conversationId });
  }

  leaveConversation(conversationId: string): void {
    this.socket?.emit('conversation:leave', { conversationId });
  }

  // Send message via socket
  sendMessage(conversationId: string, content: string, type: 'text' | 'image' | 'document' = 'text', attachment?: Attachment): void {
    this.socket?.emit('message:send', {
      conversationId,
      content,
      type,
      attachment
    });
  }

  // Typing indicators
  startTyping(conversationId: string): void {
    this.socket?.emit('typing:start', { conversationId });
  }

  stopTyping(conversationId: string): void {
    this.socket?.emit('typing:stop', { conversationId });
  }

  // Mark messages as read via socket
  markAsReadSocket(conversationId: string): void {
    this.socket?.emit('message:read', { conversationId });
  }

  // Handle new message
  private handleNewMessage(message: Message, conversationId: string): void {
    // Add to messages if in current conversation
    if (this.currentConversation()?._id === conversationId) {
      const currentMessages = this.messages();
      if (!currentMessages.find(m => m._id === message._id)) {
        this.messages.set([...currentMessages, message]);
      }
    }

    // Update conversation in list
    const currentUser = this.authService.getUser();
    const convs = this.conversations();
    const convIndex = convs.findIndex(c => c._id === conversationId);

    if (convIndex > -1) {
      const conv = { ...convs[convIndex] };
      conv.lastMessage = {
        content: message.content,
        sender: message.sender,
        sentAt: message.createdAt,
        type: message.type
      };

      // Increment unread if not from current user and not in active conversation
      if (message.sender._id !== currentUser?.id &&
          this.currentConversation()?._id !== conversationId) {
        conv.unreadCount = (conv.unreadCount || 0) + 1;
        this.totalUnread.update(count => count + 1);
      }

      const newConvs = [...convs];
      newConvs[convIndex] = conv;
      this.conversations.set(newConvs);
    }
  }

  private updateConversationInList(conversation: Conversation): void {
    const convs = this.conversations();
    const convIndex = convs.findIndex(c => c._id === conversation._id);

    if (convIndex > -1) {
      const newConvs = [...convs];
      newConvs[convIndex] = {
        ...newConvs[convIndex],
        lastMessage: conversation.lastMessage,
        updatedAt: conversation.updatedAt
      };
      this.conversations.set(newConvs);
    }
  }

  // HTTP Methods
  getConversations(): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(`${this.API_URL}/conversations`)
      .pipe(tap(convs => {
        this.conversations.set(convs);
        this.calculateTotalUnread(convs);
      }));
  }

  getOrCreateConversation(userId: string): Observable<Conversation> {
    return this.http.post<Conversation>(`${this.API_URL}/conversations/with/${userId}`, {})
      .pipe(tap(conv => {
        this.currentConversation.set(conv);
        // Add to list if not exists
        const convs = this.conversations();
        if (!convs.find(c => c._id === conv._id)) {
          this.conversations.set([conv, ...convs]);
        }
      }));
  }

  getMessages(conversationId: string, page = 1, limit = 50): Observable<MessagesResponse> {
    return this.http.get<MessagesResponse>(
      `${this.API_URL}/conversations/${conversationId}/messages`,
      { params: { page: page.toString(), limit: limit.toString() } }
    ).pipe(tap(response => {
      if (page === 1) {
        this.messages.set(response.messages);
      } else {
        this.messages.set([...response.messages, ...this.messages()]);
      }
    }));
  }

  markAsRead(conversationId: string): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(
      `${this.API_URL}/conversations/${conversationId}/read`,
      {}
    ).pipe(tap(() => {
      // Update local state
      const convs = this.conversations();
      const convIndex = convs.findIndex(c => c._id === conversationId);
      if (convIndex > -1 && convs[convIndex].unreadCount > 0) {
        const unreadToRemove = convs[convIndex].unreadCount;
        const newConvs = [...convs];
        newConvs[convIndex] = { ...newConvs[convIndex], unreadCount: 0 };
        this.conversations.set(newConvs);
        this.totalUnread.update(count => Math.max(0, count - unreadToRemove));
      }
    }));
  }

  searchUsers(query: string): Observable<UserPreview[]> {
    return this.http.get<UserPreview[]>(`${this.API_URL}/users/search`, {
      params: { q: query }
    });
  }

  uploadFile(file: File): Observable<Attachment & { type: 'image' | 'document' }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<Attachment & { type: 'image' | 'document' }>(`${this.API_URL}/upload`, formData);
  }

  getUnreadCount(): Observable<{ unreadCount: number }> {
    return this.http.get<{ unreadCount: number }>(`${this.API_URL}/unread`)
      .pipe(tap(response => this.totalUnread.set(response.unreadCount)));
  }

  private calculateTotalUnread(conversations: Conversation[]): void {
    const total = conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);
    this.totalUnread.set(total);
  }

  // Utility methods
  getTypingUsersForConversation(conversationId: string): TypingEvent[] {
    const currentUser = this.authService.getUser();
    const typingArray: TypingEvent[] = [];
    this.typingUsers().forEach((event, key) => {
      if (key.startsWith(conversationId) && event.userId !== currentUser?.id) {
        typingArray.push(event);
      }
    });
    return typingArray;
  }

  clearCurrentConversation(): void {
    const currentConv = this.currentConversation();
    if (currentConv) {
      this.leaveConversation(currentConv._id);
    }
    this.currentConversation.set(null);
    this.messages.set([]);
  }

  setCurrentConversation(conversation: Conversation): void {
    const previousConv = this.currentConversation();
    if (previousConv) {
      this.leaveConversation(previousConv._id);
    }
    this.currentConversation.set(conversation);
    this.joinConversation(conversation._id);
  }
}
