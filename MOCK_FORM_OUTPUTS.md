# Mock Form Outputs - Quick Reference

This document shows example payloads for all three submission forms.

## 1. Node Submission (Map Page)

**Form Location**: `/map` page sidebar  
**Webhook ENV**: `PUBLIC_N8N_WEBHOOK_URL`

```json
{
  "name": "West Ashley Relay",
  "description": "Solar-powered relay on residential rooftop providing west-side coverage",
  "coordinates": {
    "lat": 32.7765,
    "lng": -80.0298
  },
  "type": "relay",
  "elevation": 35,
  "active": true,
  "owner": "CharlieM",
  "lastSeen": "2026-01-31",
  "submitterEmail": "charlie@example.com",
  "submittedAt": "2026-01-31T14:23:45.123Z"
}
```

**PR File**: `src/content/nodes/west-ashley-relay.json`

---

## 2. Guide Submission (Guides Page)

**Form Location**: `/guides` page bottom  
**Webhook ENV**: `PUBLIC_N8N_GUIDES_WEBHOOK_URL`

```json
{
  "title": "Setting Up Solar Power for Your Node",
  "description": "Complete guide to powering your Meshtastic node with solar energy for 24/7 operation",
  "content": "## Introduction\n\nSolar power enables true off-grid operation...\n\n## Materials Needed\n\n- 10W+ solar panel\n- 3.7V LiPo battery (2000mAh+)\n- TP4056 charge controller\n- Multimeter\n\n## Step 1: Choose Your Panel\n\nSelect a solar panel rated for at least 10 watts...\n\n## Step 2: Wire the Charge Controller\n\n...",
  "category": "hardware",
  "difficulty": "intermediate",
  "author": "SolarTech",
  "prerequisites": [
    "Basic soldering skills",
    "Multimeter",
    "Understanding of battery safety"
  ],
  "order": 999,
  "submitterEmail": "solar@example.com",
  "submittedAt": "2026-01-31T10:00:00.000Z"
}
```

**PR File**: `src/content/guides/setting-up-solar-power-for-your-node.md`

```markdown
---
title: Setting Up Solar Power for Your Node
description: Complete guide to powering your Meshtastic node with solar energy for 24/7 operation
category: hardware
difficulty: intermediate
author: SolarTech
prerequisites:
  - Basic soldering skills
  - Multimeter
  - Understanding of battery safety
order: 999
---

## Introduction

Solar power enables true off-grid operation...

## Materials Needed

- 10W+ solar panel
- 3.7V LiPo battery (2000mAh+)
- TP4056 charge controller
- Multimeter

## Step 1: Choose Your Panel

Select a solar panel rated for at least 10 watts...

## Step 2: Wire the Charge Controller

...
```

---

## 3. Meetup Submission (Meetups Page)

**Form Location**: `/meetups` page bottom  
**Webhook ENV**: `PUBLIC_N8N_MEETUPS_WEBHOOK_URL`

```json
{
  "title": "Monthly Mesh Meetup - February 2026",
  "description": "Monthly community gathering for Meshtastic enthusiasts to share knowledge and test equipment",
  "content": "Join us for our regular monthly meetup!\n\n## Agenda\n\n1. **2:00 PM** - Welcome & introductions\n2. **2:15 PM** - Network status update\n3. **2:30 PM** - Hardware demos (bring your devices!)\n4. **3:00 PM** - Range testing at the park\n5. **3:45 PM** - Q&A and troubleshooting\n\n## What to Bring\n\n- Your Meshtastic device(s)\n- Laptop or phone with Meshtastic app\n- Questions!\n\n## Parking\n\nFree parking available in the lot adjacent to the pavilion.",
  "date": "2026-02-15T14:00:00",
  "endDate": "2026-02-15T16:00:00",
  "location": "Shem Creek Park",
  "address": "508 Mill St, Mount Pleasant, SC 29464",
  "coordinates": {
    "lat": 32.7879,
    "lng": -79.8846
  },
  "rsvpLink": "https://discord.gg/chsmesh-february-meetup",
  "maxAttendees": 25,
  "featured": false,
  "submitterEmail": "organizer@example.com",
  "submittedAt": "2026-01-31T10:00:00.000Z"
}
```

**PR File**: `src/content/meetups/monthly-mesh-meetup-february-2026.md`

```markdown
---
title: Monthly Mesh Meetup - February 2026
description: Monthly community gathering for Meshtastic enthusiasts to share knowledge and test equipment
date: 2026-02-15T14:00:00
endDate: 2026-02-15T16:00:00
location: Shem Creek Park
address: 508 Mill St, Mount Pleasant, SC 29464
coordinates:
  lat: 32.7879
  lng: -79.8846
rsvpLink: https://discord.gg/chsmesh-february-meetup
maxAttendees: 25
featured: false
---

Join us for our regular monthly meetup!

## Agenda

1. **2:00 PM** - Welcome & introductions
2. **2:15 PM** - Network status update
3. **2:30 PM** - Hardware demos (bring your devices!)
4. **3:00 PM** - Range testing at the park
5. **3:45 PM** - Q&A and troubleshooting

## What to Bring

- Your Meshtastic device(s)
- Laptop or phone with Meshtastic app
- Questions!

## Parking

Free parking available in the lot adjacent to the pavilion.
```

---

## n8n Workflow Summary

Each webhook should:

1. **Validate** - Check required fields
2. **Sanitize** - Create slug from title/name
3. **Format** - Generate appropriate file format (JSON for nodes, Markdown for guides/meetups)
4. **Branch** - Create GitHub branch: `add-{type}-{slug}`
5. **Commit** - Commit file to appropriate directory
6. **PR** - Create pull request for review
7. **Notify** (optional) - Email submitter with PR link

## Field Filtering

Remember to **exclude** from committed files:
- `submitterEmail` (keep in PR description only)
- `submittedAt` (metadata, not needed in content)

These fields are for workflow tracking and notifications only.
