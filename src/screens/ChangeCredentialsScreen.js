import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
  AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../contexts/AuthContext';
import { 
  auth, 
  db,
  sendPasswordResetEmail, 
  sendEmailVerification,
  verifyBeforeUpdateEmail,
  updateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  reload,
  getCurrentUser,
  signOut
} from '../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function ChangeCredentialsScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('password');
  
  // Password reset state
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  
  // Email change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailChangeLoading, setEmailChangeLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Error states
  const [passwordError, setPasswordError] = useState('');
  const [emailError, setEmailError] = useState('');
  
  // Email verification flow states
  const [emailChangeStatus, setEmailChangeStatus] = useState('idle'); // idle, pending, verified, completed
  const [pendingNewEmail, setPendingNewEmail] = useState('');
  const [lastResendTime, setLastResendTime] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [previousEmail, setPreviousEmail] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);

  const handlePasswordReset = async () => {
    setPasswordResetLoading(true);
    setPasswordError('');
    setPasswordResetSent(false);
    
    try {
      await sendPasswordResetEmail(user.email);
      setPasswordResetSent(true);
      Alert.alert(
        'Check Your Inbox',
        `A password reset link has been sent to ${user.email}. Follow the link to set a new password.`,
        [{ text: 'OK' }]
      );
    } catch (e) {
      console.error('Password reset error:', e);
      if (e.code === 'auth/too-many-requests') {
        setPasswordError('Too many requests. Please try again later.');
      } else {
        setPasswordError('Failed to send reset email. Please try again.');
      }
    } finally {
      setPasswordResetLoading(false);
    }
  };

  const handleEmailChange = async () => {
    const trimmedNewEmail = newEmail.trim().toLowerCase();
    
    // Validation
    if (!currentPassword) {
      setEmailError('Please enter your current password for security.');
      return;
    }
    
    if (!trimmedNewEmail) {
      setEmailError('Please enter your new email address.');
      return;
    }
    
    if (trimmedNewEmail === user.email.toLowerCase()) {
      setEmailError('New email must be different from current email.');
      return;
    }
    
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedNewEmail)) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    
    setEmailChangeLoading(true);
    setEmailError('');
    
    try {
      // Step 1: Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Step 2: Store previous email
      setPreviousEmail(user.email);
      
      // Step 3: Try to use verifyBeforeUpdateEmail (with our new smart detection)
      await verifyBeforeUpdateEmail(user, trimmedNewEmail);
      
      // Step 4: Update UI state
      setPendingNewEmail(trimmedNewEmail);
      setEmailChangeStatus('pending');
      setVerificationSent(true);
      setLastResendTime(Date.now());
      
      // Clear sensitive data
      setCurrentPassword('');
      setNewEmail('');
      
      // Step 5: Show success message
      Alert.alert(
        'Verification Email Sent',
        `A verification link has been sent to ${trimmedNewEmail}.\n\n` +
        `Please check your inbox and click the link to complete the email change.\n\n` +
        `Note: After verification, you'll need to sign in again with your new email for security.`,
        [{ text: 'OK' }]
      );
      
    } catch (e) {
      // Check if it's our custom alternative method error
      if (e.message && e.message.includes('alternative method')) {
        setEmailError('This app requires an alternative email change method. Contact support for assistance.');
      } else {
        handleEmailChangeError(e);
      }
    } finally {
      setEmailChangeLoading(false);
    }
  };

  const handleEmailChangeError = (error) => {
    switch (error.code) {
      case 'auth/wrong-password':
      case 'auth/invalid-login-credentials':  // Handle both password error codes
        setEmailError('Incorrect password. Please try again.');
        break;
      case 'auth/requires-recent-login':
        setEmailError('For security, please log out and log in again before changing your email.');
        break;
      case 'auth/email-already-in-use':
        setEmailError('This email is already associated with another account.');
        break;
      case 'auth/invalid-email':
        setEmailError('Please enter a valid email address.');
        break;
      case 'auth/too-many-requests':
        setEmailError('Too many attempts. Please wait a few minutes before trying again.');
        break;
      case 'auth/operation-not-allowed':
        setEmailError('Email change is not enabled. Please contact support.');
        break;
      default:
        // Only log truly unexpected errors
        console.error('Unexpected email change error:', error);
        setEmailError('Failed to update email. Please try again later.');
    }
  };

  const resendVerificationEmail = async () => {
    const timeSinceLastResend = Date.now() - lastResendTime;
    if (timeSinceLastResend < 60000) {
      const remainingSeconds = Math.ceil((60000 - timeSinceLastResend) / 1000);
      Alert.alert('Please Wait', `You can resend the verification email in ${remainingSeconds} seconds.`);
      return;
    }
    
    setEmailChangeLoading(true);
    
    try {
      // Try to resend using verifyBeforeUpdateEmail
      await verifyBeforeUpdateEmail(user, pendingNewEmail);
      setLastResendTime(Date.now());
      Alert.alert(
        'Verification Email Resent', 
        `A new verification link has been sent to ${pendingNewEmail}.\n\n` +
        `Please check your inbox and spam folder.`
      );
    } catch (e) {
      console.error('Resend error:', e);
      if (e.code === 'auth/too-many-requests') {
        Alert.alert('Too Many Requests', 'Please wait a few minutes before requesting another email.');
      } else if (e.message && e.message.includes('alternative method')) {
        Alert.alert('Error', 'Email verification not available. Please contact support.');
      } else {
        Alert.alert('Error', 'Failed to resend verification email. Please try again.');
      }
    } finally {
      setEmailChangeLoading(false);
    }
  };

  const checkVerificationStatus = async () => {
    try {
      // Reload user to get latest state
      await reload(user);
      const currentUser = getCurrentUser();
      
      // Check if email has changed (verification completed)
      if (currentUser.email !== previousEmail && currentUser.email === pendingNewEmail) {
        // Email has been successfully changed
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          email: currentUser.email,
          emailVerified: currentUser.emailVerified,
          verifiedAt: serverTimestamp()
        });
        
        setEmailChangeStatus('completed');
        setPendingNewEmail('');
        setVerificationSent(false);
        setPreviousEmail('');
        
        Alert.alert(
          '✅ Email Changed Successfully',
          `Your email has been changed to ${currentUser.email}.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert(
          'Verification Pending', 
          'Please check your email and click the verification link to complete the change.'
        );
      }
    } catch (e) {
      // Check if it's the token expired error - this means email change succeeded!
      if (e.code === 'auth/user-token-expired' || e.code === 'auth/requires-recent-login') {
        console.log('Email verification completed - user needs to re-authenticate');
        
        // The email has been changed successfully, but user needs to re-authenticate
        
        // Try to update Firestore before the session ends
        try {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            email: pendingNewEmail,
            emailVerified: true,
            verifiedAt: serverTimestamp(),
            previousEmail: previousEmail
          });
        } catch (firestoreError) {
          console.log('Could not update Firestore, but email change was successful');
        }
        
        // Show success message and guide user to sign in again
        Alert.alert(
          '✅ Email Changed Successfully!',
          `Your email has been successfully changed to ${pendingNewEmail}.\n\n` +
          `For security reasons, you'll be signed out and need to sign in again.\n\n` +
          `Email: ${pendingNewEmail}\n` +
          `Password: Your existing password`,
          [
            { 
              text: 'OK - Sign Out', 
              onPress: () => {
                // Sign out - the app will automatically show login screen
                signOut().catch((error) => {
                  console.log('Sign out error:', error);
                });
                // No need to navigate - App.js will automatically show AuthNavigator when user is null
              }
            }
          ],
          { cancelable: false }
        );
      } else {
        // Log only actual errors
        console.error('Error checking verification status:', e);
        Alert.alert('Error', 'Could not check verification status. Please try again.');
      }
    }
  };


  // Auto-check verification status when app resumes
  useEffect(() => {
    if (emailChangeStatus === 'pending') {
      const subscription = AppState.addEventListener('change', (nextAppState) => {
        if (nextAppState === 'active') {
          checkVerificationStatus();
        }
      });
      
      return () => subscription?.remove();
    }
  }, [emailChangeStatus]);

  // Auto-check on mount if we're in pending state
  useEffect(() => {
    if (emailChangeStatus === 'pending' && pendingNewEmail) {
      // Automatically check status when screen loads
      const timer = setTimeout(() => {
        checkVerificationStatus();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, []);

  const renderPasswordTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={24} color="#A4D65E" />
        <Text style={styles.infoText}>
          We'll send a password reset link to your email address: {'\n'}
          <Text style={styles.emailText}>{user.email}</Text>
        </Text>
      </View>

      {passwordError ? <Text style={styles.error}>{passwordError}</Text> : null}
      {passwordResetSent && !passwordError && (
        <Text style={styles.success}>Reset email sent successfully!</Text>
      )}

      <TouchableOpacity 
        style={[styles.btn, (passwordResetLoading || passwordResetSent) && styles.disabledBtn]} 
        onPress={handlePasswordReset}
        disabled={passwordResetLoading || passwordResetSent}
      >
        <Text style={styles.btnText}>
          {passwordResetLoading ? 'Sending...' : 
           passwordResetSent ? 'Email Sent' : 'Send Password Reset Email'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.helpText}>
        After receiving the email, follow the link to create a new password.
      </Text>
    </View>
  );

  const renderEmailTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {emailChangeStatus === 'pending' ? (
        // Pending verification UI
        <View>
          <View style={styles.pendingCard}>
            <Ionicons name="mail-unread" size={48} color="#A4D65E" />
            <Text style={styles.pendingTitle}>Verification Pending</Text>
            <Text style={styles.pendingText}>
              We've sent a verification link to:
            </Text>
            <Text style={styles.pendingEmail}>{pendingNewEmail}</Text>
            <Text style={styles.pendingSubtext}>
              Please check your inbox and click the link to complete the email change.
              Don't forget to check your spam folder.
            </Text>
          </View>
          
          <View style={styles.pendingActions}>
            <TouchableOpacity 
              style={styles.secondaryBtn}
              onPress={checkVerificationStatus}
            >
              <Text style={styles.secondaryBtnText}>I've Verified My Email</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.secondaryBtn, emailChangeLoading && styles.disabledBtn]}
              onPress={resendVerificationEmail}
              disabled={emailChangeLoading}
            >
              <Text style={styles.secondaryBtnText}>
                {emailChangeLoading ? 'Sending...' : 'Resend Verification Email'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.textBtn}
              onPress={() => {
                setEmailChangeStatus('idle');
                setPendingNewEmail('');
              }}
            >
              <Text style={styles.textBtnText}>Change to Different Email</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // Normal email change form
        <View>
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={24} color="#A4D65E" />
            <Text style={styles.infoText}>
              Current email: <Text style={styles.emailText}>{user.email}</Text>
              {'\n\n'}You'll receive a verification link at your new email address.
            </Text>
          </View>

          <Text style={styles.label}>Current Password</Text>
          <View style={styles.inputContainer}>
            <TextInput
              placeholder="Enter your current password"
              placeholderTextColor="#6B7280"
              style={styles.input}
              secureTextEntry={!showPassword}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              editable={!emailChangeLoading}
              autoCapitalize="none"
            />
            <TouchableOpacity 
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons 
                name={showPassword ? "eye-off" : "eye"} 
                size={20} 
                color="#6B7280" 
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>New Email Address</Text>
          <TextInput
            placeholder="Enter new email address"
            placeholderTextColor="#6B7280"
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            value={newEmail}
            onChangeText={setNewEmail}
            editable={!emailChangeLoading}
            autoComplete="email"
            textContentType="emailAddress"
          />

          {emailError ? <Text style={styles.error}>{emailError}</Text> : null}

          <TouchableOpacity 
            style={[styles.btn, emailChangeLoading && styles.disabledBtn]} 
            onPress={handleEmailChange}
            disabled={emailChangeLoading}
          >
            <Text style={styles.btnText}>
              {emailChangeLoading ? 'Processing...' : 'Send Verification Email'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.helpText}>
            After clicking the verification link in your email, your login email will be updated.
          </Text>
        </View>
      )}
    </ScrollView>
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#A4D65E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Settings</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'password' && styles.activeTab]}
          onPress={() => setActiveTab('password')}
        >
          <Ionicons 
            name="key" 
            size={20} 
            color={activeTab === 'password' ? '#A4D65E' : '#6B7280'} 
          />
          <Text style={[styles.tabText, activeTab === 'password' && styles.activeTabText]}>
            Password
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'email' && styles.activeTab]}
          onPress={() => setActiveTab('email')}
        >
          <Ionicons 
            name="mail" 
            size={20} 
            color={activeTab === 'email' ? '#A4D65E' : '#6B7280'} 
          />
          <Text style={[styles.tabText, activeTab === 'email' && styles.activeTabText]}>
            Email
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={styles.content} behavior="padding">
        {activeTab === 'password' ? renderPasswordTab() : renderEmailTab()}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: '#2E3439',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#A4D65E',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: 'rgba(164, 214, 94, 0.2)',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    marginLeft: 8,
  },
  activeTabText: {
    color: '#A4D65E',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  tabContent: {
    paddingTop: 30,
  },
  infoCard: {
    backgroundColor: 'rgba(164, 214, 94, 0.1)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 30,
  },
  infoText: {
    color: '#FFF',
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 12,
    flex: 1,
  },
  emailText: {
    color: '#A4D65E',
    fontWeight: 'bold',
  },
  label: {
    color: '#A4D65E',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#FFF', 
    borderRadius: 12, 
    padding: 16,
    fontSize: 16, 
    marginBottom: 20,
    color: '#1A1E23',
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  btn: {
    backgroundColor: '#A4D65E', 
    borderRadius: 12, 
    paddingVertical: 16,
    alignItems: 'center', 
    marginTop: 10,
  },
  disabledBtn: {
    backgroundColor: '#7A9B47',
    opacity: 0.7,
  },
  btnText: { 
    color: '#FFF', 
    fontWeight: 'bold', 
    fontSize: 18 
  },
  error: { 
    color: '#F87171', 
    textAlign: 'center', 
    marginBottom: 10,
    fontSize: 14,
  },
  success: {
    color: '#A4D65E',
    textAlign: 'center',
    marginBottom: 10,
    fontSize: 14,
  },
  helpText: {
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 14,
    lineHeight: 20,
  },
  pendingCard: {
    backgroundColor: 'rgba(164, 214, 94, 0.1)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 30,
  },
  pendingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#A4D65E',
    marginTop: 16,
    marginBottom: 12,
  },
  pendingText: {
    color: '#FFF',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  pendingEmail: {
    color: '#A4D65E',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  pendingSubtext: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  pendingActions: {
    gap: 12,
  },
  secondaryBtn: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#A4D65E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryBtnText: {
    color: '#A4D65E',
    fontWeight: '600',
    fontSize: 16,
  },
  textBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  textBtnText: {
    color: '#9CA3AF',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});