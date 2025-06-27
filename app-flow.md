# 📲 SnapConnect App Flow Design

## 🎯 App Goal

A Snapchat-style mobile app built with Expo, NativeWind, and Supabase, designed for fast media sharing (photos/videos) and daily wellness-based engagement. Users can capture, send, and view disappearing media, interact with friends, and complete challenges.

---

## 🚀 User Journey Overview

1. Launch app
2. Complete onboarding + permissions
3. Sign up / log in
4. Setup profile
5. Land on camera (default tab)
6. Navigate to:
   - Feed (stories)
   - Camera
   - Messages
   - Challenges (optional)
   - Profile
7. Capture + share content
8. View/respond to snaps
9. Track progress / repeat

---

## 🧭 App Screens

### 1. Splash & Onboarding

- Show logo or animation (optional)
- Onboarding slides (optional)
- Ask permissions:
  - Camera
  - Microphone
  - Media library
  - Notifications

---

### 2. Authentication

- Sign up / Log in
- Support social login (Google/Apple)
- Store session with Supabase Auth
- Redirect to profile setup after first login

---

### 3. Profile Setup

- Capture avatar or choose emoji
- Enter username, optional bio
- Select wellness interests (tags)
- Optional: sync contacts or invite friends

---

### 4. Home / Feed (Stories)

- Horizontal scroll of story cards
- Tap to open → full-screen view
- Auto-play with timer (1–10 seconds)
- Swipe up for reactions / chat
- Long press: pause, save, report

---

### 5. Camera Screen (Default tab)

- Capture photo or hold for video
- Switch front/back, flash toggle
- Add text, stickers, drawings
- Post options:
  - Send to friends
  - Post to story
  - Save to device
- Optional: filters (wellness-themed), overlays (e.g., step count)

---

### 6. Messages

- Chat list with last message preview
- One-on-one or group chats
- Send snaps, emojis, or text
- Snaps disappear after viewed
- Typing indicator and time-since-sent

---

### 7. Challenges / Discover (Optional)

- Daily wellness challenge cards
- Join challenge and post snap
- View leaderboard or others' entries
- Optional: health-related rewards or streaks

---

### 8. Profile Screen

- View your posted stories
- Edit bio, photo, username
- Settings (privacy, notifications)
- Streak tracker or snap stats (optional)

---

## ⚙️ Technical Notes

| Feature                 | Stack / Tool                      |
|-------------------------|------------------------------------|
| Camera                  | `expo-camera`                      |
| Media Library           | `expo-media-library`               |
| Video Playback          | `expo-av`                          |
| State Management        | Zustand                            |
| Animations              | Reanimated 3                       |
| Auth                    | Supabase Auth                      |
| Storage (Snaps)         | Supabase Storage + signed URLs     |
| Navigation              | React Navigation                   |
| Styling                 | NativeWind                         |
| Notifications           | `expo-notifications`               |

---

## 🔐 Permissions

- Camera access
- Microphone (for video snaps)
- Media Library (view gallery)
- Notifications (snap received)

---

## 🧠 Notes for AI Agent (Claude)

- Use clean React Native component structure.
- Build screen flows modularly.
- Use placeholder assets (e.g., dummy snaps).
- Prioritize **Camera → Story Sharing → Feed → Messaging** as MVP.
- Add conditional logic for disappearing messages/snaps.
- Use Supabase row-level security (RLS) for storing private snaps/messages.
- Handle onboarding flow with async storage or Supabase flags.

---

## ❓ Open Decisions (Claude can help!)

- Should story snaps be archived after expiry?
- Should camera filters be built in or use external lib?
- Do we build streak logic now or post-MVP?

