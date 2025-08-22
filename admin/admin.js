// Admin-specific Firebase SDK initialization and logic

// --- Firebase Configuration (REPLACE WITH YOUR ACTUAL CONFIG) ---
const firebaseConfig = {
  apiKey: "AIzaSyA9Hyb4nv6yZcyOqI_azRLB0v31jdO3YvU", // <--- REPLACE THIS WITH YOUR ACTUAL API KEY FROM FIREBASE CONSOLE!
  authDomain: "red-head-7391.firebaseapp.com",
  databaseURL: "https://red-head-7391-default-rtdb.firebaseio.com",
  projectId: "red-head-7391",
  storageBucket: "red-head-7391.firebasestorage.app",
  messagingSenderId: "408168002586",
  appId: "1:408168002586:web:f9920d13106cbe375b8da3",
  measurementId: "G-N6QX49H4KN"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig); // Using compat version
const auth = firebase.auth();
const database = firebase.database();

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
const currentChattedUsername = document.getElementById('current-chatted-username');
const adminMessageDisplay = document.getElementById('admin-message-display');
const adminMessageInput = document.getElementById('admin-message-input');
const adminSendButton = document.getElementById('admin-send-button');

// NEW DOM Elements for User Creation
const newUsernameInput = document.getElementById('new-username-input');
const newPasswordInput = document.getElementById('new-password-input');
const createUserButton = document.getElementById('create-user-button');
const createUserMessage = document.getElementById('create-user-message');


let adminCurrentUser = null;
let adminUserName = '';
let selectedPublicUserUid = null;
let selectedPublicUserName = '';
let currentAdminChatId = null; // chat ID for the current selected user

// --- Utility Functions ---
// Function to generate a consistent chat ID between two UIDs
function generateChatId(uid1, uid2) {
    // Ensure consistent order for chat ID generation
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

// --- UI State Management ---
function showAdminLoginSection() {
    adminLoginSection.style.display = 'flex';
    adminDashboardSection.style.display = 'none';
    adminUsernameDisplay.textContent = '';
}

function showAdminDashboardSection() {
    adminLoginSection.style.display = 'none';
    adminDashboardSection.style.display = 'flex';
    adminUsernameDisplay.textContent = adminUserName;
}

// --- Firebase Authentication (Admin) ---
async function adminLogin() {
    const email = adminEmailInput.value.trim();
    const password = adminPasswordInput.value.trim();

    if (!email || !password) {
        adminLoginError.textContent = "Please enter both email and password.";
        return;
    }

    adminLoginButton.disabled = true;
    adminLoginError.textContent = '';

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
            showAdminDashboardSection();
            listPublicUsers(); // Load public users after successful admin login
            adminEmailInput.value = '';
            adminPasswordInput.value = '';
        } else {
            console.error("User is not an admin or profile missing.");
            adminLoginError.textContent = "You are not authorized as an admin.";
            auth.signOut(); // Force logout if not admin
        }
    } catch (error) {
        console.error("Admin login failed:", error.message);
        adminLoginError.textContent = `Login failed: ${error.message}`;
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
        selectedPublicUserUid = null;
        selectedPublicUserName = '';
        currentAdminChatId = null;
        publicUsersList.innerHTML = '<li>No public users found.</li>';
        currentChattedUsername.textContent = 'None Selected';
        adminMessageDisplay.innerHTML = '';
        adminSendButton.disabled = true;
        if (unsubscribeChat) {
            unsubscribeChat();
        }
        showAdminLoginSection();
    } catch (error) {
        console.error("Admin logout failed:", error.message);
    }
}

// --- Admin Dashboard: Listing Public Users ---
function listPublicUsers() {
    publicUsersList.innerHTML = ''; // Clear previous list
    const usersRef = database.ref('users');

    usersRef.on('value', (snapshot) => {
        publicUsersList.innerHTML = ''; // Clear again for real-time updates
        const usersData = snapshot.val();
        let foundPublicUsers = false;

        if (usersData) {
            for (let uid in usersData) {
                const user = usersData[uid];
                if (!user.isAdmin && uid !== adminCurrentUser.uid) { // List only public users, not self
                    foundPublicUsers = true;
                    const listItem = document.createElement('li');
                    listItem.textContent = user.username || `User ${uid.substring(0, 6)}`;
                    listItem.dataset.uid = uid; // Store UID for selection
                    listItem.dataset.username = user.username;
                    listItem.addEventListener('click', () => selectUserToChat(uid, user.username));
                    publicUsersList.appendChild(listItem);
                }
            }
        }
        if (!foundPublicUsers) {
            publicUsersList.innerHTML = '<li>No public users registered.</li>';
        }
    });
}

