import TrackPlayer from 'react-native-track-player';

// Import the expo-router entry (registers the root component).
import 'expo-router/entry';

// Register the RNTP headless playback service for remote events.
TrackPlayer.registerPlaybackService(() => require('./src/services/playbackService'));
