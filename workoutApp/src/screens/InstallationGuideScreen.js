import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { createZipArchive } from '../utils/fileUtils';

const InstallationGuideScreen = () => {
  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Installation Guide</Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prerequisites</Text>
          <Text style={styles.paragraph}>
            Before installing the Workout Competition App, make sure you have the following:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Node.js (version 14 or higher)</Text>
            <Text style={styles.bulletItem}>• npm or yarn package manager</Text>
            <Text style={styles.bulletItem}>• Expo CLI (install with: npm install -g expo-cli)</Text>
            <Text style={styles.bulletItem}>• Expo Go app on your iOS device</Text>
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Installation Steps</Text>
          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Extract the project files</Text>
              <Text style={styles.paragraph}>
                Unzip the project files to your desired location.
              </Text>
            </View>
          </View>
          
          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Install dependencies</Text>
              <Text style={styles.paragraph}>
                Open a terminal in the project directory and run:
              </Text>
              <View style={styles.codeBlock}>
                <Text style={styles.code}>npm install</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Start the development server</Text>
              <Text style={styles.paragraph}>
                In the same terminal, run:
              </Text>
              <View style={styles.codeBlock}>
                <Text style={styles.code}>npm start</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>4</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Run on your device</Text>
              <Text style={styles.paragraph}>
                Scan the QR code with your iOS device's camera app or the Expo Go app.
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Troubleshooting</Text>
          <Text style={styles.paragraph}>
            If you encounter any issues during installation:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• Make sure all dependencies are correctly installed</Text>
            <Text style={styles.bulletItem}>• Check that you're using compatible versions of Node.js and Expo</Text>
            <Text style={styles.bulletItem}>• Try clearing the npm cache with: npm cache clean --force</Text>
            <Text style={styles.bulletItem}>• Restart the development server</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1E23',
    marginBottom: 24,
    textAlign: 'center',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A1E23',
    marginBottom: 15,
  },
  paragraph: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 24,
    marginBottom: 10,
  },
  bulletList: {
    marginLeft: 10,
    marginTop: 10,
  },
  bulletItem: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 24,
    marginBottom: 8,
  },
  step: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#A4D65E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1E23',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1E23',
    marginBottom: 8,
  },
  codeBlock: {
    backgroundColor: '#1A1E23',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  code: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#FFFFFF',
  },
});

export default InstallationGuideScreen;
