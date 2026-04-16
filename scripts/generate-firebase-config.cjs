#!/usr/bin/env node

/**
 * Generates firebase.ts from environment variables
 * Used in CI/CD to create the Firebase configuration file
 */

const fs = require('fs');
const path = require('path');

const requiredVars = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_DATABASE_URL',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_APP_ID',
];

const missing = requiredVars.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error('Missing required Firebase config environment variables:', missing.join(', '));
  process.exit(1);
}

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.FIREBASE_APP_ID,
};

const firebaseTs = `// Firebase Configuration
// Auto-generated from environment variables

declare const firebase: any;

const firebaseConfig = {
  apiKey: "${firebaseConfig.apiKey}",
  authDomain: "${firebaseConfig.authDomain}",
  databaseURL: "${firebaseConfig.databaseURL}",
  projectId: "${firebaseConfig.projectId}",
  storageBucket: "${firebaseConfig.storageBucket}",
  messagingSenderId: "${firebaseConfig.messagingSenderId}",
  appId: "${firebaseConfig.appId}"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Authentication and sign in anonymously
export const auth = firebase.auth();
export const db = firebase.database();
export const ServerValue = firebase.database.ServerValue;

// Sign in anonymously - this maintains privacy while securing the database
let authInitialized = false;
export const ensureAuthenticated = async (): Promise<void> => {
  if (authInitialized && auth.currentUser) {
    return;
  }

  try {
    await auth.signInAnonymously();
    authInitialized = true;
    console.log('Authenticated anonymously');
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
};

// Auto-authenticate on page load
auth.onAuthStateChanged((user: any) => {
  if (user) {
    authInitialized = true;
  }
});
`;

const outputPath = path.join(__dirname, '..', 'firebase.ts');
fs.writeFileSync(outputPath, firebaseTs, 'utf8');
console.log('firebase.ts generated successfully');