import type { Exercise, Workout } from '../data/workouts';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type RootStackParamList = {
  Tabs: undefined;
  Workout: {
    title: string;
    subtitle: string;
    category: Workout['category'];
    exercises: Exercise[];
    duration?: string;
    difficulty?: Workout['difficulty'];
    equipment?: string[];
    pointsPer30Min?: number;
    earnedPoints?: number;
  };
  Timer: {
    workoutTitle: string;
    exercises: Exercise[];
    earnedPoints?: number;
    category?: Workout['category'];
  };
};
