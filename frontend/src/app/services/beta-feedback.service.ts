import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type FeedbackType = 'bug' | 'ui' | 'perf' | 'idea';
export type FeedbackScreen = 'home' | 'chat' | 'planning' | 'sorties' | 'profil' | 'boutique' | 'auth' | 'other';
export type FeedbackSeverity = 'low' | 'med' | 'high' | 'crit';
export type FeedbackStatus = 'triage' | 'open' | 'prog' | 'planned' | 'fixed' | 'closed';

export interface BetaFeedbackPayload {
  type: FeedbackType;
  screen: FeedbackScreen;
  description: string;
  severity: FeedbackSeverity;
  contactMe: boolean;
  title?: string;
  email?: string;
  appVersion?: string;
  locale?: string;
  timezone?: string;
}

export interface BetaFeedbackResponse {
  ticketId: string;
  status: FeedbackStatus;
  createdAt: string;
}

export interface BetaStats {
  testers: number;
  feedbacks: number;
  fixed: number;
  avgResponseHours: number;
}

export interface CommunityItem {
  id: string;
  ticketId: string;
  title: string;
  screen: FeedbackScreen;
  status: FeedbackStatus;
  votes: number;
}

@Injectable({ providedIn: 'root' })
export class BetaFeedbackService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/beta`;

  submit(payload: BetaFeedbackPayload): Observable<BetaFeedbackResponse> {
    return this.http.post<BetaFeedbackResponse>(`${this.base}/feedback`, payload);
  }

  getStats(): Observable<BetaStats> {
    return this.http.get<BetaStats>(`${this.base}/stats`);
  }

  getCommunity(): Observable<{ items: CommunityItem[] }> {
    return this.http.get<{ items: CommunityItem[] }>(`${this.base}/feedback/community`);
  }

  toggleVote(id: string): Observable<{ votes: number; voted: boolean }> {
    return this.http.post<{ votes: number; voted: boolean }>(`${this.base}/feedback/${id}/vote`, {});
  }

  getMyCount(): Observable<{ countMonth: number; countTotal: number; goal: number }> {
    return this.http.get<{ countMonth: number; countTotal: number; goal: number }>(`${this.base}/feedback/my-count`);
  }
}
