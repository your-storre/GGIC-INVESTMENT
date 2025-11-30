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
    serverTimestamp,
    onSnapshot
} from './firebase-config.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

let currentUser = null;
let userData = null;
let earningsChart = null;
let allocationChart = null;
let transactions = [];
let currentPage = 1;
const transactionsPerPage = 10;

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
            setupRealTimeListeners();
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

    // Transaction filters
    const transactionFilter = document.getElementById('transactionFilter');
    const transactionPeriod = document.getElementById('transactionPeriod');
    if (transactionFilter) {
        transactionFilter.addEventListener('change', filterTransactions);
    }
    if (transactionPeriod) {
        transactionPeriod.addEventListener('change', filterTransactions);
    }

    // Partner filters
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => filterPartners(btn.dataset.filter));
    });

    // Refresh stocks
    const refreshStocks = document.getElementById('refreshStocks');
    if (refreshStocks) {
        refreshStocks.addEventListener('click', initializeStockWidget);
    }

    // Password form
    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', handlePasswordChange);
    }

    // Notification bell
    const notificationBell = document.getElementById('notificationBell');
    if (notificationBell) {
        notificationBell.addEventListener('click', showNotifications);
    }
}

async function loadUserData(user) {
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            userData = { id: userDoc.id, ...userDoc.data() };
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
    const profileFullName = document.getElementById('profileFullName');
    const profileGhanaCard = document.getElementById('profileGhanaCard');
    const profileEmail = document.getElementById('profileEmail');
    const profilePhone = document.getElementById('profilePhone');
    const memberSince = document.getElementById('memberSince');
    const memberId = document.getElementById('memberId');

    if (userData) {
        const displayName = userData.fullName || currentUser.displayName || 'User';
        const initials = getInitials(displayName);
        
        // Update text content
        if (userName) userName.textContent = displayName;
        if (profileName) profileName.textContent = displayName;
        if (profileFullName) profileFullName.value = displayName;
        if (profileGhanaCard) profileGhanaCard.value = userData.ghanaCard || 'Not provided';
        if (profileEmail) profileEmail.value = userData.email || currentUser.email;
        if (profilePhone) profilePhone.value = userData.phone || 'Not provided';
        if (memberSince && userData.createdAt) {
            const date = new Date(userData.createdAt);
            memberSince.textContent = date.toLocaleDateString('en-GB', { year: 'numeric', month: 'long' });
        }
        if (memberId) memberId.textContent = `ID: ${userData.memberId || 'GGIC-M-' + userData.id.slice(-6)}`;

        // Update avatars
        updateAvatar(userAvatar, userData.photoURL, initials);
        updateAvatar(profileAvatar, userData.photoURL, initials);
    }
}

function updateAvatar(avatarElement, photoURL, initials) {
    const avatarImage = avatarElement.querySelector('img');
    const avatarInitials = avatarElement.querySelector('#avatarInitials, #profileAvatarInitials');
    
    if (photoURL) {
        avatarImage.src = photoURL;
        avatarImage.style.display = 'block';
        avatarInitials.style.display = 'none';
    } else {
        avatarImage.style.display = 'none';
        avatarInitials.style.display = 'block';
        avatarInitials.textContent = initials;
    }
}

async function loadDashboardData() {
    await loadInvestmentStats();
    await loadRecentActivity();
    await loadCurrentBeneficiary();
    await loadTransactions();
    await loadPartners();
    initializeStockWidget();
    loadNotifications();
}

