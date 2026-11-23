---
type: mesh
heading: Charleston mesh settings
intro: The Charleston-area mesh runs on Meshtastic's public defaults, so a radio set to these talks to everyone else's.
reviewed: 2026-11-22
reviewedLabel: Last checked
settings:
  - label: Region
    value: US
    note: 915 MHz. A new radio does not transmit until this is set.
  - label: Modem preset
    value: LongFast
    note: The default. Leave the frequency slot on its default too.
  - label: Device role
    value: Client
    note: For anything you carry or keep indoors.
  - label: Hop limit
    value: "3"
    note: The default.
channelsHeading: Channels
channelLabels:
  name: Name
  slot: Slot
  key: Key
  primary: Primary
  secondary: Secondary
channels:
  - name: LongFast
    slot: primary
    key: AQ==
    note: The public default channel. Leave the name box empty in the app.
share:
  heading: One-tap import
  body: Scan this with your phone's camera, or from the Meshtastic app's channel screen, to load the region, preset and channel listed here.
  url: https://meshtastic.org/e/#CgcSAQE6AggNEgoIATgBQANIAWgB
  buttonLabel: Open in the Meshtastic app
  qrAlt: QR code that sets a Meshtastic radio to the US region and the default LongFast channel
  warning: Importing replaces the channels already on a radio. On a brand-new radio that is what you want. If you have already added private channels, set the region and preset by hand instead. After importing, check the position setting on the primary channel is what you want.
---

The settings a radio needs to join the Charleston-area mesh. Guides marked to show the local mesh settings card read them from here.
