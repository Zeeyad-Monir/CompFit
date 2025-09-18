# Workout Competition App

This is a React Native application built with Expo for creating and managing workout competitions. The app allows users to create competitions, view leaderboards, and submit workout activities.

## Features

- Create new workout competitions
- View active competitions
- View competition details and submissions
- View leaderboard rankings
- Add workout submissions
- User profile management

## Installation

1. Make sure you have Node.js and npm installed
2. Install Expo CLI globally:
   ```
   npm install -g expo-cli
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Start the development server:
   ```
   npm start
   ```
5. Use the Expo Go app on your iOS device to scan the QR code and run the app

## Project Structure

- `/src/components`: Reusable UI components
- `/src/screens`: Screen components for each page
- `/src/navigation`: Navigation configuration
- `/src/assets`: Images and icons

## Dependencies

- React Navigation for screen navigation
- React Native Picker for dropdown components
- React Native Gesture Handler for touch interactions

## Screens

1. **Active Competitions**: Shows a list of all active competitions
2. **Competition Details**: Shows details of a specific competition including submissions
3. **Leaderboard**: Shows rankings of participants in a competition
4. **Competition Creation**: Form to create a new competition
5. **Submission Form**: Form to add a new workout submission
6. **Profile**: User profile information and settings

## Future Enhancements

- Firebase integration for data persistence
- Messaging feature between contestants
- Automatic reminders for competitions
- Visual graphs of points and activities over time
