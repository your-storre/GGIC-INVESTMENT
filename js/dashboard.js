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
    serverTimestamp
} from './firebase-config.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

let currentUser = null;
let userData = null;
let earningsChart = null;
let allocationChart = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
    setupEventListeners();
    initializeCharts();
});

async function initializeDashboard() {
    // Check authentication state
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadUserData(user);
            await loadDashboardData();
            setupNavigation();
        } else {
            // Redirect to login if not authenticated
            window.location.href = 'login.html';
        }
    });
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

    // Beneficiary form
    const beneficiaryForm = document.getElementById('beneficiaryForm');
    if (beneficiaryForm) {
        beneficiaryForm.addEventListener('submit', handleBeneficiaryUpdate);
    }

    // Avatar upload
    const avatarUpload = document.getElementById('avatarUpload');
    const avatarFileInput = document.getElementById('avatarFileInput');
    if (avatarUpload && avatarFileInput) {
        avatarUpload.addEventListener('click', () => avatarFileInput.click());
        avatarFileInput.addEventListener('change', handleAvatarUpload);
    }

    // Chart period selector
    const chartPeriod = document.getElementById('chartPeriod');
    if (chartPeriod) {
        chartPeriod.addEventListener('change', updateEarningsChart);
    }
}

async function loadUserData(user) {
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            userData = userDoc.data();
            updateUserInterface();
        } else {
            console.error('User data not found');
            showMessage('Error loading user data', 'error');
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        showMessage('Error loading user data', 'error');
    }
}

function updateUserInterface() {
    // Update user name and avatar
    const userName = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');
    const profileName = document.getElementById('profileName');
    const profileAvatar = document.getElementById('profileAvatar');

    if (userData) {
        const displayName = userData.fullName || currentUser.displayName || 'User';
        const initials = getInitials(displayName);
        
        if (userName) userName.textContent = displayName;
        if (userAvatar) userAvatar.textContent = initials;
        if (profileName) profileName.textContent = displayName;
        if (profileAvatar) profileAvatar.textContent = initials;
    }

    // Update member since date
    const memberSince = document.getElementById('memberSince');
    if (memberSince && userData?.createdAt) {
        const date = new Date(userData.createdAt);
        memberSince.textContent = date.getFullYear();
    }
}

async function loadDashboardData() {
    await loadInvestmentStats();
    await loadRecentActivity();
    await loadCurrentBeneficiary();
    initializeStockTicker();
}

async function loadInvestmentStats() {
    // Mock data - in real app, fetch from Firestore
    const stats = {
        investmentAmount: 50000,
        currentBalance: 58750,
        dailyEarning: 125,
        daysToMaturity: 45
    };

    // Update DOM elements
    document.getElementById('investmentAmount').textContent = `₵${stats.investmentAmount.toLocaleString()}`;
    document.getElementById('currentBalance').textContent = `₵${stats.currentBalance.toLocaleString()}`;
    document.getElementById('dailyEarning').textContent = `₵${stats.dailyEarning.toLocaleString()}`;
    document.getElementById('daysToMaturity').textContent = stats.daysToMaturity.toString();
}

async function loadRecentActivity() {
    try {
        // Mock activity data - in real app, fetch from Firestore
        const activities = [
            {
                type: 'profit',
                title: 'Daily Profit',
                description: 'Daily investment return',
                amount: 125,
                date: new Date().toISOString(),
                status: 'completed'
            },
            {
                type: 'deposit',
                title: 'Initial Investment',
                description: 'Investment deposit',
                amount: 50000,
                date: new Date(Date.now() - 86400000).toISOString(),
                status: 'completed'
            },
            {
                type: 'profit',
                title: 'Daily Profit',
                description: 'Daily investment return',
                amount: 125,
                date: new Date(Date.now() - 172800000).toISOString(),
                status: 'completed'
            }
        ];

        const activityList = document.getElementById('recentActivity');
        if (activityList) {
            activityList.innerHTML = activities.map(activity => `
                <div class="activity-item">
                    <div class="activity-icon ${activity.type}">
                        <i class="fas ${getActivityIcon(activity.type)}"></i>
                    </div>
                    <div class="activity-details">
                        <div class="activity-title">${activity.title}</div>
                        <div class="activity-description">${activity.description}</div>
                        <div class="activity-date">${formatDate(activity.date)}</div>
                    </div>
                    <div class="activity-amount ${activity.type === 'withdrawal' ? 'negative' : 'positive'}">
                        ${activity.type === 'withdrawal' ? '-' : '+'}₵${activity.amount.toLocaleString()}
                    </div>
                </div>
            `).join('');
        }

        // Also update transactions table
        await loadTransactionsTable();
    } catch (error) {
        console.error('Error loading recent activity:', error);
    }
}

