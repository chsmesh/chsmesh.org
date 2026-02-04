import { defineCollection, z } from 'astro:content';

// Meetups collection - community events and gatherings
const meetups = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    location: z.string(),
    address: z.string().optional(),
    description: z.string(),
    featured: z.boolean().default(false),
    rsvpLink: z.string().url().optional(),
    coordinates: z
      .object({
        lat: z.number(),
        lng: z.number(),
      })
      .optional(),
    maxAttendees: z.number().optional(),
    recurring: z
      .object({
        frequency: z.enum(['weekly', 'biweekly', 'monthly']),
        day: z.string().optional(),
      })
      .optional(),
  }),
});

// Guides collection - tutorials and how-to articles
const guides = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
    category: z.enum([
      'getting-started',
      'hardware',
      'software',
      'network',
      'troubleshooting',
    ]),
    order: z.number().default(0),
    readingTime: z.number().optional(), // in minutes
    prerequisites: z.array(z.string()).default([]),
    lastUpdated: z.coerce.date().optional(),
    author: z.string().optional(),
  }),
});

// Resources collection - device recommendations and external links
const resources = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum([
      'devices',
      'accessories',
      'software',
      'firmware',
      'community',
    ]),
    order: z.number().default(0),
    featured: z.boolean().default(false),
    links: z
      .array(
        z.object({
          label: z.string(),
          url: z.string().url(),
          type: z.enum(['purchase', 'docs', 'download', 'community']).optional(),
        })
      )
      .default([]),
    priceRange: z.string().optional(),
    pros: z.array(z.string()).default([]),
    cons: z.array(z.string()).default([]),
    image: z.string().optional(),
  }),
});

// Nodes collection - for the map page
const nodes = defineCollection({
  type: 'data',
  schema: z.object({
    name: z.string(),
    description: z.string().optional(),
    coordinates: z.object({
      lat: z.number(),
      lng: z.number(),
    }),
    type: z.enum(['relay', 'router', 'client', 'solar']).default('client'),
    elevation: z.number().optional(), // in feet
    active: z.boolean().default(true),
    owner: z.string().optional(),
    lastSeen: z.coerce.date().optional(),
  }),
});

const taxonomyItem = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
});

// Taxonomies - labels and icons for categories, difficulties, statuses
const taxonomies = defineCollection({
  type: 'content',
  schema: z.object({
    guideCategories: z.array(taxonomyItem).default([]),
    guideDifficulties: z.array(taxonomyItem).default([]),
    resourceCategories: z.array(taxonomyItem).default([]),
    meetupStatuses: z.array(taxonomyItem).default([]),
    meetupBadges: z.array(taxonomyItem).default([]),
  }),
});

const linkSchema = z.object({
  label: z.string(),
  href: z.string(),
  external: z.boolean().optional(),
});

const ctaSchema = z.object({
  label: z.string(),
  href: z.string(),
  variant: z.enum(['primary', 'secondary', 'outline', 'ghost']).optional(),
});

