// --- Firebase Configuration ---
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA9Hyb4nv6yZcyOqI_azRLB0v31jdO3YvU", // <--- CRITICAL: REPLACE WITH YOUR ACTUAL API KEY FROM FIREBASE CONSOLE!
  authDomain: "red-head-7391.firebaseapp.com",
  databaseURL: "https://red-head-7391-default-rtdb.firebaseio.com",
  projectId: "red-head-7391",
  storageBucket: "red-head-7391.firebasestorage.app", // For Firebase Storage
  messagingSenderId: "408168002586",
  appId: "1:408168002586:web:f9920d13106cbe375b8da3",
  measurementId: "G-N6QX49H4KN" // Optional
};

// Initialize Firebase App
const app = firebase.initializeApp(firebaseConfig);

// Get service instances
const auth = firebase.auth();
const database = firebase.database();
const storage = firebase.storage(); // For Firebase Storage

// --- DOM Elements ---
const authSection = document.getElementById('auth-section');
const chatSection = document.getElementById('chat-section');
const usernameInput = document.getElementById('username-input');
const passwordInput = document.getElementById('password-input');
const loginButton = document.getElementById('login-button');
const loginError = document.getElementById('login-error');
const logoutButton = document.getElementById('logout-button');
const currentUsernameDisplay = document.getElementById('current-username-display');
const messageDisplay = document.getElementById('message-display');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const mediaInput = document.getElementById('media-input'); // NEW

let currentUser = null; // Store current Firebase User object
let currentUserName = ''; // Store the username from RTDB
let adminUid = null; // We need to fetch the admin's UID to form the chat ID
let publicUserAdminChatId = null; // The chat ID for this specific public user and admin

// --- Utility Functions ---
function generateChatId(uid1, uid2) {
    // Ensure consistent order for chat ID generation (alphabetical)
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

// Function to render media content
function renderMedia(type, url) {
    let mediaHtml = '';
    if (type.startsWith('image')) {
        mediaHtml = `<img src="${url}" alt="Image">`;
    } else if (type.startsWith('video')) {
        mediaHtml = `<video src="${url}" controls></video>`;
    } else if (type.startsWith('audio')) {
        mediaHtml = `<audio src="${url}" controls></audio>`;
    }
    return mediaHtml;
}

// --- UI State Management ---
function showAuthSection() {
    authSection.style.display = 'flex';
    chatSection.style.display = 'none';
    messageDisplay.innerHTML = '<div class="chat-empty-state"><p>Start a conversation with the Admin!</p></div>'; // Clear on logout
    loginError.textContent = ''; // Clear login error
    usernameInput.value = '';
    passwordInput.value = '';
}

function showChatSection() {
    authSection.style.display = 'none';
    chatSection.style.display = 'flex';
}

// --- Firebase Authentication (Public User) ---
async function loginUser() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    loginError.textContent = 'Logging in...';
    loginError.style.color = 'gray';

    if (!username || !password) {
        loginError.textContent = "Please enter both username and password.";
        loginError.style.color = 'var(--error-color)';
        return;
    }

    loginButton.disabled = true;

    try {
        const email = `${username.toLowerCase()}@yourchatapp.com`; // Consistent dummy email as per Cloud Function (even if manual)
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        currentUser = userCredential.user;
        console.log("User logged in successfully:", currentUser.uid);

        // Fetch actual username and isAdmin status from Realtime Database
        const userRef = database.ref(`users/${currentUser.uid}`);
        const snapshot = await userRef.once('value'); // Use once('value') for initial fetch
        const userData = snapshot.val();

        if (userData && !userData.isAdmin) { // Ensure they are NOT an admin
            currentUserName = userData.username;
            currentUsernameDisplay.textContent = `${currentUserName}`;

            // Fetch admin UID to form the chat ID (find the single admin)
            const adminUserSnapshot = await database.ref('users').orderByChild('isAdmin').equalTo(true).limitToFirst(1).once('value');
            const adminData = adminUserSnapshot.val();

            if (adminData) {
                adminUid = Object.keys(adminData)[0]; // Get the first admin UID
                publicUserAdminChatId = generateChatId(currentUser.uid, adminUid);
                console.log("Admin UID found:", adminUid, "Chat ID:", publicUserAdminChatId);

                showChatSection();
                setupChatListener(publicUserAdminChatId); // Start listening to messages
                usernameInput.value = '';
                passwordInput.value = '';
            } else {
                console.error("No admin user found in database. Cannot start chat.");
                loginError.textContent = "No admin available to chat with.";
                loginError.style.color = 'var(--error-color)';
                auth.signOut();
            }

        } else {
            console.error("User profile missing, is an admin, or wrong account type for public access.");
            loginError.textContent = "Invalid account type for public access.";
            loginError.style.color = 'var(--error-color)';
            auth.signOut(); // Force logout
        }

    } catch (error) {
        console.error("Login failed:", error.message, "Code:", error.code);
        let displayErrorMessage = `Login failed: ${error.message}`;
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            displayErrorMessage = 'Incorrect username or password.';
        } else if (error.code === 'auth/invalid-email') {
            displayErrorMessage = 'Invalid username format.'; // Should not happen with dummy email system
        } else if (error.code === 'auth/network-request-failed') {
            displayErrorMessage = 'Network error. Please check your internet connection.';
        }
        loginError.textContent = displayErrorMessage;
        loginError.style.color = 'var(--error-color)';
    } finally {
        loginButton.disabled = false;
    }
}