// --- Admin Dashboard: Create Public User ---
async function createPublicUser() {
    const username = newUsernameInput.value.trim();
    const password = newPasswordInput.value.trim();

    if (!username || !password) {
        createUserMessage.textContent = "Username and password are required.";
        createUserMessage.style.color = '#dc3545'; // Red for error
        return;
    }
    if (password.length < 6) {
        createUserMessage.textContent = "Password must be at least 6 characters long.";
        createUserMessage.style.color = '#dc3545';
        return;
    }

    createUserButton.disabled = true;
    createUserMessage.textContent = 'Creating user...';
    createUserMessage.style.color = '#007bff'; // Blue for info

    try {
        // --- THIS IS WHERE YOU WILL CALL YOUR CLOUD FUNCTION ---
        // For now, this is a simulated call.
        // Once your Cloud Function is deployed, you will replace this with:
        // const response = await fetch('YOUR_CLOUD_FUNCTION_URL', {
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/json',
        //         'Authorization': `Bearer ${await adminCurrentUser.getIdToken()}` // Send admin's token
        //     },
        //     body: JSON.stringify({ username, password })
        // });
        // const data = await response.json();
        // if (data.error) {
        //     throw new Error(data.error);
        // }
        // console.log("User creation response:", data);


        // SIMULATED SUCCESS - REMOVE THESE LINES AFTER CLOUD FUNCTION IS READY
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate network delay
        // END SIMULATED SUCCESS

        createUserMessage.textContent = `User "${username}" created successfully!`;
        createUserMessage.style.color = '#28a745'; // Green for success
        newUsernameInput.value = '';
        newPasswordInput.value = '';
        
        listPublicUsers(); // Refresh the list of public users
        
    } catch (error) {
        console.error("Error creating user:", error.message);
        createUserMessage.textContent = `Error: ${error.message}`;
        createUserMessage.style.color = '#dc3545';
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
    adminMessageDisplay.innerHTML = ''; // Clear previous chat
    adminMessageInput.value = '';

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

    unsubscribeChat = messagesRef.on('value', (snapshot) => {
        adminMessageDisplay.innerHTML = ''; // Clear previous messages
        const messagesData = snapshot.val();
        const messagesList = [];

        if (messagesData) {
            for (let id in messagesData) {
                messagesList.push({ id, ...messagesData[id] });
            }
            messagesList.sort((a, b) => a.timestamp - b.timestamp);
        }

        messagesList.forEach(msg => {
            const messageElement = document.createElement('div');
            messageElement.classList.add('admin-message-bubble');

            const isSelf = msg.senderId === adminCurrentUser.uid;
            messageElement.classList.add(isSelf ? 'admin-message-self' : 'admin-message-other');

            const senderName = msg.senderId === adminCurrentUser.uid ? adminUserName : selectedPublicUserName;

            messageElement.innerHTML = `
                <div class="admin-message-sender">${senderName}</div>
                <div>${msg.text}</div>
                <span class="admin-message-timestamp">${new Date(msg.timestamp).toLocaleTimeString()}</span>
            `;
            adminMessageDisplay.appendChild(messageElement);
        });

        adminMessageDisplay.scrollTop = adminMessageDisplay.scrollHeight;

    }, (error) => {
        console.error("Error fetching admin messages:", error);
    });
}

async function sendAdminMessage() {
    const messageText = adminMessageInput.value.trim();
    if (!messageText || !adminCurrentUser || !selectedPublicUserUid || !currentAdminChatId) {
        return; // Don't send empty messages, if not logged in, or no user selected
    }

    adminSendButton.disabled = true;

    try {
        const messagesRef = database.ref(`chats/${currentAdminChatId}/messages`);
        await messagesRef.push({
            senderId: adminCurrentUser.uid,
            text: messageText,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        adminMessageInput.value = '';
        console.log("Admin message sent!");
    } catch (error) {
        console.error("Error sending admin message:", error.message);
    } finally {
        adminSendButton.disabled = false;
    }
}

// --- Event Listeners ---
adminLoginButton.addEventListener('click', adminLogin);
adminLogoutButton.addEventListener('click', adminLogout);
adminSendButton.addEventListener('click', sendAdminMessage);
adminMessageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendAdminMessage();
    }
});
// NEW Event Listener for User Creation
createUserButton.addEventListener('click', createPublicUser);


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
});```
