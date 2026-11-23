import { defineCollection, reference, z } from 'astro:content';

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
    // Show the local mesh settings card (src/content/global/mesh.md) above the
    // guide, so channel settings are written down in one place only.
    meshSettings: z.boolean().default(false),
    // Include this guide in the field handbook (/handbook/ and its PDF). Keep
    // it to what someone needs in hand when the internet is down.
    handbook: z.boolean().default(false),
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

// Builds collection - the member build gallery at /builds/. Photos live in
// src/assets/builds/ and are referenced relative to the entry file, so they go
// through Astro's asset pipeline (hashed file names under /_astro/, intrinsic
// width and height on every <img>). Entries arrive through the public form
// (services/submissions, which strips photo metadata) or the CMS.
const builds = defineCollection({
  type: 'content',
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      // Name, handle or callsign to credit. Whatever the builder chose to give.
      builder: z.string(),
      description: z.string(),
      // When the build was added; the gallery lists newest first.
      date: z.coerce.date(),
      featured: z.boolean().default(false),
      // The first photo is the cover.
      photos: z
        .array(
          z.object({
            image: image(),
            alt: z.string(),
          })
        )
        .min(1)
        .max(6),
      hardware: z
        .array(
          z.object({
            name: z.string(),
            // Links the item to its entry on /resources/. Without it, an item
            // whose name is exactly a resource's title is linked anyway.
            resource: reference('resources').optional(),
          })
        )
        .default([]),
      // Neighborhood level only, never an address.
      area: z.string().optional(),
      // The node's name on the mesh, as listed on /status/.
      nodeName: z.string().optional(),
      // The node's entry on a mesh map, if the builder wants it linked.
      mapLink: z.string().url().optional(),
    }),
});