async function logoutUser() {
    try {
        await auth.signOut();
        console.log("User logged out successfully.");
        currentUsernameDisplay.textContent = '';
        currentUser = null;
        currentUserName = '';
        adminUid = null;
        publicUserAdminChatId = null;
        if (unsubscribeChat) {
            unsubscribeChat(); // Unsubscribe from chat listener
        }
        showAuthSection();
    } catch (error) {
        console.error("Logout failed:", error.message);
    }
}

// --- Firebase Realtime Database (Chat) ---
let unsubscribeChat = null; // To store the unsubscribe function for the chat listener

function setupChatListener(chatId) {
    if (unsubscribeChat) {
        unsubscribeChat(); // Unsubscribe previous listener if exists
    }

    const messagesRef = database.ref(`chats/${chatId}/messages`);

    // Listen for messages in real-time
    unsubscribeChat = messagesRef.on('value', async (snapshot) => {
        const messagesData = snapshot.val();
        messageDisplay.innerHTML = ''; // Clear previous messages
        const messagesList = [];

        if (messagesData) {
            for (let id in messagesData) {
                messagesList.push({ id, ...messagesData[id] });
            }
            messagesList.sort((a, b) => a.timestamp - b.timestamp);
        }

        if (messagesList.length === 0) {
            messageDisplay.innerHTML = '<div class="chat-empty-state"><p>Start a conversation with the Admin!</p></div>';
        } else {
            for (const msg of messagesList) {
                const messageElement = document.createElement('div');
                messageElement.classList.add('message-bubble');

                const isSelf = currentUser && msg.senderId === currentUser.uid;
                messageElement.classList.add(isSelf ? 'message-self' : 'message-other');

                const senderName = isSelf ? currentUserName : "Admin"; // Simplified for 1-on-1 chat

                messageElement.innerHTML = `
                    <span class="message-sender-name">${senderName}</span>
                    <div class="message-content">${msg.text || ''}</div>
                `;

                // Handle media content if present
                if (msg.mediaUrl && msg.mediaType) {
                    messageElement.innerHTML += `<div class="message-media">${renderMedia(msg.mediaType, msg.mediaUrl)}</div>`;
                }

                messageElement.innerHTML += `<span class="message-timestamp">${new Date(msg.timestamp).toLocaleTimeString()}</span>`;
                
                messageDisplay.appendChild(messageElement);
            }
        }

        // Scroll to the bottom of the chat
        messageDisplay.scrollTop = messageDisplay.scrollHeight;

    }, (error) => {
        console.error("Error fetching messages:", error);
        messageDisplay.innerHTML = `<div class="chat-empty-state" style="color:var(--error-color);"><p>Error loading messages: ${error.message}</p></div>`;
    });
}

