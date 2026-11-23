import type { FormConfig } from './SubmissionForm.astro';

/**
 * Submission form configurations.
 *
 * Each form POSTs to the same-origin submissions service at
 * `${PUBLIC_SUBMIT_BASE}/<kind>` (default `/api/submit/<kind>`). That endpoint is public and callable by anyone, so
 * the service (services/submissions) is the only trust boundary: it validates
 * input, rate limits and verifies Turnstile. Nothing the browser does here -
 * required attributes, zod schemas, the honeypot-free form markup - is a
 * security control; it is only user-experience polish that an attacker skips
 * by POSTing to the endpoint directly.
 */

// Guide Form Configuration
export const guideFormConfig: FormConfig = {
  id: 'guide-form',
  kind: 'guide',
  title: 'Submit a Guide',
  description: 'Share your Meshtastic knowledge with the community.',
  fields: [
    {
      name: 'title',
      label: 'Guide Title',
      type: 'text',
      required: true,
      placeholder: 'e.g., Setting Up Solar Power for Your Node',
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      required: true,
      rows: 2,
      placeholder: 'Brief summary of what the guide covers',
    },
    {
      name: 'content',
      label: 'Guide Content',
      type: 'textarea',
      required: true,
      rows: 12,
      placeholder: 'Write your guide in Markdown format. Use ## for headings, - for lists, **bold**, *italic*, etc.',
      helpText: 'Use Markdown formatting (headers, lists, code blocks, etc.)',
      className: 'font-mono text-sm',
    },
    {
      name: 'category',
      label: 'Category',
      type: 'select',
      required: true,
      placeholder: 'Select a category...',
      options: [
        { value: 'getting-started', label: 'Getting Started' },
        { value: 'hardware', label: 'Hardware' },
        { value: 'software', label: 'Software' },
        { value: 'network', label: 'Network' },
        { value: 'troubleshooting', label: 'Troubleshooting' },
      ],
    },
    {
      name: 'difficulty',
      label: 'Difficulty Level',
      type: 'select',
      required: true,
      placeholder: 'Select difficulty...',
      options: [
        { value: 'beginner', label: 'Beginner - No prior experience needed' },
        { value: 'intermediate', label: 'Intermediate - Some experience required' },
        { value: 'advanced', label: 'Advanced - Technical knowledge required' },
      ],
    },
    {
      name: 'author',
      label: 'Author Name',
      type: 'text',
      placeholder: 'Your name or callsign (optional)',
    },
    {
      name: 'prerequisites',
      label: 'Prerequisites',
      type: 'text',
      placeholder: 'e.g., Basic soldering skills, Flashed device (comma-separated)',
      helpText: 'Comma-separated list of prerequisites (optional)',
    },
    {
      name: 'submitterEmail',
      label: 'Email',
      type: 'email',
      required: true,
      placeholder: 'your.email@example.com',
      helpText: 'For chsmesh.org contact only (not published on site)',
    },
  ],
  transformRules: [
    { field: 'prerequisites', type: 'splitCommas', optional: true },
  ],
  payloadRules: {
    add: {
      order: 999,
    }
  },
  successMessage: '✓ Guide submitted successfully!',
  disclaimerText: 'By submitting, you agree that your guide will be publicly available under the site\'s license.',
};