async function loadInvestmentStats() {
    try {
        // Calculate investment stats
        const stats = {
            investmentAmount: userData?.investmentAmount || 50000,
            currentBalance: userData?.currentBalance || 58750,
            dailyEarning: userData?.dailyEarning || 125,
            daysToMaturity: calculateDaysToMaturity(),
            totalGrowth: ((58750 - 50000) / 50000 * 100).toFixed(1)
        };

        // Update DOM elements
        document.getElementById('investmentAmount').textContent = `₵${stats.investmentAmount.toLocaleString()}`;
        document.getElementById('currentBalance').textContent = `₵${stats.currentBalance.toLocaleString()}`;
        document.getElementById('dailyEarning').textContent = `₵${stats.dailyEarning.toLocaleString()}`;
        document.getElementById('daysToMaturity').textContent = stats.daysToMaturity.toString();
        
        // Update change indicators
        document.getElementById('investmentChange').textContent = `+${stats.totalGrowth}% total growth`;
        document.getElementById('balanceChange').textContent = `+₵${(stats.currentBalance - stats.investmentAmount).toLocaleString()} earned`;
        
        const maturityStatus = document.getElementById('maturityStatus');
        if (stats.daysToMaturity > 30) {
            maturityStatus.textContent = 'Active';
            maturityStatus.className = 'stat-change positive';
        } else if (stats.daysToMaturity > 0) {
            maturityStatus.textContent = `${stats.daysToMaturity} days left`;
            maturityStatus.className = 'stat-change warning';
        } else {
            maturityStatus.textContent = 'Ready for payout';
            maturityStatus.className = 'stat-change positive';
        }

    } catch (error) {
        console.error('Error loading investment stats:', error);
    }
}

function calculateDaysToMaturity() {
    if (!userData?.maturityDate) return 45; // Default
    
    const maturityDate = new Date(userData.maturityDate);
    const today = new Date();
    const diffTime = maturityDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
}

