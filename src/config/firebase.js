const admin = require('firebase-admin');

const initializeFirebase = () => {
  try {
    // Initialize Firebase Admin SDK
    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase:', error.message);
    throw error;
  }
};

const verifyFirebaseToken = async (token) => {
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    throw new Error('Invalid Firebase token');
  }
};

const createFirebaseUser = async (email, password, displayName) => {
  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
      emailVerified: false,
    });
    return userRecord;
  } catch (error) {
    throw error;
  }
};

const deleteFirebaseUser = async (uid) => {
  try {
    await admin.auth().deleteUser(uid);
  } catch (error) {
    throw error;
  }
};

const updateFirebaseUser = async (uid, updates) => {
  try {
    const userRecord = await admin.auth().updateUser(uid, updates);
    return userRecord;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  admin,
  initializeFirebase,
  verifyFirebaseToken,
  createFirebaseUser,
  deleteFirebaseUser,
  updateFirebaseUser,
};