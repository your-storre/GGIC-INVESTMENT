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

// Cache for instant page loads
let pageCache = new Map();
let currentUser = null;
let userData = null;
let charts = new Map();

document.addEventListener('DOMContentLoaded', function() {
    initializePremiumDashboard();
    setupEventListeners();
    preloadAllPages();
});

async function initializePremiumDashboard() {
    // Check authentication state
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadUserData(user);
            initializeNavigation();
            loadCurrentPage('overview');
            initializeRealTimeUpdates();
        } else {
            window.location.href = 'login.html';
        }
    });
}

function setupEventListeners() {
    // Mobile menu
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    }

    // Avatar upload
    const avatarUpload = document.querySelector('.avatar-upload');
    const avatarFileInput = document.getElementById('avatarFileInput');
    if (avatarUpload && avatarFileInput) {
        avatarUpload.addEventListener('click', () => avatarFileInput.click());
        avatarFileInput.addEventListener('change', handleAvatarUpload);
    }

    // Beneficiary form
    const beneficiaryForm = document.getElementById('beneficiaryForm');
    if (beneficiaryForm) {
        beneficiaryForm.addEventListener('submit', handleBeneficiaryUpdate);
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

// Ultra Fast Navigation System
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-page], .action-btn[data-page]');
    
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const pageId = this.getAttribute('data-page');
            loadPageInstantly(pageId);
        });
    });
}

function loadPageInstantly(pageId) {
    // Hide all pages first (instant)
    document.querySelectorAll('.page-content').forEach(page => {
        page.style.display = 'none';
    });

    // Show target page (instant)
    const targetPage = document.getElementById(pageId + '-page');
    if (targetPage) {
        targetPage.style.display = 'block';
        targetPage.classList.add('active');
        
        // Update page title
        document.getElementById('pageTitle').textContent = getPageTitle(pageId);
        
        // Update active nav state
        updateActiveNav(pageId);
        
        // Load page data if not cached
        if (!pageCache.has(pageId)) {
            loadPageData(pageId);
        } else {
            // Use cached data for instant display
            displayCachedData(pageId);
        }
    }
}

function updateActiveNav(pageId) {
    // Remove active class from all nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active class to current page
    const activeNav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (activeNav) {
        activeNav.classList.add('active');
    }
}

function getPageTitle(pageId) {
    const titles = {
        'overview': 'Portfolio Overview',
        'transactions': 'Transaction History',
        'beneficiary': 'Beneficiary Management',
        'update-beneficiary': 'Update Beneficiary',
        'partners': 'Investment Partners',
        'performance': 'Performance Analytics',
        'settings': 'Account Settings',
        'security': 'Security Settings'
    };
    return titles[pageId] || 'GGIC Dashboard';
}

// Preload all pages for instant navigation
function preloadAllPages() {
    const pages = ['overview', 'transactions', 'beneficiary', 'partners', 'performance', 'settings', 'security'];
    pages.forEach(page => {
        initializePageData(page);
    });
}

async function initializePageData(pageId) {
    switch (pageId) {
        case 'overview':
            await loadOverviewData();
            break;
        case 'transactions':
            await loadTransactionsData();
            break;
        case 'partners':
            await loadPartnersData();
            break;
        case 'performance':
            await loadPerformanceData();
            break;
        case 'settings':
            await loadSettingsData();
            break;
    }
}

// Page Data Loaders
async function loadOverviewData() {
    const data = {
        stats: {
            investmentAmount: 150000,
            currentBalance: 187500,
            dailyEarning: 375,
            daysToMaturity: 45
        },
        recentActivity: await generateRecentActivity(),
        marketData: await getLiveMarketData()
    };
    
    pageCache.set('overview', data);
    displayOverview(data);
}

async function loadTransactionsData() {
    const transactions = await generateTransactionHistory();
    pageCache.set('transactions', transactions);
    displayTransactions(transactions);
}

async function loadPartnersData() {
    const partners = await generatePartnersList();
    pageCache.set('partners', partners);
    displayPartners(partners);
}

