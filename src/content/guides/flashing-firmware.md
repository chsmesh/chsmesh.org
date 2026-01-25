---
title: "Flashing Meshtastic Firmware"
description: "Step-by-step guide to flashing Meshtastic firmware to your device using the web flasher - no coding required."
difficulty: beginner
category: getting-started
order: 3
readingTime: 10
prerequisites:
  - A Meshtastic-compatible device
  - USB cable (data capable, not charge-only)
  - Chrome or Edge browser (Firefox doesn't support Web Serial)
---

## Overview

Flashing firmware is how you install or update the Meshtastic software on your device. Thanks to the web flasher, this is now incredibly easy - no coding or command line required.

## Before You Start

### Check Your USB Cable

**This is the #1 issue people have!** Many USB cables are charge-only and don't carry data. If your device isn't detected:

1. Try a different cable
2. Use the cable that came with your device
3. Test with a known data cable

### Identify Your Device

Know exactly which device you have:
- **Heltec V3** (not V2!)
- **LilyGo T-Beam** (note the version: Supreme, S3, etc.)
- **RAK WisBlock** (specify core module)

Using the wrong firmware can brick your device.

## Flashing Process

### Step 1: Open the Web Flasher

Go to [flasher.meshtastic.org](https://flasher.meshtastic.org) in Chrome or Edge.

### Step 2: Select Your Device

1. Click "Select Device"
2. Choose your exact device model from the list
3. If unsure, check the markings on your board

### Step 3: Connect Your Device

1. Plug in your device via USB
2. Click "Connect"
3. Select the correct serial port from the popup
   - Usually shows as "CP210x" or "CH340" or similar

**Device not showing?**
- Try a different USB port
- Check your cable (see above)
- On Windows, you may need to install drivers

### Step 4: Flash the Firmware

1. Select the firmware version (usually "Stable" for most users)
2. Click "Flash"
3. Wait for the process to complete (1-3 minutes)
4. Do not disconnect during flashing!

### Step 5: Verify

After flashing:
1. Your device should reboot automatically
2. The screen should show the Meshtastic logo
3. It will display firmware version and node info

## Troubleshooting

### "No device found"

1. **Try a different cable** - Most common issue
2. **Install drivers** - 
   - [CP210x drivers](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers)
   - [CH340 drivers](https://sparks.gogo.co.nz/ch340.html)
3. **Try a different USB port** - Front ports are sometimes unreliable
4. **Restart your browser** - Web Serial can be finicky

### "Flash failed" or "Write error"

1. Hold the BOOT button while connecting
2. Try flashing again
3. If repeated failures, device may need recovery mode

### Device bricked / won't boot

1. Hold BOOT button
2. Press and release RESET while holding BOOT
3. Release BOOT after 2 seconds
4. Try flashing again

### Wrong firmware flashed

If you accidentally flashed the wrong device type:
1. Your device may not boot properly
2. Use the recovery steps above
3. Flash the correct firmware

## Alternative Methods

### esptool (Command Line)

For advanced users or if web flasher fails:

```bash
# Install esptool
pip install esptool

# Erase flash
esptool.py --chip esp32s3 erase_flash

# Flash firmware (download .bin files first)
esptool.py --chip esp32s3 write_flash 0x0 firmware.bin
```

### Meshtastic Flasher App

A desktop app that provides similar functionality:
- Download from [Meshtastic downloads page](https://meshtastic.org/downloads)
- Good backup option if web flasher has issues

## After Flashing

Your device is now running Meshtastic, but it needs configuration:

1. **Connect the app** - Download the Meshtastic app (iOS/Android)
2. **Pair via Bluetooth** - Your device will broadcast as "Meshtastic_XXXX"
3. **Initial setup** - Set your region (US), name, etc.

Continue to the [Initial Setup Guide](/guides/initial-setup) for next steps.

## Keeping Updated

Meshtastic releases updates regularly. To update:

1. Check [meshtastic.org](https://meshtastic.org) for new versions
2. Follow the same flashing process
3. Your settings are usually preserved (but backup first!)

We recommend updating when:
- Security fixes are released
- You're having issues that might be firmware-related
- New features you want are available
