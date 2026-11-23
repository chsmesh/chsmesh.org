---
title: "Lowcountry Coverage and Node Placement"
description: "Why height beats everything else on flat, wooded, wet ground, and how to place and test a node so it extends the Charleston mesh."
difficulty: intermediate
category: network
order: 2
readingTime: 14
prerequisites:
  - A Meshtastic radio already set up on the Charleston mesh
lastUpdated: 2026-11-22
---

## Overview

Most Meshtastic advice is written by people with hills. Put a node on a ridge and it covers a county. The Lowcountry has no ridges: the land is flat, a few feet above the water, and covered in pines and live oaks. Coverage here behaves differently, and the rules of thumb that work elsewhere can mislead you.

The short version: **height matters more than anything else you can change.** More than antenna gain, more than transmit power, more than which board you bought.

## Why height dominates

### Radio travels in straight lines

At 915 MHz a signal goes where it has line of sight, and a little beyond. On flat ground the thing that ends your line of sight is the curve of the earth. The distance to the radio horizon is roughly:

**miles to the horizon ≈ 1.41 × √(antenna height in feet)**

| Antenna height | Radio horizon |
|---|---|
| 5 ft (in your hand) | 3 miles |
| 15 ft (one-story eave) | 5.5 miles |
| 30 ft (two-story roof) | 8 miles |
| 60 ft (mast or small tower) | 11 miles |
| 150 ft (tall building) | 17 miles |

Two nodes can see each other when their horizons overlap, so add the two figures. A handheld at 5 ft and a relay at 150 ft can in principle reach 20 miles. Two handhelds at 5 ft manage 6 at best. The square root is the important part: going from 5 ft to 30 ft nearly triples your horizon, and you can do that with a ladder.

On hilly ground a node gets its height for free from the terrain. Here every foot has to come from a building, a mast or a tower.

### A clear line is not enough

A radio signal does not travel as a thin beam. It occupies a football-shaped volume between the two antennas called the first Fresnel zone, and whatever intrudes into that volume weakens the signal even if the straight line between the antennas is clear. The zone is fattest in the middle of the path. At 915 MHz:

| Path length | Fresnel zone radius at the midpoint | Clearance to aim for (60%) |
|---|---|---|
| 3 miles (5 km) | 66 ft (20 m) | 40 ft (12 m) |
| 6 miles (10 km) | 94 ft (29 m) | 56 ft (17 m) |

Look at those numbers next to the height of a mature live oak or loblolly pine, which is often 60 to 100 ft. On a three-mile path between two rooftops at 30 ft, the direct line runs below the treetops for most of the way and the Fresnel zone is full of branches. The link may still work, because LoRa is very forgiving, but it works badly and unreliably. That is why a node 100 ft up changes an area and a node at 25 ft often changes only its own street.

## Trees, humidity and water

### Trees

Trees are the main obstacle here. Measurements near this frequency put the loss through mixed woodland at around 0.17 dB for every metre of foliage the signal passes through, up to a ceiling of roughly 26 dB, and trees in leaf are about a fifth worse than bare ones. A 26 dB loss means only a quarter of one percent of the signal gets through. Live oaks and pines keep their leaves, so there is little winter improvement to look forward to.

In practice:

- A single tree in the way costs a few dB. You may not notice.
- A block of wooded lots costs most of your signal.
- The far side of a stretch of forest is reached by going **over** it, not through it.

Getting the antenna above the canopy is therefore the goal. If you cannot get above it, get to the edge of it: an antenna on the side of the house that faces open ground, a road or the marsh does far better than one facing the woods.

### Humidity and rain

Charleston's humidity does not weaken a 915 MHz signal in the air. Rain and water vapor only start to absorb radio at frequencies more than ten times higher. If your range drops in a summer downpour, look for water in a connector or cable before you blame the weather.

Humidity matters to your hardware instead. Salt air and constant damp corrode connectors and wick into coax. Seal outdoor connections and expect to check them every year.

### Water crossings

Open water and marsh are the best paths we have, because nothing grows tall on them. A node with a view across the harbor, a river or a wide stretch of marsh can often reach the far bank when a node the same distance away over land cannot. This is why sites near the water, and on anything that crosses it, are so useful to the mesh.