async function loadRecentActivity() {
    try {
        // Mock activity data - in real app, fetch from Firestore
        const activities = [
            {
                type: 'profit',
                title: 'Daily Profit',
                description: 'Daily investment return - Portfolio growth',
                amount: 125,
                date: new Date().toISOString(),
                status: 'completed'
            },
            {
                type: 'profit',
                title: 'Daily Profit',
                description: 'Daily investment return - Portfolio growth',
                amount: 125,
                date: new Date(Date.now() - 86400000).toISOString(),
                status: 'completed'
            },
            {
                type: 'deposit',
                title: 'Initial Investment',
                description: 'Investment deposit - Portfolio funding',
                amount: 50000,
                date: new Date(Date.now() - 172800000).toISOString(),
                status: 'completed'
            },
            {
                type: 'profit',
                title: 'Daily Profit',
                description: 'Daily investment return - Portfolio growth',
                amount: 125,
                date: new Date(Date.now() - 259200000).toISOString(),
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
    } catch (error) {
        console.error('Error loading recent activity:', error);
    }
}

async function loadTransactions() {
    try {
        // Mock transactions data
        transactions = [
            {
                id: '1',
                date: new Date().toISOString(),
                type: 'profit',
                description: 'Daily investment return',
                amount: 125,
                status: 'completed',
                reference: 'PROF-001'
            },
            {
                id: '2',
                date: new Date(Date.now() - 86400000).toISOString(),
                type: 'profit',
                description: 'Daily investment return',
                amount: 125,
                status: 'completed',
                reference: 'PROF-002'
            },
            {
                id: '3',
                date: new Date(Date.now() - 172800000).toISOString(),
                type: 'deposit',
                description: 'Initial investment deposit',
                amount: 50000,
                status: 'completed',
                reference: 'DEP-001'
            },
            {
                id: '4',
                date: new Date(Date.now() - 259200000).toISOString(),
                type: 'profit',
                description: 'Daily investment return',
                amount: 125,
                status: 'completed',
                reference: 'PROF-003'
            },
            {
                id: '5',
                date: new Date(Date.now() - 345600000).toISOString(),
                type: 'profit',
                description: 'Daily investment return',
                amount: 125,
                status: 'completed',
                reference: 'PROF-004'
            }
        ];

        displayTransactions();

    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

function displayTransactions() {
    const transactionsTable = document.getElementById('transactionsTable');
    const tableInfo = document.getElementById('tableInfo');
    
    if (!transactionsTable) return;

    const filteredTransactions = filterTransactionsData();
    const startIndex = (currentPage - 1) * transactionsPerPage;
    const endIndex = startIndex + transactionsPerPage;
    const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

    if (paginatedTransactions.length === 0) {
        transactionsTable.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <div class="empty-state">
                        <i class="fas fa-exchange-alt"></i>
                        <p>No transactions found</p>
                    </div>
                </td>
            </tr>
        `;
    } else {
        transactionsTable.innerHTML = paginatedTransactions.map(transaction => `
            <tr>
                <td>${formatDate(transaction.date)}</td>
                <td>
                    <span class="transaction-type ${transaction.type}">
                        <i class="fas ${getTransactionIcon(transaction.type)}"></i>
                        ${transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                    </span>
                </td>
                <td>${transaction.description}</td>
                <td>
                    <span class="amount ${transaction.type === 'withdrawal' ? 'negative' : 'positive'}">
                        ${transaction.type === 'withdrawal' ? '-' : '+'}₵${transaction.amount.toLocaleString()}
                    </span>
                </td>
                <td><span class="status-badge ${transaction.status}">${transaction.status}</span></td>
                <td class="text-small">${transaction.reference}</td>
            </tr>
        `).join('');
    }

    // Update table info and pagination
    if (tableInfo) {
        tableInfo.textContent = `Showing ${startIndex + 1}-${Math.min(endIndex, filteredTransactions.length)} of ${filteredTransactions.length} transactions`;
    }

    updatePagination(filteredTransactions.length);
}

function filterTransactionsData() {
    const typeFilter = document.getElementById('transactionFilter').value;
    const periodFilter = document.getElementById('transactionPeriod').value;
    
    let filtered = transactions;

    // Filter by type
    if (typeFilter !== 'all') {
        filtered = filtered.filter(t => t.type === typeFilter);
    }

    // Filter by period
    if (periodFilter !== 'all') {
        const now = new Date();
        let startDate = new Date();
        
        switch (periodFilter) {
            case '7d':
                startDate.setDate(now.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(now.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(now.getDate() - 90);
                break;
        }
        
        filtered = filtered.filter(t => new Date(t.date) >= startDate);
    }

    return filtered;
}

function filterTransactions() {
    currentPage = 1;
    displayTransactions();
}

function updatePagination(totalItems) {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;

    const totalPages = Math.ceil(totalItems / transactionsPerPage);
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `
        <button class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}" 
                onclick="changePage(${currentPage - 1})" 
                ${currentPage === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i>
        </button>
    `;

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            paginationHTML += `
                <button class="pagination-btn ${i === currentPage ? 'active' : ''}" 
                        onclick="changePage(${i})">
                    ${i}
                </button>
            `;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            paginationHTML += `<span class="pagination-ellipsis">...</span>`;
        }
    }

    // Next button
    paginationHTML += `
        <button class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}" 
                onclick="changePage(${currentPage + 1})" 
                ${currentPage === totalPages ? 'disabled' : ''}>
            <i class="fas fa-chevron-right"></i>
        </button>
    `;

    pagination.innerHTML = paginationHTML;
}

// Make changePage function available globally
window.changePage = function(page) {
    const totalPages = Math.ceil(filterTransactionsData().length / transactionsPerPage);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        displayTransactions();
    }
};

async function loadCurrentBeneficiary() {
    try {
        // Mock beneficiary data
        const beneficiary = {
            name: 'Jane Doe',
            relationship: 'spouse',
            phone: '+233 24 987 6543',
            email: 'jane.doe@example.com',
            address: '123 Main Street, Accra, Ghana',
            idNumber: 'GHA-987654321',
            status: 'active',
            lastUpdated: new Date('2024-01-15').toISOString()
        };

        const currentBeneficiary = document.getElementById('currentBeneficiary');
        const beneficiaryStatus = document.getElementById('beneficiaryStatus');
        
        if (currentBeneficiary) {
            currentBeneficiary.innerHTML = `
                <div class="beneficiary-details">
                    <div class="detail-row">
                        <div class="detail-label">Full Name</div>
                        <div class="detail-value">${beneficiary.name}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Relationship</div>
                        <div class="detail-value">${beneficiary.relationship}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Phone Number</div>
                        <div class="detail-value">${beneficiary.phone}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Email Address</div>
                        <div class="detail-value">${beneficiary.email || 'Not provided'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Residential Address</div>
                        <div class="detail-value">${beneficiary.address || 'Not provided'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">ID Number</div>
                        <div class="detail-value">${beneficiary.idNumber || 'Not provided'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Last Updated</div>
                        <div class="detail-value">${formatDate(beneficiary.lastUpdated)}</div>
                    </div>
                </div>
            `;
        }

        if (beneficiaryStatus) {
            beneficiaryStatus.textContent = beneficiary.status.charAt(0).toUpperCase() + beneficiary.status.slice(1);
        }

    } catch (error) {
        console.error('Error loading beneficiary:', error);
    }
}

async function loadPartners() {
    try {
        const partners = [
            {
                id: 1,
                name: 'Kofi Jobs Construction Ltd',
                sector: 'construction',
                description: 'Leading infrastructure development company specializing in affordable housing and commercial projects across Ghana.',
                investment: 15000000,
                performance: 12.5,
                employees: 250,
                established: 2010,
                location: 'Accra, Ghana'
            },
            {
                id: 2,
                name: 'Adom Agro Supplies',
                sector: 'agriculture',
                description: 'Agricultural inputs and processing company revolutionizing Ghana\'s farming sector with modern techniques and equipment.',
                investment: 8500000,
                performance: 8.2,
                employees: 120,
                established: 2015,
                location: 'Kumasi, Ghana'
            },
            {
                id: 3,
                name: 'Nana Foods Processing',
                sector: 'manufacturing',
                description: 'Food manufacturing company producing high-quality Ghanaian food products for local and international markets.',
                investment: 6200000,
                performance: 15.3,
                employees: 85,
                established: 2012,
                location: 'Tema, Ghana'
            },
            {
                id: 4,
                name: 'Twum & Sons Logistics',
                sector: 'logistics',
                description: 'Comprehensive logistics and transportation services connecting Ghanaian businesses to regional markets.',
                investment: 12000000,
                performance: 9.8,
                employees: 180,
                established: 2008,
                location: 'Accra, Ghana'
            },
            {
                id: 5,
                name: 'Akosua Textiles Enterprise',
                sector: 'manufacturing',
                description: 'Traditional Ghanaian textile manufacturer preserving cultural heritage while embracing modern production methods.',
                investment: 5500000,
                performance: 7.5,
                employees: 95,
                established: 2018,
                location: 'Koforidua, Ghana'
            },
            {
                id: 6,
                name: 'Ghana Tech Solutions',
                sector: 'technology',
                description: 'Innovative technology company developing software solutions for Ghana\'s growing digital economy.',
                investment: 10000000,
                performance: 22.1,
                employees: 65,
                established: 2020,
                location: 'Accra, Ghana'
            }
        ];

        displayPartners(partners);

    } catch (error) {
        console.error('Error loading partners:', error);
    }
}

function displayPartners(partners) {
    const partnersGrid = document.getElementById('partnersGrid');
    if (!partnersGrid) return;

    partnersGrid.innerHTML = partners.map(partner => `
        <div class="card partner-card" data-sector="${partner.sector}">
            <div class="partner-header">
                <h3>${partner.name}</h3>
                <span class="sector-badge ${partner.sector}">${partner.sector.charAt(0).toUpperCase() + partner.sector.slice(1)}</span>
            </div>
            <div class="partner-stats">
                <div class="partner-stat">
                    <div class="stat-value">₵${(partner.investment / 1000000).toFixed(1)}M</div>
                    <div class="stat-label">GGIC Investment</div>
                </div>
                <div class="partner-stat">
                    <div class="stat-value ${partner.performance >= 10 ? 'positive' : 'warning'}">${partner.performance}%</div>
                    <div class="stat-label">YTD Performance</div>
                </div>
            </div>
            <p class="partner-description">${partner.description}</p>
            <div class="partner-details">
                <div class="detail-item">
                    <i class="fas fa-users"></i>
                    <span>${partner.employees}+ employees</span>
                </div>
                <div class="detail-item">
                    <i class="fas fa-calendar"></i>
                    <span>Est. ${partner.established}</span>
                </div>
                <div class="detail-item">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${partner.location}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function filterPartners(sector) {
    const partners = document.querySelectorAll('.partner-card');
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    // Update active filter button
    filterButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === sector);
    });
    
    // Filter partners
    partners.forEach(partner => {
        if (sector === 'all' || partner.dataset.sector === sector) {
            partner.style.display = 'block';
        } else {
            partner.style.display = 'none';
        }
    });
}

function initializeStockWidget() {
    const stockData = [
        { symbol: "GSE-CAL", name: "Cal Bank", price: 0.48, change: 0.02, changePercent: 4.35 },
        { symbol: "GSE-EGH", name: "Ecobank Ghana", price: 6.10, change: 0.15, changePercent: 2.52 },
        { symbol: "GSE-GCB", name: "GCB Bank", price: 4.25, change: -0.10, changePercent: -2.30 },
        { symbol: "GSE-ML", name: "Cocoa Processing", price: 0.02, change: 0.00, changePercent: 0.00 },
        { symbol: "GSE-SOG", name: "SOGEGH", price: 0.90, change: 0.05, changePercent: 5.88 },
        { symbol: "GSE-TBL", name: "Trust Bank", price: 0.06, change: -0.01, changePercent: -1.64 }
    ];

    const stockList = document.getElementById('stockList');
    if (stockList) {
        stockList.innerHTML = stockData.map(stock => `
            <div class="stock-item">
                <div class="stock-info">
                    <div class="stock-symbol">${stock.symbol}</div>
                    <div class="stock-name">${stock.name}</div>
                </div>
                <div class="stock-price">
                    <div class="price">₵${stock.price.toFixed(2)}</div>
                    <div class="change ${stock.change >= 0 ? 'positive' : 'negative'}">
                        ${stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)} (${stock.changePercent.toFixed(2)}%)
                    </div>
                </div>
            </div>
        `).join('');
    }
}

function initializeCharts() {
    // Earnings Growth Chart
    const earningsCtx = document.getElementById('earningsChart');
    if (earningsCtx) {
        earningsChart = new Chart(earningsCtx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [{
                    label: 'Portfolio Value',
                    data: [50000, 52000, 54500, 56200, 57800, 58750, 60100, 61800, 63200, 64500, 65800, 67200],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#3b82f6',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                return `Portfolio: ₵${context.parsed.y.toLocaleString()}`;
                            }
                        }
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
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    // Allocation Chart
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
                    borderWidth: 3,
                    borderColor: '#ffffff',
                    hoverOffset: 8
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
                            padding: 15,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.label}: ${context.parsed}%`;
                            }
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }
}

function updateEarningsChart() {
    const period = document.getElementById('chartPeriod').value;
    // In real app, update chart data based on selected period
    console.log('Updating chart for period:', period);
    
    // Simulate chart update
    if (earningsChart) {
        earningsChart.update();
    }
}

// ... (rest of the functions from previous implementation remain the same)
// Including: setupNavigation, handleBeneficiaryUpdate, handleAvatarUpload, etc.

// Add new CSS for enhanced features
const enhancedStyles = document.createElement('style');
enhancedStyles.textContent = `
    .stock-widget {
        max-height: 300px;
        overflow-y: auto;
    }
    
    .stock-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem;
        border-bottom: 1px solid #e5e7eb;
    }
    
    .stock-item:last-child {
        border-bottom: none;
    }
    
    .stock-info {
        flex: 1;
    }
    
    .stock-symbol {
        font-weight: 600;
        color: var(--text-dark);
    }
    
    .stock-name {
        font-size: 0.8rem;
        color: var(--text-light);
    }
    
    .stock-price {
        text-align: right;
    }
    
    .price {
        font-weight: 600;
    }
    
    .change.positive {
        color: var(--success);
        font-size: 0.8rem;
    }
    
    .change.negative {
        color: var(--error);
        font-size: 0.8rem;
    }
    
    .partner-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 1rem;
    }
    
    .sector-badge {
        padding: 0.25rem 0.5rem;
        border-radius: 12px;
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
    }
    
    .sector-badge.construction {
        background: #dbeafe;
        color: #1e40af;
    }
    
    .sector-badge.agriculture {
        background: #dcfce7;
        color: #166534;
    }
    
    .sector-badge.technology {
        background: #f0f9ff;
        color: #0c4a6e;
    }
    
    .sector-badge.manufacturing {
        background: #fef3c7;
        color: #92400e;
    }
    
    .sector-badge.logistics {
        background: #fee2e2;
        color: #991b1b;
    }
    
    .partner-stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        margin: 1rem 0;
    }
    
    .partner-stat {
        text-align: center;
        padding: 0.5rem;
        background: #f8fafc;
        border-radius: 8px;
    }
    
    .partner-description {
        color: var(--text-light);
        font-size: 0.9rem;
        line-height: 1.5;
        margin: 1rem 0;
    }
    
    .partner-details {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    
    .detail-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.8rem;
        color: var(--text-light);
    }
    
    .beneficiary-details {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    
    .detail-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 0.5rem 0;
        border-bottom: 1px solid #f3f4f6;
    }
    
    .detail-row:last-child {
        border-bottom: none;
    }
    
    .detail-label {
        font-weight: 600;
        color: var(--text-dark);
        min-width: 120px;
    }
    
    .detail-value {
        color: var(--text-light);
        text-align: right;
        flex: 1;
    }
    
    .input-with-action {
        display: flex;
        gap: 0.5rem;
    }
    
    .input-with-action .form-input {
        flex: 1;
    }
    
    .security-item, .notification-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 0;
        border-bottom: 1px solid #f3f4f6;
    }
    
    .security-item:last-child, .notification-item:last-child {
        border-bottom: none;
    }
    
    .security-info h4, .notification-info h4 {
        margin: 0 0 0.25rem 0;
        font-size: 1rem;
    }
    
    .security-info p, .notification-info p {
        margin: 0;
        font-size: 0.8rem;
        color: var(--text-light);
    }
    
    .toggle-switch {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .switch {
        position: relative;
        display: inline-block;
        width: 50px;
        height: 24px;
    }
    
    .switch input {
        opacity: 0;
        width: 0;
        height: 0;
    }
    
    .slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #ccc;
        transition: .4s;
    }
    
    .slider:before {
        position: absolute;
        content: "";
        height: 16px;
        width: 16px;
        left: 4px;
        bottom: 4px;
        background-color: white;
        transition: .4s;
    }
    
    input:checked + .slider {
        background-color: var(--success);
    }
    
    input:checked + .slider:before {
        transform: translateX(26px);
    }
    
    .slider.round {
        border-radius: 24px;
    }
    
    .slider.round:before {
        border-radius: 50%;
    }
    
    .transaction-type {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.25rem 0.75rem;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 600;
    }
    
    .transaction-type.deposit {
        background: #dcfce7;
        color: #166534;
    }
    
    .transaction-type.profit {
        background: #fef3c7;
        color: #92400e;
    }
    
    .transaction-type.withdrawal {
        background: #fee2e2;
        color: #991b1b;
    }
    
    .table-responsive {
        overflow-x: auto;
    }
    
    .pagination {
        display: flex;
        gap: 0.25rem;
    }
    
    .pagination-btn {
        padding: 0.5rem 0.75rem;
        border: 1px solid #e5e7eb;
        background: white;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.8rem;
    }
    
    .pagination-btn:hover:not(.disabled) {
        background: #f8fafc;
    }
    
    .pagination-btn.active {
        background: var(--primary-blue);
        color: white;
        border-color: var(--primary-blue);
    }
    
    .pagination-btn.disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    .pagination-ellipsis {
        padding: 0.5rem 0.25rem;
        color: var(--text-light);
    }
    
    .filter-buttons {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
    }
    
    .filter-btn {
        padding: 0.5rem 1rem;
        border: 1px solid #e5e7eb;
        background: white;
        border-radius: 20px;
        cursor: pointer;
        font-size: 0.8rem;
        transition: all 0.3s ease;
    }
    
    .filter-btn:hover {
        background: #f8fafc;
    }
    
    .filter-btn.active {
        background: var(--primary-blue);
        color: white;
        border-color: var(--primary-blue);
    }
    
    .investment-summary {
        text-align: right;
    }
    
    .form-hint {
        font-size: 0.8rem;
        color: var(--text-light);
        margin-top: 0.25rem;
    }
    
    .text-small {
        font-size: 0.8rem;
    }
    
    .amount.positive {
        color: var(--success);
        font-weight: 600;
    }
    
    .amount.negative {
        color: var(--error);
        font-weight: 600;
    }
`;
document.head.appendChild(enhancedStyles);
