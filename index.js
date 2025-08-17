// Import Expo's root component registration function
import { registerRootComponent } from 'expo';

// Import the main App component
import App from './App';

// Import all function modules
const competitionStats = require('../utils/competitionStats');

// Export all functions
exports.updateUserStats = competitionStats.updateUserStats;
exports.completeExpiredCompetitions = competitionStats.completeExpiredCompetitions;
exports.manuallyCompleteCompetition = competitionStats.manuallyCompleteCompetition;
/**
 * Entry point of the React Native application
 * 
 * registerRootComponent is Expo's way of registering the root component
 * It calls AppRegistry.registerComponent('main', () => App) internally
 * and ensures that whether you load the app in Expo Go or in a native build,
 * the environment is set up appropriately with proper initialization
 */
registerRootComponent(App);