// Data Display Functions
function displayOverview(data) {
    if (!data) return;
    
    // Update stats
    document.getElementById('investmentAmount').textContent = `$${data.stats.investmentAmount.toLocaleString()}`;
    document.getElementById('currentBalance').textContent = `$${data.stats.currentBalance.toLocaleString()}`;
    document.getElementById('dailyEarning').textContent = `$${data.stats.dailyEarning.toLocaleString()}`;
    document.getElementById('daysToMaturity').textContent = data.stats.daysToMaturity.toString();
    
    // Display recent activity
    displayRecentActivity(data.recentActivity);
    
    // Display market data
    displayMarketData(data.marketData);
    
    // Initialize charts
    initializeOverviewCharts();
}

function displayRecentActivity(activities) {
    const container = document.getElementById('recentActivity');
    if (!container) return;
    
    container.innerHTML = activities.map(activity => `
        <div class="activity-item">
            <div class="activity-icon ${activity.type}">
                <i class="fas ${getActivityIcon(activity.type)}"></i>
            </div>
            <div class="activity-details">
                <div class="activity-title">${activity.title}</div>
                <div class="activity-description">${activity.description}</div>
                <div class="activity-date">${activity.time}</div>
            </div>
            <div class="activity-amount ${activity.amount > 0 ? 'positive' : 'negative'}">
                ${activity.amount > 0 ? '+' : ''}$${Math.abs(activity.amount).toLocaleString()}
            </div>
        </div>
    `).join('');
}

function displayMarketData(marketData) {
    const container = document.getElementById('liveMarketData');
    if (!container) return;
    
    container.innerHTML = marketData.map(stock => `
        <div class="stock-item">
            <div class="stock-info">
                <div class="stock-symbol">${stock.symbol}</div>
                <div class="stock-name">${stock.name}</div>
            </div>
            <div class="stock-price">
                <div class="price">$${stock.price.toFixed(2)}</div>
                <div class="change ${stock.change >= 0 ? 'positive' : 'negative'}">
                    ${stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)} (${stock.changePercent.toFixed(2)}%)
                </div>
            </div>
        </div>
    `).join('');
}

function displayTransactions(transactions) {
    const container = document.getElementById('transactionsTable');
    if (!container) return;
    
    container.innerHTML = transactions.map(transaction => `
        <tr>
            <td>${transaction.date}<br><small>${transaction.time}</small></td>
            <td>
                <span class="transaction-type ${transaction.type}">
                    <i class="fas ${getTransactionIcon(transaction.type)}"></i>
                    ${transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                </span>
            </td>
            <td>${transaction.description}</td>
            <td>
                <span class="amount ${transaction.amount > 0 ? 'positive' : 'negative'}">
                    ${transaction.amount > 0 ? '+' : ''}$${Math.abs(transaction.amount).toLocaleString()}
                </span>
            </td>
            <td><span class="status-badge ${transaction.status}">${transaction.status}</span></td>
            <td><small>${transaction.reference}</small></td>
        </tr>
    `).join('');
}

function displayPartners(partners) {
    const container = document.getElementById('partnersGrid');
    if (!container) return;
    
    container.innerHTML = partners.map(partner => `
        <div class="partner-card">
            <div class="partner-header">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div class="partner-logo">
                        ${partner.logo}
                    </div>
                    <h4 style="margin: 0;">${partner.name}</h4>
                </div>
                <span class="sector-badge ${partner.sector}">${partner.sector}</span>
            </div>
            <div class="partner-stats">
                <div class="partner-stat">
                    <div style="font-weight: 600; color: var(--primary-blue);">$${(partner.investment / 1000000).toFixed(1)}M</div>
                    <div style="font-size: 0.8rem; color: var(--text-light);">GGIC Investment</div>
                </div>
                <div class="partner-stat">
                    <div style="font-weight: 600; color: ${partner.performance >= 10 ? 'var(--success)' : 'var(--warning)'};">
                        ${partner.performance >= 0 ? '+' : ''}${partner.performance}%
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-light);">YTD Performance</div>
                </div>
            </div>
            <p style="color: var(--text-light); font-size: 0.9rem; margin: 1rem 0; line-height: 1.5;">
                ${partner.description}
            </p>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: var(--text-light);">
                <span><i class="fas fa-users"></i> ${partner.employees}+ employees</span>
                <span><i class="fas fa-map-marker-alt"></i> ${partner.location}</span>
            </div>
        </div>
    `).join('');
}

