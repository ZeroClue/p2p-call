# Setup Guide

This guide will help you set up and run the P2P Video Call application.

## Prerequisites

- Node.js (v16 or higher)
- A Firebase account
- Modern web browser (Chrome, Firefox, or Edge recommended)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Firebase Project Setup

#### Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard

#### Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll to "Your apps" section
3. Click the web icon (`</>`) to add a web app
4. Register your app (you can skip Firebase Hosting for now)
5. Copy the `firebaseConfig` object

#### Configure Your App

1. Copy the example configuration file:

   ```bash
   cp firebase.ts.example firebase.ts
   ```

2. Open `firebase.ts` and replace the placeholder values with your Firebase config:
   ```typescript
   const firebaseConfig = {
     apiKey: 'YOUR_API_KEY',
     authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
     databaseURL: 'https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com',
     projectId: 'YOUR_PROJECT_ID',
     storageBucket: 'YOUR_PROJECT_ID.appspot.com',
     messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
     appId: 'YOUR_APP_ID',
   };
   ```

### 3. Enable Firebase Services

#### Enable Realtime Database

1. In Firebase Console, go to **Realtime Database**
2. Click "Create Database"
3. Choose a location (closest to your users)
4. Start in **test mode** (we'll deploy security rules later)

#### Enable Anonymous Authentication

**⚠️ IMPORTANT: This step is required or the app won't work!**

1. In Firebase Console, go to **Authentication**
2. Click on the **Sign-in method** tab
3. Find **Anonymous** in the list
4. Click on it and toggle **Enable** to ON
5. Click **Save**

### 4. Deploy Security Rules

Deploy the database security rules to protect your Firebase database:

```bash
firebase deploy --only database
```

If you don't have Firebase CLI installed:

```bash
npm install -g firebase-tools
firebase login
firebase init  # Select your project
firebase deploy --only database
```

### 5. Run the Development Server

```bash
npm run dev
```

The app will be available at http://localhost:5173

### 6. Build for Production

```bash
npm run build
```

The production build will be in the `dist/` directory.

### 7. Deploy to Firebase Hosting (Optional)

```bash
firebase deploy
```

Or deploy only hosting:

```bash
firebase deploy --only hosting
```

## Common Issues & Solutions

### Authentication Error: "CONFIGURATION_NOT_FOUND"

**Problem:** Anonymous authentication is not enabled in Firebase.

**Solution:**

1. Go to Firebase Console → Authentication → Sign-in method
2. Enable Anonymous authentication
3. Refresh the app

### "Permission denied" errors in console

**Problem:** Firebase security rules haven't been deployed.

**Solution:**

```bash
firebase deploy --only database
```

### Camera/Microphone not working

**Problem:** Browser permissions or HTTPS requirement.

**Solution:**

- Allow camera/microphone permissions when prompted
- In production, the app must be served over HTTPS
- For local development, `localhost` is allowed

### Build fails with Tailwind CSS errors

**Problem:** Content configuration issue.

**Solution:**
Make sure `tailwind.config.js` has correct paths:

```javascript
content: [
  "./index.html",
  "./index.tsx",
  "./App.tsx",
  "./components/**/*.{js,ts,jsx,tsx}",
  "./hooks/**/*.{js,ts,jsx,tsx}",
  "./utils/**/*.{js,ts,jsx,tsx}",
],
```

## Testing

Run the test suite:

```bash
npm test
```

Run tests with UI:

```bash
npm run test:ui
```

Generate coverage report:

```bash
npm run test:coverage
```

## PWA Setup (Optional)

To enable full PWA functionality, create app icons:

1. Create `public/icon-192.png` (192x192 pixels)
2. Create `public/icon-512.png` (512x512 pixels)

You can use a tool like [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator) to generate icons.

## Production Checklist

Before deploying to production:

- [ ] Firebase configuration set in `firebase.ts`
- [ ] Anonymous authentication enabled in Firebase Console
- [ ] Database security rules deployed
- [ ] App icons created (`icon-192.png`, `icon-512.png`)
- [ ] Tests passing (`npm test`)
- [ ] Production build successful (`npm run build`)
- [ ] TURN servers configured (consider paid service for better reliability)
- [ ] Error tracking configured (optional but recommended)

## Environment-Specific Notes

### Development

- Service worker may cache aggressively; use hard refresh (Ctrl+Shift+R)
- HTTPS not required for `localhost`
- Hot module replacement enabled

### Production

- HTTPS enforced automatically
- Service worker provides offline capability
- Optimized bundle with tree-shaking
- Security headers configured in `firebase.json`

## Getting Help

- **Firebase Issues:** Check [Firebase Documentation](https://firebase.google.com/docs)
- **WebRTC Issues:** Check browser console for detailed errors
- **Build Issues:** Ensure all dependencies are installed and Node.js version is correct

## Next Steps

After setup:

1. **Test locally**: Create a call and join from another browser tab
2. **Test on network**: Join from another device on same network
3. **Test E2EE**: Enable encryption in lobby and verify the lock icon appears
4. **Test reconnection**: Disconnect/reconnect your network during a call
5. **Deploy**: Deploy to Firebase Hosting and test with the production URL

## Advanced Configuration

### Custom TURN Servers

For production, consider using paid TURN services for better connection reliability:

1. Sign up for a TURN service (Twilio, Xirsys, or self-hosted coturn)
2. Update `constants.ts` with your TURN credentials:

```typescript
export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:your-turn-server.com:3478',
      username: 'your-username',
      credential: 'your-credential',
    },
  ],
};
```

### Error Tracking

To add error tracking (e.g., Sentry):

1. Install Sentry SDK: `npm install @sentry/react`
2. Update `components/ErrorBoundary.tsx` to send errors to Sentry
3. Add Sentry initialization in `index.tsx`

---

**You're all set! Enjoy your secure P2P video calling app!** 🎉
