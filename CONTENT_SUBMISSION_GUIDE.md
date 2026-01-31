# Content Submission Forms - n8n Integration Guide

This guide covers the integration of submission forms for **Nodes**, **Guides**, **Meetups**, and **Resources** with n8n webhooks.

## Setup Instructions

### 1. Configure Environment Variables

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` and set your n8n webhook URLs:
```env
PUBLIC_N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/submit-node
PUBLIC_N8N_GUIDES_WEBHOOK_URL=https://your-n8n-instance.com/webhook/submit-guide
PUBLIC_N8N_MEETUPS_WEBHOOK_URL=https://your-n8n-instance.com/webhook/submit-meetup
PUBLIC_N8N_RESOURCES_WEBHOOK_URL=https://your-n8n-instance.com/webhook/submit-resource
```

### 2. n8n Webhook Configuration

## Node Submissions

Location: `/map` page sidebar

#### Example Request Body

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
  "lastSeen": "2026-01-30",
  "submitterEmail": "charlie@example.com",
  "submittedAt": "2026-01-30T14:23:45.123Z"
}
```

#### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Display name for the node |
| `description` | string | No | Optional details about the node setup |
| `coordinates.lat` | number | Yes | Latitude (-90 to 90) |
| `coordinates.lng` | number | Yes | Longitude (-180 to 180) |
| `type` | enum | Yes | One of: `relay`, `router`, `client`, `solar` |
| `elevation` | number | No | Height above ground in feet |
| `active` | boolean | Yes | Always `true` (auto-set by form) |
| `owner` | string | No | Owner name or callsign |
| `lastSeen` | string | Yes | Date in YYYY-MM-DD format (auto-set to submission date) |
| `submitterEmail` | string | Yes | Email for PR notifications (not published) |
| `submittedAt` | string | Yes | ISO timestamp of submission (auto-set) |

### 3. n8n Workflow Steps

Your n8n workflow should perform these actions:

1. **Webhook Trigger** - Receive POST request
2. **Validate Data** - Check required fields exist
3. **Generate Filename** - Sanitize name and create slug: `{sanitized-name}.json`
4. **Create GitHub Branch** - Use GitHub API to create branch: `add-node-{sanitized-name}`
5. **Format JSON File** - Create properly formatted JSON without `submitterEmail` and `submittedAt`
6. **Commit File** - Commit to `src/content/nodes/{filename}.json` on new branch
7. **Create Pull Request** - Open PR with title: `Add node: {name}`
8. **Send Email** (optional) - Notify submitter that PR was created

#### Example n8n GitHub PR Body Template

```markdown
## New Node Submission

**Node Name:** {{$json.name}}
**Type:** {{$json.type}}
**Location:** {{$json.coordinates.lat}}, {{$json.coordinates.lng}}
**Owner:** {{$json.owner}}

### Description
{{$json.description}}

---
*Submitted via web form on {{$json.submittedAt}}*
*Submitter email: {{$json.submitterEmail}}*
```

#### JSON File to Commit (without submission metadata)

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
  "lastSeen": "2026-01-30"
}
```

### 4. CORS Configuration

Ensure your n8n webhook allows requests from your domain. In n8n webhook settings:

- **Response Mode**: `Respond When Last Node Finishes`
- **Response Code**: `200`
- **Response Headers**: 
  ```
  Access-Control-Allow-Origin: https://chsmesh.org
  Access-Control-Allow-Methods: POST, OPTIONS
  Access-Control-Allow-Headers: Content-Type
  ```

### 5. Testing the Integration

Use curl to test your n8n webhook before deploying:

```bash
curl -X POST https://your-n8n-instance.com/webhook/submit-node \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Node",
    "coordinates": {"lat": 32.7765, "lng": -80.0298},
    "type": "client",
    "active": true,
    "lastSeen": "2026-01-30",
    "submitterEmail": "test@example.com",
    "submittedAt": "2026-01-30T14:23:45.123Z"
  }'