// Data Generation Functions (Mock Data)
async function generateRecentActivity() {
    return [
        {
            type: 'profit',
            title: 'Daily Investment Return',
            description: 'Portfolio growth - Technology sector',
            amount: 375,
            time: '2 hours ago'
        },
        {
            type: 'profit',
            title: 'Dividend Payment',
            description: 'MTN Ghana dividend distribution',
            amount: 1250,
            time: '1 day ago'
        },
        {
            type: 'deposit',
            title: 'Investment Top-up',
            description: 'Additional capital injection',
            amount: 50000,
            time: '3 days ago'
        }
    ];
}

async function getLiveMarketData() {
    // Mock live market data
    return [
        { symbol: 'AAPL', name: 'Apple Inc.', price: 182.63, change: 1.25, changePercent: 0.69 },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 138.21, change: 0.89, changePercent: 0.65 },
        { symbol: 'MSFT', name: 'Microsoft Corp.', price: 407.59, change: 2.34, changePercent: 0.58 },
        { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 174.99, change: -0.45, changePercent: -0.26 },
        { symbol: 'TSLA', name: 'Tesla Inc.', price: 177.11, change: 3.21, changePercent: 1.85 }
    ];
}

async function generateTransactionHistory() {
    return [
        {
            date: 'Mar 20, 2024',
            time: '10:30 AM',
            type: 'profit',
            description: 'Daily investment return - Portfolio growth',
            amount: 375,
            status: 'completed',
            reference: 'PROF-001234'
        },
        {
            date: 'Mar 19, 2024',
            time: '09:15 AM',
            type: 'profit',
            description: 'MTN Ghana dividend distribution',
            amount: 1250,
            status: 'completed',
            reference: 'DIV-005678'
        },
        {
            date: 'Mar 18, 2024',
            time: '02:45 PM',
            type: 'deposit',
            description: 'Additional capital investment',
            amount: 50000,
            status: 'completed',
            reference: 'DEP-003421'
        },
        {
            date: 'Mar 15, 2024',
            time: '11:20 AM',
            type: 'profit',
            description: 'Weekly portfolio performance',
            amount: 2625,
            status: 'completed',
            reference: 'PROF-009876'
        }
    ];
}

