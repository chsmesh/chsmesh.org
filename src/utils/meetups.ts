import { SITE_TIME_ZONE } from '../../services/submissions/time-zone.mjs';

/**
 * Meetups happen in Charleston, so their dates and times are shown in
 * Charleston time whatever zone the build machine or visitor is in. Stored
 * values carry an offset (the submissions service and the CMS both write
 * one), so this only changes how the instant is presented.
 */
export const MEETUP_TIME_ZONE = SITE_TIME_ZONE;

export const formatMeetupDate = (date: Date): string =>
  date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: MEETUP_TIME_ZONE,
  });

export const formatMeetupTime = (date: Date): string =>
  date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: MEETUP_TIME_ZONE,
  });

type MeetupDates = {
  date: Date;
  endDate?: Date;
};

/**
 * A meetup is over when its end time passes, not when it starts. Meetups
 * without an explicit `endDate` fall back to their start date.
 */
export const meetupEndsAt = (data: MeetupDates): Date => data.endDate ?? data.date;

export const isPastMeetup = (data: MeetupDates, now: Date = new Date()): boolean =>
  meetupEndsAt(data) < now;

export const isUpcomingMeetup = (data: MeetupDates, now: Date = new Date()): boolean =>
  !isPastMeetup(data, now);

/**
 * Start date and time on one line, with the zone abbreviation ("Saturday,
 * October 3, 2026 · 6:00 PM EDT"). For share cards, which are read outside
 * the site by people who may not assume Charleston time.
 */
export const formatMeetupDateTime = (date: Date): string => {
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: MEETUP_TIME_ZONE,
  });
  return `${formatMeetupDate(date)} · ${time}`;
};
