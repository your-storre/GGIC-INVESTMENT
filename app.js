// Stock Ticker Data
const stockData = [
    { symbol: "GSE-CAL", name: "Cal Bank", price: 0.48, change: 0.02 },
    { symbol: "GSE-EGH", name: "Ecobank Ghana", price: 6.10, change: 0.15 },
    { symbol: "GSE-GCB", name: "GCB Bank", price: 4.25, change: -0.10 },
    { symbol: "GSE-ML", name: "Cocoa Processing", price: 0.02, change: 0.00 },
    { symbol: "GSE-SOG", name: "SOGEGH", price: 0.90, change: 0.05 },
    { symbol: "GSE-TBL", name: "Trust Bank", price: 0.06, change: -0.01 }
];

// Initialize Stock Ticker
function initializeStockTicker() {
    const ticker = document.getElementById('stockTicker');
    
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

// Update stock prices randomly (simulate live updates)
function updateStockPrices() {
    const tickerItems = document.querySelectorAll('.ticker-item');
    
    tickerItems.forEach((item, index) => {
        const actualIndex = index % stockData.length;
        const stock = stockData[actualIndex];
        
        // Simulate small price changes
        const change = (Math.random() - 0.5) * 0.04;
        stock.change = change;
        stock.price = Math.max(0.01, stock.price + change);
        
        const priceElement = item.querySelector('.ticker-price');
        const changeElement = item.querySelector('.ticker-change');
        
        const changeClass = change >= 0 ? 'ticker-change' : 'ticker-change negative';
        const changeSymbol = change >= 0 ? '+' : '';
        
        priceElement.textContent = `₵${stock.price.toFixed(2)}`;
        changeElement.className = changeClass;
        changeElement.textContent = `${changeSymbol}${change.toFixed(2)}`;
    });
}

// Smooth scrolling for anchor links
document.addEventListener('DOMContentLoaded', function() {
    // Initialize stock ticker
    initializeStockTicker();
    
    // Update stock prices every 10 seconds
    setInterval(updateStockPrices, 10000);
    
    // Smooth scrolling
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const headerHeight = document.querySelector('.header').offsetHeight;
                const targetPosition = targetElement.offsetTop - headerHeight - 20;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Add scroll effect to header
    window.addEventListener('scroll', function() {
        const header = document.querySelector('.header');
        if (window.scrollY > 100) {
            header.style.background = 'var(--primary-blue)';
            header.style.boxShadow = '0 2px 20px rgba(0,0,0,0.2)';
        } else {
            header.style.background = 'linear-gradient(135deg, var(--primary-blue) 0%, var(--secondary-blue) 100%)';
            header.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
        }
    });
});

// Utility function for displaying messages
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
        background: ${type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--error)' : 'var(--warning)'};
    `;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(messageDiv);
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
    
    .step-number {
        display: inline-block;
        width: 40px;
        height: 40px;
        background: var(--accent-gold);
        color: var(--dark-grey);
        border-radius: 50%;
        text-align: center;
        line-height: 40px;
        font-weight: bold;
        margin-bottom: 1rem;
    }
`;
document.head.appendChild(style);