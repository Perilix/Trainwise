import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const PUSH_SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';

if (PUSH_SUPPORTED) {
  // Notification reçue app ouverte : on l'affiche quand même en bannière.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  });
}

/**
 * Demande l'autorisation et renvoie le jeton Expo de l'appareil.
 * Renvoie null sur simulateur, en cas de refus ou si le projet EAS n'est pas encore créé.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (!PUSH_SUPPORTED || !Device.isDevice) return null;

  // Android 13+ : le canal doit exister avant la demande d'autorisation.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Trainwise',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#00A6FB',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('[push] Projet EAS absent : lance `npx eas init` dans app/ pour activer les notifications push.');
    return null;
  }

  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}