// Glossary collection - plain-language definitions of mesh jargon. One JSON
// file per term; the file name is the entry's anchor on /glossary/. JSON (not
// markdown) so src/utils/glossary.mjs can read the terms for the auto-linking
// rehype plugin without a YAML parser.
const glossary = defineCollection({
  type: 'data',
  schema: z.object({
    term: z.string().min(1),
    // Shown in the hover tooltip on auto-linked terms, so it has to stay short.
    definition: z.string().min(1).max(200),
    // Optional longer explanation; blank lines separate paragraphs.
    explanation: z.string().optional(),
    // Other spellings that should auto-link to this entry.
    aliases: z.array(z.string()).default([]),
    // File names (without .json) of related entries.
    related: z.array(z.string()).default([]),
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
      // Featured builds from the gallery; hidden while none is featured.
      buildsSection: z.object({
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
      type: z.literal('relay-sites'),
      pageTitle: z.string(),
      pageDescription: z.string(),
      hero: z.object({
        title: z.string(),
        subtitle: z.string(),
        size: z.enum(['small', 'large']).optional(),
        ctas: z.array(ctaSchema).default([]),
      }),
      intro: z.object({
        heading: z.string(),
        body: z.string(),
      }),
      hosting: z.object({
        heading: z.string(),
        body: z.string(),
        points: z
          .array(
            z.object({
              title: z.string(),
              description: z.string(),
            })
          )
          .default([]),
      }),
      hosts: z.object({
        heading: z.string(),
        body: z.string(),
        items: z
          .array(
            z.object({
              title: z.string(),
              description: z.string(),
            })
          )
          .default([]),
      }),
      // Neighborhood level only. Never list an address, a building name or
      // anything else that identifies a host or a prospective host.
      areas: z.object({
        heading: z.string(),
        body: z.string(),
        updated: z.coerce.date().optional(),
        updatedLabel: z.string(),
        empty: z.string(),
        items: z
          .array(
            z.object({
              name: z.string(),
              need: z.string(),
            })
          )
          .default([]),
      }),
      offer: z.object({
        heading: z.string(),
        body: z.string(),
      }),
      faq: z.object({
        heading: z.string(),
        items: z
          .array(
            z.object({
              question: z.string(),
              answer: z.string(),
            })
          )
          .default([]),
      }),
      contactCta: z.object({
        heading: z.string(),
        body: z.string(),
        ctas: z.array(ctaSchema).default([]),
      }),
    }),
    z.object({
      type: z.literal('status'),
      pageTitle: z.string(),
      pageDescription: z.string(),
      hero: z.object({
        title: z.string(),
        subtitle: z.string(),
        size: z.enum(['small', 'large']).optional(),
      }),
      scope: z.string(),
      stats: z
        .array(
          z.object({
            key: z.enum(['activeNodes', 'infrastructure', 'gatewaysOnline', 'packets24h', 'channelUtilization']),
            label: z.string(),
          })
        )
        .default([]),
      infrastructure: z.object({ heading: z.string(), body: z.string() }),
      activity: z.object({ heading: z.string(), body: z.string() }),
      hops: z.object({ heading: z.string(), body: z.string() }),
      map: z.object({
        heading: z.string(),
        body: z.string(),
        // Link under the map, to the relay host recruiting page.
        // nullish: the CMS may save a removed object as null.
        cta: ctaSchema.nullish(),
      }),
      gateways: z.object({ heading: z.string(), body: z.string() }),
      nodes: z.object({ heading: z.string() }),
      // Other projects' maps, for a wider view than our own gateways give.
      externalMaps: z.object({
        heading: z.string(),
        links: z.array(linkSchema).default([]),
      }),
      unavailable: z.object({ heading: z.string(), body: z.string() }),
      // Shown when the service answers but is not receiving uploads.
      paused: z.object({ heading: z.string(), body: z.string() }),
    }),
    z.object({
      // What a radio needs to join the local mesh. The one place these
      // settings are written down: guides marked `meshSettings: true` show
      // them as a card (src/components/MeshSettings.astro) instead of
      // repeating them.
      type: z.literal('mesh'),
      heading: z.string(),
      // Not `body`: the CMS writes a top-level field of that name as the
      // file's markdown content, not into the frontmatter.
      intro: z.string(),
      // When someone last checked these against the live mesh.
      reviewed: z.coerce.date().optional(),
      reviewedLabel: z.string(),
      settings: z
        .array(
          z.object({
            label: z.string(),
            value: z.string(),
            note: z.string().optional(),
          })
        )
        .default([]),
      channelsHeading: z.string(),
      channelLabels: z.object({
        name: z.string(),
        slot: z.string(),
        key: z.string(),
        primary: z.string(),
        secondary: z.string(),
      }),
      channels: z
        .array(
          z.object({
            name: z.string(),
            slot: z.enum(['primary', 'secondary']),
            // As typed into the app. Only ever a key the mesh already
            // publishes; a private channel's key does not belong here.
            key: z.string(),
            note: z.string().optional(),
          })
        )
        .min(1),
      // One-tap import. `url` is a Meshtastic channel link; the QR code is
      // drawn from it at build time. test/site/mesh-settings.test.mjs checks
      // that it agrees with the settings and channels listed above.
      share: z.object({
        heading: z.string(),
        body: z.string(),
        url: z.string().url().startsWith('https://meshtastic.org/e/'),
        buttonLabel: z.string(),
        qrAlt: z.string(),
        warning: z.string().optional(),
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
      type: z.literal('builds'),
      pageTitle: z.string(),
      pageDescription: z.string(),
      hero: z.object({
        title: z.string(),
        subtitle: z.string(),
        size: z.enum(['small', 'large']).optional(),
      }),
      submitLabel: z.string(),
      empty: z.object({
        heading: z.string(),
        body: z.string(),
      }),
      contribute: z.object({
        heading: z.string(),
        body: z.string(),
      }),
      // Labels on /builds/<slug>/.
      detail: z.object({
        backLabel: z.string(),
        builderLabel: z.string(),
        hardwareHeading: z.string(),
        areaLabel: z.string(),
        nodeLabel: z.string(),
        mapLinkLabel: z.string(),
        moreHeading: z.string(),
      }),
    }),
    z.object({
      type: z.literal('glossary'),
      pageTitle: z.string(),
      pageDescription: z.string(),
      hero: z.object({
        title: z.string(),
        subtitle: z.string(),
        size: z.enum(['small', 'large']).optional(),
      }),
      alsoKnownAsLabel: z.string(),
      relatedLabel: z.string(),
      empty: z.object({
        heading: z.string(),
        body: z.string(),
      }),
    }),
    z.object({
      type: z.literal('guides-detail'),
      backLabel: z.string(),
      prerequisitesHeading: z.string(),
      relatedHeading: z.string(),
      // The "Download PDF" button in the guide header.
      download: z.object({
        label: z.string(),
        hint: z.string(),
      }),
      feedback: z.object({
        question: z.string(),
        reportLabel: z.string(),
        reportUrlTemplate: z.string(),
        improveLabel: z.string(),
        improveUrl: z.string(),
      }),
    }),
    z.object({
      type: z.literal('handbook'),
      pageTitle: z.string(),
      pageDescription: z.string(),
      hero: z.object({
        title: z.string(),
        subtitle: z.string(),
        size: z.enum(['small', 'large']).optional(),
      }),
      intro: z.string(),
      downloadLabel: z.string(),
      // Followed by the build date, e.g. "Generated November 22, 2026".
      generatedLabel: z.string(),
      contentsHeading: z.string(),
      glossaryHeading: z.string(),
      // The callout on the guides index.
      promo: z.object({
        heading: z.string(),
        body: z.string(),
        downloadLabel: z.string(),
        viewLabel: z.string(),
      }),
    }),
    z.object({
      // Offline reading: the /offline/ fallback page and the labels the
      // service worker's UI uses on every page.
      type: z.literal('offline'),
      pageTitle: z.string(),
      pageDescription: z.string(),
      hero: z.object({
        title: z.string(),
        subtitle: z.string(),
        size: z.enum(['small', 'large']).optional(),
      }),
      savedHeading: z.string(),
      savedBody: z.string(),
      guidesLabel: z.string(),
      // Badge shown on a page once it is saved on the visitor's device.
      indicatorLabel: z.string(),
      // Strip under the header while the browser has no connection.
      bannerText: z.string(),
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
  builds,
  glossary,
  taxonomies,
  global,
};