// Meetup Form Configuration
export const meetupFormConfig: FormConfig = {
  id: 'meetup-form',
  kind: 'meetup',
  title: 'Submit a Meetup',
  description: 'Host or propose a community meetup.',
  fields: [
    {
      name: 'title',
      label: 'Event Title',
      type: 'text',
      required: true,
      placeholder: 'e.g., Monthly Mesh Meetup - February 2026',
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      required: true,
      rows: 3,
      placeholder: 'Brief summary of the meetup purpose and activities',
    },
    {
      name: 'content',
      label: 'Event Details',
      type: 'textarea',
      rows: 8,
      placeholder: 'Optional: Additional details, agenda, what to bring, parking info, etc. (Markdown supported)',
      helpText: 'Use Markdown formatting for rich content (optional)',
      className: 'font-mono text-sm',
    },
    {
      name: 'date',
      label: 'Start Date',
      type: 'datetime-local',
      required: true,
      helpText: 'Charleston (Eastern) time',
      gridCol: 2,
    },
    {
      name: 'endDate',
      label: 'End Date',
      type: 'datetime-local',
      helpText: 'Charleston (Eastern) time',
      gridCol: 2,
    },
    {
      name: 'location',
      label: 'Location Name',
      type: 'text',
      required: true,
      placeholder: 'e.g., Shem Creek Park, Charleston Coffee House',
    },
    {
      name: 'address',
      label: 'Street Address',
      type: 'text',
      placeholder: '508 Mill St, Mount Pleasant, SC 29464',
      helpText: 'Full address with city and zip code (optional)',
    },
    {
      name: 'lat',
      label: 'Latitude',
      type: 'number',
      gridCol: 2,
      step: '0.0001',
      min: -90,
      max: 90,
      placeholder: '32.7765',
    },
    {
      name: 'lng',
      label: 'Longitude',
      type: 'number',
      gridCol: 2,
      step: '0.0001',
      min: -180,
      max: 180,
      placeholder: '-80.0298',
      helpText: 'GPS coordinates for map display (optional)',
    },
    {
      name: 'rsvpLink',
      label: 'RSVP Link',
      type: 'url',
      placeholder: 'https://eventbrite.com/your-event or Discord event link',
      helpText: 'Link to RSVP or get more info (optional)',
    },
    {
      name: 'maxAttendees',
      label: 'Max Attendees',
      type: 'number',
      min: 1,
      placeholder: 'e.g., 25',
      helpText: 'Venue capacity limit (optional)',
    },
    {
      name: 'submitterEmail',
      label: 'Email',
      type: 'email',
      required: true,
      placeholder: 'your.email@example.com',
      helpText: 'For chsmesh.org contact only (not published on site)',
    },
  ],
  transformRules: [
    { field: 'lat', type: 'number', optional: true },
    { field: 'lng', type: 'number', optional: true },
    { field: 'maxAttendees', type: 'number', optional: true },
  ],
  payloadRules: {
    add: {
      featured: false,
    },
    nest: [
      { sourceFields: ['lat', 'lng'], targetField: 'coordinates' }
    ]
  },
  successMessage: '✓ Meetup submitted successfully!',
  disclaimerText: 'By submitting, you agree that your meetup information will be publicly displayed on this website.',
};

// Resource Form Configuration
export const resourceFormConfig: FormConfig = {
  id: 'resource-form',
  kind: 'resource',
  title: 'Submit a Resource',
  description: 'Recommend a device, accessory, app, or community resource.',
  fields: [
    {
      name: 'title',
      label: 'Resource Title',
      type: 'text',
      required: true,
      placeholder: 'e.g., Heltec V3 LoRa Board',
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      required: true,
      rows: 3,
      placeholder: 'Brief overview of the resource',
    },
    {
      name: 'content',
      label: 'Detailed Information',
      type: 'textarea',
      rows: 8,
      placeholder: 'Optional: Detailed specs, usage tips, setup instructions, etc. (Markdown supported)',
      helpText: 'Use Markdown formatting for rich content (optional)',
      className: 'font-mono text-sm',
    },
    {
      name: 'category',
      label: 'Category',
      type: 'select',
      required: true,
      placeholder: 'Select a category...',
      options: [
        { value: 'devices', label: 'Devices' },
        { value: 'accessories', label: 'Accessories' },
        { value: 'software', label: 'Software' },
        { value: 'firmware', label: 'Firmware' },
        { value: 'community', label: 'Community' },
      ],
    },
    {
      name: 'priceRange',
      label: 'Price Range',
      type: 'text',
      placeholder: 'e.g., $25-35, Free, $100+',
      helpText: 'Approximate price range (optional)',
    },
    {
      name: 'links',
      label: 'Links',
      type: 'dynamic-array',
      helpText: 'Add links one at a time (purchase pages, documentation, download links, community resources)',
      subFields: [
        {
          name: 'label',
          label: 'Link Label',
          type: 'text',
          required: true,
          placeholder: 'e.g., Buy on Amazon',
        },
        {
          name: 'url',
          label: 'URL',
          type: 'url',
          required: true,
          placeholder: 'https://...',
        },
        {
          name: 'type',
          label: 'Link Type',
          type: 'select',
          options: [
            { value: 'purchase', label: 'Purchase' },
            { value: 'docs', label: 'Documentation' },
            { value: 'download', label: 'Download' },
            { value: 'community', label: 'Community' },
          ],
        },
      ],
    },
    {
      name: 'pros',
      label: 'Pros',
      type: 'textarea',
      rows: 3,
      placeholder: 'One pro per line:\nBuilt-in display\nLong battery life\nEasy to flash',
      helpText: 'List advantages, one per line (optional)',
    },
    {
      name: 'cons',
      label: 'Cons',
      type: 'textarea',
      rows: 3,
      placeholder: 'One con per line:\nNo GPS\nExpensive\nLimited availability',
      helpText: 'List disadvantages, one per line (optional)',
    },
    {
      name: 'image',
      label: 'Image URL',
      type: 'url',
      placeholder: 'https://example.com/image.jpg',
      helpText: 'Link to product image (optional)',
    },
    {
      name: 'submitterEmail',
      label: 'Email',
      type: 'email',
      required: true,
      placeholder: 'your.email@example.com',
      helpText: 'For chsmesh.org contact only (not published on site)',
    },
  ],
  transformRules: [
    { field: 'pros', type: 'splitLines', optional: true },
    { field: 'cons', type: 'splitLines', optional: true },
  ],
  payloadRules: {
    add: {
      order: 999,
      featured: false,
    },
    filterArrayFields: ['links']
  },
  successMessage: '✓ Resource submitted successfully!',
  disclaimerText: 'By submitting, you agree that your resource recommendation will be publicly displayed on this website.',
};

