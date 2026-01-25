import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ChatService, Conversation, UserPreview } from '../../../services/chat.service';
import { AuthService } from '../../../services/auth.service';
import { NavbarComponent } from '../../../components/navbar/navbar.component';
import { debounceTime, Subject } from 'rxjs';

@Component({
  selector: 'app-conversations-list',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './conversations-list.component.html',
  styleUrl: './conversations-list.component.scss'
})
export class ConversationsListComponent implements OnInit {
  // State
  isLoading = signal(true);
  searchQuery = signal('');
  searchResults = signal<UserPreview[]>([]);
  isSearching = signal(false);
  showNewConversation = signal(false);

  // Search debounce
  private searchSubject = new Subject<string>();

  constructor(
    public chatService: ChatService,
    public authService: AuthService,
    private router: Router
  ) {
    // Setup search debounce
    this.searchSubject.pipe(
      debounceTime(300)
    ).subscribe(query => {
      if (query.length >= 2) {
        this.performSearch(query);
      } else {
        this.searchResults.set([]);
        this.isSearching.set(false);
      }
    });
  }

  ngOnInit() {
    this.loadConversations();
    // Ensure socket is connected
    if (!this.chatService.isConnected()) {
      this.chatService.connect();
    }
  }

  loadConversations() {
    this.isLoading.set(true);
    this.chatService.getConversations().subscribe({
      next: () => {
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading conversations:', err);
        this.isLoading.set(false);
      }
    });
  }

  onSearchInput(event: Event) {
    const query = (event.target as HTMLInputElement).value;
    this.searchQuery.set(query);
    this.isSearching.set(true);
    this.searchSubject.next(query);
  }

  performSearch(query: string) {
    this.chatService.searchUsers(query).subscribe({
      next: (users) => {
        this.searchResults.set(users);
        this.isSearching.set(false);
      },
      error: (err) => {
        console.error('Error searching users:', err);
        this.isSearching.set(false);
      }
    });
  }

  startConversation(user: UserPreview) {
    this.chatService.getOrCreateConversation(user._id).subscribe({
      next: (conversation) => {
        this.showNewConversation.set(false);
        this.searchQuery.set('');
        this.searchResults.set([]);
        this.router.navigate(['/chat', conversation._id]);
      },
      error: (err) => {
        console.error('Error creating conversation:', err);
      }
    });
  }

  openConversation(conversation: Conversation) {
    this.router.navigate(['/chat', conversation._id]);
  }

  toggleNewConversation() {
    this.showNewConversation.update(v => !v);
    if (!this.showNewConversation()) {
      this.searchQuery.set('');
      this.searchResults.set([]);
    }
  }

  getConversationName(conversation: Conversation): string {
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

  getLastMessagePreview(conversation: Conversation): string {
    if (!conversation.lastMessage?.content) {
      return 'Nouvelle conversation';
    }

    const content = conversation.lastMessage.content;
    if (conversation.lastMessage.type === 'image') {
      return 'Photo';
    }
    if (conversation.lastMessage.type === 'document') {
      return 'Document';
    }

    return content.length > 50 ? content.substring(0, 50) + '...' : content;
  }

  formatTime(date: Date | string | null): string {
    if (!date) return '';

    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();

    // Less than 24 hours
    if (diff < 24 * 60 * 60 * 1000) {
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

    // Less than 7 days
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      return d.toLocaleDateString('fr-FR', { weekday: 'short' });
    }

    // More than 7 days
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  isOnline(conversation: Conversation): boolean {
    return conversation.otherParticipant?.isOnline || false;
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }

  getConversationAvatar(conversation: Conversation): string | undefined {
    if (conversation.otherParticipant?.profilePicture) {
      return conversation.otherParticipant.profilePicture;
    }
    const currentUser = this.authService.getUser();
    const other = conversation.participants.find(p => p._id !== currentUser?.id);
    return other?.profilePicture;
  }
}
