import { Component, OnInit, OnDestroy, signal, computed, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ChatService, Conversation, Message, Attachment, TypingEvent } from '../../../services/chat.service';
import { AuthService } from '../../../services/auth.service';
import { NavbarComponent } from '../../../components/navbar/navbar.component';
import { Subject, debounceTime, takeUntil } from 'rxjs';

@Component({
  selector: 'app-conversation-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './conversation-detail.component.html',
  styleUrl: './conversation-detail.component.scss'
})
export class ConversationDetailComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  // State
  isLoading = signal(true);
  messageText = signal('');
  isSending = signal(false);
  isUploading = signal(false);
  pendingAttachment = signal<(Attachment & { type: 'image' | 'document' }) | null>(null);

  // Typing
  private typingSubject = new Subject<void>();
  private typingTimeout: any;
  private destroy$ = new Subject<void>();
  private shouldScrollToBottom = true;

  // Computed
  typingUsers = computed(() => {
    const conv = this.chatService.currentConversation();
    if (!conv) return [];
    return this.chatService.getTypingUsersForConversation(conv._id);
  });

  constructor(
    public chatService: ChatService,
    public authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    // Typing debounce
    this.typingSubject.pipe(
      debounceTime(300),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.emitTyping();
    });
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      const conversationId = params['id'];
      if (conversationId) {
        this.loadConversation(conversationId);
      }
    });

    // Ensure socket is connected
    if (!this.chatService.isConnected()) {
      this.chatService.connect();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.chatService.clearCurrentConversation();
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
    }
  }

  loadConversation(conversationId: string) {
    this.isLoading.set(true);

    // First, get conversations list to find the conversation
    this.chatService.getConversations().subscribe({
      next: (conversations) => {
        const conversation = conversations.find(c => c._id === conversationId);
        if (conversation) {
          this.chatService.setCurrentConversation(conversation);
          this.loadMessages(conversationId);
        } else {
          // Conversation not found, go back to list
          this.router.navigate(['/chat']);
        }
      },
      error: (err) => {
        console.error('Error loading conversation:', err);
        this.isLoading.set(false);
      }
    });
  }

  loadMessages(conversationId: string) {
    this.chatService.getMessages(conversationId).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.shouldScrollToBottom = true;

        // Mark as read
        this.chatService.markAsRead(conversationId).subscribe();
        this.chatService.markAsReadSocket(conversationId);
      },
      error: (err) => {
        console.error('Error loading messages:', err);
        this.isLoading.set(false);
      }
    });
  }

  sendMessage() {
    const content = this.messageText().trim();
    const attachment = this.pendingAttachment();
    const conversation = this.chatService.currentConversation();

    if ((!content && !attachment) || !conversation) return;

    this.isSending.set(true);
    this.shouldScrollToBottom = true;

    if (attachment) {
      this.chatService.sendMessage(
        conversation._id,
        content || attachment.filename,
        attachment.type,
        attachment
      );
    } else {
      this.chatService.sendMessage(conversation._id, content, 'text');
    }

    // Clear input
    this.messageText.set('');
    this.pendingAttachment.set(null);
    this.isSending.set(false);

    // Stop typing
    this.stopTyping();
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  onInput() {
    this.typingSubject.next();
  }

  private emitTyping() {
    const conversation = this.chatService.currentConversation();
    if (!conversation) return;

    this.chatService.startTyping(conversation._id);

    // Auto stop typing after 3 seconds
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    this.typingTimeout = setTimeout(() => {
      this.stopTyping();
    }, 3000);
  }

  private stopTyping() {
    const conversation = this.chatService.currentConversation();
    if (conversation) {
      this.chatService.stopTyping(conversation._id);
    }
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
  }

  triggerFileUpload() {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Check file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert('Fichier trop volumineux (max 10 Mo)');
      return;
    }

    this.isUploading.set(true);

    this.chatService.uploadFile(file).subscribe({
      next: (attachment) => {
        this.pendingAttachment.set(attachment);
        this.isUploading.set(false);
      },
      error: (err) => {
        console.error('Error uploading file:', err);
        alert('Erreur lors du telechargement du fichier');
        this.isUploading.set(false);
      }
    });

    // Reset input
    input.value = '';
  }

  removePendingAttachment() {
    this.pendingAttachment.set(null);
  }

  private scrollToBottom() {
    try {
      const container = this.messagesContainer?.nativeElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    } catch (err) {
      // Ignore scroll errors
    }
  }

  goBack() {
    this.router.navigate(['/chat']);
  }

  getConversationName(): string {
    const conversation = this.chatService.currentConversation();
    if (!conversation) return '';

    if (conversation.type === 'group' && conversation.name) {
      return conversation.name;
    }

    if (conversation.otherParticipant) {
      return `${conversation.otherParticipant.firstName} ${conversation.otherParticipant.lastName}`;
    }

    const currentUser = this.authService.getUser();
    const other = conversation.participants.find(p => p._id !== currentUser?.id);
    return other ? `${other.firstName} ${other.lastName}` : 'Conversation';
  }

  isOnline(): boolean {
    return this.chatService.currentConversation()?.otherParticipant?.isOnline || false;
  }

  isOwnMessage(message: Message): boolean {
    return message.sender._id === this.authService.getUser()?.id;
  }

  formatMessageTime(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  formatMessageDate(date: Date | string): string {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateStr = d.toDateString();
    if (dateStr === today.toDateString()) {
      return "Aujourd'hui";
    }
    if (dateStr === yesterday.toDateString()) {
      return 'Hier';
    }

    return d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  }

  shouldShowDate(index: number): boolean {
    const messages = this.chatService.messages();
    if (index === 0) return true;

    const currentDate = new Date(messages[index].createdAt).toDateString();
    const prevDate = new Date(messages[index - 1].createdAt).toDateString();
    return currentDate !== prevDate;
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }

  isImage(message: Message): boolean {
    return message.type === 'image';
  }

  isDocument(message: Message): boolean {
    return message.type === 'document';
  }

  getFileIcon(mimeType: string): string {
    if (mimeType.includes('pdf')) return 'PDF';
    if (mimeType.includes('word')) return 'DOC';
    return 'FILE';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' Ko';
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
  }
}
