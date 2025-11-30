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
    serverTimestamp
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

    // Mobile menu
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
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
        document.getElementById('totalInvestments').textContent = `₵${stats.totalInvestments.toLocaleString()}`;

        // Load recent activity
        await loadAdminActivity();
        
        // Load data for current page
        const activePage = document.querySelector('.page-content.active').id.replace('-page', '');
        await loadPageData(activePage);

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

async function loadPageData(page) {
    switch (page) {
        case 'members':
            await loadMembersTable();
            break;
        case 'appointments':
            await loadAppointmentsTables();
            break;
        case 'beneficiaries':
            await loadBeneficiaryRequests();
            break;
        case 'payouts':
            await loadPayoutsTables();
            break;
        case 'messaging':
            await loadSentNotifications();
            break;
        case 'security':
            await loadSecurityData();
            break;
    }
}

async function loadMembersTable() {
    try {
        // Mock members data
        const members = [
            {
                id: '1',
                name: 'Kwame Mensah',
                email: 'kwame.mensah@example.com',
                investment: 50000,
                status: 'active',
                joinDate: new Date('2024-01-15').toISOString()
            },
            {
                id: '2',
                name: 'Ama Serwaa',
                email: 'ama.serwaa@example.com',
                investment: 75000,
                status: 'active',
                joinDate: new Date('2024-02-20').toISOString()
            },
            {
                id: '3',
                name: 'Kofi Annan',
                email: 'kofi.annan@example.com',
                investment: 100000,
                status: 'frozen',
                joinDate: new Date('2024-01-05').toISOString()
            }
        ];

        const membersTable = document.getElementById('membersTable');
        if (membersTable) {
            membersTable.innerHTML = members.map(member => `
                <tr>
                    <td>${member.name}</td>
                    <td>${member.email}</td>
                    <td>₵${member.investment.toLocaleString()}</td>
                    <td><span class="status-badge ${member.status}">${member.status}</span></td>
                    <td>${formatDate(member.joinDate)}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-secondary" onclick="viewMemberDetails('${member.id}')">View</button>
                            <button class="btn btn-sm btn-warning" onclick="freezeMember('${member.id}')">Freeze</button>
                            <button class="btn btn-sm btn-error" onclick="deleteMember('${member.id}')">Delete</button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading members table:', error);
    }
}

async function loadAppointmentsTables() {
    try {
        // Mock appointments data
        const pendingAppointments = [
            {
                id: '1',
                name: 'Yaw Boateng',
                email: 'yaw.boateng@example.com',
                investmentAmount: 25000,
                preferredDate: new Date('2024-03-20').toISOString(),
                submitted: new Date('2024-03-15').toISOString()
            }
        ];

        const approvedAppointments = [
            {
                id: '2',
                name: 'Akua Asante',
                email: 'akua.asante@example.com',
                investmentAmount: 50000,
                scheduledDate: new Date('2024-03-18').toISOString(),
                approvedBy: 'Admin User'
            }
        ];

        // Update tables
        updateAppointmentsTable('pending', pendingAppointments);
        updateAppointmentsTable('approved', approvedAppointments);
        updateAppointmentsTable('rejected', []);

    } catch (error) {
        console.error('Error loading appointments:', error);
    }
}

function updateAppointmentsTable(type, appointments) {
    const tableId = `${type}AppointmentsTable`;
    const table = document.getElementById(tableId);
    
    if (table) {
        table.innerHTML = appointments.map(appointment => `
            <tr>
                <td>${appointment.name}</td>
                <td>${appointment.email}</td>
                <td>₵${appointment.investmentAmount.toLocaleString()}</td>
                <td>${formatDate(appointment.preferredDate || appointment.scheduledDate)}</td>
                <td>${type === 'pending' ? formatDate(appointment.submitted) : appointment.approvedBy}</td>
                <td>
                    <div class="action-buttons">
                        ${type === 'pending' ? `
                            <button class="btn btn-sm btn-success" onclick="approveAppointment('${appointment.id}')">Approve</button>
                            <button class="btn btn-sm btn-error" onclick="rejectAppointment('${appointment.id}')">Reject</button>
                        ` : `
                            <button class="btn btn-sm btn-secondary" onclick="viewAppointment('${appointment.id}')">View</button>
                        `}
                    </div>
                </td>
            </tr>
        `).join('');
    }
}

async function loadBeneficiaryRequests() {
    try {
        // Mock beneficiary requests
        const requests = [
            {
                id: '1',
                memberName: 'Kwame Mensah',
                currentBeneficiary: 'Jane Mensah',
                newBeneficiary: 'Akua Mensah',
                relationship: 'child',
                reason: 'Birth of new child',
                status: 'pending'
            }
        ];

        const table = document.getElementById('beneficiaryRequestsTable');
        if (table) {
            table.innerHTML = requests.map(request => `
                <tr>
                    <td>${request.memberName}</td>
                    <td>${request.currentBeneficiary}</td>
                    <td>${request.newBeneficiary}</td>
                    <td>${request.relationship}</td>
                    <td>${request.reason}</td>
                    <td><span class="status-badge ${request.status}">${request.status}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-success" onclick="approveBeneficiary('${request.id}')">Approve</button>
                            <button class="btn btn-sm btn-error" onclick="rejectBeneficiary('${request.id}')">Reject</button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading beneficiary requests:', error);
    }
}

async function loadPayoutsTables() {
    try {
        // Mock payout data
        const maturityPayouts = [
            {
                id: '1',
                memberName: 'Ama Serwaa',
                investmentAmount: 75000,
                totalReturn: 82500,
                maturityDate: new Date('2024-03-25').toISOString(),
                daysOverdue: 0
            }
        ];

        const completedPayouts = [
            {
                id: '2',
                memberName: 'Kofi Annan',
                investmentAmount: 100000,
                totalPaid: 110000,
                paymentDate: new Date('2024-03-10').toISOString(),
                processedBy: 'Admin User',
                reference: 'PAY-001234'
            }
        ];

        updatePayoutsTable('maturity', maturityPayouts);
        updatePayoutsTable('completed', completedPayouts);

    } catch (error) {
        console.error('Error loading payouts:', error);
    }
}

function updatePayoutsTable(type, payouts) {
    const tableId = `${type}PayoutsTable`;
    const table = document.getElementById(tableId);
    
    if (table) {
        table.innerHTML = payouts.map(payout => `
            <tr>
                <td>${payout.memberName}</td>
                <td>₵${payout.investmentAmount.toLocaleString()}</td>
                <td>₵${(payout.totalReturn || payout.totalPaid).toLocaleString()}</td>
                <td>${formatDate(payout.maturityDate || payout.paymentDate)}</td>
                <td>${type === 'maturity' ? payout.daysOverdue : payout.processedBy}</td>
                <td>
                    ${type === 'maturity' ? `
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-success" onclick="processPayout('${payout.id}')">Process</button>
                            <button class="btn btn-sm btn-secondary" onclick="viewPayoutDetails('${payout.id}')">Details</button>
                        </div>
                    ` : `
                        ${payout.reference}
                    `}
                </td>
            </tr>
        `).join('');
    }
}

async function loadSentNotifications() {
    try {
        // Mock sent notifications
        const notifications = [
            {
                id: '1',
                subject: 'System Maintenance',
                message: 'Scheduled maintenance this weekend',
                sentTo: 'All Members',
                timestamp: new Date('2024-03-15').toISOString()
            }
        ];

        const notificationsList = document.getElementById('sentNotifications');
        if (notificationsList) {
            notificationsList.innerHTML = notifications.map(notification => `
                <div class="activity-item">
                    <div class="activity-icon notification">
                        <i class="fas fa-envelope"></i>
                    </div>
                    <div class="activity-details">
                        <div class="activity-title">${notification.subject}</div>
                        <div class="activity-description">${notification.message}</div>
                        <div class="activity-date">Sent to ${notification.sentTo} • ${formatDate(notification.timestamp)}</div>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading sent notifications:', error);
    }
}

async function loadSecurityData() {
    // Load security-related data
    await loadDeviceManagementTable();
}

async function loadDeviceManagementTable() {
    try {
        // Mock device management data
        const devices = [
            {
                id: '1',
                userName: 'Kwame Mensah',
                device: 'Chrome on Windows',
                lastLogin: new Date('2024-03-18').toISOString(),
                status: 'approved'
            }
        ];

        const table = document.getElementById('deviceManagementTable');
        if (table) {
            table.innerHTML = devices.map(device => `
                <tr>
                    <td>${device.userName}</td>
                    <td>${device.device}</td>
                    <td>${formatDate(device.lastLogin)}</td>
                    <td><span class="status-badge ${device.status}">${device.status}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-warning" onclick="revokeDevice('${device.id}')">Revoke</button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading device management:', error);
    }
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-page]');
    const pageContents = document.querySelectorAll('.page-content');
    const pageTitle = document.getElementById('pageTitle');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all items
            navItems.forEach(navItem => navItem.classList.remove('active'));
            pageContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked item
            item.classList.add('active');
            
            // Show corresponding page
            const pageId = item.getAttribute('data-page');
            const targetPage = document.getElementById(`${pageId}-page`);
            if (targetPage) {
                targetPage.classList.add('active');
                
                // Update page title
                if (pageTitle) {
                    pageTitle.textContent = getAdminPageTitle(pageId);
                }
                
                // Load page data
                loadPageData(pageId);
            }
            
            // Close mobile menu if open
            const sidebar = document.querySelector('.sidebar');
            if (sidebar.classList.contains('mobile-open')) {
                sidebar.classList.remove('mobile-open');
            }
        });
    });
}

