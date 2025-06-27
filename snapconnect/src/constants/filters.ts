import { FilterAsset } from '../types/media';

// Enhanced filter library with better fitness-themed options
// Using improved emoji selections until proper assets are created

export const FILTER_LIBRARY: FilterAsset[] = [
  {
    id: 'none',
    name: 'No Filter',
    type: 'face',
    category: 'fitness',
    thumbnail: '', // No thumbnail for "none" filter
    asset: '', // No asset for "none" filter
  },
  {
    id: 'workout_glasses',
    name: 'Sport Shades',
    type: 'face',
    category: 'fitness',
    thumbnail: '🥽', // Sport goggles emoji
    asset: '🥽',
    position: 'eyes',
    scaleWithFace: true,
  },
  {
    id: 'sweatband',
    name: 'Victory Band',
    type: 'face',
    category: 'fitness',
    thumbnail: '🎯', // Target/goal emoji
    asset: '🎯',
    position: 'forehead',
    scaleWithFace: true,
  },
  {
    id: 'fitness_crown',
    name: 'Fitness Crown',
    type: 'face',
    category: 'celebration',
    thumbnail: '🏆', // Trophy emoji
    asset: '🏆',
    position: 'forehead',
    scaleWithFace: true,
  },
  {
    id: 'energy_spark',
    name: 'Energy Spark',
    type: 'face',
    category: 'celebration',
    thumbnail: '⚡', // Lightning bolt for energy
    asset: '⚡',
    position: 'rightCheek',
    scaleWithFace: false,
  },
  {
    id: 'muscle_power',
    name: 'Strength Mode',
    type: 'face',
    category: 'workout',
    thumbnail: '💪', // Classic muscle emoji
    asset: '💪',
    position: 'leftCheek',
    scaleWithFace: false,
  },
  {
    id: 'heart_zone',
    name: 'Heart Zone',
    type: 'face',
    category: 'workout',
    thumbnail: '💓', // Beating heart emoji
    asset: '💓',
    position: 'mouth',
    scaleWithFace: false,
  },
  {
    id: 'beast_mode',
    name: 'Beast Mode',
    type: 'face',
    category: 'workout',
    thumbnail: '🦁', // Lion emoji for beast mode
    asset: '🦁',
    position: 'face',
    scaleWithFace: true,
  },
  {
    id: 'medal_winner',
    name: 'Medal Winner',
    type: 'face',
    category: 'celebration',
    thumbnail: '🥇', // Gold medal
    asset: '🥇',
    position: 'mouth',
    scaleWithFace: false,
  },
  {
    id: 'fire_power',
    name: 'On Fire',
    type: 'face',
    category: 'celebration',
    thumbnail: '🔥', // Fire emoji
    asset: '🔥',
    position: 'forehead',
    scaleWithFace: false,
  },
];

// Filter categories for UI organization
export const FILTER_CATEGORIES = {
  fitness: {
    name: 'Fitness',
    icon: '🏋️‍♀️',
    filters: FILTER_LIBRARY.filter(f => f.category === 'fitness'),
  },
  workout: {
    name: 'Workout',
    icon: '💪',
    filters: FILTER_LIBRARY.filter(f => f.category === 'workout'),
  },
  celebration: {
    name: 'Achievement',
    icon: '🏆',
    filters: FILTER_LIBRARY.filter(f => f.category === 'celebration'),
  },
  fun: {
    name: 'Fun',
    icon: '😄',
    filters: FILTER_LIBRARY.filter(f => f.category === 'fun'),
  },
};

// Helper function to get filter by ID
export const getFilterById = (id: string): FilterAsset | undefined => {
  return FILTER_LIBRARY.find(filter => filter.id === id);
};

// Helper function to get default filter
export const getDefaultFilter = (): FilterAsset => {
  return FILTER_LIBRARY[0]; // 'none' filter
};