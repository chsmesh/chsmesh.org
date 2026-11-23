---
title: "Initial Device Setup"
description: "Configure your newly flashed Meshtastic device - region settings, user info, and connecting to the Charleston mesh."
difficulty: beginner
category: getting-started
order: 4
readingTime: 12
prerequisites:
  - Meshtastic firmware flashed to your device
  - Meshtastic app installed on your phone
lastUpdated: 2026-11-22
handbook: true
meshSettings: true
---

## Overview

You've flashed your device - now let's configure it! This guide walks through the essential settings to get you connected to the Charleston mesh network.

## Step 1: Download the App

Install the official Meshtastic app:

- **Android**: [Google Play Store](https://play.google.com/store/apps/details?id=com.geeksville.mesh)
- **iOS**: [App Store](https://apps.apple.com/app/meshtastic/id1586432531)

## Step 2: Connect to Your Device

### Enable Bluetooth

1. Turn on Bluetooth on your phone
2. Power on your Meshtastic device
3. Open the Meshtastic app

### Pairing

1. Tap the **+** or **Connect** button
2. Look for a device named "Meshtastic_XXXX"
3. Tap to connect
4. Accept the pairing request on your phone

**Can't find your device?**
- Make sure Bluetooth is on
- Restart your Meshtastic device
- Check that the device screen shows it's advertising
- Try resetting Bluetooth on your phone

## Step 3: Essential Settings

### Region (Critical!)

**You must set this correctly** or your device may transmit illegally. A new device does not transmit at all until a region is set.

1. Go to **Settings** > **LoRa**
2. Set **Region** to the one in the settings card above
3. This configures the correct frequency and power limits

### User Info

1. Go to **Settings** > **User**
2. Set your **Long Name**: Something identifiable (e.g., "Chris - Downtown")
3. Set your **Short Name**: 4 characters max (e.g., "CHAS")

### Device Role

For most users:

1. Go to **Settings** > **Device**
2. Set **Role** to **Client** (default)

Role options in the current stable firmware:
- **Client**: Normal portable device, helps relay when awake
- **Client Mute**: Receives but doesn't relay (saves battery)
- **Client Hidden**: Receives and transmits but is hidden from node lists (stealth mode for coverage extension)
- **Client Base**: Like Client, but prioritizes rebroadcasting for favorited nodes — ideal for your own rooftop/attic node
- **Router**: Always-on, well-positioned fixed node that aggressively rebroadcasts
- **Router Late**: Router that rebroadcasts only after giving closer nodes a chance first

Most users should stay on **Client**. Only use **Router** or **Router Late** for a permanently powered node in a location that genuinely improves coverage — misplaced routers hurt the mesh more than they help. Note: the **Repeater** role was deprecated in firmware 2.7.11; use Router or Router Late instead.

## Step 4: Charleston Network Settings

The settings the local mesh uses are in the settings card above, which is kept up to date in one place. In short, the Charleston-area mesh runs on Meshtastic's public defaults. In a hurry? [Join the Charleston Mesh](/guides/join-the-charleston-mesh/) is the ten-minute version of this guide.

### Primary Channel

1. Go to **Channels**
2. Confirm the primary channel matches the card: default name, default key
3. In **Settings** > **LoRa**, confirm the preset matches the card as well

Do not rename the primary channel. A renamed primary is a different channel, and your radio drops off the public mesh. Add private channels as secondary channels instead.

### Position Sharing (Optional)

If you want to share your location:

1. Go to **Settings** > **Position**
2. Enable **Position Broadcast**
3. Set **Position Broadcast Interval** (900 seconds is the default)
4. Leave **Smart Position** on to reduce unnecessary broadcasts
5. Choose how precise the shared location is in the primary channel's settings

**Privacy note**: Your position will be visible to others on the mesh and on public maps. A new radio starts on a coarse setting, a couple of miles, but check what yours is set to. Pick a coarse one for a radio that stays at home, or leave position off.

## Step 5: Verify Connection

### Send a Test Message

1. Go to the **Messages** tab
2. Select the primary channel
3. Type "Test from [your name]"
4. Send!

If others are nearby, you might get a response. No response doesn't mean it's broken - you might just be out of range of other nodes.

### Check Node List

1. Go to the **Nodes** tab
2. You should see your own node
3. Other nodes will appear as they're discovered
4. Nodes might take several minutes to appear

## Step 6: Optimize Your Setup

### Battery Settings

For portable use:

1. **Settings** > **Power**
2. Enable **Power Saving** for better battery life
3. Set appropriate sleep intervals

### Bluetooth Settings

1. **Settings** > **Bluetooth**
2. Keep **Bluetooth Enabled** on if using frequently
3. Consider pairing PIN for security

### Display Settings (if applicable)

1. **Settings** > **Display**
2. Adjust **Screen On Duration**
3. Set **Auto Carousel** to rotate through info screens

## Common Issues

### "No nodes visible"

- Normal if you're the only one nearby
- Check that region is set correctly
- Verify antenna is connected properly
- Try repositioning (near window, higher location)

### "Messages not sending"

- Check channel settings
- Verify region configuration
- Ensure device isn't in airplane mode

### "Device disconnects frequently"

- Check Bluetooth stability
- Update app to latest version
- Try "forgetting" and re-pairing the device

### "Position not updating"

- Ensure GPS has a fix (may take several minutes first time)
- Check that position sharing is enabled
- Verify GPS antenna connection (T-Beam and similar)

## Next Steps

Congratulations! Your device is configured. Here's what to do next:

1. **Explore the area** - Walk around and see who you can reach
2. **Join our Discord** - Connect with local users
3. **Attend a meetup** - Get help optimizing your setup
4. **Consider antenna upgrades** - Improve your range significantly