```

Expected response: `200 OK`

### 6. Error Handling

The form will display user-friendly error messages if:
- Validation fails (invalid coordinates, missing required fields)
- Webhook URL not configured
- Network request fails
- HTTP error response from n8n

### 7. Deployment

After configuring `.env` with your webhook URL:

```bash
npm run build
npm run preview  # Test locally
# Deploy as usual
```

**Important**: Make sure `.env` is in `.gitignore` (already configured) and never commit your webhook URL.

## Security Notes

- The webhook URL is public (client-side), so add rate limiting in n8n if needed
- Consider adding authentication token in n8n for additional security
- Validate all input on the n8n side, not just client-side
- Filter `submitterEmail` from public JSON files (keep in PR body only)

---

## Guide Submissions

Location: `/guides` page bottom section

### Example Payload

```json
{
  "title": "Setting Up Solar Power for Your Node",
  "description": "Complete guide to powering your Meshtastic node with solar energy",
  "content": "## Introduction\n\nThis guide covers...\n\n## Materials Needed\n\n- Solar panel (10W+)\n- Battery (3.7V LiPo)\n...",
  "category": "hardware",
  "difficulty": "intermediate",
  "author": "SolarTech",
  "prerequisites": ["Basic soldering skills", "Multimeter"],
  "order": 999,
  "submitterEmail": "solar@example.com",
  "submittedAt": "2026-01-31T10:00:00.000Z"
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Guide title |
| `description` | string | Yes | Brief summary (appears in card) |
| `content` | string | Yes | Full guide content in Markdown format |
| `category` | enum | Yes | `getting-started`, `hardware`, `software`, `network`, `troubleshooting` |
| `difficulty` | enum | Yes | `beginner`, `intermediate`, `advanced` |
| `author` | string | No | Author name or callsign |
| `prerequisites` | array | No | List of prerequisite skills/items |
| `order` | number | Yes | Sort order (auto-set to 999, adjust during review) |
| `submitterEmail` | string | Yes | Email for PR notifications (not published) |
| `submittedAt` | string | Yes | ISO timestamp (auto-set) |

### n8n Workflow Steps

1. Receive webhook POST
2. Validate required fields
3. Generate filename: `src/content/guides/{slug-from-title}.md`
4. Create frontmatter YAML + markdown content
5. Create GitHub branch: `add-guide-{slug}`
6. Commit markdown file to branch
7. Create PR with title: "Add guide: {title}"

### File Format to Commit

```markdown
---
title: Setting Up Solar Power for Your Node
description: Complete guide to powering your Meshtastic node with solar energy
category: hardware
difficulty: intermediate
author: SolarTech
prerequisites:
  - Basic soldering skills
  - Multimeter
order: 999
---

## Introduction

This guide covers...

## Materials Needed

- Solar panel (10W+)
- Battery (3.7V LiPo)
...
```

---

## Meetup Submissions

Location: `/meetups` page bottom section

### Example Payload

```json
{
  "title": "Monthly Mesh Meetup - February 2026",
  "description": "Monthly community gathering for Meshtastic enthusiasts",
  "content": "## Agenda\n\n1. Network updates\n2. Hardware demos\n3. Q&A session\n\n## What to Bring\n\n- Your Meshtastic device\n- Laptop (optional)",
  "date": "2026-02-15T14:00:00",
  "endDate": "2026-02-15T16:00:00",
  "location": "Shem Creek Park",
  "address": "508 Mill St, Mount Pleasant, SC 29464",
  "coordinates": {
    "lat": 32.7879,
    "lng": -79.8846
  },
  "rsvpLink": "https://discord.gg/example-event",
  "maxAttendees": 25,
  "featured": false,
  "submitterEmail": "organizer@example.com",
  "submittedAt": "2026-01-31T10:00:00.000Z"
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Event title |
| `description` | string | Yes | Brief summary (appears in card) |
| `content` | string | No | Detailed event info in Markdown format |
| `date` | string | Yes | ISO datetime (start) |
| `endDate` | string | No | ISO datetime (end) |
| `location` | string | Yes | Venue name |
| `address` | string | No | Full street address |
| `coordinates` | object | No | `{lat: number, lng: number}` for map |
| `rsvpLink` | string | No | URL for RSVP/more info |
| `maxAttendees` | number | No | Venue capacity |
| `featured` | boolean | Yes | Always `false` (auto-set) |
| `submitterEmail` | string | Yes | Email for PR notifications (not published) |
| `submittedAt` | string | Yes | ISO timestamp (auto-set) |

### n8n Workflow Steps

1. Receive webhook POST
2. Validate required fields and date format
3. Generate filename: `src/content/meetups/{slug-from-title}.md`
4. Create frontmatter YAML + markdown content
5. Create GitHub branch: `add-meetup-{slug}`
6. Commit markdown file to branch
7. Create PR with title: "Add meetup: {title}"

### File Format to Commit

```markdown
---
title: Monthly Mesh Meetup - February 2026
description: Monthly community gathering for Meshtastic enthusiasts
date: 2026-02-15T14:00:00
endDate: 2026-02-15T16:00:00
location: Shem Creek Park
address: 508 Mill St, Mount Pleasant, SC 29464
coordinates:
  lat: 32.7879
  lng: -79.8846
rsvpLink: https://discord.gg/example-event
maxAttendees: 25
featured: false
---

## Agenda

1. Network updates
2. Hardware demos
3. Q&A session

## What to Bring

- Your Meshtastic device
- Laptop (optional)
```

---

## Resource Submissions

Location: `/resources` page bottom section

### Example Payload

```json
{
  "title": "Heltec V3 LoRa Board",
  "description": "Feature-rich ESP32-based board with built-in display, GPS, and excellent battery life",
  "content": "## Overview\n\nThe Heltec V3 is a popular choice for Meshtastic nodes...\n\n## Specifications\n\n- ESP32-S3 processor\n- 0.96\" OLED display\n- Built-in GPS\n- LoRa 868/915MHz\n- USB-C charging\n\n## Setup Notes\n\nFlashing is straightforward using the web flasher...",
  "category": "devices",
  "priceRange": "$25-35",
  "links": [
    {
      "label": "Buy on AliExpress",
      "url": "https://www.aliexpress.com/item/...",
      "type": "purchase"
    },
    {
      "label": "Official Documentation",
      "url": "https://heltec.org/project/...",
      "type": "docs"
    }
  ],
  "pros": [
    "Built-in display",
    "Integrated GPS",
    "Long battery life",
    "Easy to flash"
  ],
  "cons": [
    "Display can be hard to read in sunlight",
    "GPS antenna placement matters"
  ],
  "image": "https://example.com/heltec-v3.jpg",
  "order": 999,
  "featured": false,
  "submitterEmail": "tech@example.com",
  "submittedAt": "2026-01-31T12:00:00.000Z"
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Resource name |
| `description` | string | Yes | Brief overview (appears in card) |
| `content` | string | No | Detailed info in Markdown format |
| `category` | enum | Yes | `devices`, `accessories`, `software`, `firmware`, `community` |
| `priceRange` | string | No | Approximate price (e.g., "$25-35", "Free") |
| `links` | array | No | Array of `{label, url, type?}` objects |
| `pros` | array | No | List of advantages |
| `cons` | array | No | List of disadvantages |
| `image` | string | No | URL to product image |
| `order` | number | Yes | Sort order (auto-set to 999, adjust during review) |
| `featured` | boolean | Yes | Always `false` (auto-set) |
| `submitterEmail` | string | Yes | Email for PR notifications (not published) |
| `submittedAt` | string | Yes | ISO timestamp (auto-set) |

### n8n Workflow Steps

1. Receive webhook POST
2. Validate required fields
3. Generate filename: `src/content/resources/{slug-from-title}.md`
4. Create frontmatter YAML + markdown content
5. Create GitHub branch: `add-resource-{slug}`
6. Commit markdown file to branch
7. Create PR with title: "Add resource: {title}"

### File Format to Commit

```markdown
---
title: Heltec V3 LoRa Board
description: Feature-rich ESP32-based board with built-in display, GPS, and excellent battery life
category: devices
priceRange: $25-35
links:
  - label: Buy on AliExpress
    url: https://www.aliexpress.com/item/...
    type: purchase
  - label: Official Documentation
    url: https://heltec.org/project/...
    type: docs
pros:
  - Built-in display
  - Integrated GPS
  - Long battery life
  - Easy to flash
cons:
  - Display can be hard to read in sunlight
  - GPS antenna placement matters
image: https://example.com/heltec-v3.jpg
order: 999
featured: false
---

## Overview

The Heltec V3 is a popular choice for Meshtastic nodes...

## Specifications

- ESP32-S3 processor
- 0.96" OLED display
- Built-in GPS
- LoRa 868/915MHz
- USB-C charging

## Setup Notes

Flashing is straightforward using the web flasher...
```

---

## Maintenance

When a PR is merged:
1. Rebuild the site to include new content
2. **Nodes**: Appear in registered nodes table, stats bar updates
3. **Guides**: Appear in appropriate category section
4. **Meetups**: Listed as upcoming (if date is future) or past
5. **Resources**: Grouped by category, sorted by featured then order
