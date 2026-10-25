# TrailSync-Mountain-Trekking-Project

A Smart Eco-Tourism and Trail Management System with Automated Guide Dispatching, Real-Time Trekker Monitoring, Weather Intelligence, Digital Certification, and Tourism Analytics for Analytics

Project Name: TrailSync Mountain Trekking Booking and Tracking System
Purpose:

# System Architecture

The project follows a **Test-Driven Development** approach, where each feature is tested first, the implementation is then developed to make the test pass, and the code is then refactored.

# Core Features

# Tech Stack

PERN Stack

Frontend: React.js for Web app & Flutter for cross-platform app development

Backend: Node.js

Database: PostgreSQL

Authentication: Firebase Auth & OAuth2

Testing Framework: Jest

Database Object-Relational Mapper (ORM): Prisma

# Notes:

PostgreSQL DB User: `trailsync_app`

# Testing on your phone (same network)

1. Leave `VITE_API_BASE_URL` empty in `frontend/.env.local` so API calls go through the Vite proxy.
2. Run `npm run dev` from the repo root and open the `Network:` URL Vite prints (e.g. `http://192.168.1.24:5173`) on your phone.
3. Add that IP to Firebase Console → Authentication → Settings → Authorized domains, or sign-in will fail.
4. If a firewall is on, allow the port: `sudo ufw allow 5173/tcp`.

The IP can change when the router reassigns it; reserve a fixed IP for the dev machine in the router to avoid re-adding it in Firebase. Plain HTTP on a LAN IP is not a secure context, so browser APIs such as camera and geolocation will not work this way.
