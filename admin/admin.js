// --- Firebase Configuration ---
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA9Hyb4nv6yZcyOqI_azRLB0v31jdO3YvU", // <--- CRITICAL: REPLACE WITH YOUR ACTUAL API KEY!
  authDomain: "red-head-7391.firebaseapp.com",
  databaseURL: "https://red-head-7391-default-rtdb.firebaseio.com",
  projectId: "red-head-7391",
  storageBucket: "red-head-7391.firebasestorage.app", // NEW: For Firebase Storage
  messagingSenderId: "408168002586",
  appId: "1:408168002586:web:f9920d13106cbe375b8da3",
  measurementId: "G-N6QX49H4KN" // Optional
};

// Initialize Firebase App
const app = firebase.initializeApp(firebaseConfig);

// Get service instances
const auth = firebase.auth();
const database = firebase.database();
const functions = firebase.functions(); // For Firebase Cloud Functions
const storage = firebase.storage(); // NEW: For Firebase Storage

// --- DOM Elements ---
const adminLoginSection = document.getElementById('admin-login-section');
const adminDashboardSection = document.getElementById('admin-dashboard-section');
const adminEmailInput = document.getElementById('admin-email-input');
const adminPasswordInput = document.getElementById('admin-password-input');
const adminLoginButton = document.getElementById('admin-login-button');
const adminLoginError = document.getElementById('admin-login-error');
const adminUsernameDisplay = document.getElementById('admin-username-display');
const adminLogoutButton = document.getElementById('admin-logout-button');
const publicUsersList = document.getElementById('public-users-list');
const userSearchInput = document.getElementById('user-search-input'); // NEW: Search input
const currentChattedUsername = document.getElementById('current-chatted-username');
const adminMessageDisplay = document.getElementById('admin-message-display');
const adminMessageInput = document.getElementById('admin-message-input');
const adminSendButton = document.getElementById('admin-send-button');
const adminMediaInput = document.getElementById('admin-media-input'); // NEW: Admin media input

// User Creation DOM Elements
const newUsernameInput = document.getElementById('new-username-input');
const newPasswordInput = document.getElementById('new-password-input');
const createUserButton = document.getElementById('create-user-button');
const createUserMessage = document.getElementById('create-user-message');


let adminCurrentUser = null;
let adminUserName = '';
let allPublicUsers = []; // Store all public users for search filtering
let selectedPublicUserUid = null;
let selectedPublicUserName = '';
let currentAdminChatId = null; // chat ID for the current selected user

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
function showAdminLoginSection() {
    adminLoginSection.style.display = 'flex';
    adminDashboardSection.style.display = 'none';
    adminUsernameDisplay.textContent = '';
    adminLoginError.textContent = ''; // Clear login error
    adminEmailInput.value = '';
    adminPasswordInput.value = '';
}

function showAdminDashboardSection() {
    adminLoginSection.style.display = 'none';
    adminDashboardSection.style.display = 'flex';
    adminUsernameDisplay.textContent = adminUserName;
    // Reset chat and user selection states
    selectedPublicUserUid = null;
    selectedPublicUserName = '';
    currentChattedUsername.textContent = 'None Selected';
    adminMessageDisplay.innerHTML = '<div class="chat-empty-state"><p>Select a user to start chatting.</p></div>';
    adminSendButton.disabled = true;
    if (unsubscribeChat) {
        unsubscribeChat();
    }
}

