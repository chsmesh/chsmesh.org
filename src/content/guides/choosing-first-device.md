---
title: "Choosing Your First Device"
description: "A guide to selecting the right Meshtastic hardware for beginners - comparing popular options and what to look for."
difficulty: beginner
category: getting-started
order: 2
readingTime: 8
lastUpdated: 2026-04-21
---

## Overview

Choosing your first Meshtastic device can be overwhelming. This guide breaks down the options and helps you pick the right one for your needs.

## Quick Recommendations

**Just want an answer?** Here's what we recommend: (prices may be out-of-date)

| Use Case | Recommendation | Price |
|----------|---------------|-------|
| First device, general use | Heltec V3 | ~$20-25 |
| GPS tracking important | LilyGo T-Beam Supreme | ~$45-55 |
| Low-power / long battery | LilyGo T-Echo (nRF52) | ~$55-70 |
| Solar / permanent install | RAK WisBlock (nRF52840) | ~$60-90 |
| Backbone relay / repeater | B&Q Station G2 | ~$109 |

## Key Considerations

### 1. Built-in GPS

Some devices have GPS built in, others don't:

- **With GPS**: LilyGo T-Beam (Supreme / S3), RAK WisBlock (with GPS module), B&Q Station G2, B&Q Nano G2 Ultra
- **Without GPS**: Heltec V3, LilyGo T-Echo, most basic boards

If you want to share your location or track assets, get a device with GPS. If you just want messaging from a fixed location, you can skip it.

### 2. Screen

Having a screen lets you:
- See messages without your phone
- Check battery status
- View node information

Most popular devices (Heltec, T-Beam) include small OLED screens.

### 3. Battery

- **Heltec V3**: Small internal battery holder, limited capacity
- **T-Beam**: 18650 battery slot - easy to swap, high capacity
- **Station G2**: Built-in battery with USB-C charging

For portable use, the T-Beam's swappable 18650 batteries are convenient.

### 4. Case/Enclosure

Consider whether you want:
- A bare board (cheapest, most hackable)
- A basic case (protects the device)
- A weatherproof enclosure (for outdoor installation)

## Popular Devices Compared

### Heltec LoRa 32 V3

**Best for**: Budget-conscious beginners, portable use

**Pros**:
- Inexpensive (~$20)
- Compact size
- Built-in screen
- USB-C charging
- Good community support

**Cons**:
- No GPS
- Small battery capacity
- Needs external antenna for best range

### LilyGo T-Beam

**Best for**: GPS tracking, longer battery life

**Pros**:
- Built-in GPS
- 18650 battery (swappable, high capacity)
- Built-in screen
- Well-documented

**Cons**:
- Larger form factor
- Micro USB (not USB-C on older versions)
- Slightly more expensive

### RAK WisBlock

**Best for**: Custom builds, solar installations

**Pros**:
- Modular design
- Low power consumption
- Great for solar projects
- Industrial quality

**Cons**:
- More complex assembly
- Higher cost for full kit
- Steeper learning curve

### B&Q Station G2

**Best for**: Backbone relays, rooftop/mast repeaters, maximum range

**Pros**:
- 35 dBm PA with high receiver sensitivity
- Ready to use out of box
- Built-in GPS and battery
- Weather-resistant enclosure
- USB-C

**Cons**:
- Higher price (~$109)
- Less hackable than bare boards
- Frequently sold out — order early

### LilyGo T-Echo

**Best for**: All-day carry, efficient battery use, pocketable messenger

**Pros**:
- nRF52840 chipset — much lower power draw than ESP32
- Built-in e-paper display readable in sunlight
- Compact, enclosed form factor out of the box
- Good community support

**Cons**:
- No built-in GPS on all variants (check before buying)
- Smaller community than Heltec/T-Beam
- Slower Bluetooth pairing on some phones

## Where to Buy

### Amazon (Fast Shipping)
- Heltec V3
- LilyGo T-Beam
- Various accessories

### AliExpress (Budget Option)
- All devices cheaper
- 2-4 week shipping
- Direct from manufacturer

### Specialty Retailers
- Rokland (US-based, antenna specialists)
- Neil Hao's store (T-Beam accessories)
- RAK Store (WisBlock ecosystem)

## Our Charleston Recommendation

For Charleston specifically, we recommend the **Heltec V3** or **T-Beam Supreme** for most new members because:

1. **Flat terrain** - We don't need extreme range; mesh density matters more
2. **Hurricane prep** - Swappable batteries (T-Beam) or USB power banks work great
3. **Community support** - Most local members use these devices, so help is available

For anyone planning a rooftop or elevated fixed node to fill coverage gaps, a **B&Q Station G2** is worth the extra cost. A growing number of 2026 Charleston members are also running **nRF52-based devices (T-Echo, RAK WisBlock)** for better battery life.

## What Else You'll Need

Regardless of device, plan to get:

1. **Better antenna** - The included antennas are often mediocre. A $10-15 upgrade makes a big difference.
2. **Case** (if not included) - 3D printed or purchased
3. **Power solution** - USB power bank, battery, or wall adapter

## Next Steps

Once you've chosen your device:

1. Order it (Amazon for speed, AliExpress for savings)
2. While waiting, join our Discord and introduce yourself
3. Read the [Flashing Firmware](/guides/flashing-firmware) guide
4. Come to a meetup - we can help with initial setup!