// --- Sending Messages (Text & Media) ---
async function sendMessage() {
    const messageText = messageInput.value.trim();
    const mediaFile = mediaInput.files[0];

    if ((!messageText && !mediaFile) || !currentUser || !publicUserAdminChatId) {
        // Don't send empty messages/files or if not logged in/chat not established
        return;
    }

    sendButton.disabled = true;
    mediaInput.disabled = true; // Disable media input during send
    loginError.textContent = ''; // Use loginError for temporary feedback
    loginError.style.color = 'gray';

    try {
        let messageData = {
            senderId: currentUser.uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };

        if (messageText) {
            messageData.text = messageText;
        }

        if (mediaFile) {
            loginError.textContent = 'Uploading media...';
            const mediaPath = `chat_media/${publicUserAdminChatId}/${currentUser.uid}/${Date.now()}_${mediaFile.name}`;
            const mediaRef = storage.ref(mediaPath);
            const uploadTask = mediaRef.put(mediaFile);

            // You can add upload progress here if needed
            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    loginError.textContent = `Upload: ${progress.toFixed(0)}%`;
                },
                (error) => {
                    console.error("Media upload error:", error);
                    throw new Error("Media upload failed.");
                }
            );

            await uploadTask; // Wait for upload to complete
            const mediaUrl = await mediaRef.getDownloadURL();

            messageData.mediaUrl = mediaUrl;
            messageData.mediaType = mediaFile.type;
        }

        const messagesRef = database.ref(`chats/${publicUserAdminChatId}/messages`);
        await messagesRef.push(messageData);

        messageInput.value = ''; // Clear text input
        mediaInput.value = ''; // Clear file input
        loginError.textContent = ''; // Clear media upload message

        console.log("Message sent!");
    } catch (error) {
        console.error("Error sending message:", error.message);
        loginError.textContent = `Error sending: ${error.message}`; // Display error
        loginError.style.color = 'var(--error-color)';
    } finally {
        sendButton.disabled = false;
        mediaInput.disabled = false;
    }
}


// --- Event Listeners ---
loginButton.addEventListener('click', loginUser);
logoutButton.addEventListener('click', logoutUser);
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});
mediaInput.addEventListener('change', () => {
    if (mediaInput.files[0]) {
        console.log("Media selected:", mediaInput.files[0].name, mediaInput.files[0].type);
        loginError.textContent = `File selected: ${mediaInput.files[0].name}`;
        loginError.style.color = 'gray';
    } else {
        loginError.textContent = '';
    }
});


// --- Initial Auth State Check ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        console.log("User already logged in:", user.uid);

        const userRef = database.ref(`users/${user.uid}`);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();

        if (userData && !userData.isAdmin) {
            currentUserName = userData.username;
            currentUsernameDisplay.textContent = `${currentUserName}`;

            const adminUserSnapshot = await database.ref('users').orderByChild('isAdmin').equalTo(true).limitToFirst(1).once('value');
            const adminData = adminUserSnapshot.val();

            if (adminData) {
                adminUid = Object.keys(adminData)[0];
                publicUserAdminChatId = generateChatId(currentUser.uid, adminUid);
                console.log("Chat ID on load:", publicUserAdminChatId);
                setupChatListener(publicUserAdminChatId);
                showChatSection();
            } else {
                console.error("No admin user found during initial auth check.");
                loginError.textContent = "No admin available to chat with.";
                loginError.style.color = 'var(--error-color)';
                auth.signOut();
                showAuthSection();
            }
        } else {
            console.error("Logged in user is an admin, or profile missing for public access.");
            auth.signOut(); // Force logout if admin or not a public user
            showAuthSection();
        }
    } else {
        console.log("No user logged in.");
        showAuthSection();
    }
});
