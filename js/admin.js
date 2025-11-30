import { 
    auth, 
    db, 
    signOut,
    onAuthStateChanged,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    createUserWithEmailAndPassword,
    sendEmailVerification
} from './firebase-config.js';

let currentUser = null;
let adminData = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeAdminDashboard();
    setupEventListeners();
});

async function initializeAdminDashboard() {
    // Check authentication state and admin role
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            const isAdmin = await checkAdminRole(user);
            
            if (isAdmin) {
                await loadAdminData();
                await loadOverviewStats();
                setupNavigation();
                setupTabs();
                loadAllData();
            } else {
                // Redirect to member dashboard if not admin
                window.location.href = 'member-dashboard.html';
            }
        } else {
            // Redirect to login if not authenticated
            window.location.href = 'login.html';
        }
    });
}

async function checkAdminRole(user) {
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            return userData.role === 'admin';
        }
        return false;
    } catch (error) {
        console.error('Error checking admin role:', error);
        return false;
    }
}

function setupEventListeners() {
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Member registration form
    const memberRegistrationForm = document.getElementById('memberRegistrationForm');
    if (memberRegistrationForm) {
        memberRegistrationForm.addEventListener('submit', handleMemberRegistration);
    }

    // Notification form
    const notificationForm = document.getElementById('notificationForm');
    if (notificationForm) {
        notificationForm.addEventListener('submit', handleSendNotification);
    }

    // Notification recipients dropdown
    const notificationRecipients = document.getElementById('notificationRecipients');
    if (notificationRecipients) {
        notificationRecipients.addEventListener('change', function() {
            const specificGroup = document.getElementById('specificMembersGroup');
            if (this.value === 'specific') {
                specificGroup.style.display = 'block';
            } else {
                specificGroup.style.display = 'none';
            }
        });
    }
}

async function loadAdminData() {
    try {
        // Load admin user data
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
            adminData = userDoc.data();
            updateAdminInterface();
        }
    } catch (error) {
        console.error('Error loading admin data:', error);
        showMessage('Error loading admin data', 'error');
    }
}

function updateAdminInterface() {
    // Update admin name and avatar
    const userName = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');

    if (adminData) {
        const displayName = adminData.fullName || currentUser.displayName || 'Admin';
        const initials = getInitials(displayName);
        
        if (userName) userName.textContent = displayName;
        if (userAvatar) userAvatar.textContent = initials;
    }
}

async function loadOverviewStats() {
    try {
        // Mock stats - in real app, fetch from Firestore
        const stats = {
            totalMembers: 157,
            pendingAppointments: 12,
            pendingPayouts: 8,
            totalInvestments: 7850000
        };

        // Update DOM elements
        document.getElementById('totalMembers').textContent = stats.totalMembers.toLocaleString();
        document.getElementById('pendingAppointments').textContent = stats.pendingAppointments.toLocaleString();
        document.getElementById('pendingPayouts').textContent = stats.pendingPayouts.toLocaleString();
        document.getElementById('totalInvestments').textContent = `₵${(stats.totalInvestments / 1000000).toFixed(1)}M`;

        // Load recent activity
        await loadAdminActivity();

    } catch (error) {
        console.error('Error loading overview stats:', error);
    }
}