// Relay Host Offer Configuration (the form on /relay-sites/)
//
// Contact only: the service forwards it to the moderators' Discord channel and
// writes nothing to the repository. It deliberately asks for a neighborhood
// rather than a street address; the address is exchanged privately later.
export const hostFormConfig: FormConfig = {
  id: 'host-form',
  kind: 'host',
  title: 'I can host a relay',
  description: 'Tell us roughly where the site is and how to reach you. A volunteer will get in touch to talk it through. Nothing is installed without your say-so.',
  fields: [
    {
      name: 'name',
      maxLength: 80,
      label: 'Your Name',
      type: 'text',
      required: true,
      placeholder: 'e.g., Jordan Smith',
    },
    {
      name: 'organization',
      maxLength: 120,
      label: 'Business or Organization',
      type: 'text',
      placeholder: 'Leave blank if this is your home',
      helpText: 'Optional',
    },
    {
      name: 'siteType',
      label: 'Kind of Site',
      type: 'select',
      required: true,
      placeholder: 'Select one...',
      options: [
        { value: 'business', label: 'Business or commercial building' },
        { value: 'church', label: 'Church or place of worship' },
        { value: 'school', label: 'School or campus' },
        { value: 'home', label: 'Home' },
        { value: 'tower', label: 'Tower, mast or water tank' },
        { value: 'other', label: 'Something else' },
      ],
    },
    {
      name: 'area',
      maxLength: 120,
      label: 'Neighborhood or Area',
      type: 'text',
      required: true,
      placeholder: 'e.g., James Island near Folly Road',
      helpText: 'Please do not enter a street address. A neighborhood or nearby cross streets is enough for now.',
    },
    {
      name: 'height',
      maxLength: 120,
      label: 'How High Is It?',
      type: 'text',
      placeholder: 'e.g., 3-story roof, about 40 feet',
      helpText: 'A rough guess is fine (optional)',
    },
    {
      name: 'power',
      label: 'Power at the Site',
      type: 'select',
      placeholder: 'Select one (optional)...',
      options: [
        { value: 'outlet', label: 'An outlet is available nearby' },
        { value: 'none', label: 'No power, it would need to be solar' },
        { value: 'unsure', label: 'Not sure' },
      ],
    },
    {
      name: 'notes',
      maxLength: 1000,
      label: 'Anything Else',
      type: 'textarea',
      rows: 4,
      placeholder: 'Roof access, who would need to approve it, good times to reach you, questions for us',
      helpText: 'Optional',
    },
    {
      name: 'submitterEmail',
      label: 'Email',
      type: 'email',
      required: true,
      placeholder: 'your.email@example.com',
    },
    {
      name: 'phone',
      maxLength: 40,
      label: 'Phone',
      type: 'text',
      placeholder: 'e.g., 843-555-0100',
      helpText: 'Optional, if you would rather get a call or text',
    },
  ],
  successMessage: '✓ Thank you! A CHS Mesh volunteer will be in touch.',
  disclaimerText: 'This goes privately to the CHS Mesh moderators. Nothing you enter here is published on this site.',
};
