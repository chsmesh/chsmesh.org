---
title: "Hurricane Season Preparedness"
description: "What a mesh radio can and cannot do after a storm, and how to get your radios, power and family ready before one."
difficulty: beginner
category: network
order: 1
readingTime: 12
prerequisites:
  - A Meshtastic radio already set up on the Charleston mesh
lastUpdated: 2026-11-22
handbook: true
---

## Overview

The Atlantic hurricane season runs from June 1 to November 30 and peaks around September 10, with most activity between mid-August and mid-October. After a storm, power and cell service can be out for days. A mesh radio keeps working through that, because it depends on neither.

This guide covers what the mesh is good for after a storm, what it is not, and what to do before the season so your radio is useful when you need it. Print it, or save the PDF: you will not be able to look it up when the internet is down.

## What the mesh can do

- **Work with no cell towers and no internet.** Radios talk directly to each other and pass messages along.
- **Run for days on little power.** A handheld runs on a phone power bank. A solar relay runs on its own.
- **Carry short text messages** across town through the relays, and between houses on the same street with no relay at all.
- **Tell people you are okay.** That one message is most of what anyone needs in the first day.

## What the mesh cannot do

Be honest with yourself and your family about this before you rely on it.

- **It is not 911.** Nobody monitors the mesh for emergencies, and it does not reach emergency services. If you can call 911, call. Charleston County 911 also accepts text messages when a voice call cannot be made.
- **It does not replace a weather radio.** Warnings and forecasts come from NOAA Weather Radio and local broadcasters. Keep a battery or hand-crank weather radio.
- **It is short text only.** No voice, no photos, and a message is limited to a couple hundred characters.
- **Delivery is not guaranteed.** A message that goes unacknowledged may not have arrived. After a storm some relays will be down, and the ones still up will be busy.
- **The public channel is public.** Anyone with a radio can read LongFast. Do not post that your house is empty.
- **It only reaches people who also have a radio.** A radio you bought the week of the storm, for a relative who has never used one, will not help much.
- **It is not ham radio.** Licensed amateur operators run organized emergency nets with far more power and range. If that interests you, the Charleston-area SKYWARN net and the Charleston Amateur Radio Society are the places to start.

Treat the mesh as one more way to reach people, alongside the others on this page.

## Before the season

Do these in May, and again when a storm is forecast.

### Radios

- [ ] Charge every radio and check each one powers on.
- [ ] Update the firmware and the phone app while you still have internet. Do not update the day before landfall.
- [ ] Send a message between your own radios, and from home to the public channel. Check that your node appears on the [Network Status](/status/) page.
- [ ] Check the settings against [Join the Charleston Mesh](/guides/join-the-charleston-mesh/).
- [ ] Write each radio's node name on a label on its back.

### Family and neighbors

- [ ] Set up a private channel for your household and add it to every family radio as a secondary channel. Share it by QR code, in person, now.
- [ ] Print that QR code and keep it with your storm papers.
- [ ] Have everyone send and read a message at least once. The storm is the wrong time to learn the app.
- [ ] Agree where each person will be, and when you will check in.
- [ ] Tell an out-of-town relative how you plan to make contact, and that silence for a day or two does not mean trouble.

### Power

- [ ] One power bank per radio, charged. See the budget below.
- [ ] A way to recharge without the grid: a folding solar panel, a car charger, or a generator you already own.
- [ ] Short, known-good USB cables. Label them.

### Weatherproofing

- [ ] A zip-top freezer bag for each handheld is enough for rain and wet hands. Radios still work through the bag.
- [ ] Put power banks, cables and the printed QR code in a dry bag or a sealed container.
- [ ] Keep the kit above floor level if you live in a flood zone.

### If you evacuate

Take the radios with you. A radio is no use in an empty house, and it will be useful on the road back and in the days after you return. If you run a fixed relay, leave it running: see the section on relays below.

## Power for a multi-day outage

Plan for five days without mains power. The sums are simple:

**hours of runtime = power bank watt-hours × 0.7 ÷ the radio's draw in watts**

The 0.7 covers what a power bank loses converting its battery voltage to USB. Watt-hours are printed on most power banks; if yours only gives milliamp-hours, multiply by 3.7 and divide by 1,000.

Draw varies a lot by board. As planning figures, until you have measured your own:

| Radio | Rough draw | 10,000 mAh bank (37 Wh) lasts about |
|---|---|---|
| nRF52 board (RAK WisBlock, T-Echo) | under 0.1 W | more than a week |
| ESP32 board (Heltec V3, T-Beam), screen and Bluetooth in use | 0.3 to 0.6 W | 2 to 3 days |

These are rough figures, not measurements of your radio. To find the real number, charge a power bank fully, run the radio from it, and note how long it lasts. Do it once in the spring and write the answer on the power bank.

To stretch a charge:

- Shorten the screen timeout, or turn the screen off.
- Turn off GPS on a radio that is not moving, and set a fixed position or none.
- Leave the radio on. A radio that is switched off cannot receive, and messages sent while it was off are gone.
- Charge your phone last. The radio keeps receiving without it; you only need the phone to read and write.

Some power banks switch themselves off when the load is very small, which a low-power radio is. Test yours for a full day before you depend on it.

