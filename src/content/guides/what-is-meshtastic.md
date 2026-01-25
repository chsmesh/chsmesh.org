---
title: "What is Meshtastic?"
description: "An introduction to Meshtastic - what it is, how it works, and why it matters for off-grid communication."
difficulty: beginner
category: getting-started
order: 1
readingTime: 5
---

## Overview

Meshtastic is an open-source project that turns affordable LoRa (Long Range) radio modules into a mesh network for text messaging, GPS location sharing, and sensor data transmission—all without any internet or cellular connection.

## How It Works

### The Basics

1. **LoRa Radio**: Each Meshtastic device contains a LoRa radio that can transmit and receive on the 915 MHz ISM band (in the US)
2. **Mesh Networking**: Messages automatically hop between nodes to extend range
3. **Smartphone App**: You interact with your node via Bluetooth using the Meshtastic app
4. **Encryption**: All messages are encrypted by default

### Message Flow

When you send a message:
1. Your phone sends it via Bluetooth to your node
2. Your node broadcasts it over LoRa
3. Other nodes in range receive and rebroadcast it
4. The message hops through the network until it reaches the destination

## Why Meshtastic?

### Emergency Preparedness

Charleston faces hurricanes regularly. When cell towers fail, Meshtastic keeps working. It's:
- Completely independent of infrastructure
- Low power (runs for days on a battery)
- Simple to use once set up

### Outdoor Activities

Perfect for:
- Hiking and camping
- Kayaking and boating
- Group events and festivals
- Any situation where cell coverage is spotty

### Privacy

- No central server
- No data collection
- No corporate surveillance
- You control your encryption keys

### Community Building

Meshtastic creates a shared resource. Every node you add improves coverage for everyone. It's infrastructure owned by the community, for the community.

## What You Can Do

- **Text Messaging**: Send messages to individuals or groups
- **Location Sharing**: Share GPS coordinates with your group
- **Telemetry**: Monitor battery levels, temperature, humidity
- **Alerts**: Set up emergency alerts or waypoints

## Limitations

Be realistic about what Meshtastic can and can't do:

- ✅ Short text messages (up to ~230 bytes)
- ✅ GPS locations
- ✅ Basic sensor data
- ❌ Voice calls
- ❌ Images or files
- ❌ High-speed data

Think of it as a resilient, long-range pager network.

## Next Steps

Ready to get started? Here's your path:

1. **[Choose Your Hardware](/resources)** - Pick a device that fits your needs
2. **[Flash the Firmware](/guides/flashing-firmware)** - Get the latest Meshtastic software
3. **[Configure Your Node](/guides/initial-setup)** - Set up your device and connect to the network
4. **[Join the Community](/about)** - Connect with local mesh enthusiasts
