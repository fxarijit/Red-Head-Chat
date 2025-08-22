const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp(); // Initialize Firebase Admin SDK

const db = admin.database(); // Firebase Realtime Database reference

/**
 * HTTP Callable Cloud Function to create a new public user.
 * Accessible only by authenticated administrators.
 */
exports.createPublicUser = functions.https.onCall(async (data, context) => {
    // 1. Authenticate the caller
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Only authenticated users can call this function.');
    }

    const callerUid = context.auth.uid;

    // 2. Authorize the caller: Check if the authenticated caller is an admin.
    try {
        const adminUserSnapshot = await db.ref(`users/${callerUid}`).once('value');
        const adminUserData = adminUserSnapshot.val();

        if (!adminUserData || !adminUserData.isAdmin) {
            console.warn(`Permission denied: User ${callerUid} attempted to create a user but is not an admin.`);
            throw new functions.https.HttpsError('permission-denied', 'Only administrators can create public user accounts.');
        }
    } catch (error) {
        console.error("Error verifying admin status:", error);
        throw new functions.https.HttpsError('internal', 'Failed to verify administrator status.', error.message);
    }

    // 3. Extract and validate input
    const { username, password } = data;

    if (!username || !password) {
        throw new functions.https.HttpsError('invalid-argument', 'Username and password are required.');
    }
    if (password.length < 6) {
        throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 6 characters long.');
    }

    const dummyEmail = `${username.toLowerCase()}@yourchatapp.com`;

    try {
        // 4. Check for existing username (via dummy email) in Firebase Auth
        try {
            await admin.auth().getUserByEmail(dummyEmail);
            throw new functions.https.HttpsError('already-exists', 'A user with that username already exists.');
        } catch (error) {
            if (error.code !== 'auth/user-not-found') {
                console.error(`Error checking for existing user by email ${dummyEmail}:`, error);
                throw new functions.https.HttpsError('internal', 'Failed to check for existing username.', error.message);
            }
        }

        // 5. Create user in Firebase Authentication
        const userRecord = await admin.auth().createUser({
            email: dummyEmail,
            password: password,
            displayName: username,
        });

        const newUid = userRecord.uid;

        // 6. Store user profile in Realtime Database
        await db.ref(`users/${newUid}`).set({
            uid: newUid,
            username: username,
            email: dummyEmail,
            isAdmin: false,
            createdAt: admin.database.ServerValue.TIMESTAMP,
        });

        return {
            status: 'success',
            message: `User "${username}" created successfully.`,
            uid: newUid,
        };

    } catch (error) {
        console.error("Error during public user creation process:", error);
        if (error.code && error.details) {
            throw error;
        }
        throw new functions.https.HttpsError('unknown', 'Failed to create public user account.', error.message);
    }
});
