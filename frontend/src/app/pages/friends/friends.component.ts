import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { FriendService, Friend, FriendRequest, UserSearchResult } from '../../services/friend.service';
import { ChatService } from '../../services/chat.service';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-friends',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NavbarComponent],
  templateUrl: './friends.component.html',
  styleUrl: './friends.component.scss'
})
export class FriendsComponent implements OnInit {
  activeTab = signal<'friends' | 'requests' | 'search'>('friends');
  isLoading = signal(false);
  searchQuery = '';
  searchResults = signal<UserSearchResult[]>([]);
  isSearching = signal(false);

  private searchSubject = new Subject<string>();

  constructor(
    public friendService: FriendService,
    private chatService: ChatService,
    private router: Router
  ) {
    // Debounce search
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      this.performSearch(query);
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    this.friendService.getFriends().subscribe({
      next: () => this.isLoading.set(false),
      error: () => this.isLoading.set(false)
    });
    this.friendService.getPendingRequests().subscribe();
    this.friendService.getSentRequests().subscribe();
  }

  setTab(tab: 'friends' | 'requests' | 'search'): void {
    this.activeTab.set(tab);
    if (tab === 'search') {
      this.searchResults.set([]);
      this.searchQuery = '';
    }
  }

  onSearchInput(): void {
    this.searchSubject.next(this.searchQuery);
  }

  performSearch(query: string): void {
    if (query.length < 2) {
      this.searchResults.set([]);
      return;
    }

    this.isSearching.set(true);
    this.friendService.searchUsers(query).subscribe({
      next: (results) => {
        this.searchResults.set(results);
        this.isSearching.set(false);
      },
      error: () => this.isSearching.set(false)
    });
  }

  sendRequest(userId: string): void {
    this.friendService.sendFriendRequest(userId).subscribe({
      next: () => {
        // Mettre à jour la liste de recherche
        this.performSearch(this.searchQuery);
        this.friendService.getSentRequests().subscribe();
      }
    });
  }

  cancelRequest(userId: string): void {
    this.friendService.cancelRequest(userId).subscribe({
      next: () => {
        this.performSearch(this.searchQuery);
      }
    });
  }

  acceptRequest(friendshipId: string): void {
    this.friendService.respondToRequest(friendshipId, true).subscribe();
  }

  rejectRequest(friendshipId: string): void {
    this.friendService.respondToRequest(friendshipId, false).subscribe();
  }

  removeFriend(userId: string): void {
    if (confirm('Voulez-vous vraiment supprimer cet ami ?')) {
      this.friendService.removeFriend(userId).subscribe();
    }
  }

  getInitials(firstName: string, lastName: string): string {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }

  getStatusText(friendship: UserSearchResult['friendship']): string {
    if (!friendship) return '';
    if (friendship.status === 'pending') {
      return friendship.isRequester ? 'Demande envoyée' : 'Vous a invité';
    }
    if (friendship.status === 'accepted') return 'Ami';
    return '';
  }

  openProfile(userId: string): void {
    this.router.navigate(['/user', userId]);
  }

  openConversation(userId: string): void {
    this.chatService.getOrCreateConversation(userId).subscribe({
      next: (conversation) => {
        this.router.navigate(['/chat', conversation._id]);
      },
      error: (err) => {
        console.error('Erreur ouverture conversation:', err);
      }
    });
  }
}
