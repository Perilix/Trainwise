import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { AuthService } from './auth.service';
import { SocketService } from './socket.service';
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
export class ChatService {
  private readonly API_URL = `${environment.apiUrl}/api/chat`;

  // Signals
  conversations = signal<Conversation[]>([]);
  currentConversation = signal<Conversation | null>(null);
  messages = signal<Message[]>([]);
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
    private authService: AuthService,
    private socketService: SocketService
  ) {
    if (this.authService.isAuthenticated()) {
      this.setupSocketListeners();
      // Charger les conversations et le nombre de non lus au démarrage
      this.getConversations().subscribe();
      this.getUnreadCount().subscribe();
    }
  }

  private setupSocketListeners(): void {
    // Message events
    this.socketService.on<{ message: Message; conversationId: string }>('message:new').subscribe(data => {
      this.handleNewMessage(data.message, data.conversationId);
    });

    this.socketService.on<{ conversation: Conversation }>('conversation:updated').subscribe(data => {
      this.updateConversationInList(data.conversation);
    });

    // Typing events
    this.socketService.on<TypingEvent>('typing:start').subscribe(data => {
      const typingMap = new Map(this.typingUsers());
      typingMap.set(`${data.conversationId}-${data.userId}`, data);
      this.typingUsers.set(typingMap);
    });

    this.socketService.on<{ conversationId: string; userId: string }>('typing:stop').subscribe(data => {
      const typingMap = new Map(this.typingUsers());
      typingMap.delete(`${data.conversationId}-${data.userId}`);
      this.typingUsers.set(typingMap);
    });

    // Read events
    this.socketService.on<{ conversationId: string; userId: string }>('message:read').subscribe(data => {
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

    // New conversation created - auto-join the room
    this.socketService.on<{ conversationId: string }>('conversation:new').subscribe(data => {
      this.joinConversation(data.conversationId);
      this.getConversations().subscribe();
    });
  }

  // Pour la compatibilité avec les anciens composants
  disconnect(): void {
    // Géré par SocketService maintenant
  }

  connect(): void {
    this.socketService.connect();
  }

  isConnected(): boolean {
    return this.socketService.isConnected();
  }

  // Join/Leave conversation room
  joinConversation(conversationId: string): void {
    this.socketService.emit('conversation:join', { conversationId });
  }

  leaveConversation(conversationId: string): void {
    this.socketService.emit('conversation:leave', { conversationId });
  }

  // Send message via socket
  sendMessage(conversationId: string, content: string, type: 'text' | 'image' | 'document' = 'text', attachment?: Attachment): void {
    this.socketService.emit('message:send', {
      conversationId,
      content,
      type,
      attachment
    });
  }

  // Typing indicators
  startTyping(conversationId: string): void {
    this.socketService.emit('typing:start', { conversationId });
  }

  stopTyping(conversationId: string): void {
    this.socketService.emit('typing:stop', { conversationId });
  }

  // Mark messages as read via socket
  markAsReadSocket(conversationId: string): void {
    this.socketService.emit('message:read', { conversationId });
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
    } else {
      // Conversation pas encore dans la liste, la récupérer
      this.getConversations().subscribe();
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
