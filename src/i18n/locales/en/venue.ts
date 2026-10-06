import type de from '../de/venue';
import type { LocaleShape } from '../types';

const venue: LocaleShape<typeof de> = {
  events: {
    dateTime: '{{date}}, {{time}}',
    empty: 'No upcoming events',
    publicViewing: 'Public viewing',
  },
  info: {
    description: 'Description',
    type: 'Type',
    address: 'Address',
    capacity: 'Capacity',
    people: '{{count}} people',
    openingHours: 'Opening hours',
  },
  ownerBar: {
    editProfile: 'Edit profile',
    createEvent: 'Create event',
  },
  photos: {
    empty: 'No photos yet.',
    add: 'Add\nphoto',
  },
  rating: {
    alertTitle: 'Rating',
    minStar: 'Please give at least one star.',
    heading: 'Rate venue',
    yourRating: 'Your rating',
    comment: 'Comment (optional)',
    placeholder: 'How was the atmosphere, the venue, the event?',
    update: 'Update rating',
    submit: 'Submit rating',
  },
  errors: {
    notSignedIn: 'Not signed in',
  },
  detail: {
    permTitle: 'Access required',
    permBody: 'Please allow photo access in Settings.',
    photoUploadFailed: 'Photo upload failed',
    unknownError: 'Unknown error',
    saveError: 'Error while saving',
    removePhotoTitle: 'Remove photo',
    removePhotoBody: 'Really remove this photo?',
    noResults: 'No results found.',
    bannerUploadFailed: 'Banner upload failed',
    avatarUploadFailed: 'Avatar upload failed',
    changeBanner: 'Change banner',
    name: 'Name',
    namePlaceholder: 'Venue name',
    typePlaceholder: 'e.g. hall, gym, outdoor',
    capacityPeople: 'Capacity (people)',
    capacityPlaceholder: 'e.g. 200',
    descriptionPlaceholder: 'Describe your venue...',
    location: 'Location',
    addressPlaceholder: 'Street, house number, city',
    found: 'Found: {{label}}',
    reached: 'Reached via Sparr',
    signups_one: 'sign-up via Sparr',
    signups_other: 'sign-ups via Sparr',
    noSignups: 'No sign-ups via Sparr yet',
    ratings: 'Ratings',
    noRatings: 'No ratings yet',
    ratingCount_one: '{{count}} rating',
    ratingCount_other: '{{count}} ratings',
    photos: 'Photos',
    upcomingEvents: 'Upcoming events',
  },
};

export default venue;
