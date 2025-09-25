// src/screens/LoginScreen.js
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ImageBackground,
  Platform,
  Dimensions,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { signInWithEmailAndPassword } from '../firebase';
import { Ionicons } from '@expo/vector-icons';
import useDoneButton from '../hooks/useDoneButton';

const HERO_IMAGE = require('../../assets/Onboarding/OnboardingImgOne.jpg');
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_HEIGHT = Math.max(SCREEN_HEIGHT * 0.55, 420);

export default function LoginScreen({ navigation }) {
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const emailRef = useRef(null);

  // Done button hooks for both inputs
  const emailDoneButton = useDoneButton();
  const passwordDoneButton = useDoneButton();

  useEffect(() => {
    if (showEmailForm && emailRef.current) {
      emailRef.current.focus();
    }
  }, [showEmailForm]);

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
      await signInWithEmailAndPassword(trimmedEmail, password);
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
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {showEmailForm ? (
        <View style={styles.fullWhiteContainer}>
          <ScrollView
            contentContainerStyle={styles.topContentContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.whiteScreenTitle}>CompFit</Text>
            <Text style={styles.whiteScreenSubtitle}>Compete With Your Friends</Text>
            
            <View style={styles.titleRow}>
              <TouchableOpacity 
                onPress={() => setShowEmailForm(false)}
                style={styles.backButton}
              >
                <View style={styles.backButtonContent}>
                  <Ionicons name="arrow-back" size={18} color="#93C31D" style={styles.backArrow} />
                  <Text style={styles.backButtonText}>Back</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.fieldStack}>
              <TextInput
                ref={emailRef}
                placeholder="Email"
                placeholderTextColor="#878988"
                style={[
                  styles.input,
                  styles.emailInput,
                  emailFocused && styles.inputFocused,
                ]}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                editable={!loading}
                autoComplete="email"
                textContentType="emailAddress"
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                inputAccessoryViewID={emailDoneButton.inputAccessoryViewID}
              />

              <View style={styles.passwordContainer}>
                <TextInput
                  placeholder="Password"
                  placeholderTextColor="#878988"
                  style={[
                    styles.input,
                    styles.passwordInput,
                    passwordFocused && styles.inputFocused,
                  ]}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  editable={!loading}
                  autoComplete="password"
                  textContentType="password"
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  inputAccessoryViewID={passwordDoneButton.inputAccessoryViewID}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={22}
                    color="#6C6658"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword')}
              style={styles.forgotPasswordContainer}
              disabled={loading}
            >
              <Text
                style={[
                  styles.forgotPasswordText,
                  loading && styles.disabledText,
                ]}
              >
                Forgot Password?
              </Text>
            </TouchableOpacity>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? 'Signing In...' : 'Login'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('SignUp')}
              style={styles.switchContainer}
              disabled={loading}
            >
              <Text style={[styles.switchText, loading && styles.disabledText]}>
                Don't have an Account? <Text style={styles.switchLink}>Sign up</Text>
              </Text>
            </TouchableOpacity>

            <Text style={styles.legalText}>
              By Continuing you agree to CompFit's{' '}
              <Text style={styles.legalLink}>Terms of Use</Text>
            </Text>
          </ScrollView>
        </View>
      ) : (
        <>
          <View style={styles.heroSection}>
            <ImageBackground
              source={HERO_IMAGE}
              style={styles.heroImage}
              resizeMode="cover"
            >
              <LinearGradient
                colors={[
                  'rgba(0,0,0,0.6)',
                  'rgba(0,0,0,0.6)',
                ]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.heroOverlay}
              />
              <View style={styles.heroContent}>
                <Text style={styles.logo}>CompFit</Text>
                <Text style={styles.tagline}>Compete with your friends</Text>
              </View>
            </ImageBackground>
          </View>

          <View style={styles.sheetContainer}>
            <ScrollView
              contentContainerStyle={styles.sheetContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.sheetTitle}>Get Started</Text>
              <Text style={styles.sheetDescription}>
                CompFit helps you and your friends connect with one another through
                healthy competition.
              </Text>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  setShowEmailForm(true);
                  setError('');
                }}
                disabled={loading}
              >
                <Text style={styles.primaryButtonText}>Continue with Email</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                activeOpacity={0.85}
              >
                <View style={styles.secondaryButtonContent}>
                  <View style={styles.googleBadge}>
                    <Text style={styles.googleLetter}>G</Text>
                  </View>
                  <Text style={styles.secondaryButtonText}>Continue With Google</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('SignUp')}
                style={styles.switchContainer}
                disabled={loading}
              >
                <Text style={[styles.switchText, loading && styles.disabledText]}>
                  Don't have an Account? <Text style={styles.switchLink}>Sign up</Text>
                </Text>
              </TouchableOpacity>

              <Text style={styles.legalText}>
                By Continuing you agree to CompFit's{' '}
                <Text style={styles.legalLink}>Terms of Use</Text>
              </Text>
            </ScrollView>
          </View>
        </>
      )}

      {emailDoneButton.accessoryView}
      {passwordDoneButton.accessoryView}
    </KeyboardAvoidingView>
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
    paddingTop: 66,
    paddingHorizontal: 24,
  },
  logo: {
    fontSize: 63,
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
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 32 : 24,
  },
  sheetContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingBottom: 16,
  },
  sheetTitle: {
    fontSize: 32,
    color: '#93C31D',
    fontWeight: '700',
    textAlign: 'left',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    width: '100%',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backArrow: {
    marginRight: 6,
  },
  backButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#93C31D',
  },
  sheetDescription: {
    fontSize: 15,
    color: '#6C6658',
    lineHeight: 20,
    marginTop: 8,
  },
  fieldStack: {
    marginTop: 26,
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
  },
  inputFocused: {
    borderColor: '#B7D564',
    backgroundColor: '#FFFFFF',
  },
  emailInput: {
    marginBottom: 12,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeIcon: {
    position: 'absolute',
    right: 18,
    top: 15,
    padding: 4,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginTop: 12,
  },
  forgotPasswordText: {
    color: '#93C31D',
    fontSize: 14,
    fontWeight: '600',
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
    marginTop: 32,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6E6E6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  secondaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  googleBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6E6E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  googleLetter: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
  },
  secondaryButtonText: {
    fontSize: 16,
    color: '#1A1F2C',
    fontWeight: '600',
  },
  switchContainer: {
    marginTop: 28,
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