async function generatePartnersList() {
    return [
        {
            name: 'MTN Ghana',
            sector: 'telecom',
            logo: 'MTN',
            investment: 25000000,
            performance: 18.5,
            employees: 2500,
            location: 'Accra, Ghana',
            description: 'Leading telecommunications company in Ghana with nationwide coverage and innovative digital solutions.'
        },
        {
            name: 'GCB Bank',
            sector: 'banking',
            logo: 'GCB',
            investment: 18000000,
            performance: 12.3,
            employees: 1800,
            location: 'Accra, Ghana',
            description: 'Premier banking institution with extensive branch network and comprehensive financial services.'
        },
        {
            name: 'Telecel Ghana',
            sector: 'telecom',
            logo: 'TCL',
            investment: 15000000,
            performance: 15.8,
            employees: 1200,
            location: 'Accra, Ghana',
            description: 'Innovative telecom provider focusing on digital transformation and customer-centric solutions.'
        },
        {
            name: 'Ecobank Ghana',
            sector: 'banking',
            logo: 'ECO',
            investment: 22000000,
            performance: 14.2,
            employees: 2000,
            location: 'Accra, Ghana',
            description: 'Pan-African banking group offering diverse financial products across multiple countries.'
        },
        {
            name: 'Kofi Jobs Construction',
            sector: 'construction',
            logo: 'KJC',
            investment: 12000000,
            performance: 22.1,
            employees: 850,
            location: 'Kumasi, Ghana',
            description: 'Leading construction company specializing in infrastructure and commercial building projects.'
        },
        {
            name: 'Adom Agro Supplies',
            sector: 'agriculture',
            logo: 'AAS',
            investment: 8500000,
            performance: 16.7,
            employees: 450,
            location: 'Tamale, Ghana',
            description: 'Agricultural inputs and processing company revolutionizing farming practices in Northern Ghana.'
        },
        {
            name: 'Ghana Commercial Bank',
            sector: 'banking',
            logo: 'GCB',
            investment: 19500000,
            performance: 13.8,
            employees: 2200,
            location: 'Accra, Ghana',
            description: 'One of Ghana\'s largest banks with strong corporate and retail banking presence.'
        },
        {
            name: 'Nana Foods Processing',
            sector: 'manufacturing',
            logo: 'NFP',
            investment: 9500000,
            performance: 19.3,
            employees: 600,
            location: 'Tema, Ghana',
            description: 'Food manufacturing company producing high-quality Ghanaian food products for export markets.'
        },
        {
            name: 'Twum & Sons Logistics',
            sector: 'logistics',
            logo: 'TSL',
            investment: 11000000,
            performance: 17.5,
            employees: 720,
            location: 'Takoradi, Ghana',
            description: 'Comprehensive logistics and transportation services connecting Ghana to international markets.'
        },
        {
            name: 'Akosua Textiles Enterprise',
            sector: 'manufacturing',
            logo: 'ATE',
            investment: 7500000,
            performance: 14.9,
            employees: 480,
            location: 'Koforidua, Ghana',
            description: 'Traditional Ghanaian textile manufacturer preserving cultural heritage with modern techniques.'
        },
        {
            name: 'Ghana Tech Solutions',
            sector: 'technology',
            logo: 'GTS',
            investment: 13500000,
            performance: 28.4,
            employees: 320,
            location: 'Accra, Ghana',
            description: 'Innovative technology company developing software solutions for Ghana\'s digital economy.'
        },
        {
            name: 'Standard Chartered Ghana',
            sector: 'banking',
            logo: 'SCB',
            investment: 16500000,
            performance: 11.8,
            employees: 1500,
            location: 'Accra, Ghana',
            description: 'International banking group with strong presence in Ghana\'s corporate banking sector.'
        },
        {
            name: 'Cal Bank',
            sector: 'banking',
            logo: 'CAL',
            investment: 12500000,
            performance: 15.2,
            employees: 1100,
            location: 'Accra, Ghana',
            description: 'Dynamic banking institution focused on SME financing and digital banking solutions.'
        },
        {
            name: 'Fidelity Bank Ghana',
            sector: 'banking',
            logo: 'FID',
            investment: 14000000,
            performance: 13.5,
            employees: 1300,
            location: 'Accra, Ghana',
            description: 'Growing banking group with innovative retail and corporate banking products.'
        },
        {
            name: 'Republic Bank Ghana',
            sector: 'banking',
            logo: 'REP',
            investment: 11500000,
            performance: 12.9,
            employees: 950,
            location: 'Accra, Ghana',
            description: 'Caribbean-based banking group with strong retail banking presence in Ghana.'
        },
        {
            name: 'Zenith Bank Ghana',
            sector: 'banking',
            logo: 'ZEN',
            investment: 15500000,
            performance: 14.7,
            employees: 1200,
            location: 'Accra, Ghana',
            description: 'Nigerian banking giant with comprehensive financial services across West Africa.'
        },
        {
            name: 'Access Bank Ghana',
            sector: 'banking',
            logo: 'ACC',
            investment: 13500000,
            performance: 16.1,
            employees: 1050,
            location: 'Accra, Ghana',
            description: 'Pan-African banking group with growing presence in Ghana\'s financial sector.'
        },
        {
            name: 'Stanbic Bank Ghana',
            sector: 'banking',
            logo: 'STA',
            investment: 14500000,
            performance: 13.2,
            employees: 1250,
            location: 'Accra, Ghana',
            description: 'Standard Bank Group subsidiary offering corporate and investment banking services.'
        },
        {
            name: 'Barclays Bank Ghana',
            sector: 'banking',
            logo: 'BAR',
            investment: 17500000,
            performance: 12.1,
            employees: 1600,
            location: 'Accra, Ghana',
            description: 'International banking brand with long-standing presence in Ghana\'s banking industry.'
        },
        {
            name: 'UT Bank Ghana',
            sector: 'banking',
            logo: 'UTB',
            investment: 9500000,
            performance: 18.3,
            employees: 800,
            location: 'Accra, Ghana',
            description: 'Specialized banking services focusing on entrepreneurial and business development.'
        }
    ];
}

