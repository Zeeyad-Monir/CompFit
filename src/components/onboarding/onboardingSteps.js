export const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to CompFit!',
    description: 'Let\'s quickly show you around. Compete with friends and track your fitness journey.',
    highlightBounds: 'none', // Everything stays dark
    contentPosition: 'center', // Center of screen
    requiresScreen: null, // No specific screen needed
  },
  {
    id: 'competitions',
    title: 'Your Competition Hub',
    description: 'View active competitions, pending invites, and completed challenges all in one place.',
    highlightBounds: {
      top: 46,  // SafeArea top + header (1px) + topNavContainer paddingTop (1px)
      left: 24,  // topNavContainer paddingHorizontal
      right: 24, // topNavContainer paddingHorizontal
      height: 56, // tabRow height
    },
    contentPosition: 'below', // Position tutorial below the tabs
    requiresScreen: 'HomeStack', // Must be on home screen
    navigateTo: 'ActiveCompetitions', // Navigate here if not already
  },
  {
    id: 'create',
    title: 'Create Competitions',
    description: 'Challenge your friends! Choose from presets or customize your own rules.',
    highlightBounds: {
      centerX: true,
      bottom: 70,
      width: 46,
      height: 46,
      borderRadius: 23,
    },
    contentPosition: 'middle', // Move tutorial to middle of screen
    requiresScreen: null, // Works on any screen with bottom nav
  },
  {
    id: 'submit',
    title: 'Track Your Workouts',
    description: 'Submit daily activities, attach photos, and earn points based on competition rules.',
    highlightBounds: {
      top: 120,
      height: 120,
      left: 24,
      right: 24,
      fullWidth: true,
      borderRadius: 24,
    },
    contentPosition: 'below',
    requiresScreen: 'HomeStack',
    navigateTo: 'ActiveCompetitions',
  },
  {
    id: 'leaderboard',
    title: 'Check Your Ranking',
    description: 'See how you stack up against friends. Some competitions hide scores for extra suspense!',
    highlightBounds: {
      top: 120,
      height: 120,
      left: 24,
      right: 24,
      fullWidth: true,
      borderRadius: 24,
    },
    contentPosition: 'below',
    requiresScreen: 'HomeStack',
    navigateTo: 'ActiveCompetitions',
  },
  {
    id: 'profile',
    title: 'Connect with Friends',
    description: 'Add friends, track your stats, and manage your profile. Ready to compete?',
    highlightBounds: {
      centerX: false,
      bottom: 70,
      right: 50,
      width: 46,
      height: 46,
    },
    contentPosition: 'above',
    requiresScreen: null,
  },
];