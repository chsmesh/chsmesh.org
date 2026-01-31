# Node Submission Form - n8n Integration Guide

## Setup Instructions

### 1. Configure Environment Variable

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` and set your n8n webhook URL:
```env
PUBLIC_N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/submit-node
```

### 2. n8n Webhook Configuration

Your n8n workflow should expect a POST request with this payload structure:

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

## Maintenance

When a PR is merged:
1. Rebuild the site to include the new node
2. New node will appear in the registered nodes table
3. Stats bar will update automatically
