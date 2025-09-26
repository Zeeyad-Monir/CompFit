// src/screens/SignUpScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Platform,
  Dimensions,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { db, createUserWithEmailAndPassword, updateProfile } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

const HERO_IMAGE = require('../../assets/coverPhotos/coverPhotoSeven.png');
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_HEIGHT = Math.max(SCREEN_HEIGHT * 0.35, 280);

export default function SignUpScreen({ navigation }) {
  const [username,      setUsername]      = useState('');
  const [email,         setEmail]         = useState('');
  const [pass1,         setPass1]         = useState('');
  const [pass2,         setPass2]         = useState('');
  const [error,         setError]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [showPassword1, setShowPassword1] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);

  // Check if username is already taken using the usernames collection
  const isUsernameAvailable = async (username) => {
    const trimmedUsername = username.trim().toLowerCase();
    if (!trimmedUsername) return false;
    
    try {
      // Check if the username document exists in the 'usernames' collection
      const usernameDoc = await getDoc(doc(db, 'usernames', trimmedUsername));
      return !usernameDoc.exists(); // Returns true if username is available
    } catch (error) {
      console.error('Error checking username availability:', error);
      // Fail safely: assume username is not available if there's an error
      return false;
    }
  };

  const handleSignUp = async () => {
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim().toLowerCase();
    
    // --- Start Validation ---
    if (!trimmedUsername) {
      setError('Username is required');
      return;
    }
    
    if (trimmedUsername.length < 3) {
      setError('Username must be at least 3 characters long');
      return;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      setError('Username can only contain letters, numbers, and underscores');
      return;
    }
    
    if (!trimmedEmail) {
      setError('Email is required');
      return;
    }
    
    if (pass1 !== pass2) {
      setError('Passwords do not match');
      return;
    }
    
    if (pass1.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    // --- End Validation ---

    setLoading(true);
    setError('');
    
    try {
      // 1. Check if username is available before anything else
      const usernameAvailable = await isUsernameAvailable(trimmedUsername);
      if (!usernameAvailable) {
        setError('Username is already taken. Please choose a different one.');
        setLoading(false);
        return;
      }

      // 2. Create the user with Firebase Authentication
      // This will fail automatically if the email is already in use
      const cred = await createUserWithEmailAndPassword(
        trimmedEmail,
        pass1
      );

      // 3. Update the new user's Auth profile with the chosen display name
      await updateProfile(cred.user, { displayName: trimmedUsername });

      // 4. Create the user's profile document in the 'users' collection
      await setDoc(doc(db, 'users', cred.user.uid), {
        username: trimmedUsername,
        handle: trimmedUsername.toLowerCase(),
        email: trimmedEmail,
        favouriteWorkout: '',
        wins: 0,
        totals: 0,
        friends: [],
        hasCompletedOnboarding: false, // New users should see the tutorial
      });

      // 5. Create a reverse lookup document for the username to enforce uniqueness
      await setDoc(doc(db, 'usernames', trimmedUsername.toLowerCase()), {
        uid: cred.user.uid,
      });

      // User is now signed in, and the app will navigate to the home stack automatically.

    } catch (e) {
      console.log('Sign up error:', e.code);
      // Handle specific Firebase Auth errors
      if (e.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please log in or use a different email.');
      } else if (e.code === 'auth/weak-password') {
        setError('Password is too weak. Please choose a stronger one.');
      } else if (e.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        // Generic error for other issues
        setError(e.message || 'Failed to create account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.fullWhiteContainer}>
        <ScrollView
          contentContainerStyle={styles.topContentContainer}
        >
          <Text style={styles.whiteScreenTitle}>CompFit</Text>
          <Text style={styles.whiteScreenSubtitle}>Compete With Your Friends</Text>

          <View style={styles.formStack}>
            <TextInput
              placeholder="Username"
              placeholderTextColor="#878988"
              style={styles.input}
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
              editable={!loading}
            />

            <TextInput
              placeholder="Email"
              placeholderTextColor="#878988"
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              editable={!loading}
              textContentType="emailAddress"
            />

            <View style={styles.passwordContainer}>
              <TextInput
                placeholder="Password"
                placeholderTextColor="#878988"
                style={[
                  styles.input,
                  styles.passwordInput,
                ]}
                secureTextEntry={!showPassword1}
                textContentType="newPassword"
                value={pass1}
                onChangeText={setPass1}
                editable={!loading}
                />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword1(!showPassword1)}
                disabled={loading}
              >
                <Ionicons
                  name={showPassword1 ? 'eye-off' : 'eye'}
                  size={22}
                  color="#6C6658"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.passwordContainer}>
              <TextInput
                placeholder="Repeat Password"
                placeholderTextColor="#878988"
                style={[
                  styles.input,
                  styles.passwordInput,
                ]}
                secureTextEntry={!showPassword2}
                textContentType="newPassword"
                value={pass2}
                onChangeText={setPass2}
                editable={!loading}
                />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword2(!showPassword2)}
                disabled={loading}
              >
                <Ionicons
                  name={showPassword2 ? 'eye-off' : 'eye'}
                  size={22}
                  color="#6C6658"
                />
              </TouchableOpacity>
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
            onPress={handleSignUp}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? 'Creating Account...' : 'Sign Up'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.switchContainer}
            disabled={loading}
          >
            <Text style={[styles.switchText, loading && styles.disabledText]}>
              Have an Account? <Text style={styles.switchLink}>Login</Text>
            </Text>
          </TouchableOpacity>

          <Text style={styles.legalText}>
            By Continuing you agree to CompFit's{' '}
            <Text style={styles.legalLink}>Terms of Use</Text>
          </Text>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  heroSection: {
    width: '100%',
  },
  heroImage: {
    height: HERO_HEIGHT,
    width: '100%',
    justifyContent: 'flex-start',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  logo: {
    fontSize: 52,
    color: '#93C31D',
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  sheetContainer: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 32 : 24,
  },
  sheetContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingBottom: 16,
  },
  sheetTitle: {
    fontSize: 28,
    color: '#93C31D',
    fontWeight: '700',
    textAlign: 'left',
  },
  sheetDescription: {
    fontSize: 15,
    color: '#6C6658',
    lineHeight: 20,
    marginTop: 10,
  },
  formStack: {
    marginTop: 32,
  },
  input: {
    height: 54,
    borderRadius: 14,
    paddingHorizontal: 18,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#EEEEEE',
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 12,
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  passwordInput: {
    paddingRight: 48,
    marginBottom: 0,
  },
  eyeIcon: {
    position: 'absolute',
    right: 18,
    top: 15,
    padding: 4,
  },
  primaryButton: {
    backgroundColor: '#93C31D',
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#93C31D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
    marginTop: 20,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  switchContainer: {
    marginTop: 32,
  },
  switchText: {
    color: '#6C6658',
    textAlign: 'center',
    fontSize: 14,
  },
  switchLink: {
    color: '#93C31D',
    fontWeight: '700',
  },
  disabledText: {
    opacity: 0.6,
  },
  legalText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#A7ABA0',
    marginTop: 12,
    marginBottom: 4,
  },
  legalLink: {
    color: '#6C6658',
    fontWeight: '600',
  },
  error: {
    color: '#F87171',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 12,
  },
  fullWhiteContainer: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  topContentContainer: {
    paddingTop: 66,
    paddingHorizontal: 24,
    paddingBottom: 40,
    minHeight: '50%',
  },
  whiteScreenTitle: {
    fontSize: 63,
    color: '#93C31D',
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  whiteScreenSubtitle: {
    fontSize: 18,
    color: '#6C6658',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 32,
  },
});
