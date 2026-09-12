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
