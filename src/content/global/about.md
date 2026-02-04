---
type: about
pageTitle: About
pageDescription: Learn about the Charleston Meshtastic community - our mission, how to get involved, and frequently asked questions
hero:
  title: About CHS Mesh
  subtitle: Building resilient, community-owned communication infrastructure in Charleston
  size: small
mission:
  heading: Our Mission
  intro: >-
    CHS Mesh is a volunteer-run community group dedicated to building and maintaining an open, decentralized mesh communication network across the Charleston, South Carolina area.
  leadIn: "We believe in the power of community-owned infrastructure. Our mesh network provides:"
  bullets:
    - title: Emergency resilience
      description: When cell towers fail during hurricanes or disasters, our network keeps working
    - title: Privacy
      description: No tracking, no data collection, no corporate surveillance
    - title: Accessibility
      description: Free to use with affordable hardware (under $50 to get started)
    - title: Education
      description: Learn about radio technology, networking, and open-source hardware
  outro: Whether you're interested in emergency preparedness, outdoor adventures, privacy-focused communication, or just love tinkering with technology, you're welcome here.
getInvolved:
  heading: Get Involved
  cards:
    - title: Join the Chat
      description: Connect with local mesh enthusiasts on Discord. Ask questions, share experiences, and stay updated.
      icon: chat
      cta:
        label: Join Discord
        href: https://discord.gg/8Btn3fck2U
        variant: primary
    - title: Attend a Meetup
      description: Meet other members in person, get help with your setup, and learn from experienced operators.
      icon: calendar
      cta:
        label: View Meetups
        href: /meetups
        variant: primary
    - title: Run a Node
      description: Expand network coverage by setting up your own node. Even a simple client helps the mesh!
      icon: radio
      cta:
        label: Get Hardware
        href: /resources
        variant: primary
community:
  heading: Our Community
  intro: >-
    CHS Mesh is run entirely by volunteers who are passionate about open communication technology. We're always looking for help with:
  roles:
    - name: Community Organizers
      description: Volunteers who help coordinate meetups and events
    - name: Technical Contributors
      description: Members who help with node setup and network planning
    - name: Content Creators
      description: Contributors who write guides and documentation
  ctaText: Interested in helping out?
  ctaLabel: Join our Discord and introduce yourself!
  ctaHref: https://discord.gg/8Btn3fck2U
faqs:
  - question: What is Meshtastic?
    answer: >-
      Meshtastic is an open-source project that turns affordable LoRa radios into mesh-networked communication devices. It allows text messaging, GPS location sharing, and telemetry data exchange without any cell service or internet connection.
  - question: Do I need a ham radio license?
    answer: >-
      No! Meshtastic operates on the 915 MHz ISM band in the US, which does not require a license. However, you must stay within FCC power limits (typically 1 watt or less depending on antenna gain).
  - question: How far can Meshtastic communicate?
    answer: >-
      Range depends heavily on terrain, antenna quality, and node placement. Typical urban range is 1-3 miles, but with elevated nodes and good line-of-sight, ranges of 10+ miles are common. The mesh network extends range by hopping messages through intermediate nodes.
  - question: What devices work with Meshtastic?
    answer: >-
      Popular devices include the Heltec V3, LilyGo T-Beam, RAK WisBlock, and various ESP32-based boards with SX1262 or SX1276 LoRa modules. See our Resources page for specific recommendations.
  - question: How do I connect to the Charleston mesh?
    answer: >-
      Simply get a Meshtastic device, flash the latest firmware, and configure it for the default US settings. If you're in range of our network, you'll automatically connect! Join our Discord for help getting started.
  - question: Is the network private?
    answer: >-
      By default, the primary channel uses a shared encryption key for basic network traffic. For private conversations, you can create encrypted secondary channels with custom keys. Location and telemetry sharing is optional and configurable.
contactCta:
  heading: Have Questions?
  body: We're happy to help! Reach out on Discord or email us directly.
  ctas:
    - label: Join Discord
      href: https://discord.gg/8Btn3fck2U
      variant: primary
    - label: Email Us
      href: mailto:info@chsmesh.org
      variant: outline
---
