---
title: "Join the Charleston Mesh"
description: "From a radio in a box to seeing local nodes in about ten minutes, with the settings the Charleston-area mesh actually uses."
difficulty: beginner
category: getting-started
order: 0
readingTime: 5
prerequisites:
  - A Meshtastic radio with its antenna attached and firmware installed
  - The Meshtastic app on your phone
lastUpdated: 2026-11-22
handbook: true
meshSettings: true
---

## Overview

This is the short version. The card above has every setting the local mesh uses; the steps below put them on your radio and check that it worked. If your radio does not have Meshtastic on it yet, start with [Flashing Meshtastic Firmware](/guides/flashing-firmware/). For what each setting means, see [Initial Device Setup](/guides/initial-setup/).

**Attach the antenna before you power the radio on.** Transmitting without one can damage the radio chip.

## 1. Pair your phone

1. Turn on Bluetooth and power on the radio.
2. Open the Meshtastic app and connect to the device named `Meshtastic_XXXX`.
3. Enter the PIN shown on the radio's screen. Radios without a screen use `123456`.

## 2. Load the settings

On a new radio, the quickest way is the QR code in the card at the top of this page. Scan it with your phone's camera, or tap **Open in the Meshtastic app** if you are reading this on the phone itself, then accept the import. That sets the region to US and leaves you on the public LongFast channel.

To do it by hand instead:

1. Open the LoRa settings and set **Region** to **US**. The radio restarts.
2. On the same screen, check that the preset reads **LongFast**. Radios set up on the newest firmware may start on a different preset, and a radio on another preset hears nobody here.
3. Open **Channels** and leave the primary channel as it came: no name, default key. Do not rename it. A renamed primary channel is a different channel, and your radio drops off the public mesh.

## 3. Name your node

In the **User** settings, set a long name people will recognize and a short name of up to four characters. Many people here put their neighborhood in the long name, such as "Sam - West Ashley". Leave out anything you would not write on a postcard.

## 4. Keep the newcomer defaults

- **Role: Client.** This is the default and the right choice for a radio you carry, keep on a desk or put in a window. Do not pick Router because it sounds helpful: a router in an ordinary spot talks over better-placed nodes and makes the mesh worse for everyone nearby. [Lowcountry Coverage and Node Placement](/guides/lowcountry-coverage/) explains when another role is right.
- **Hop limit: 3.** Also the default. Raising it does not make your messages go further here; it adds traffic.
- **Position: your choice.** Sharing a position puts your node on the [status map](/status/). On the public channel the firmware never sends your exact location; it rounds it to roughly half a mile at the finest setting. You can choose a coarser setting, or turn position off, in the primary channel's settings. For a radio that stays at home, a coarse setting is the sensible one.

## 5. Check that it worked

1. Open the **Nodes** tab. Your own node is listed first. Others appear as your radio hears them. That can take a while, because nodes only announce themselves every so often, so give it an hour before deciding something is wrong.
2. Open the LongFast channel and send a short hello, such as "Hello from James Island". The app marks the message as acknowledged when another node relays it.
3. Look yourself up on the [Network Status](/status/) page. You appear there once one of the mesh's gateways has heard you.

Keep test messages few. Everyone on the channel shares the same slice of airtime.

## Nothing showing up?

- **Check the region and preset first.** An unset region is the most common cause, and a radio with no region does not transmit at all.
- **Get near a window, upstairs, or outside.** This is flat country with a lot of trees, so height and a clear view matter more than anything else. A radio on a ground-floor desk may hear nothing while the same radio on a second-floor windowsill hears a dozen nodes.
- **Look at the map.** The [status page](/status/) shows where nodes are heard, and [Help Wanted: Relay Sites](/relay-sites/) lists the areas with thin coverage. If you live in one of them, you may simply be out of range for now.
- **Check the antenna.** It should be finger-tight, and it should be a 915 MHz antenna.
- **Ask.** Post in the [CHS Mesh Discord](https://discord.gg/8Btn3fck2U) with your neighborhood and what you see. Someone nearby can usually tell you what to expect.

## More channels

LongFast is the public channel: anyone with a radio can read it, so treat it like a room full of strangers. For family or a group of friends, add a private secondary channel with its own key and share it by QR code in person. Keep LongFast as the primary so you stay on the public mesh. The community also keeps a chat channel of its own; ask in the Discord for its settings.

## Next steps

- [Initial Device Setup](/guides/initial-setup/) covers the rest of the settings.
- [Lowcountry Coverage and Node Placement](/guides/lowcountry-coverage/) is about getting more range out of the radio you have.
- [Hurricane Season Preparedness](/guides/hurricane-preparedness/) covers getting ready before a storm, which is the reason many of us built this network.
- Come to a [meetup](/meetups/) and bring the radio.
