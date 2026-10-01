# Driver Monitoring System (Prototype)

A browser-based, real-time driver drowsiness monitoring prototype built with
React, TypeScript, Vite, and MediaPipe Face Landmarker. All webcam processing
happens **locally in the browser** — no video, images, or facial landmarks
are ever uploaded.

> **This is a student research prototype, not a certified automotive safety
> system.** It does not medically diagnose fatigue and cannot guarantee
> accident prevention. The wording used throughout the app is deliberately
> "Possible Drowsiness Detected," not a diagnostic claim.

---

## 1. Installation

Requires Node.js 18+.

```bash
cd driver-monitoring
npm install
npm run dev
```

Then open the printed local URL (typically `http://localhost:5173`) in a
modern browser (Chrome, Edge, or Firefox recommended for WebGL/WASM support).

To build for production:

```bash
npm run build
npm run preview
```

### Authentication mode

By default the app uses a **local, browser-only auth** system (works out of
the box, zero setup — passwords are SHA-256 hashed and stored only in
`localStorage`, and a session never leaves the device). This is fine for a
student demo.

To use real Firebase Authentication instead:

1. Copy `.env.example` to `.env`.
2. Set `VITE_AUTH_PROVIDER=firebase`.
3. Fill in your Firebase project's `VITE_FIREBASE_API_KEY`,
   `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and
   `VITE_FIREBASE_APP_ID` (from Firebase Console → Project Settings).
4. Enable Email/Password sign-in under Firebase Authentication → Sign-in
   method.
5. Restart `npm run dev`.

No other code changes are needed — `src/services/auth.ts` reads
`VITE_AUTH_PROVIDER` and switches implementations automatically.

---

## 2. Camera Permissions

On first clicking **Start Monitoring**, your browser will prompt for camera
access. You must click **Allow**. If you accidentally deny it:

- Chrome/Edge: click the camera icon in the address bar → Allow → reload.
- Firefox: click the padlock icon → Permissions → Allow Camera.

The app requests `video: true, audio: false` and never records or transmits
the stream — it's decoded frame-by-frame directly into the MediaPipe model
running in WebAssembly/WebGL in your browser.

---

## 3. How MediaPipe Is Used

The app uses **MediaPipe Tasks Vision — FaceLandmarker** (`@mediapipe/tasks-vision`),
loaded from Google's CDN, running in `VIDEO` mode with
`outputFacialTransformationMatrixes: true`. On each animation frame:

1. The current `<video>` frame is passed to `faceLandmarker.detectForVideo()`.
2. It returns up to 478 3D face-mesh landmarks per detected face, plus a 4x4
   facial transformation matrix used for head pose.
3. Landmarks are drawn as a light overlay (eyes, mouth, face outline) on a
   `<canvas>` positioned over the video — not all 478 points, to avoid visual
   noise.
4. EAR, MAR, and head pose are computed from specific landmark indices (see
   `src/utils/ear.ts`, `src/utils/mar.ts`, `src/utils/headPose.ts`).

## 4. Eye Aspect Ratio (EAR)

```
EAR = (‖p2-p6‖ + ‖p3-p5‖) / (2 · ‖p1-p4‖)
```

computed separately for each eye from 6 landmarks around it, then averaged.
EAR drops sharply when eyes close. Because eye shape and camera setup vary
per person, the app **does not hard-code a single universal threshold**.
Instead:

- Before monitoring (or via the **Calibrate** button), the user looks
  normally at the camera for 5 seconds.
- The median EAR from that window becomes the **baseline EAR**.
- The **eye closure threshold** is set to 75% of the baseline.
- If calibration is skipped, a documented fallback default is used
  (`src/utils/calibration.ts`).

## 5. Mouth Aspect Ratio (MAR)

```
MAR = average(vertical mouth openings) / horizontal mouth width
```

using inner-lip landmarks. A yawn is only counted when MAR exceeds a
threshold **and** stays open for a minimum sustained duration — this
prevents talking, laughing, or a single wide frame from being misread as a
yawn.

## 6. Head Pitch (and Yaw/Roll)

Head pose is derived from MediaPipe's **facial transformation matrix** (a
real 3D rotation fit to the mesh), not from a single landmark's Y-coordinate.
The rotation matrix is decomposed into pitch/yaw/roll (`src/utils/headPose.ts`).
Sustained negative pitch (looking down) beyond a threshold contributes to
the drowsiness index and is shown as a "Looking Down" state.

## 7. Drowsiness Calculation

The **Prototype Drowsiness Index** (0-100) is a weighted composite of five
temporal signals over a rolling ~30-second window, not a simple point-add
system:

| Signal | Weight |
|---|---|
| % of time eyes closed | 35 |
| Longest single eye closure | 25 |
| Yawn rate | 15 |
| Head-down percentage | 15 |
| Blink-rate deviation from normal | 10 |

See `src/services/drowsiness.ts` for the exact formula and rationale for
each weight. Bands (Low 0-30 / Moderate 31-60 / High 61-80 / Critical 81-100)
are **prototype thresholds**, not clinically validated cut-offs.

False-alarm prevention: the index and alert level only escalate when a face
is reliably detected with both eyes visible; missing/ambiguous landmarks are
never treated as "eyes closed," and a single frame never triggers an alert.

## 8. Limitations

- Not a certified or medically validated fatigue-detection device.
- Accuracy depends heavily on lighting, camera angle/quality, glasses,
  facial hair, and calibration quality.
- Designed for a single front-facing camera and a single visible driver;
  behavior with multiple faces is flagged but not fully handled.
- Runs entirely client-side, so performance (target ~20-30 FPS) depends on
  the user's device.
- Does not connect to a real vehicle and cannot take any physical action.

## 9. Privacy

- Webcam video is **never** uploaded, recorded to disk, or sent to a server.
- No face images or raw landmark coordinates are stored anywhere, including
  locally.
- Only aggregate **session statistics** (durations, counts, indices) are
  saved, in the browser's `localStorage`, scoped to the logged-in user.
- The **Stop Camera** / **Stop** control immediately stops all camera
  tracks (`stream.getTracks().forEach(t => t.stop())`).

## 10. Future Improvements

- Persist calibration per user across sessions (not just per monitoring run).
- Export session history as CSV/PDF.
- Configurable alert thresholds and response-timeout in Profile settings.
- Optional cloud sync of session *statistics only*, with explicit opt-in.
- Multi-camera / infrared support for low-light robustness.
- Formal validation study against a labeled drowsiness dataset before any
  real-world safety claims are made.

---

## Project Structure

```
src/
  components/
    CameraMonitor.tsx      # webcam + MediaPipe processing loop
    FaceOverlay.tsx        # canvas landmark drawing
    MetricCard.tsx
    AlertPanel.tsx
    DrowsinessGauge.tsx
    CalibrationPanel.tsx
    Navbar.tsx
    ProtectedRoute.tsx
  pages/
    Home.tsx  Login.tsx  Register.tsx  Dashboard.tsx
    Monitoring.tsx  History.tsx  Profile.tsx  About.tsx
  services/
    mediapipe.ts   faceAnalysis.ts   drowsiness.ts   auth.ts
  utils/
    ear.ts   mar.ts   headPose.ts   calibration.ts   storage.ts
  context/
    AuthContext.tsx
  App.tsx
  main.tsx
```