## Checking in after a storm

When many people come back on the air at once, a slow shared channel fills up quickly. The conventions below keep it usable. They are the community's suggested practice, not a monitored service, and nobody is obliged to answer.

### Where

Use **LongFast**, the public primary channel, for check-ins. It is the one channel every radio in the area already has. Use your private family channel for anything personal.

### When

Check in at the **top of the hour**, and listen for the ten minutes after it. If everyone transmits and listens in the same window, radios running on batteries can rest in between, and you know when to expect a reply. Outside that window, send only what cannot wait.

### What to send

One short message, in this order:

**CHECK-IN, area, status, needs**

For example:

- `CHECK-IN West Ashley near Avondale. All OK. Power out. No needs.`
- `CHECK-IN Johns Island, Main Rd. OK. Road blocked by trees. Need nothing urgent.`
- `CHECK-IN James Island. Need insulin kept cold, can anyone near Folly Rd help?`

Name the neighborhood, not your address. If you need someone to come to you, move to a direct message to give the address.

### Good manners on a busy channel

- Send once. If nobody acknowledges, wait for the next hour rather than repeating every few minutes.
- Do not reply "copy" to every check-in. Reply only if you can help, or if someone asked a question.
- No chatter, tests or weather commentary on LongFast in the first days.
- Relay for others only if they ask. Passing along a message you half-read does more harm than good.
- Do not raise your hop limit. It does not help your message through; it multiplies the traffic everyone else has to wait for.
- If someone reports a life-threatening emergency and you have a working phone, call 911 for them and say so on the channel.

## Keeping a relay alive through a storm

If you run a rooftop or solar relay, the network is leaning on it. Most of this work is done long before a storm.

- **Mount it for the wind.** A hurricane puts far more force on a mast than a summer thunderstorm does. Use a short, stiff mast, two clamps rather than one, stainless hardware, and nothing that depends on a zip tie. A small panel mounted flat against the mast or wall catches much less wind than one on an arm.
- **Keep it low-profile.** A foot or two of mast that survives is worth more than ten feet that fold over.
- **Give it days of battery.** A storm brings several days of heavy cloud before and after. Size the battery to run the node for at least five days with no sun. [Building a Solar Relay Node](/guides/solar-relay-build/) shows how.
- **Seal it and drain it.** Cable glands tightened, cables looped downward before they enter the box, and a vent or drain so water that gets in can get out.
- **Decide in advance whether it comes down.** A node on a mast you would lower for a storm anyway should come down with it, and go back up as soon as it is safe. A node bolted to a building that is staying put is usually better left running.
- **Never go on a roof or up a ladder once the wind picks up,** and not afterwards either until it is dry and calm. No relay is worth a fall.
- **Afterwards, check it from the ground.** Look at the [Network Status](/status/) page to see whether the node is still being heard before deciding it needs a visit.
- **Tell the group.** Post in the Discord if your relay is down or you took it down, so nobody wastes effort wondering why an area went quiet.

If you have a high site and no relay, [Help Wanted: Relay Sites](/relay-sites/) explains how to host one.

## Official resources

Save these now. Sign up for alerts before you need them.

**Charleston County**

- [Charleston County Emergency Management: Hurricanes](https://www.charlestoncounty.gov/departments/emergency-management/hurricane.php)
- [Charleston County Citizen Alert sign-up](https://www.charlestoncounty.gov/departments/emergency-management/alert-removal.php)
- [Charleston County 911: questions and answers, including text-to-911](https://www.charlestoncounty.gov/departments/consolidated-911/faqs.php)

**Neighboring counties**

- [Berkeley County Emergency Management](https://berkeleycountysc.gov/dept/epd/) and [alert sign-up](https://berkeleycountysc.gov/emergency-alerts-signup/)
- [Dorchester County Emergency Management](https://www.dorchestercountysc.gov/government/public-safety/emergency-management)

**South Carolina**

- [SC Emergency Management Division: South Carolina Hurricane Guide](https://www.scemd.org/stay-informed/publications/hurricane-guide/)
- [Know Your Zone](https://www.scemd.org/prepare/know-your-zone/): find your evacuation zone before a storm is named
- [SC Emergency Manager mobile app](https://www.scemd.org/stay-informed/mobile-applications/)

**Weather**

- [National Hurricane Center](https://www.nhc.noaa.gov/)
- [National Weather Service, Charleston](https://www.weather.gov/chs/)
- NOAA Weather Radio: the Charleston transmitter is on **162.550 MHz**. Program it into your weather radio now.

**Federal**

- [Ready.gov: Hurricanes](https://www.ready.gov/hurricanes)
- [FEMA app](https://www.ready.gov/fema-app)

**Amateur radio**

- [SKYWARN storm spotters, NWS Charleston](https://www.weather.gov/chs/skywarn)
- [Charleston Amateur Radio Society](https://www.wa4usn.org/)

## The short version

1. Charge, update and test every radio in May.
2. Share a family channel by QR code and print it.
3. One charged power bank per radio, and a way to refill it.
4. After the storm: LongFast, top of the hour, `CHECK-IN, area, status, needs`.
5. For an emergency, call or text 911.
