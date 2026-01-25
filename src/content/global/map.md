---
type: map
pageTitle: Network Map
pageDescription: Explore the Charleston Meshtastic mesh network - view node locations, coverage areas, and network statistics
hero:
  title: Network Map
  subtitle: Explore our growing mesh network across the Lowcountry
  size: small
stats:
  - key: total
    label: Total Active
    colorClass: text-primary-600
  - key: relay
    label: Relays
    colorClass: text-purple-600
  - key: router
    label: Routers
    colorClass: text-blue-600
  - key: solar
    label: Solar Nodes
    colorClass: text-yellow-600
  - key: client
    label: Clients
    colorClass: text-gray-600
map:
  heading: Interactive Map Coming Soon
  body: We're working on an interactive map showing all registered nodes in the Charleston area.
  cta:
    label: View on MeshMap.net
    href: https://meshmap.net/#14.5/32.7909/-79.9388
    variant: primary
empty:
  heading: No Nodes Registered
  body: Be the first to add your node to the map!
legend:
  heading: Node Types
  items:
    - label: Relay
      description: High-power fixed nodes
      colorClass: bg-purple-500
    - label: Router
      description: Always-on routing nodes
      colorClass: bg-blue-500
    - label: Solar
      description: Solar-powered nodes
      colorClass: bg-yellow-500
    - label: Client
      description: Mobile/portable nodes
      colorClass: bg-gray-400
addNode:
  heading: Add Your Node
  body: Got a node? Help us map the network! Submit your node location to appear on the map.
  cta:
    label: Submit Node
    href: https://github.com/chsmesh/chsmesh.org/issues/new?template=add-node.md
    variant: primary
coverage:
  heading: Coverage Goals
  body: "We're working to provide mesh coverage across the Charleston metro area, including:"
  locations:
    - label: Downtown Charleston (planned)
      status: planned
    - label: Mount Pleasant (planned)
      status: planned
    - label: "James Island (in progress)"
      status: progress
    - label: "West Ashley (planned)"
      status: planned
    - label: "North Charleston (planned)"
      status: planned
externalMaps:
  heading: External Maps
  links:
    - label: MeshMap.net
      href: https://meshmap.net
      external: true
    - label: Liam's Map
      href: https://meshtastic.liamcottle.net
      external: true
registeredNodes:
  heading: Registered Nodes
  table:
    name: Name
    type: Type
    elevation: Elevation
    lastSeen: Last Seen
---
