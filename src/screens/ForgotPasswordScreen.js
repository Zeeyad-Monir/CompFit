// src/screens/ForgotPasswordScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { auth, sendPasswordResetEmail } from '../firebase';
import { Ionicons } from '@expo/vector-icons';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handlePasswordReset = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    setError('');
    setSent(false);
    
    try {
      await sendPasswordResetEmail(trimmedEmail);
      setSent(true);
      Alert.alert(
        'Check Your Inbox',
        `A password reset link has been sent to ${trimmedEmail}.`,
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch (e) {
      console.error('Password reset error:', e);
      if (e.code === 'auth/user-not-found') {
        setError('No account found with this email address.');
      } else if (e.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError('Failed to send reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#111111" />
        </TouchableOpacity>
        
        <Text style={styles.logo}>Reset Password</Text>
        <Text style={styles.tagline}>Enter your email to receive a reset link</Text>

        <View style={styles.form}>
        <TextInput
          placeholder="Email"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          editable={!loading}
          autoComplete="email"
          textContentType="emailAddress"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {sent && !error && <Text style={styles.success}>Reset email sent successfully!</Text>}

        <TouchableOpacity 
          style={[styles.btn, (loading || sent) && styles.disabledBtn]} 
          onPress={handlePasswordReset}
          disabled={loading || sent}
        >
          <Text style={styles.btnText}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </Text>
        </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingBottom: 40,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
  },
  logo: { 
    fontSize: 42, 
    fontWeight: '900', 
    color: '#B6DB78', 
    marginTop: 120 
  },
  tagline: { 
    fontSize: 18, 
    color: '#666666', 
    marginTop: 12, 
    marginBottom: 60,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  form: { 
    width: '80%' 
  },
  input: {
    backgroundColor: '#FFFFFF', 
    borderRadius: 12, 
    padding: 16,
    fontSize: 16, 
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    color: '#111111',
  },
  btn: {
    backgroundColor: '#B6DB78', 
    borderRadius: 12, 
    paddingVertical: 16,
    alignItems: 'center', 
    marginTop: 10,
  },
  disabledBtn: {
    backgroundColor: '#D4E8B8',
    opacity: 0.7,
  },
  btnText: { 
    color: '#FFFFFF', 
    fontWeight: 'bold', 
    fontSize: 18 
  },
  error: { 
    color: '#EF4444', 
    textAlign: 'center', 
    marginBottom: 10,
    fontSize: 14,
  },
  success: {
    color: '#22C55E',
    textAlign: 'center',
    marginBottom: 10,
    fontSize: 14,
  },
});