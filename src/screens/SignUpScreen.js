// src/screens/SignUpScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
} from 'react-native';
import { auth, db, createUserWithEmailAndPassword, updateProfile } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import useDoneButton from '../hooks/useDoneButton';

export default function SignUpScreen({ navigation }) {
  const [username,      setUsername]      = useState('');
  const [email,         setEmail]         = useState('');
  const [pass1,         setPass1]         = useState('');
  const [pass2,         setPass2]         = useState('');
  const [error,         setError]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [showPassword1, setShowPassword1] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);

  // Done button hooks for all four inputs
  const usernameDoneButton = useDoneButton();
  const emailDoneButton = useDoneButton();
  const password1DoneButton = useDoneButton();
  const password2DoneButton = useDoneButton();

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
    <KeyboardAvoidingView style={styles.root} behavior="padding">
      <Text style={styles.logo}>CompFit</Text>
      <Text style={styles.tagline}>Compete with your friends</Text>

      <View style={styles.form}>
        <TextInput
          placeholder="Username"
          placeholderTextColor="#6B7280"
          style={styles.input}
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
          editable={!loading}
          inputAccessoryViewID={usernameDoneButton.inputAccessoryViewID}
        />

        <TextInput
          placeholder="Email"
          placeholderTextColor="#6B7280"
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          editable={!loading}
          inputAccessoryViewID={emailDoneButton.inputAccessoryViewID}
        />

        {/* Password Input with Eye Toggle */}
        <View style={styles.passwordContainer}>
          <TextInput
            placeholder="Password"
            placeholderTextColor="#6B7280"
            style={styles.passwordInput}
            secureTextEntry={!showPassword1}
            textContentType="none"
            autoComplete="off"
            value={pass1}
            onChangeText={setPass1}
            editable={!loading}
            inputAccessoryViewID={password1DoneButton.inputAccessoryViewID}
          />
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => setShowPassword1(!showPassword1)}
            disabled={loading}
          >
            <Ionicons
              name={showPassword1 ? 'eye-off' : 'eye'}
              size={24}
              color="#6B7280"
            />
          </TouchableOpacity>
        </View>

        {/* Repeat Password Input with Eye Toggle */}
        <View style={styles.passwordContainer}>
          <TextInput
            placeholder="Repeat Password"
            placeholderTextColor="#6B7280"
            style={styles.passwordInput}
            secureTextEntry={!showPassword2}
            textContentType="none"
            autoComplete="off"
            value={pass2}
            onChangeText={setPass2}
            editable={!loading}
            inputAccessoryViewID={password2DoneButton.inputAccessoryViewID}
          />
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => setShowPassword2(!showPassword2)}
            disabled={loading}
          >
            <Ionicons
              name={showPassword2 ? 'eye-off' : 'eye'}
              size={24}
              color="#6B7280"
            />
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity 
          style={[styles.btn, loading && styles.disabledBtn]} 
          onPress={handleSignUp}
          disabled={loading}
        >
          <Text style={styles.btnText}>
            {loading ? 'Creating Account...' : 'Sign Up'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={{ marginTop: 18 }}
          disabled={loading}
        >
          <Text style={[styles.switchText, loading && styles.disabledText]}>
            Have an Account? <Text style={styles.switchLink}>Login</Text>
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Done button accessories for inputs */}
      {usernameDoneButton.accessoryView}
      {emailDoneButton.accessoryView}
      {password1DoneButton.accessoryView}
      {password2DoneButton.accessoryView}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: '#2E3439', 
    alignItems: 'center' 
  },
  logo: { 
    fontSize: 52, 
    fontWeight: '900', 
    color: '#A4D65E', 
    marginTop: 80 
  },
  tagline: { 
    fontSize: 20, 
    color: '#FFF', 
    marginTop: 12, 
    marginBottom: 60 
  },
  form: { 
    width: '80%' 
  },
  input: {
    backgroundColor: '#FFF', 
    borderRadius: 8, 
    padding: 12,
    fontSize: 16, 
    marginBottom: 20,
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  passwordInput: {
    backgroundColor: '#FFF', 
    borderRadius: 8, 
    padding: 12,
    paddingRight: 50, // Make room for the eye icon
    fontSize: 16,
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    top: 6,
    padding: 4,
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
  switchText: { 
    color: '#FFF', 
    textAlign: 'center', 
    fontSize: 14 
  },
  switchLink: { 
    color: '#A4D65E', 
    fontWeight: '600' 
  },
  disabledText: {
    opacity: 0.6,
  },
  error: { 
    color: '#F87171', 
    textAlign: 'center', 
    marginBottom: 10,
    fontSize: 14,
  },
});