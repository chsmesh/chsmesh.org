# Network status (`/status`)

`/status` shows how the LoCoMesh Meshtastic network around Charleston is doing
right now: which fixed infrastructure is being heard, which gateways are
uploading, how busy the channel is, and which nodes were heard in the last day.

The page itself is static like the rest of the site. Its numbers come from the
**status service** (`services/status`), a small always-on collector that nginx
reaches at `/api/status/`.

```
nodes on the mesh ── RF ──► gateways (members' nodes with MQTT uplink)
                                │  upload to the LoCoMesh MQTT server
                                ▼
                       mqtt.locomesh.cc:8883 (TLS)
                                │  read-only login `chsmesh-status`
                                ▼
                 services/status ── /data/status-state.json (7 days)
                                │  GET /api/status/summary
                                ▼
                     nginx ──► /status page (fetches every 60 s)
```

## What it shows

| Section | Source |
| --- | --- |
| Nodes heard (24 h) | Any packet a gateway uploaded from the node |
| Infrastructure up | Sites in `services/status/infrastructure.json`. *Up* = heard in the last 6 h, *stale* = within 24 h, *down* = longer ago. *Unseen* (shown as "Not yet seen") = never heard and added to the list less than 7 days ago; after that a never-heard site is *down*. Unseen sites are left out of the headline count (`infrastructureUnseen` in the totals). Heard means its own packet was uploaded, it uploaded as a gateway, or it relayed a packet (its last ID byte in the relay field, credited only when no other known node shares that byte) |
| Last 7 days bars | One 3-hour block each, filled when the site was heard |
| Channel busy | `channelUtilization` from nodes' own device telemetry on LongFast (median of reports in the last 2 h; per site in the table) |
| Activity | Packets per hour, each packet counted once however many gateways uploaded it |
| Hops travelled | `hop_start - hop_limit` when a gateway heard the packet |
| Map | Positions from LongFast position packets and map reports, rounded to 2 decimal places (about 1 km) |
| Gateways | Nodes that uploaded in the last 24 h; online = within 30 min |

## Privacy

- Only **LongFast** is decoded, with the public default key. Every other channel
  (LoCo-Chat, private channels) is only counted, and channel names are never
  published.
- **Message text is never stored or published**, only counted.
- Positions are rounded to about 1 km before they are stored.
  `infrastructure.json` never lists coordinates; a site appears on the map only
  if the node broadcasts its own position.
- Broker usernames never appear. Gateways are shown by node name.
- Node names and IDs are shown; they are already public on LongFast and the
  public MQTT maps.

The snapshot states its own scope: a node shows up only if at least one gateway
uploading to the LoCoMesh MQTT server hears it.

## Configuration

The service reads only these variables. In every compose file they are passed
individually, so the service never sees the submissions service's secrets.

| Variable | Default | |
| --- | --- | --- |
| `STATUS_MQTT_PASSWORD` | *(empty)* | Password for the read-only broker login. Empty = the service runs but stays disconnected and serves an empty snapshot. **Secret**: in production a Komodo Variable. |
| `STATUS_MQTT_USERNAME` | `chsmesh-status` | Broker login (read access to `msh/US/SC/LoCo/#` only) |
| `STATUS_MQTT_URL` | `mqtts://mqtt.locomesh.cc:8883` | `mqtts://` (TLS) or `mqtt://` |
| `STATUS_MQTT_ROOT` | `msh/US/SC/LoCo` | Topic root to follow |
| `STATUS_DATA_DIR` | `/data` | Where state is saved every 5 minutes and on shutdown |
| `PORT` | `3001` | |

State lives in the `status-data` named volume, so history survives restarts
and redeploys. Losing it empties the charts until new uploads arrive, and
resets every site that is not currently heard to "Not yet seen" for 7 days
before it shows as down again.

### Adding or renaming infrastructure

Edit `services/status/infrastructure.json`: `id` is the Meshtastic node ID
(`!xxxxxxxx`), `name` and `area` are the public labels. Never add coordinates
(a test enforces this). Rebuild and redeploy the status image. A site the
collector has already heard as an ordinary node keeps that history; one it has
never heard reads "Not yet seen" for 7 days, then "Down".

## Endpoints

| Path | |
| --- | --- |
| `GET /api/status/summary` | Public JSON snapshot (cached 15 s in the service, `max-age=30` for browsers) |
| `GET /healthz` | `{ ok, mqtt: connected \| connecting \| disabled, messages, decodeErrors }` (not exposed through nginx) |

## Development

```bash
npm run test:status                       # service tests (Node 22, no install needed)
STATUS_MQTT_PASSWORD=... STATUS_DATA_DIR=/tmp/status node services/status/server.mjs
curl -s localhost:3001/api/status/summary | head -c 600
```

`docker compose up --build` runs the site, submissions and status together;
set `STATUS_MQTT_PASSWORD` in `.env` to connect.

The service has no dependencies: `services/status/mqtt.mjs` is a minimal MQTT
3.1.1 subscriber and `services/status/mesh.mjs` decodes just the Meshtastic
protobuf messages it needs. `test/status/fixtures.json` holds real
ServiceEnvelopes generated with `@meshtastic/protobufs` 2.8.0.
