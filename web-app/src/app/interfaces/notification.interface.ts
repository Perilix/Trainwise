export interface Notification {
  _id: string;
  recipient: string;
  sender?: {
    _id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
  // Mêmes valeurs que l'énumération du modèle côté API : les trois dernières
  // sont arrivées avec le centre de notifications trié.
  type: 'invitation' | 'invitation_response' | 'session' | 'message' | 'friend' | 'reengagement' | 'athlete_alert' | 'subscription_request'
      | 'competition' | 'achievement' | 'subscription';
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