// --- Firebase Authentication (Admin) ---
async function adminLogin() {
    const email = adminEmailInput.value.trim();
    const password = adminPasswordInput.value.trim();

    adminLoginError.textContent = 'Attempting login...';
    adminLoginError.style.color = 'gray';

    if (!email || !password) {
        adminLoginError.textContent = "Please enter both email and password.";
        adminLoginError.style.color = 'var(--error-color)';
        return;
    }

    adminLoginButton.disabled = true;

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        adminCurrentUser = userCredential.user;
        console.log("Admin logged in successfully:", adminCurrentUser.uid);

        // Verify if the logged-in user is actually an admin from RTDB
        const userRef = database.ref(`users/${adminCurrentUser.uid}`);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();

        if (userData && userData.isAdmin) {
            adminUserName = userData.username || 'Admin';
            console.log("Admin profile confirmed:", adminUserName);
            adminLoginError.textContent = 'Login successful! Loading dashboard...';
            adminLoginError.style.color = 'var(--primary-color)';
            showAdminDashboardSection();
            listPublicUsers(); // Load public users after successful admin login
            adminEmailInput.value = '';
            adminPasswordInput.value = '';
        } else {
            console.error("User is not an admin or profile missing from RTDB.");
            adminLoginError.textContent = "You are not authorized as an admin. (RTDB check failed)";
            adminLoginError.style.color = 'var(--error-color)';
            auth.signOut(); // Force logout if not admin
        }
    } catch (error) {
        console.error("Admin login failed:", error.message, "Code:", error.code);
        let displayErrorMessage = `Login failed: ${error.message}`;
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            displayErrorMessage = 'Incorrect email or password.';
        } else if (error.code === 'auth/network-request-failed') {
            displayErrorMessage = 'Network error. Please check your internet connection.';
        } else if (error.code === 'auth/invalid-email') {
             displayErrorMessage = 'Invalid email format.';
        }
        adminLoginError.textContent = displayErrorMessage;
        adminLoginError.style.color = 'var(--error-color)';
    } finally {
        adminLoginButton.disabled = false;
    }
}

async function adminLogout() {
    try {
        await auth.signOut();
        console.log("Admin logged out successfully.");
        adminCurrentUser = null;
        adminUserName = '';
        allPublicUsers = [];
        selectedPublicUserUid = null;
        selectedPublicUserName = '';
        currentAdminChatId = null;
        publicUsersList.innerHTML = '<li>No public users found.</li>';
        currentChattedUsername.textContent = 'None Selected';
        adminMessageDisplay.innerHTML = '';
        adminSendButton.disabled = true;
        adminMediaInput.value = ''; // Clear any pending file
        if (unsubscribeChat) {
            unsubscribeChat();
        }
        showAdminLoginSection();
    } catch (error) {
        console.error("Admin logout failed:", error.message);
    }
}

// --- Admin Dashboard: Listing and Searching Public Users ---
function listPublicUsers() {
    publicUsersList.innerHTML = ''; // Clear previous list
    const usersRef = database.ref('users');

    usersRef.on('value', (snapshot) => {
        allPublicUsers = []; // Clear for new data
        publicUsersList.innerHTML = ''; // Clear list for display
        const usersData = snapshot.val();
        let foundPublicUsers = false;

        if (usersData) {
            for (let uid in usersData) {
                const user = usersData[uid];
                if (!user.isAdmin && uid !== adminCurrentUser.uid) { // List only public users, not self
                    foundPublicUsers = true;
                    allPublicUsers.push({ uid: uid, ...user }); // Store for filtering
                }
            }
        }
        filterUsers(); // Display all users initially or apply current filter
        if (!foundPublicUsers && allPublicUsers.length === 0) { // If no users *at all*
            publicUsersList.innerHTML = '<li>No public users registered.</li>';
        }
    });
}

function filterUsers() {
    const searchTerm = userSearchInput.value.toLowerCase().trim();
    publicUsersList.innerHTML = ''; // Clear for filtered results
    let filteredCount = 0;

    allPublicUsers.forEach(user => {
        // Simple search by username
        const userNameMatch = (user.username || '').toLowerCase().includes(searchTerm);
        
        // You could add chat message search here with more complex logic,
        // e.g., fetching last few messages for each user.
        // For now, we'll keep it to username search for simplicity.

        if (userNameMatch) {
            filteredCount++;
            const listItem = document.createElement('li');
            listItem.textContent = user.username || `User ${user.uid.substring(0, 6)}`;
            listItem.dataset.uid = user.uid; // Store UID for selection
            listItem.dataset.username = user.username;
            listItem.addEventListener('click', () => selectUserToChat(user.uid, user.username));
            if (user.uid === selectedPublicUserUid) {
                listItem.classList.add('selected');
            }
            publicUsersList.appendChild(listItem);
        }
    });

    if (filteredCount === 0 && allPublicUsers.length > 0) {
        publicUsersList.innerHTML = '<li>No matching users found.</li>';
    } else if (allPublicUsers.length === 0) {
        publicUsersList.innerHTML = '<li>No public users registered.</li>';
    }
}