async function loadAdminActivity() {
    try {
        // Mock admin activity
        const activities = [
            {
                type: 'member',
                title: 'New Member Registered',
                description: 'Kwame Mensah joined GGIC',
                timestamp: new Date().toISOString()
            },
            {
                type: 'appointment',
                title: 'Appointment Approved',
                description: 'Investment consultation scheduled',
                timestamp: new Date(Date.now() - 3600000).toISOString()
            },
            {
                type: 'payout',
                title: 'Payout Processed',
                description: 'Maturity payout completed',
                timestamp: new Date(Date.now() - 7200000).toISOString()
            }
        ];

        const activityList = document.getElementById('adminActivity');
        if (activityList) {
            activityList.innerHTML = activities.map(activity => `
                <div class="activity-item">
                    <div class="activity-icon ${activity.type}">
                        <i class="fas ${getAdminActivityIcon(activity.type)}"></i>
                    </div>
                    <div class="activity-details">
                        <div class="activity-title">${activity.title}</div>
                        <div class="activity-description">${activity.description}</div>
                        <div class="activity-date">${formatTimeAgo(activity.timestamp)}</div>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading admin activity:', error);
    }
}

async function loadAllData() {
    await loadMembersTable();
    await loadAppointmentsTables();
    await loadBeneficiaryRequests();
    await loadPayoutsTables();
    await loadSentNotifications();
    await loadSecurityData();
}

// MEMBER REGISTRATION - FIXED
async function handleMemberRegistration(e) {
    e.preventDefault();
    
    const formData = {
        fullName: document.getElementById('regFullName').value,
        email: document.getElementById('regEmail').value,
        phone: document.getElementById('regPhone').value,
        ghanaCard: document.getElementById('regGhanaCard').value,
        investmentAmount: parseFloat(document.getElementById('regInvestment').value),
        duration: parseInt(document.getElementById('regDuration').value),
        profitRate: parseFloat(document.getElementById('regProfitRate').value),
        beneficiary: document.getElementById('regBeneficiary').value,
        status: 'active',
        role: 'member',
        createdAt: serverTimestamp(),
        createdBy: currentUser.uid
    };

    try {
        // Create user in Firebase Auth
        const password = generatePassword();
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, password);
        const user = userCredential.user;

        // Save user data to Firestore
        await setDoc(doc(db, 'users', user.uid), {
            ...formData,
            uid: user.uid,
            memberId: 'GGIC-M-' + Date.now().toString().slice(-6),
            currentBalance: formData.investmentAmount,
            dailyEarning: formData.investmentAmount * (formData.profitRate / 100),
            maturityDate: calculateMaturityDate(formData.duration)
        });

        // Send email verification
        await sendEmailVerification(user);

        // Create initial investment record
        await addDoc(collection(db, 'investments'), {
            userId: user.uid,
            amount: formData.investmentAmount,
            currentBalance: formData.investmentAmount,
            dailyRate: formData.profitRate,
            duration: formData.duration,
            startDate: serverTimestamp(),
            maturityDate: calculateMaturityDate(formData.duration),
            status: 'active',
            createdAt: serverTimestamp()
        });

        // Create welcome transaction
        await addDoc(collection(db, 'transactions'), {
            userId: user.uid,
            type: 'deposit',
            amount: formData.investmentAmount,
            description: 'Initial investment deposit',
            status: 'completed',
            createdAt: serverTimestamp(),
            reference: 'DEP-' + Date.now().toString().slice(-6)
        });

        // Show success message with credentials
        showMessage(`Member registered successfully! Login credentials sent to ${formData.email}. Temporary password: ${password}`, 'success');
        
        // Close modal and reset form
        closeModal('memberRegistrationModal');
        document.getElementById('memberRegistrationForm').reset();
        
        // Refresh members table
        await loadMembersTable();
        
    } catch (error) {
        console.error('Error registering member:', error);
        showMessage('Error registering member: ' + error.message, 'error');
    }
}

function generatePassword() {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
    let password = "";
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
}

function calculateMaturityDate(durationMonths) {
    const date = new Date();
    date.setMonth(date.getMonth() + durationMonths);
    return date;
}

// ... (rest of the admin functions remain the same as previous implementation)

// Make functions available globally for HTML onclick attributes
window.showMemberRegistration = function() {
    document.getElementById('memberRegistrationModal').style.display = 'flex';
};

window.closeModal = function(modalId) {
    document.getElementById(modalId).style.display = 'none';
};

window.navigateToPage = function(page) {
    const navItem = document.querySelector(`.desktop-nav-item[data-page="${page}"]`);
    if (navItem) {
        navItem.click();
    }
};

// Utility functions
function getInitials(name) {
    return name.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2);
}

function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-GB');
}

function showMessage(message, type = 'success') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        background: ${type === 'success' ? 'var(--success)' : 
                    type === 'error' ? 'var(--error)' : 
                    type === 'info' ? 'var(--secondary-blue)' : 'var(--warning)'};
    `;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (document.body.contains(messageDiv)) {
                document.body.removeChild(messageDiv);
            }
        }, 300);
    }, 5000);
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
