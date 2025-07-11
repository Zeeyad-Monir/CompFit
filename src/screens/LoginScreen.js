// src/screens/LoginScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
} from 'react-native';
import { signInWithEmailAndPassword, auth } from '../firebase';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen({ navigation }) {
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    
    if (!trimmedEmail) {
      setError('Email is required');
      return;
    }
    
    if (!password) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      await signInWithEmailAndPassword(auth, trimmedEmail, password);
      // User will be automatically redirected by AuthContext
    } catch (e) {
      console.log('Login error:', e.code);
      
      if (e.code === 'auth/user-not-found') {
        setError('No account found with this email address.');
      } else if (e.code === 'auth/wrong-password') {
        setError('Incorrect password. Please try again.');
      } else if (e.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (e.code === 'auth/invalid-credential') {
        setError('Invalid email or password. Please check your credentials.');
      } else if (e.code === 'auth/user-disabled') {
        setError('This account has been disabled. Please contact support.');
      } else if (e.code === 'auth/too-many-requests') {
        setError('Too many failed login attempts. Please try again later.');
      } else {
        setError('Failed to login. Please check your credentials and try again.');
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
          placeholder="Email"
          placeholderTextColor="#6B7280"
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          editable={!loading}
          autoComplete="email"
          textContentType="emailAddress"
        />

        {/* Password Input with Eye Toggle */}
        <View style={styles.passwordContainer}>
          <TextInput
            placeholder="Password"
            placeholderTextColor="#6B7280"
            style={styles.passwordInput}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            editable={!loading}
            autoComplete="password"
            textContentType="password"
          />
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => setShowPassword(!showPassword)}
            disabled={loading}
          >
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={24}
              color="#6B7280"
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          onPress={() => navigation.navigate('ForgotPassword')}
          style={styles.forgotPasswordContainer}
          disabled={loading}
        >
          <Text style={[styles.forgotPasswordText, loading && styles.disabledText]}>
            Forgot Password?
          </Text>
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity 
          style={[styles.btn, loading && styles.disabledBtn]} 
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.btnText}>
            {loading ? 'Signing In...' : 'Login'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => navigation.navigate('SignUp')} 
          style={{ marginTop: 18 }}
          disabled={loading}
        >
          <Text style={[styles.switchText, loading && styles.disabledText]}>
            Don't have an Account? <Text style={styles.switchLink}>Sign up</Text>
          </Text>
        </TouchableOpacity>

        <Text style={styles.socialHeading}>or sign up with</Text>

        <View style={styles.socialRow}>
          <Ionicons name="logo-google"   size={32} color="#A4D65E" style={styles.socialIcon} />
          <Ionicons name="logo-facebook" size={32} color="#A4D65E" style={styles.socialIcon} />
          <Ionicons name="finger-print"  size={32} color="#A4D65E" style={styles.socialIcon} />
        </View>
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
    borderRadius: 12, 
    padding: 16,
    fontSize: 16, 
    marginBottom: 20,
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  passwordInput: {
    backgroundColor: '#FFF', 
    borderRadius: 12, 
    padding: 16,
    paddingRight: 50, // Make room for the eye icon
    fontSize: 16,
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    top: 10,
    padding: 4,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: 15,
  },
  forgotPasswordText: {
    color: '#A4D65E',
    fontSize: 14,
    fontWeight: '600',
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
  socialHeading: { 
    color: '#FFF', 
    textAlign: 'center', 
    marginVertical: 20 
  },
  socialRow: { 
    flexDirection: 'row', 
    justifyContent: 'center' 
  },
  socialIcon: { 
    marginHorizontal: 14 
  },
  error: { 
    color: '#F87171', 
    textAlign: 'center', 
    marginBottom: 10,
    fontSize: 14,
  },
});