// --- Admin Dashboard: Create Public User ---
async function createPublicUser() {
    const username = newUsernameInput.value.trim();
    const password = newPasswordInput.value.trim();

    if (!username || !password) {
        createUserMessage.textContent = "Username and password are required.";
        createUserMessage.style.color = 'var(--error-color)';
        return;
    }
    if (password.length < 6) {
        createUserMessage.textContent = "Password must be at least 6 characters long.";
        createUserMessage.style.color = 'var(--error-color)';
        return;
    }

    createUserButton.disabled = true;
    createUserMessage.textContent = 'Creating user...';
    createUserMessage.style.color = 'gray';

    try {
        // Call the Firebase Cloud Function
        const createPublicUserCallable = functions.httpsCallable('createPublicUser');
        const result = await createPublicUserCallable({ username, password });
        console.log("Cloud Function response:", result.data);

        if (result.data.status !== 'success') {
            throw new Error(result.data.message || 'Unknown error from Cloud Function.');
        }

        createUserMessage.textContent = `User "${username}" created successfully!`;
        createUserMessage.style.color = 'var(--primary-color)';
        newUsernameInput.value = '';
        newPasswordInput.value = '';
        
        // listPublicUsers() is already listening to RTDB, will update automatically
        
    } catch (error) {
        console.error("Error creating user:", error.message, "Code:", error.code, "Details:", error.details);
        let displayErrorMessage = error.message;
        if (error.code === 'functions/already-exists') {
            displayErrorMessage = 'A user with that username already exists. Please choose a different one.';
        } else if (error.details) {
            displayErrorMessage = error.details; // Cloud function might send specific details
        }
        createUserMessage.textContent = `Error: ${displayErrorMessage}`;
        createUserMessage.style.color = 'var(--error-color)';
    } finally {
        createUserButton.disabled = false;
    }
}


// --- Admin Dashboard: Chatting with Selected User ---
let unsubscribeChat = null;

function selectUserToChat(uid, username) {
    // Remove 'selected' class from previously selected user
    const previouslySelected = document.querySelector('#public-users-list li.selected');
    if (previouslySelected) {
        previouslySelected.classList.remove('selected');
    }

    // Add 'selected' class to the new user
    const newSelected = document.querySelector(`#public-users-list li[data-uid="${uid}"]`);
    if (newSelected) {
        newSelected.classList.add('selected');
    }

    selectedPublicUserUid = uid;
    selectedPublicUserName = username;
    currentChattedUsername.textContent = username;
    adminSendButton.disabled = false;
    adminMessageDisplay.innerHTML = '<div class="chat-empty-state"><p>No messages yet with this user.</p></div>'; // Clear previous chat
    adminMessageInput.value = '';
    adminMediaInput.value = ''; // Clear any pending media file
    createUserMessage.textContent = ''; // Clear any pending creation message

    // Generate the chat ID consistently
    currentAdminChatId = generateChatId(adminCurrentUser.uid, selectedPublicUserUid);
    console.log(`Selected chat: ${currentAdminChatId}`);

    setupAdminChatListener(currentAdminChatId);
}

function setupAdminChatListener(chatId) {
    if (unsubscribeChat) {
        unsubscribeChat(); // Unsubscribe from previous chat listener
    }

    const messagesRef = database.ref(`chats/${chatId}/messages`);

    unsubscribeChat = messagesRef.on('value', async (snapshot) => {
        adminMessageDisplay.innerHTML = ''; // Clear previous messages
        const messagesData = snapshot.val();
        const messagesList = [];

        if (messagesData) {
            for (let id in messagesData) {
                messagesList.push({ id, ...messagesData[id] });
            }
            messagesList.sort((a, b) => a.timestamp - b.timestamp);
        }

        if (messagesList.length === 0) {
            adminMessageDisplay.innerHTML = '<div class="chat-empty-state"><p>No messages yet with this user.</p></div>';
        } else {
            for (const msg of messagesList) {
                const messageElement = document.createElement('div');
                messageElement.classList.add('admin-message-bubble');

                const isSelf = msg.senderId === adminCurrentUser.uid;
                messageElement.classList.add(isSelf ? 'admin-message-self' : 'admin-message-other');

                const senderName = isSelf ? adminUserName : selectedPublicUserName;

                messageElement.innerHTML = `
                    <span class="admin-message-sender-name">${senderName}</span>
                    <div class="admin-message-content">${msg.text || ''}</div>
                `;
                
                // Handle media content if present
                if (msg.mediaUrl && msg.mediaType) {
                    messageElement.innerHTML += `<div class="admin-message-media">${renderMedia(msg.mediaType, msg.mediaUrl)}</div>`;
                }

                messageElement.innerHTML += `<span class="admin-message-timestamp">${new Date(msg.timestamp).toLocaleTimeString()}</span>`;

                adminMessageDisplay.appendChild(messageElement);
            }
        }

        adminMessageDisplay.scrollTop = adminMessageDisplay.scrollHeight;

    }, (error) => {
        console.error("Error fetching admin messages:", error);
        adminMessageDisplay.innerHTML = `<div class="chat-empty-state" style="color:var(--error-color);"><p>Error loading messages: ${error.message}</p></div>`;
    });
}

