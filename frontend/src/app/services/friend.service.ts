import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { SocketService } from './socket.service';

export interface Friend {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture?: string;
  isOnline?: boolean;
}

export interface FriendshipStatus {
  status: 'none' | 'pending' | 'accepted' | 'rejected' | 'blocked';
  isRequester?: boolean;
  friendshipId?: string;
}

export interface UserSearchResult extends Friend {
  friendship?: {
    status: string;
    isRequester: boolean;
    friendshipId: string;
  } | null;
}

export interface FriendRequest {
  _id: string;
  requester: Friend;
  recipient: Friend;
  status: string;
  createdAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class FriendService {
  private apiUrl = `${environment.apiUrl}/api/friends`;

  // Signals pour l'état
  friends = signal<Friend[]>([]);
  pendingRequests = signal<FriendRequest[]>([]);
  sentRequests = signal<FriendRequest[]>([]);
  pendingCount = signal<number>(0);

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private socketService: SocketService
  ) {
    if (this.authService.isAuthenticated()) {
      this.setupSocketListeners();
      // Charger les demandes en attente au démarrage
      this.getPendingRequests().subscribe();
    }
  }

  private setupSocketListeners(): void {
    // Écouter les nouvelles demandes d'amis
    this.socketService.on('friend:request').subscribe(() => {
      this.getPendingRequests().subscribe();
    });

    // Écouter les réponses aux demandes
    this.socketService.on<{ accepted: boolean }>('friend:response').subscribe(data => {
      this.getSentRequests().subscribe();
      if (data.accepted) {
        this.getFriends().subscribe();
      }
    });
  }

  // Récupérer la liste d'amis
  getFriends(): Observable<Friend[]> {
    return this.http.get<Friend[]>(this.apiUrl).pipe(
      tap(friends => this.friends.set(friends))
    );
  }

  // Rechercher des utilisateurs
  searchUsers(query: string): Observable<UserSearchResult[]> {
    return this.http.get<UserSearchResult[]>(`${this.apiUrl}/search`, {
      params: { q: query }
    });
  }

  // Récupérer les demandes en attente reçues
  getPendingRequests(): Observable<FriendRequest[]> {
    return this.http.get<FriendRequest[]>(`${this.apiUrl}/requests/pending`).pipe(
      tap(requests => {
        this.pendingRequests.set(requests);
        this.pendingCount.set(requests.length);
      })
    );
  }

  // Récupérer les demandes envoyées
  getSentRequests(): Observable<FriendRequest[]> {
    return this.http.get<FriendRequest[]>(`${this.apiUrl}/requests/sent`).pipe(
      tap(requests => this.sentRequests.set(requests))
    );
  }

  // Vérifier le statut d'amitié avec un utilisateur
  getFriendshipStatus(userId: string): Observable<FriendshipStatus> {
    return this.http.get<FriendshipStatus>(`${this.apiUrl}/status/${userId}`);
  }

  // Envoyer une demande d'ami
  sendFriendRequest(userId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/request/${userId}`, {});
  }

  // Répondre à une demande
  respondToRequest(friendshipId: string, accept: boolean): Observable<any> {
    return this.http.patch(`${this.apiUrl}/request/${friendshipId}/respond`, { accept }).pipe(
      tap(() => {
        // Mettre à jour les listes
        this.getPendingRequests().subscribe();
        if (accept) {
          this.getFriends().subscribe();
        }
      })
    );
  }

  // Annuler une demande envoyée
  cancelRequest(userId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/request/${userId}`).pipe(
      tap(() => this.getSentRequests().subscribe())
    );
  }

  // Supprimer un ami
  removeFriend(userId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${userId}`).pipe(
      tap(() => this.getFriends().subscribe())
    );
  }
}
