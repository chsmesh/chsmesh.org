---
type: status
pageTitle: Network Status
pageDescription: Live health of the LoCoMesh Meshtastic network around Charleston - infrastructure, gateways, activity and channel load
hero:
  title: Network Status
  subtitle: How the Lowcountry mesh is doing right now
  size: small
scope: >-
  Built from what gateways upload to the LoCoMesh MQTT server. A node shows up
  here when at least one gateway hears it, so quiet corners of the mesh may be
  missing. Positions are rounded to about 1 km and message text is never
  collected.
stats:
  - key: activeNodes
    label: Nodes heard (24 h)
  - key: infrastructure
    label: Infrastructure up
  - key: gatewaysOnline
    label: Gateways online
  - key: packets24h
    label: Packets (24 h)
  - key: channelUtilization
    label: Channel busy (median)
infrastructure:
  heading: Infrastructure
  body: Fixed routers and rooftop nodes. Up = heard in the last 6 hours, stale = within a day, down = not heard in the last day. Not yet seen = added in the last 7 days and not heard yet (new, or out of reach of the gateways that upload to us); after 7 days it counts as down. The headline count leaves out sites not yet seen. Each bar is one 3-hour block over the last 7 days, filled when the node was heard (its own packets, its uploads, or traffic it relayed).
activity:
  heading: Activity
  body: Packets uploaded per hour over the last 24 hours, each packet counted once however many gateways heard it.
hops:
  heading: Hops travelled
  body: How many relays a packet had passed through when a gateway heard it.
map:
  heading: Where nodes are
  body: Nodes that share a position, rounded to about 1 km.
gateways:
  heading: Gateways
  body: Nodes uploading to the LoCoMesh MQTT server in the last 24 hours. Want to add one? Ask in the Discord.
nodes:
  heading: Nodes heard in the last 24 hours
externalMaps:
  heading: Other maps
  links:
    - label: MeshMap.net
      href: https://meshmap.net
      external: true
    - label: Liam's Map
      href: https://meshtastic.liamcottle.net
      external: true
unavailable:
  heading: Status data is unavailable
  body: The status service is not answering right now. The rest of the site is unaffected; try again in a few minutes.
paused:
  heading: Live data is paused
  body: The status service is not receiving uploads from the LoCoMesh MQTT server right now, so this page shows the last picture it had. Nodes may read as stale or down until uploads resume; that reflects the gap in our data, not necessarily the mesh.
---
