# Orbi — Virtual Free-Space Optical Communication System

> An interactive engineering prototype exploring satellite-to-ground free-space optical communication, link acquisition, tracking, prediction, and recovery.

🏆 **Context:** Smart India Hackathon project (SIH 26169)  
📦 **Repository:** [Orbi-Virtual_FSOC_System](https://github.com/sakilahmed-git/Orbi-Virtual_FSOC_System)  
🌐 **Hosted demo:** No public demo link is currently documented in this README.

## Overview

Orbi explores how a free-space optical communication (FSOC) system can be represented as a live, observable software experience rather than a static simulation. The intended experience combines a mission-control interface with a 3D scene for visualising a satellite, ground station, optical link, and the process of acquiring and maintaining a connection.

The project direction is to make acquisition more intelligent: observe system behaviour, track link conditions, predict potential issues, and support faster recovery using information learned from earlier attempts.

## Project goals

- Visualise satellite and ground-station elements in a 3D mission environment.
- Represent the optical communication path and link state.
- Demonstrate coarse acquisition and link-establishment stages.
- Surface system state and predictive guidance in a mission-control dashboard.
- Explore tracking, disconnection, and recovery flows.
- Use event-camera data and scene/event emulation to test acquisition and tracking concepts.

## Why this project is ambitious

- **Specialised engineering domain:** applies software and simulation to a space-communication challenge.
- **Visual and technical integration:** connects a 3D interface with system state, events, and backend services.
- **Reliability-oriented thinking:** focuses on observable acquisition, failure, and recovery—not just a successful connection.
- **Data-informed experimentation:** explores event data and emulation to make system behaviour testable.

## Technology direction

The repository's previous README contained only a short project label, so the complete stack and implementation status should be confirmed against the source tree. Development work has included a Next.js interface, React Three Fiber/Three.js, and Python components for event emulation and data processing.

## Live and development status

| Area | Status |
|---|---|
| Project concept and prototype development | In progress |
| Public hosted demo | Not documented |
| Complete end-to-end optical link simulation | Not claimed without a verified demo |
| SIH project context | SIH 26169 |

This README describes the project's goals and development direction. It does not claim that every planned feature is complete or publicly deployed.

## Development

The wider setup includes a `web` application and Python-side components. Review the repository's dependency files and scripts before starting each service; the frontend and Python API may need to run separately.

## Vision

Make optical-link acquisition observable, predictive, testable, and recoverable—bringing together simulation, engineering data, and a mission-control experience.
