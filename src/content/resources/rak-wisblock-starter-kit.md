---
title: "RAK WisBlock Meshtastic Starter Kit"
description: "A low-power nRF52840 board that sips battery and has a solar charging input built in. The usual choice for an unattended relay."
category: devices
order: 3
links:
  - label: "RAKwireless Store"
    url: "https://store.rakwireless.com/products/wisblock-meshtastic-starter-kit"
    type: purchase
  - label: "Documentation"
    url: "https://meshtastic.org/docs/hardware/devices/rak-wireless/wisblock/"
    type: docs
pros:
  - Very low power draw, so a small panel and battery go a long way
  - Battery and solar connectors on the base board
  - No Wi-Fi to configure or leave switched on by accident
  - Modular, so you can add GPS or sensors later
cons:
  - No screen, case or battery in the basic kit
  - Battery and solar plugs are small JST connectors with a polarity you must check
  - No Wi-Fi, so it cannot be an MQTT gateway by itself
---

The starter kit pairs a RAK4631 core (an nRF52840 processor with an SX1262 LoRa radio) with a WisBlock base board. Order the US915 version.

## Why it suits a relay

A relay sits outdoors for years on whatever a small solar panel gives it. The nRF52840 uses a fraction of the power an ESP32 board does, which is the difference between a panel the size of a paperback and one the size of a doormat. The base board charges a single lithium cell from a 5 V panel with no extra parts.

## What else you need

A battery, a panel, an antenna and a box. [Building a Solar Relay Node](/guides/solar-relay-build/) lists them and shows how they go together.

## Check before you plug in

The battery and solar connectors look alike and are not interchangeable. Lithium cells sold with a pre-fitted plug are often wired the opposite way round to what the board expects. Compare the red and black wires with the markings on the board before connecting anything.
