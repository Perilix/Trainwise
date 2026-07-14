export interface Notification {
  _id: string;
  recipient: string;
  sender?: {
    _id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
  type: 'invitation' | 'invitation_response' | 'session' | 'message' | 'friend' | 'reengagement' | 'athlete_alert' | 'subscription_request';
  action: string;
  title: string;
  message: string;
  actionUrl?: string;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationsResponse {
  notifications: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