function setupTabs() {
    // Setup tab navigation for appointments and payouts
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            const targetContent = document.getElementById(`${tabId}-tab`);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

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
        // In real app, you would:
        // 1. Create user in Firebase Auth
        // 2. Save user data to Firestore
        // 3. Generate and send credentials
        
        // Mock implementation
        console.log('Registering member:', formData);
        
        // Show success message
        showMessage('Member registered successfully! Credentials will be sent via email.', 'success');
        
        // Close modal and reset form
        closeModal('memberRegistrationModal');
        document.getElementById('memberRegistrationForm').reset();
        
        // Refresh members table
        await loadMembersTable();
        
    } catch (error) {
        console.error('Error registering member:', error);
        showMessage('Error registering member. Please try again.', 'error');
    }
}

async function handleSendNotification(e) {
    e.preventDefault();
    
    const recipients = document.getElementById('notificationRecipients').value;
    const subject = document.getElementById('notificationSubject').value;
    const message = document.getElementById('notificationMessage').value;

    try {
        // Save notification to Firestore
        const notificationData = {
            recipients,
            subject,
            message,
            sentBy: currentUser.uid,
            sentAt: serverTimestamp()
        };

        await addDoc(collection(db, 'notifications'), notificationData);
        
        showMessage('Notification sent successfully!', 'success');
        document.getElementById('notificationForm').reset();
        
        // Refresh sent notifications
        await loadSentNotifications();
        
    } catch (error) {
        console.error('Error sending notification:', error);
        showMessage('Error sending notification. Please try again.', 'error');
    }
}

