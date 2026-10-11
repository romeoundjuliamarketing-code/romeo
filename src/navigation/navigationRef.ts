import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

// For code that sits above the navigators (the coach tour overlay) and still
// has to switch tabs. Screens keep using useNavigation().
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
