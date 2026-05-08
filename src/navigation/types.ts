import type { Exercise, Workout } from '../data/workouts';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Tabs: undefined;
  Team: {
    studioId: string;
    studioName: string;
    studioCity: string;
  };
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
    trainingType?: string;
  };
  Settings: undefined;
  Paywall: undefined;
  WeightHistory: undefined;
  PointsBreakdown: undefined;
  AttendanceHistory: undefined;
  WorkoutHistory: undefined;
  SparringMap: undefined;
  Timer: {
    workoutTitle: string;
    exercises: Exercise[];
    earnedPoints?: number;
    category?: Workout['category'];
  };
};