// Action Functions
async function approveAppointment(appointmentId) {
    try {
        // Update appointment status in Firestore
        await updateDoc(doc(db, 'appointmentRequests', appointmentId), {
            status: 'approved',
            approvedBy: currentUser.uid,
            approvedAt: serverTimestamp()
        });
        
        showMessage('Appointment approved successfully!', 'success');
        await loadAppointmentsTables();
        
    } catch (error) {
        console.error('Error approving appointment:', error);
        showMessage('Error approving appointment.', 'error');
    }
}

async function rejectAppointment(appointmentId) {
    const reason = prompt('Please enter reason for rejection:');
    if (reason) {
        try {
            await updateDoc(doc(db, 'appointmentRequests', appointmentId), {
                status: 'rejected',
                rejectedBy: currentUser.uid,
                rejectedAt: serverTimestamp(),
                rejectionReason: reason
            });
            
            showMessage('Appointment rejected.', 'success');
            await loadAppointmentsTables();
            
        } catch (error) {
            console.error('Error rejecting appointment:', error);
            showMessage('Error rejecting appointment.', 'error');
        }
    }
}

async function approveBeneficiary(requestId) {
    try {
        await updateDoc(doc(db, 'beneficiaryRequests', requestId), {
            status: 'approved',
            approvedBy: currentUser.uid,
            approvedAt: serverTimestamp()
        });
        
        showMessage('Beneficiary change approved!', 'success');
        await loadBeneficiaryRequests();
        
    } catch (error) {
        console.error('Error approving beneficiary:', error);
        showMessage('Error approving beneficiary change.', 'error');
    }
}

async function processPayout(payoutId) {
    try {
        // Process payout logic
        showMessage('Payout processed successfully!', 'success');
        await loadPayoutsTables();
        
    } catch (error) {
        console.error('Error processing payout:', error);
        showMessage('Error processing payout.', 'error');
    }
}

// Modal Functions
function showMemberRegistration() {
    document.getElementById('memberRegistrationModal').style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function navigateToPage(page) {
    const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navItem) {
        navItem.click();
    }
}

// Utility Functions
function getAdminPageTitle(pageId) {
    const titles = {
        'overview': 'Admin Overview',
        'members': 'Member Management',
        'appointments': 'Appointment Requests',
        'beneficiaries': 'Beneficiary Requests',
        'payouts': 'Payout Management',
        'messaging': 'Admin Messaging',
        'security': 'Security Management'
    };
    return titles[pageId] || 'Admin Dashboard';
}

function getAdminActivityIcon(type) {
    const icons = {
        'member': 'fa-user-plus',
        'appointment': 'fa-calendar-check',
        'payout': 'fa-money-check',
        'notification': 'fa-envelope'
    };
    return icons[type] || 'fa-circle';
}

function getInitials(name) {
    return name.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
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
    
    return formatDate(dateString);
}

async function handleLogout() {
    try {
        await signOut(auth);
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Logout error:', error);
        showMessage('Error during logout', 'error');
    }
}

function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('mobile-open');
}

function showMessage(message, type = 'success') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
        position: fixed;
        top: 100px;
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

// Add CSS for animations and additional styles
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
    
    .page-content {
        display: none;
    }
    
    .page-content.active {
        display: block;
    }
    
    .btn-error {
        background: var(--error);
        color: white;
    }
    
    .btn-error:hover {
        background: #dc2626;
    }
    
    .btn-warning {
        background: var(--warning);
        color: white;
    }
    
    .btn-warning:hover {
        background: #d97706;
    }
    
    .btn-success {
        background: var(--success);
        color: white;
    }
    
    .btn-success:hover {
        background: #059669;
    }
`;
document.head.appendChild(style);