async function loadTransactionsTable() {
    try {
        // Mock transactions data
        const transactions = [
            {
                date: new Date().toISOString(),
                type: 'Profit',
                description: 'Daily investment return',
                amount: 125,
                status: 'completed'
            },
            {
                date: new Date(Date.now() - 86400000).toISOString(),
                type: 'Profit',
                description: 'Daily investment return',
                amount: 125,
                status: 'completed'
            },
            {
                date: new Date(Date.now() - 259200000).toISOString(),
                type: 'Deposit',
                description: 'Initial investment deposit',
                amount: 50000,
                status: 'completed'
            }
        ];

        const transactionsTable = document.getElementById('transactionsTable');
        if (transactionsTable) {
            transactionsTable.innerHTML = transactions.map(transaction => `
                <tr>
                    <td>${formatDate(transaction.date)}</td>
                    <td>${transaction.type}</td>
                    <td>${transaction.description}</td>
                    <td>₵${transaction.amount.toLocaleString()}</td>
                    <td><span class="status-badge ${transaction.status}">${transaction.status}</span></td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

async function loadCurrentBeneficiary() {
    try {
        // Mock beneficiary data
        const beneficiary = {
            name: 'Jane Doe',
            relationship: 'spouse',
            phone: '+233 24 987 6543',
            email: 'jane.doe@example.com',
            address: '123 Main Street, Accra, Ghana'
        };

        const currentBeneficiary = document.getElementById('currentBeneficiary');
        if (currentBeneficiary) {
            currentBeneficiary.innerHTML = `
                <div style="display: grid; gap: 1rem; padding: 1rem 0;">
                    <div><strong>Name:</strong> ${beneficiary.name}</div>
                    <div><strong>Relationship:</strong> ${beneficiary.relationship}</div>
                    <div><strong>Phone:</strong> ${beneficiary.phone}</div>
                    <div><strong>Email:</strong> ${beneficiary.email || 'Not provided'}</div>
                    <div><strong>Address:</strong> ${beneficiary.address || 'Not provided'}</div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading beneficiary:', error);
    }
}

function initializeCharts() {
    // Earnings Growth Chart
    const earningsCtx = document.getElementById('earningsChart');
    if (earningsCtx) {
        earningsChart = new Chart(earningsCtx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Portfolio Value',
                    data: [50000, 52000, 54500, 56200, 57800, 58750],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            callback: function(value) {
                                return '₵' + value.toLocaleString();
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    // Portfolio Allocation Chart
    const allocationCtx = document.getElementById('allocationChart');
    if (allocationCtx) {
        allocationChart = new Chart(allocationCtx, {
            type: 'doughnut',
            data: {
                labels: ['Construction', 'Agriculture', 'Food Processing', 'Logistics', 'Textiles', 'Technology'],
                datasets: [{
                    data: [25, 15, 12, 20, 10, 18],
                    backgroundColor: [
                        '#3b82f6',
                        '#10b981',
                        '#f59e0b',
                        '#ef4444',
                        '#8b5cf6',
                        '#06b6d4'
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 15
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }
}

function updateEarningsChart() {
    const period = document.getElementById('chartPeriod').value;
    // In real app, update chart data based on selected period
    console.log('Updating chart for period:', period);
}

function initializeStockTicker() {
    const stockData = [
        { symbol: "GSE-CAL", name: "Cal Bank", price: 0.48, change: 0.02 },
        { symbol: "GSE-EGH", name: "Ecobank Ghana", price: 6.10, change: 0.15 },
        { symbol: "GSE-GCB", name: "GCB Bank", price: 4.25, change: -0.10 },
        { symbol: "GSE-ML", name: "Cocoa Processing", price: 0.02, change: 0.00 }
    ];

    const ticker = document.getElementById('dashboardStockTicker');
    if (ticker) {
        // Duplicate data for seamless loop
        const doubledData = [...stockData, ...stockData];
        
        doubledData.forEach(stock => {
            const tickerItem = document.createElement('div');
            tickerItem.className = 'ticker-item';
            
            const changeClass = stock.change >= 0 ? 'ticker-change' : 'ticker-change negative';
            const changeSymbol = stock.change >= 0 ? '+' : '';
            
            tickerItem.innerHTML = `
                <span class="ticker-symbol">${stock.symbol}</span>
                <span class="ticker-price">₵${stock.price.toFixed(2)}</span>
                <span class="${changeClass}">${changeSymbol}${stock.change.toFixed(2)}</span>
            `;
            
            ticker.appendChild(tickerItem);
        });
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
                    pageTitle.textContent = getPageTitle(pageId);
                }
            }
            
            // Close mobile menu if open
            const sidebar = document.querySelector('.sidebar');
            if (sidebar.classList.contains('mobile-open')) {
                sidebar.classList.remove('mobile-open');
            }
        });
    });
}

function getPageTitle(pageId) {
    const titles = {
        'dashboard': 'Dashboard Overview',
        'transactions': 'Transaction History',
        'beneficiary': 'Beneficiary Management',
        'partners': 'Investment Partners',
        'settings': 'Account Settings'
    };
    return titles[pageId] || 'Dashboard';
}

async function handleBeneficiaryUpdate(e) {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('beneficiaryName').value,
        relationship: document.getElementById('beneficiaryRelationship').value,
        phone: document.getElementById('beneficiaryPhone').value,
        email: document.getElementById('beneficiaryEmail').value,
        address: document.getElementById('beneficiaryAddress').value,
        reason: document.getElementById('updateReason').value,
        status: 'pending',
        userId: currentUser.uid,
        createdAt: new Date().toISOString()
    };

    try {
        // Save beneficiary update request to Firestore
        await addDoc(collection(db, 'beneficiaryRequests'), formData);
        
        showMessage('Beneficiary update request submitted for approval', 'success');
        document.getElementById('beneficiaryForm').reset();
        
    } catch (error) {
        console.error('Error submitting beneficiary request:', error);
        showMessage('Error submitting request. Please try again.', 'error');
    }
}

async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
        showMessage('Please select an image file', 'error');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showMessage('Image must be less than 5MB', 'error');
        return;
    }

    try {
        // Upload to Firebase Storage
        const storage = getStorage();
        const filePath = `avatars/${currentUser.uid}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, filePath);
        
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        // Update user profile with new avatar URL
        await updateDoc(doc(db, 'users', currentUser.uid), {
            photoURL: downloadURL,
            updatedAt: serverTimestamp()
        });
        
        // Update UI
        const profileAvatar = document.getElementById('profileAvatar');
        const userAvatar = document.getElementById('userAvatar');
        
        if (profileAvatar) {
            profileAvatar.style.backgroundImage = `url(${downloadURL})`;
            profileAvatar.style.backgroundSize = 'cover';
            profileAvatar.textContent = '';
        }
        
        if (userAvatar) {
            userAvatar.style.backgroundImage = `url(${downloadURL})`;
            userAvatar.style.backgroundSize = 'cover';
            userAvatar.textContent = '';
        }
        
        showMessage('Profile picture updated successfully', 'success');
        
    } catch (error) {
        console.error('Error uploading avatar:', error);
        showMessage('Error updating profile picture', 'error');
    }
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

function changePassword() {
    showMessage('Password change feature would be implemented here', 'info');
}

function enableEdit(field) {
    const input = document.getElementById(`${field}Input`);
    if (input) {
        input.readOnly = false;
        input.focus();
        // In real app, you would add save functionality
        showMessage(`Edit ${field} - Save functionality would be implemented`, 'info');
    }
}

// Utility functions
function getInitials(name) {
    return name.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2);
}

function getActivityIcon(type) {
    const icons = {
        deposit: 'fa-plus',
        profit: 'fa-chart-line',
        withdrawal: 'fa-minus'
    };
    return icons[type] || 'fa-exchange-alt';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
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
    
    .page-content {
        display: none;
    }
    
    .page-content.active {
        display: block;
    }
`;
document.head.appendChild(style);