// Global content - site metadata, navigation, and page copy
const global = defineCollection({
  type: 'content',
  schema: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('navigation'),
      title: z.string().optional(),
      links: z.array(linkSchema),
    }),
    z.object({
      type: z.literal('site'),
      title: z.string(),
      description: z.string(),
      links: z.record(z.string()).optional(),
      social: z
        .array(
          z.object({
            platform: z.string(),
            url: z.string().url(),
            label: z.string().optional(),
          })
        )
        .optional(),
    }),
    z.object({
      type: z.literal('home'),
      pageTitle: z.string(),
      pageDescription: z.string(),
      hero: z.object({
        title: z.string(),
        subtitle: z.string(),
        size: z.enum(['small', 'large']).optional(),
        ctas: z.array(ctaSchema).default([]),
      }),
      stats: z
        .array(
          z.object({
            value: z.string(),
            label: z.string(),
          })
        )
        .default([]),
      intro: z.object({
        heading: z.string(),
        body: z.string(),
      }),
      features: z
        .array(
          z.object({
            title: z.string(),
            description: z.string(),
            icon: z.string(),
          })
        )
        .default([]),
      meetupsSection: z.object({
        heading: z.string(),
        cta: ctaSchema,
      }),
      guidesSection: z.object({
        heading: z.string(),
        cta: ctaSchema,
      }),
      cta: z.object({
        heading: z.string(),
        body: z.string(),
        ctas: z.array(ctaSchema).default([]),
      }),
    }),
    z.object({
      type: z.literal('about'),
      pageTitle: z.string(),
      pageDescription: z.string(),
      hero: z.object({
        title: z.string(),
        subtitle: z.string(),
        size: z.enum(['small', 'large']).optional(),
      }),
      mission: z.object({
        heading: z.string(),
        intro: z.string(),
        leadIn: z.string(),
        bullets: z
          .array(
            z.object({
              title: z.string(),
              description: z.string(),
            })
          )
          .default([]),
        outro: z.string(),
      }),
      getInvolved: z.object({
        heading: z.string(),
        cards: z
          .array(
            z.object({
              title: z.string(),
              description: z.string(),
              icon: z.string().optional(),
              cta: ctaSchema,
            })
          )
          .default([]),
      }),
      community: z.object({
        heading: z.string(),
        intro: z.string(),
        roles: z
          .array(
            z.object({
              name: z.string(),
              description: z.string(),
            })
          )
          .default([]),
        ctaText: z.string(),
        ctaLabel: z.string(),
        ctaHref: z.string(),
      }),
      faqs: z
        .array(
          z.object({
            question: z.string(),
            answer: z.string(),
          })
        )
        .default([]),
      contactCta: z.object({
        heading: z.string(),
        body: z.string(),
        ctas: z.array(ctaSchema).default([]),
      }),
    }),
    z.object({
      type: z.literal('map'),
      pageTitle: z.string(),
      pageDescription: z.string(),
      hero: z.object({
        title: z.string(),
        subtitle: z.string(),
        size: z.enum(['small', 'large']).optional(),
      }),
      stats: z
        .array(
          z.object({
            key: z.enum(['total', 'relay', 'router', 'solar', 'client']),
            label: z.string(),
            colorClass: z.string().optional(),
          })
        )
        .default([]),
      map: z.object({
        heading: z.string(),
        body: z.string(),
        cta: ctaSchema,
      }),
      empty: z.object({
        heading: z.string(),
        body: z.string(),
      }),
      legend: z.object({
        heading: z.string(),
        items: z
          .array(
            z.object({
              label: z.string(),
              description: z.string(),
              colorClass: z.string(),
            })
          )
          .default([]),
      }),
      addNode: z.object({
        heading: z.string(),
        body: z.string(),
        cta: ctaSchema,
      }),
      coverage: z.object({
        heading: z.string(),
        body: z.string(),
        locations: z
          .array(
            z.object({
              label: z.string(),
              status: z.enum(['complete', 'progress', 'planned']),
            })
          )
          .default([]),
      }),
      externalMaps: z.object({
        heading: z.string(),
        links: z.array(linkSchema).default([]),
      }),
      registeredNodes: z.object({
        heading: z.string(),
        table: z.object({
          name: z.string(),
          type: z.string(),
          elevation: z.string(),
          lastSeen: z.string(),
        }),
      }),
    }),
    z.object({
      type: z.literal('guides'),
      pageTitle: z.string(),
      pageDescription: z.string(),
      hero: z.object({
        title: z.string(),
        subtitle: z.string(),
        size: z.enum(['small', 'large']).optional(),
      }),
      empty: z.object({
        heading: z.string(),
        body: z.string(),
        cta: ctaSchema,
      }),
      contribute: z.object({
        heading: z.string(),
        body: z.string(),
        cta: ctaSchema,
      }),
    }),
    z.object({
      type: z.literal('guides-detail'),
      backLabel: z.string(),
      prerequisitesHeading: z.string(),
      relatedHeading: z.string(),
      feedback: z.object({
        question: z.string(),
        reportLabel: z.string(),
        reportUrlTemplate: z.string(),
        improveLabel: z.string(),
        improveUrl: z.string(),
      }),
    }),
    z.object({
      type: z.literal('meetups'),
      pageTitle: z.string(),
      pageDescription: z.string(),
      hero: z.object({
        title: z.string(),
        subtitle: z.string(),
        size: z.enum(['small', 'large']).optional(),
      }),
      upcomingHeading: z.string(),
      pastHeading: z.string(),
      empty: z.object({
        heading: z.string(),
        body: z.string(),
        cta: ctaSchema,
      }),
      host: z.object({
        heading: z.string(),
        body: z.string(),
        cta: ctaSchema,
      }),
    }),
    z.object({
      type: z.literal('meetups-detail'),
      backLabel: z.string(),
      dateTimeHeading: z.string(),
      locationHeading: z.string(),
      openMapsLabel: z.string(),
      rsvpLabel: z.string(),
      maxAttendeesLabel: z.string(),
      recurringLabel: z.string(),
      mapHeading: z.string(),
      mapBody: z.string(),
      mapCtaLabel: z.string(),
    }),
    z.object({
      type: z.literal('resources'),
      pageTitle: z.string(),
      pageDescription: z.string(),
      hero: z.object({
        title: z.string(),
        subtitle: z.string(),
        size: z.enum(['small', 'large']).optional(),
      }),
      empty: z.object({
        heading: z.string(),
        body: z.string(),
        cta: ctaSchema,
      }),
      quickStart: z.object({
        heading: z.string(),
        body: z.string(),
      }),
      disclaimer: z.object({
        body: z.string(),
      }),
    }),
    z.object({
      type: z.literal('footer'),
      brandName: z.string(),
      about: z.object({
        title: z.string(),
        body: z.string(),
      }),
      quickLinks: z.object({
        heading: z.string(),
        links: z.array(linkSchema).default([]),
      }),
      community: z.object({
        heading: z.string(),
        links: z.array(linkSchema).default([]),
      }),
      legal: z.object({
        copyright: z.string(),
        trademark: z.string(),
      }),
    }),
  ]),
});

export const collections = {
  meetups,
  guides,
  resources,
  nodes,
  taxonomies,
  global,
};
