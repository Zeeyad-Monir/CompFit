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
import { auth, db } from '../firebase';
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export default function SignUpScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [email,    setEmail]    = useState('');
  const [pass1,    setPass1]    = useState('');
  const [pass2,    setPass2]    = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

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
        auth,
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
      });

      // 5. Create a reverse lookup document for the username to enforce uniqueness
      await setDoc(doc(db, 'usernames', trimmedUsername.toLowerCase()), {
        uid: cred.user.uid,
      });

      // User is now signed in, and the app will navigate to the home stack automatically.

    } catch (e) {
      // to line 120
console.log('Sign up error:', e.code); // Use console.log instead

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
        />

        <TextInput
          placeholder="Password"
          placeholderTextColor="#6B7280"
          style={styles.input}
          secureTextEntry
          textContentType="newPassword"
          autoComplete="password-new"
          value={pass1}
          onChangeText={setPass1}
          editable={!loading}
        />

        <TextInput
          placeholder="Repeat Password"
          placeholderTextColor="#6B7280"
          style={styles.input}
          secureTextEntry
          textContentType="newPassword"
          autoComplete="password-new"
          value={pass2}
          onChangeText={setPass2}
          editable={!loading}
        />

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
