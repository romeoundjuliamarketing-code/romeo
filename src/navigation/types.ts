import type { Exercise, Workout } from '../data/workouts';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyEmail: { email: string };
};

export type RootStackParamList = {
  Onboarding: undefined;
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
    trainingType?: string;
  };
  Settings: undefined;
  Impressum: undefined;
  Paywall: undefined;
  WeightHistory: undefined;
  PointsBreakdown: undefined;
  AttendanceHistory: undefined;
  WorkoutHistory: undefined;
  SparringMap: { openCreate?: boolean } | undefined;
  PublicProfile: {
    userId:               string;
    sparringId?:          string;
    sparringScheduledAt?: string;
  };
  StudioDetail: { studioId: string };
  StudioMembers: { studioId: string; studioName: string };
  StudioRequests: { studioId: string };
  StudioInvite: { studioId: string };
  SparringChatList: undefined;
  SparringGroupChat: {
    sparringId:    string;
    sparringTitle: string;
    scheduledAt:   string;
    durationMin:   number;
    isOrganizer:   boolean;
  };
  EventGroupChat: {
    eventId:     string;
    eventTitle:  string;
    scheduledAt: string;
    durationMin: number;
    isOrganizer: boolean;
  };
  Timer: {
    workoutTitle: string;
    exercises: Exercise[];
    earnedPoints?: number;
    category?: Workout['category'];
  };
  Notifications: undefined;
  EditProfile: undefined;
  Verification: undefined;
};