// Chart Initialization
function initializeOverviewCharts() {
    // Performance Chart
    const performanceCtx = document.getElementById('performanceChart');
    if (performanceCtx && !charts.has('performance')) {
        const performanceChart = new Chart(performanceCtx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [{
                    label: 'Portfolio Value ($)',
                    data: [150000, 158000, 165000, 172000, 178000, 183000, 187500, 192000, 196000, 200000, 203000, 205000],
                    borderColor: '#ffd700',
                    backgroundColor: 'rgba(255, 215, 0, 0.1)',
                    borderWidth: 3,
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
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
        charts.set('performance', performanceChart);
    }
}

// Beneficiary Management
async function handleBeneficiaryUpdate(e) {
    e.preventDefault();
    
    const formData = {
        beneficiaryName: document.getElementById('beneficiaryName').value,
        beneficiaryPhone: document.getElementById('beneficiaryPhone').value,
        beneficiaryAddress: document.getElementById('beneficiaryAddress').value,
        bankName: document.getElementById('bankName').value,
        accountName: document.getElementById('accountName').value,
        accountNumber: document.getElementById('accountNumber').value,
        routingNumber: document.getElementById('routingNumber').value,
        updateReason: document.getElementById('updateReason').value,
        status: 'pending',
        submittedAt: new Date().toISOString()
    };

    try {
        // Save to Firestore
        await addDoc(collection(db, 'beneficiaryRequests'), {
            ...formData,
            userId: currentUser.uid,
            createdAt: serverTimestamp()
        });

        // Show success modal
        document.getElementById('successModal').style.display = 'flex';
        
        // Reset form
        document.getElementById('beneficiaryForm').reset();
        
    } catch (error) {
        console.error('Error submitting beneficiary request:', error);
        showMessage('Error submitting request. Please try again.', 'error');
    }
}

// Global Functions
window.showUpdateBeneficiary = function() {
    loadPageInstantly('update-beneficiary');
};

window.goBackToBeneficiary = function() {
    loadPageInstantly('beneficiary');
};

window.closeSuccessModal = function() {
    document.getElementById('successModal').style.display = 'none';
    loadPageInstantly('beneficiary');
};

window.applyTransactionFilters = function() {
    // Filter transactions based on selected criteria
    const type = document.getElementById('transactionType').value;
    const period = document.getElementById('transactionPeriod').value;
    // Implementation would filter the displayed transactions
    showMessage('Filters applied successfully', 'success');
};

// Utility Functions
function getActivityIcon(type) {
    const icons = {
        'profit': 'fa-chart-line',
        'deposit': 'fa-plus',
        'withdrawal': 'fa-minus'
    };
    return icons[type] || 'fa-exchange-alt';
}

function getTransactionIcon(type) {
    const icons = {
        'profit': 'fa-chart-line',
        'deposit': 'fa-arrow-down',
        'withdrawal': 'fa-arrow-up'
    };
    return icons[type] || 'fa-exchange-alt';
}

function toggleMobileMenu() {
    document.querySelector('.premium-sidebar').classList.toggle('mobile-open');
}

async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const storage = getStorage();
        const filePath = `avatars/${currentUser.uid}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, filePath);
        
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        // Update user profile
        await updateDoc(doc(db, 'users', currentUser.uid), {
            photoURL: downloadURL,
            updatedAt: serverTimestamp()
        });
        
        // Update UI
        updateAvatar(downloadURL);
        showMessage('Profile picture updated successfully', 'success');
        
    } catch (error) {
        console.error('Error uploading avatar:', error);
        showMessage('Error updating profile picture', 'error');
    }
}

function updateAvatar(photoURL) {
    const avatarImage = document.getElementById('avatarImage');
    const avatarInitials = document.getElementById('avatarInitials');
    const profileAvatarImage = document.getElementById('profileAvatarImage');
    const profileAvatarInitials = document.getElementById('profileAvatarInitials');
    
    if (photoURL) {
        if (avatarImage) {
            avatarImage.src = photoURL;
            avatarImage.style.display = 'block';
        }
        if (avatarInitials) avatarInitials.style.display = 'none';
        if (profileAvatarImage) {
            profileAvatarImage.src = photoURL;
            profileAvatarImage.style.display = 'block';
        }
        if (profileAvatarInitials) profileAvatarInitials.style.display = 'none';
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

function showMessage(message, type = 'success') {
    const messageDiv = document.createElement('div');
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
        background: ${type === 'success' ? 'var(--success)' : 'var(--error)'};
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
    
    .modal-overlay {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        z-index: 10000;
        justify-content: center;
        align-items: center;
    }
`;
document.head.appendChild(style);