// --- Sending Admin Messages (Text & Media) ---
async function sendAdminMessage() {
    const messageText = adminMessageInput.value.trim();
    const mediaFile = adminMediaInput.files[0];

    if ((!messageText && !mediaFile) || !adminCurrentUser || !selectedPublicUserUid || !currentAdminChatId) {
        return; // Don't send empty messages/files, if not logged in, or no user selected
    }

    adminSendButton.disabled = true;
    adminMediaInput.disabled = true; // Disable media input during send
    createUserMessage.textContent = ''; // Clear any existing message
    createUserMessage.style.color = 'gray'; // Reset color

    try {
        let messageData = {
            senderId: adminCurrentUser.uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };

        if (messageText) {
            messageData.text = messageText;
        }

        if (mediaFile) {
            createUserMessage.textContent = 'Uploading media...';
            const mediaPath = `chat_media/${currentAdminChatId}/${adminCurrentUser.uid}/${Date.now()}_${mediaFile.name}`;
            const mediaRef = storage.ref(mediaPath);
            const uploadTask = mediaRef.put(mediaFile);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    createUserMessage.textContent = `Upload: ${progress.toFixed(0)}%`;
                },
                (error) => {
                    console.error("Admin media upload error:", error);
                    throw new Error("Admin media upload failed.");
                }
            );

            await uploadTask; // Wait for upload to complete
            const mediaUrl = await mediaRef.getDownloadURL();

            messageData.mediaUrl = mediaUrl;
            messageData.mediaType = mediaFile.type;
        }

        const messagesRef = database.ref(`chats/${currentAdminChatId}/messages`);
        await messagesRef.push(messageData);

        adminMessageInput.value = ''; // Clear text input
        adminMediaInput.value = ''; // Clear file input
        createUserMessage.textContent = ''; // Clear media upload message

        console.log("Admin message sent!");
    } catch (error) {
        console.error("Error sending admin message:", error.message);
        createUserMessage.textContent = `Error sending: ${error.message}`;
        createUserMessage.style.color = 'var(--error-color)';
    } finally {
        adminSendButton.disabled = false;
        adminMediaInput.disabled = false;
    }
}


// --- Event Listeners ---
adminLoginButton.addEventListener('click', adminLogin);
adminLogoutButton.addEventListener('click', adminLogout);
createUserButton.addEventListener('click', createPublicUser);
userSearchInput.addEventListener('keyup', filterUsers); // NEW: Search input listener
adminSendButton.addEventListener('click', sendAdminMessage);
adminMessageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendAdminMessage();
    }
});
adminMediaInput.addEventListener('change', () => {
    if (adminMediaInput.files[0]) {
        console.log("Admin media selected:", adminMediaInput.files[0].name, adminMediaInput.files[0].type);
        createUserMessage.textContent = `File selected: ${adminMediaInput.files[0].name}`;
        createUserMessage.style.color = 'gray';
    } else {
        createUserMessage.textContent = '';
    }
});


// --- Initial Auth State Check for Admin ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        adminCurrentUser = user;
        console.log("Admin user already logged in:", user.uid);

        const userRef = database.ref(`users/${user.uid}`);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();

        if (userData && userData.isAdmin) {
            adminUserName = userData.username || 'Admin';
            showAdminDashboardSection();
            listPublicUsers();
        } else {
            console.error("Logged in user is not an admin or profile missing.");
            auth.signOut(); // Force logout if not admin
            showAdminLoginSection();
        }
    } else {
        console.log("No admin user logged in.");
        showAdminLoginSection();
    }
});
