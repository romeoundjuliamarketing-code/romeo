import type { Exercise, Workout } from '../data/workouts';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyEmail: { email: string };
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
  PublicProfile: {
    userId:               string;
    sparringId?:          string;
    sparringScheduledAt?: string;
  };
  StudioDetail: { studioId: string };
  SparringChatList: undefined;
  SparringGroupChat: {
    sparringId:    string;
    sparringTitle: string;
    scheduledAt:   string;
    durationMin:   number;
    isOrganizer:   boolean;
  };
  Timer: {
    workoutTitle: string;
    exercises: Exercise[];
    earnedPoints?: number;
    category?: Workout['category'];
  };
  Notifications: undefined;
};
