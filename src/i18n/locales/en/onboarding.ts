import type de from '../de/onboarding';
import type { LocaleShape } from '../types';

const onboarding: LocaleShape<typeof de> = {
  welcome: 'Hey! I am Sparris. Before you get started, I will ask you a few questions.',
  steps: {
    name: 'What is your name?',
    role: 'Are you a student or a coach?',
    discipline: 'Which combat sports do you train?',
    experience: 'How long have you been training actively?',
    gender: 'Are you male, female or diverse?',
    age: 'How old are you?',
    weight: 'How much do you currently weigh?',
    frequency: 'How often do you train per week?',
    invitecode: 'Are you part of a gym? Enter your invite code.',
  },
  start: 'Let\'s go',
  errorSave: 'Saving failed. Please try again.',
  errorInvite: 'Invalid code. Please check the code and try again.',
  nameLabel: 'Your name',
  nameError: 'Please enter your real name',
  roleStudent: 'Student',
  roleCoach: 'Coach',
  genderMale: 'Male',
  genderFemale: 'Female',
  genderOther: 'Diverse',
  ageUnit: 'years',
  inviteSkip: 'I do not have a code',
  weightSkip: 'Rather not say',
  experience: {
    under_1_year: { label: 'Beginner', sub: 'Less than 1 year' },
    '1_3_years': { label: 'Intermediate', sub: '1 to 3 years' },
    '3_5_years': { label: 'Experienced', sub: '3 to 5 years' },
    over_5_years: { label: 'Veteran', sub: 'More than 5 years' },
  },
  frequency: {
    low: { label: 'approx. 3x per week', sub: 'Moderately active' },
    medium: { label: 'approx. 5x per week', sub: 'Very active' },
    high: { label: 'approx. 10x per week', sub: '2x daily' },
  },
};

export default onboarding;