Paths over water also behave oddly in warm, still weather. A layer of warm air over cooler water can bend signals back down and carry them much further than usual, most often along the coast. If you briefly hear a node from far up or down the coast on a summer evening, that is what happened. Enjoy it, and do not plan around it.

## Antennas

### Gain is a shape, not extra power

An antenna does not create power. A "higher gain" omnidirectional antenna takes the signal it would have sent up and down and squeezes it toward the horizon instead. Picture a ball of dough: a low-gain antenna leaves it round, a high-gain one presses it flat into a pancake. The pancake reaches further sideways and covers less above and below.

- A low-gain antenna, around 2 to 3 dBi, has a fat pattern. It is forgiving of being tilted and reaches nodes well above or below it.
- A mid-gain antenna, around 5 to 6 dBi, is a good general choice for a fixed node.
- A high-gain antenna, 8 dBi and up, has a thin pattern. One 8 dBi omni's datasheet gives a vertical beam only 14 degrees thick.

### Why high gain can hurt on a rooftop

On flat ground everything is near the horizon, which suits a flatter pattern. The catch is close in. A thin beam from a tall site passes over the heads of nodes nearby and below, so a relay on a high-rise with a very high-gain antenna can reach the next county and miss the neighborhood at its feet. A thin beam also has to be exactly vertical: a mast that leans a few degrees in the wind points half the pattern into the ground and the other half into the sky.

A sensible rule here:

