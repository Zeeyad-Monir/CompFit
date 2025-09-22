import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  constructor() {
    this.notificationListener = null;
    this.responseListener = null;
  }

  async registerForPushNotificationsAsync(userId) {
    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications');
      return null;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return null;
      }

      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      
      if (!projectId) {
        console.log('Project ID not found');
        return null;
      }

      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      console.log('Push token:', token);

      if (userId && token) {
        await this.savePushTokenToFirestore(userId, token);
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#A4D65E',
        });
      }

      return token;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

  async savePushTokenToFirestore(userId, token) {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        pushToken: token,
        pushTokenUpdatedAt: new Date(),
      });
      console.log('Push token saved to Firestore');
    } catch (error) {
      console.error('Error saving push token to Firestore:', error);
    }
  }

  async sendPushNotification(expoPushToken, title, body, data = {}) {
    if (!expoPushToken) {
      console.log('No push token available');
      return;
    }

    const message = {
      to: expoPushToken,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
    };

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const result = await response.json();
      console.log('Push notification sent:', result);
      return result;
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  async sendFriendRequestNotification(recipientUserId, senderUsername) {
    try {
      const recipientDoc = await getDoc(doc(db, 'users', recipientUserId));
      if (!recipientDoc.exists()) {
        console.log('Recipient not found');
        return;
      }

      const recipientData = recipientDoc.data();
      const pushToken = recipientData.pushToken;

      if (!pushToken) {
        console.log('Recipient has no push token');
        return;
      }

      await this.sendPushNotification(
        pushToken,
        'New Friend Request',
        `${senderUsername} wants to be your friend!`,
        {
          type: 'friend_request',
          fromUsername: senderUsername,
          screen: 'Profile',
          tab: 'friends'
        }
      );
    } catch (error) {
      console.error('Error sending friend request notification:', error);
    }
  }

  setupNotificationListeners(navigation) {
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      const data = response.notification.request.content.data;
      
      if (data.type === 'friend_request' && data.screen === 'Profile') {
        // Navigate to Profile screen with the friends tab parameter
        navigation.navigate('Profile', { tab: 'friends' });
      }
    });
  }

  removeNotificationListeners() {
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }
    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }
  }

  async scheduleNotification(title, body, seconds = 1) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { test: 'data' },
      },
      trigger: { seconds },
    });
  }
}

export default new NotificationService();