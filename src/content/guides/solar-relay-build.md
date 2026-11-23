---
title: "Building a Solar Relay Node"
description: "A parts list, power budget and step-by-step build for a weatherproof solar relay that runs unattended through a Charleston summer and a week of cloud."
difficulty: advanced
category: hardware
order: 1
readingTime: 18
prerequisites:
  - Comfortable flashing and configuring a Meshtastic radio
  - A drill, a step bit and basic hand tools
  - A site you own or have written permission to use
lastUpdated: 2026-11-22
---

## Overview

Handheld radios become a network when there are relays above the trees to carry their messages. Most good relay sites have no outlet nearby, so most relays run on a small solar panel and a battery. This guide builds one that can sit on a roof or a pole for years without a visit.

Before you build, read [Lowcountry Coverage and Node Placement](/guides/lowcountry-coverage/). Where the node goes matters more than anything in this guide, and a relay in a poor spot makes the mesh worse. Talk to the group in the [Discord](https://discord.gg/8Btn3fck2U) about the site first.

## Parts list

This is a reference build, not the only way to do it. Prices are rough, as of late 2026, and move around.

| Part | What to get | Rough cost |
|---|---|---|
| Board | [RAK WisBlock Meshtastic Starter Kit](/resources/#resource-rak-wisblock-starter-kit), US915 | $30-40 |
| Battery | One protected 18650 lithium-ion cell, 3,000 mAh or more, in a holder with leads; or a flat lithium-polymer pack of similar size | $10-15 |
| Solar panel | 5 V or 6 V, 3 to 6 W, with a weatherproof lead | $15-25 |
| Enclosure | IP65 or better polycarbonate or ABS junction box, about 4 × 4 × 3 in, light gray or white | $10-15 |
| Antenna | Outdoor-rated 915 MHz fiberglass omni, 3 to 6 dBi, N connector | $20-40 |
| Antenna lead | Short bulkhead pigtail from the board's small IPEX (U.FL) connector to an N connector, 6 to 8 in | $8 |
| Cable gland | One PG7 or PG9 gland for the solar lead | $2 |
| Vent | One screw-in pressure-equalizing vent plug | $3 |
| Mounting | Stainless pole clamps or U-bolts, a short mast or bracket | $10-25 |
| Sundries | Self-fusing silicone tape, dielectric grease, desiccant pack, hook-and-loop or standoffs | $10 |

Expect a total of roughly **$120 to $180**.

### Why this board

The power budget below explains it in numbers. The short reason: a board built on the nRF52840 chip uses a small fraction of the power of an ESP32 board such as the Heltec V3, and its base board charges a lithium cell from a 5 V panel with no separate charge controller. An ESP32 board can run a relay, but it needs a panel and battery several times larger to get through December.

### Choosing the other parts

- **Battery.** Buy a name-brand cell with a protection circuit from a reputable seller. Unbranded cells with implausible capacity ratings are common and are a fire risk. One good 3,000 mAh cell is enough for this build.
- **Panel.** The base board's solar input is made for a 5 V panel. Check the maximum input voltage in your board's datasheet before connecting a 6 V panel, and never connect a 12 V or 18 V panel directly.
- **Enclosure.** Choose a light color. A dark box in full sun gets far hotter inside than the air around it.
- **Antenna.** A moderate-gain antenna suits a relay that serves the neighborhood around it. The coverage guide explains why more gain is not better.

## Power budget

Size the panel and battery with arithmetic, not hope. You need two numbers: what the node uses in a day, and what the panel makes on a bad day.

### What the node uses

The best figure is one you measure. Meshtastic's documentation describes how: put a USB power meter in line, run the configured node for a few hours, and multiply the average milliwatts by 24 to get watt-hours per day.

As planning figures until you have measured:

| Board | Rough daily use as a relay |
|---|---|
| nRF52840 (RAK WisBlock) | about 1 Wh |
| ESP32 (Heltec V3 and similar) | 5 to 10 Wh |

A busy mesh costs more than a quiet one, because every message relayed is a transmission. Allow some margin.

### What the panel makes

Solar output is described in peak sun hours: the number of hours of full-strength sun a day's light adds up to. For Charleston, from the [PVWatts calculator](https://pvwatts.nlr.gov/), for a fixed panel facing south:

| Panel tilt | Year average | December |
|---|---|---|
| Flat (0°) | 4.8 h | 2.5 h |
| 33° | 5.3 h | 3.9 h |
| 60° | 4.5 h | 4.1 h |
| Vertical (90°) | 3.1 h | 3.7 h |

December is the month that matters, because it has the least sun. Notice how much tilt helps: a panel lying flat makes barely 60 percent of what a steeply tilted one does in midwinter. A steep tilt also sheds rain, pollen and bird droppings, and catches less wind when it sits close to a wall or mast.

A small panel and charger deliver about half the panel's rated power to the battery once you account for charging losses, heat and a panel that is never perfectly clean. So:

**daily harvest (Wh) ≈ panel watts × peak sun hours × 0.5**

For a 5 W panel tilted at 60° in December: 5 × 4.1 × 0.5 ≈ **10 Wh a day**, against about 1 Wh used. That is a wide margin, and it should be. The margin is what recharges the battery quickly after a run of cloud, and what covers a panel partly shaded by a tree that has grown.

### Getting through cloud

Averages hide the bad weeks. A tropical system or a winter front can bring several days when a panel makes a tenth of its usual output. Size the battery to carry the node with no sun at all:

**days of autonomy = battery watt-hours × 0.8 ÷ daily use**

The 0.8 allows for not draining the cell flat and for capacity lost with age. A 3,000 mAh cell holds about 11 Wh (3,000 × 3.7 ÷ 1,000), so 11 × 0.8 ÷ 1 ≈ **9 days**. Aim for at least five; a week or more is comfortable.

Run the same sums for an ESP32 board using 7 Wh a day and you need a 20 W panel and 60 to 80 Wh of battery for a comparable result. That is the whole case for the low-power board.

### Shade

A little shade costs a lot. A branch across one corner of a small panel can cut its output by half or more. Look at the site at midday in winter, when the sun is low in the south, not just in June.

## Assembly

### 1. Build and test on the bench first

Flash the board, connect the antenna, and configure it as described under Firmware below. Run it on the bench for a few days from the battery and panel you will actually use, in a window. Find the problems here, not on the roof.

**Always connect the antenna before powering the board.**

### 2. Check battery polarity

Before plugging the battery in, compare the red and black wires on its plug with the `+` and `-` markings beside the board's battery connector. Battery leads are often wired the opposite way round to what the board expects, and a reversed battery destroys the board at once. If they do not match, move the pins in the plug or fit a new one. Do the same check on the solar lead.

### 3. Prepare the enclosure

All holes go in the **bottom** face of the box, the one that will point at the ground. Water runs down, and a hole in the bottom drains instead of filling.

1. Drill the hole for the antenna's N bulkhead connector.
2. Drill the hole for the cable gland.
3. Drill the hole for the vent plug.
4. Deburr the holes so the seals sit flat.

Some builders mount the antenna on top so it clears the box. If you do, the connector's seal is the only thing keeping rain out, so use a bulkhead connector with an O-ring and wrap the joint.

### 4. Fit the hardware

1. Fit the N bulkhead pigtail and tighten its nut against the O-ring.
2. Fit the cable gland and the vent plug.
3. Pass the solar lead through the gland and tighten the gland until the cable cannot be pulled through by hand.
4. Mount the board on standoffs or strong hook-and-loop, away from the floor of the box.
5. Secure the battery so it cannot move. A cell rattling around a box on a mast will break its leads.
6. Connect the antenna pigtail to the board's LoRa connector. It clicks on; do not force it sideways.
7. Connect the solar lead, then the battery.
8. Add a desiccant pack and close the lid evenly.

### 5. Why the vent matters

A sealed box in the sun heats up and cools down every day. As it cools, the air inside contracts and the box sucks in whatever is at its seals, which outdoors is damp air or rainwater. A vent plug has a membrane that lets air through and keeps liquid water out, so the pressure stays equal and the seals are never pulled on. It costs three dollars and prevents the most common cause of failure: a box that slowly fills with condensation.

### 6. Heat

Heat is what ages a lithium battery here, not cold. Charging a lithium-ion cell above about 113°F (45°C) shortens its life, and the inside of a dark box in July sun goes well beyond that.

- Use a light-colored box.
- Mount the box in the shade of the panel, or on the north side of the mast.
- Leave an air gap between the panel and the box. Do not glue the panel to the lid.
- Do not pack the box with foam or insulation.

### 7. Seal the outside

1. Put a little dielectric grease on the antenna connector threads, screw the antenna on, and wrap the joint with self-fusing silicone tape, starting at the bottom and overlapping upward like shingles.
2. Form a **drip loop** in the solar lead: let it hang below the gland before it rises to enter, so water runs to the bottom of the loop and drips off.
3. Secure loose cable with UV-resistant ties. Ordinary white nylon ties go brittle in a season of sun.

## Firmware for an unattended relay

Set these on the bench, then test for a few days before mounting.

### Role

Choose the role with the group, not on your own. See the role table in the [coverage guide](/guides/lowcountry-coverage/#choosing-a-role).

- **Router** only for a site well above the trees that the group has agreed needs one. This role turns on power saving by itself.
- **Client Base** or **Client** for a relay on your own roof.

### Name

Give it a long name that says what and roughly where it is, at neighborhood level, and a short name to match. Follow the pattern of the existing sites on the [status page](/status/) if the node is joining the infrastructure.

### Position

A relay does not move, so it does not need a GPS.

1. Turn GPS off, or do not fit a GPS module.
2. Set a **fixed position**, so the node appears on the map.
3. Choose how precise it is in the primary channel's settings. Round it off. Never broadcast the exact position of a site on someone else's property unless the host has agreed.

### Power and radios

- **Bluetooth:** leave it on while you test. Change the pairing PIN from the default `123456` to a number of your own before the node goes outside, or anyone standing under it can connect. Once remote administration is working, you can turn Bluetooth off altogether to save power.
- **Screen:** none fitted, nothing to set. If your board has one, set it to switch off after a few seconds.
- **Transmit power:** leave it at the default unless your antenna is over 6 dBi, in which case turn it down by the difference to stay within FCC limits.
- **Hop limit:** leave it at 3.

### Telemetry

Device telemetry reports battery level and channel use every 30 minutes by default. Leave it on at that interval. It is how you can tell from the ground, in the app, whether the node is healthy. Watch the battery level over the first sunny and cloudy days: it should recover fully by early afternoon after a clear morning.

### Remote administration

You will not want to climb up to change a setting. Remote administration lets you configure the relay over the mesh from another node you control.

1. On your own everyday node, find its public key under the security settings.
2. On the relay, paste that key into one of the **admin key** slots in the security settings. There are three, so add a second trusted node as a backup.
3. Save, then check from your everyday node that you can open the relay's settings remotely.
4. Test it before the node goes up. If the key is wrong, the only fix is a visit.

Guard the admin node: whoever holds it controls the relay. The older method, a shared `admin` channel, is off by default in current firmware and is only needed for very old nodes.

### Leave the firmware alone

Do not update a working relay casually, and never to an alpha release. Update when a stable release fixes something you need, and do it when you can reach the node if it goes wrong.

### Test a flat battery

Before mounting, unplug the panel and let the node run the battery all the way down, then reconnect the panel and see whether the node comes back by itself. Some board and battery combinations do not restart cleanly after a full discharge and sit dead until someone presses reset. It is much better to learn that on the bench. If yours does not recover, a larger battery and panel, so that it never runs flat, is the practical fix.

## Mounting and safety

### Permission

Get the owner's agreement in writing for any site that is not your own, including the height, what is being attached and how, and who to call. Do not attach anything to utility poles, bridges, street lights or public structures without permission from the agency that owns them. [Help Wanted: Relay Sites](/relay-sites/) describes how the group works with hosts.

### Power lines

Stay well away from overhead power lines: keep the mast at least twice the combined length of the mast and antenna away from any line, so it cannot touch one if it falls. Look up before you raise anything. This is the hazard that kills people putting up antennas.

### Working at height

Do not work on a roof alone, in wind, or when it is wet. Use a ladder that extends three feet past the roof edge and is tied off. For anything above a single-story roof, or any tower, use someone trained and equipped for it.

### Mounting

- Clamp to something solid: a vent pipe is not a mast. Use a wall bracket, a chimney mount, a railing or a purpose-made mast.
- Use two clamps, spaced apart, with stainless hardware.
- Keep the mast short and stiff. Design for a hurricane, not a breeze: see the relay section of [Hurricane Season Preparedness](/guides/hurricane-preparedness/#keeping-a-relay-alive-through-a-storm).
- Mount the antenna vertical and clear of the mast top, with the box just below it.
- Do not drill through a roof membrane. On a flat commercial roof use a weighted, non-penetrating mount and work to the building's rules.

### Lightning and grounding

South Carolina sees a great deal of lightning, about 11 cloud-to-ground flashes per square mile each year. Nothing protects a small node from a direct strike, and at this price the node is expendable. What matters is that the strike does not come into the building.

- A **self-contained solar node** with no wire running indoors is the safest arrangement, which is one more reason to build it this way. Mount it on a mast that is already grounded, or on a structure that has its own lightning protection, and do not make it the tallest thing on the roof if you can avoid it.
- If **any cable runs into the building**, whether coax or power, the National Electrical Code's rules for antennas apply (Article 810). In outline: the mast is bonded to the building's grounding system with heavy copper wire, a listed surge arrester goes on the cable where it enters, and any separate ground rod is bonded back to the building's main ground. Have an electrician do this or check it. A ground rod that is not bonded to the house ground can make things worse, not better.
- Unplug nothing and touch nothing during a storm.

The National Weather Service's [lightning safety pages](https://www.weather.gov/safety/lightning) are worth ten minutes.

## Getting it on the map

There is no form to register a node. The network finds it.

1. **It appears by itself.** Once a gateway hears your relay, it is listed on the [Network Status](/status/) page. It shows on the map there if it broadcasts a position.
2. **Ask for it to be listed as infrastructure.** If the relay is a permanent, well-placed site, post in the [Discord](https://discord.gg/8Btn3fck2U) with its node ID, name and neighborhood, or open a pull request against the site's infrastructure list. Listed sites get an uptime history on the status page, so everyone can see when one goes down.
3. **Share the build.** Add photos and a parts list to the [build gallery](/builds/) with the form there. Other people's builds are the best reference there is. Give the neighborhood, never the address.

## Maintenance

A good build needs a look once or twice a year. Do it in spring, before hurricane season.

- Check the node's battery level in the app, and that the [status page](/status/) still hears it, from the ground first.
- Wipe the panel. Pollen season cuts its output noticeably.
- Check the antenna joint and its tape, the gland and the clamps.
- Open the box, look for moisture or corrosion, and replace the desiccant.
- Trim or note any new shade.
- Replace the cell after three or four summers, or sooner if the node starts dying overnight.
