# GitHub Secrets Setup

The deployment workflow requires the following secrets to be configured in your GitHub repository.

## Required Secrets

Go to your repository settings → Secrets and variables → Actions → New repository secret

Add the following secrets:

### Firebase Configuration

These values come from your Firebase project configuration (same as in your local `firebase.ts` file):

- `FIREBASE_API_KEY` - Your Firebase API key
- `FIREBASE_AUTH_DOMAIN` - Your project's auth domain (e.g., `your-project.firebaseapp.com`)
- `FIREBASE_DATABASE_URL` - Your Realtime Database URL (e.g., `https://your-project-default-rtdb.firebaseio.com`)
- `FIREBASE_PROJECT_ID` - Your Firebase project ID
- `FIREBASE_STORAGE_BUCKET` - Your storage bucket (e.g., `your-project.appspot.com`)
- `FIREBASE_MESSAGING_SENDER_ID` - Your messaging sender ID
- `FIREBASE_APP_ID` - Your Firebase app ID

### Other Secrets

These should already be configured:

- `FIREBASE_SERVICE_ACCOUNT` - Firebase service account JSON for deployment
- `GEMINI_API_KEY` - Gemini API key (if used)

## How to Find Your Firebase Configuration

You can find these values in:

1. Firebase Console → Project Settings → General → Your apps → SDK setup and configuration
2. Or from your local `firebase.ts` file (don't commit this file!)

## Verification

After adding the secrets, the next deployment will:
1. Generate `firebase.ts` from environment variables
2. Build the application with the Firebase configuration
3. Deploy to Firebase Hosting

The build will fail if any required Firebase secret is missing.
