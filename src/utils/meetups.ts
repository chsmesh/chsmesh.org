/**
 * Meetups happen in Charleston, so their dates and times are shown in
 * Charleston time whatever zone the build machine or visitor is in. Stored
 * values carry an offset (the submissions service and the CMS both write
 * one), so this only changes how the instant is presented.
 */
export const MEETUP_TIME_ZONE = 'America/New_York';

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