- **Handhelds and indoor nodes:** the modest antenna in the [resources list](/resources/#resource-gizont-antenna) is plenty.
- **Home rooftop nodes:** 3 to 6 dBi.
- **Tall relay sites:** 5 to 6 dBi, mounted dead vertical. Go higher only when the site's job is a long link to another high site, not local coverage.

There is a legal reason to stay moderate as well. FCC rules for this band allow 1 watt of transmitter power with an antenna of up to 6 dBi. Above 6 dBi you must turn the transmit power down by the same amount, so a bigger antenna gains you nothing on transmit at full power.

### Cable loss

Coax between the radio and the antenna throws signal away, in both directions, and thin cable throws away a lot. Loss per 100 ft near 915 MHz:

| Cable | Loss per 100 ft | Loss in a 25 ft run |
|---|---|---|
| RG-174 (thin pigtail cable) | about 26 dB | 6.5 dB |
| RG-58 | about 15 dB | 3.7 dB |
| LMR-240 | 7.6 dB | 1.9 dB |
| LMR-400 | 3.9 dB | 1 dB |

Every 3 dB is half your power. Twenty-five feet of RG-58 wastes more than half of what the radio sends and of what the antenna hears, which cancels out most of the gain of a better antenna.

The radio draws so little power that there is a better answer: **put the radio at the antenna.** Mount the node in a weatherproof box at the top of the mast with a foot of cable, and run power up to it, or use solar and run nothing. [Building a Solar Relay Node](/guides/solar-relay-build/) shows how. Keep long coax runs for sites where the radio really cannot go outside.

## Good kinds of sites

What makes a site good is height above the trees around it and a clear view in the directions that matter. In rough order of usefulness:

- **Tall buildings.** Office blocks, hotels, hospitals and parking decks. A parapet or a roof railing is enough.
- **Towers.** Radio and communication towers, water towers and ham radio towers, with the owner's agreement.
- **Steeples and bell towers.** Often the tallest thing in a neighborhood.
- **Bridges and waterfront structures.** Superb views across water. These belong to someone, usually a public agency, and need written permission. Do not attach anything to a bridge, a utility pole or a public structure without it.
- **Stadium and field light poles,** with the school's or the owner's agreement.
- **Two- and three-story houses** on the edge of open ground, marsh or water, with a mast above the roofline.

Sites that disappoint:

- Attics under a radiant-barrier or metal roof, which block most of the signal.
- Anywhere below the surrounding tree canopy.
- The middle of a dense block of taller buildings.
- A window that faces another building.

Never put equipment on property you do not own or have permission to use, and never publish the address of a site. The [Network Status](/status/) map shows where coverage exists and [Help Wanted: Relay Sites](/relay-sites/) lists the areas where a new site would help most. If you have access to a good one, that page explains how to offer it.

## Testing coverage

Measure before you mount anything permanently. A node held up on a painter's pole for an afternoon tells you most of what a month on the roof would.

### Read the signal numbers

The app shows two numbers for each node you hear directly:

- **SNR**, in dB, is how far the signal stands above the noise. LoRa works with the signal below the noise, so negative values are normal. On LongFast the limit is about -17.5 dB. The further above that the better; within a few dB of it, expect dropped messages.
- **RSSI**, in dBm, is the raw strength. Closer to zero is stronger. Around -115 dBm and weaker is marginal.

Compare readings between two spots, not against a table. If moving the antenna six feet higher takes a relay from -14 dB to -6 dB, that is the answer.

### Traceroute

Traceroute shows the path a message takes to another node and the signal quality at each hop. Long-press a node in the app's node list and choose **Trace Route**.

- Use it to learn which relay you actually depend on. It is often not the one you expected.
- A route that changes every time you run it means you are on the edge of two relays' coverage.
- The firmware allows one trace every 30 seconds. Use far fewer than that: each one is traffic on the shared channel.

### The range test module

The range test module automates a drive or walk test. One node stays put and sends a numbered message at a set interval; the other moves around and records which numbers arrive. Gaps in the sequence show where coverage drops.

1. Enable the module on both nodes.
2. On the fixed node, set the sender interval. The Meshtastic documentation suggests 30 seconds on LongFast.
3. Walk or drive the area with the second node, then compare its log with a map.
4. **Turn the module off on both nodes when you finish.** It is easy to forget, and a forgotten sender spends airtime on a shared channel all day. The firmware stops it after eight hours as a backstop.

Range test messages go out on the channel for everyone to hear, so keep tests short and run them at quiet times. For a long session, put both nodes on a private channel on a different frequency slot so the public mesh is left alone, and put them back afterwards.

### A simple survey

1. Stand where the node will go, with the antenna at the height it will have. A pole helps.
2. Wait fifteen minutes, then note which relays you hear and their SNR.
3. Run one traceroute to a node on the far side of town.
4. Try a second spot. Raise the antenna. Compare.
5. Check the [Network Status](/status/) page to see whether the gateways heard you from each spot.

## Choosing a role

A node's role decides how eagerly it repeats other people's messages. On a slow shared channel every repeat costs airtime, so the wrong role in the wrong place makes the mesh worse for everyone around it, however good the intention.

| Role | What it does | Use it for |
|---|---|---|
| Client | Repeats a message only if it hears nobody else do it first | Handhelds, indoor nodes, most rooftop nodes. The default, and the right answer when in doubt |
| Client Mute | Never repeats | A second or third radio in the same house; a radio in a spot with no view |
| Client Base | Always repeats messages to or from the nodes you mark as favorites; otherwise acts like Client | Your own rooftop or attic node, so your handhelds always have a way out |
| Router | Always repeats, and goes first | A fixed, always-on node at a site that sees well over the trees and serves a wide area |
| Router Late | Always repeats, but only after everyone else has had a turn | Filling one dead spot or serving a local cluster, where the site does not help the wider mesh |

Meshtastic's own guidance is blunt: Router is only for stationary devices in extremely strategic locations, and the project recommends keeping to Client, Client Mute or Client Base otherwise. On this terrain, "strategic" means well above the canopy with a view over a large area. A Router at 25 ft among the trees does not extend the network. It repeats everything it hears, ahead of the better-placed nodes that would have carried the message further, and uses up airtime doing it.

Some practical rules for this mesh:

- **A good home rooftop node is a Client or a Client Base,** not a Router.
- **Ask before you deploy a Router.** Post the site and height in the [Discord](https://discord.gg/8Btn3fck2U) first. The people running the existing relays can tell you whether it would help or collide, and the mesh's fixed sites are listed on the [status page](/status/).
- **Router Late is for a gap, not a rooftop.** It suits a node that covers a pocket the main relays miss. Meshtastic advises against it for home rooftop nodes, and it adds delay on a slow preset like LongFast, so use it sparingly.
- **Leave the hop limit at 3.** A well-placed relay network needs fewer hops, not more.
- **The Repeater role is gone.** It was deprecated in firmware 2.7.11. Use Router or Router Late where you would have used it.

## Summary

1. Get the antenna higher. Then get it higher again.
2. Clear the treetops, or face open ground or water.
3. Put the radio at the antenna and keep the cable short.
4. Choose a moderate antenna and mount it vertical.
5. Test with a pole before you drill anything.
6. Stay on Client unless the site is exceptional, and ask first.
