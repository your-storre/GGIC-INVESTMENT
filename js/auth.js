import { 
    auth, 
    db, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut,
    collection,
    addDoc,
    query,
    where,
    getDocs,
    updateDoc,
    doc,
    getDoc
} from './firebase-config.js';

// Authentication state management
let currentUser = null;
let twoFACode = null;
let loginAttemptData = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeAuth();
    setupEventListeners();
});

function initializeAuth() {
    // Check if user is already logged in
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            checkUserRoleAndRedirect(user);
        } else {
            currentUser = null;
        }
    });
}

function setupEventListeners() {
    const loginForm = document.getElementById('loginForm');
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const verifyCodeBtn = document.getElementById('verifyCodeBtn');
    const resendCode = document.getElementById('resendCode');
    const approveDeviceBtn = document.getElementById('approveDeviceBtn');
    const forgotPassword = document.getElementById('forgotPassword');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    if (togglePassword) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePassword.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
        });
    }

    if (verifyCodeBtn) {
        verifyCodeBtn.addEventListener('click', verify2FACode);
    }

    if (resendCode) {
        resendCode.addEventListener('click', resend2FACode);
    }

    if (approveDeviceBtn) {
        approveDeviceBtn.addEventListener('click', approveNewDevice);
    }

    if (forgotPassword) {
        forgotPassword.addEventListener('click', handleForgotPassword);
    }

    // Setup 2FA code inputs
    setupCodeInputs();
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('loginBtn');
    
    try {
        // Show loading state
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';
        loginBtn.disabled = true;
        
        // Attempt login
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Store login attempt data for 2FA
        loginAttemptData = {
            email,
            user,
            timestamp: new Date().toISOString()
        };
        
        // Check if this is a new device/location
        const isNewDevice = await checkIfNewDevice(user);
        
        if (isNewDevice) {
            showNewDeviceModal();
        } else {
            // Proceed with 2FA
            await initiate2FA(user);
        }
        
    } catch (error) {
        console.error('Login error:', error);
        handleLoginError(error);
    } finally {
        // Reset button state
        loginBtn.innerHTML = '<i class="fas fa-lock"></i> Secure Login';
        loginBtn.disabled = false;
    }
}

async function checkIfNewDevice(user) {
    try {
        // In a real app, you'd check IP address, user agent, etc.
        // For demo purposes, we'll simulate device checking
        const devicesRef = collection(db, 'userDevices');
        const q = query(devicesRef, where('userId', '==', user.uid));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            return true; // First time login
        }
        
        // Check if current device matches any registered devices
        const currentDeviceId = generateDeviceId();
        const isKnownDevice = querySnapshot.docs.some(doc => 
            doc.data().deviceId === currentDeviceId
        );
        
        return !isKnownDevice;
    } catch (error) {
        console.error('Device check error:', error);
        return true; // Default to requiring approval on error
    }
}

async function initiate2FA(user) {
    // Generate 6-digit code
    twoFACode = generate2FACode();
    
    // In a real app, you would send this code via email/SMS
    // For demo, we'll just show it and log it
    console.log(`2FA Code for ${user.email}: ${twoFACode}`);
    
    // Simulate sending email
    await simulateSend2FAEmail(user.email, twoFACode);
    
    // Show 2FA modal
    show2FAModal();
    startResendTimer();
}

function generate2FACode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function simulateSend2FAEmail(email, code) {
    // In a real implementation, you would use Firebase Extensions or your own email service
    // For demo purposes, we'll just log it
    console.log(`Sending 2FA code ${code} to ${email}`);
    
    // You would typically use Firebase Cloud Functions to send emails
    // await fetch('/send-2fa-email', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ email, code })
    // });
}

function show2FAModal() {
    const modal = document.getElementById('twoFAModal');
    modal.style.display = 'flex';
    clearCodeInputs();
}

function close2FAModal() {
    const modal = document.getElementById('twoFAModal');
    modal.style.display = 'none';
    twoFACode = null;
    loginAttemptData = null;
}

function showNewDeviceModal() {
    const modal = document.getElementById('newDeviceModal');
    modal.style.display = 'flex';
}

function closeNewDeviceModal() {
    const modal = document.getElementById('newDeviceModal');
    modal.style.display = 'none';
    // Sign out user since they didn't approve the device
    signOut(auth);
}

function setupCodeInputs() {
    const codeInputs = document.querySelectorAll('.code-input');
    
    codeInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            
            if (value.length === 1 && index < codeInputs.length - 1) {
                codeInputs[index + 1].focus();
            }
            
            if (value.length === 0 && index > 0) {
                codeInputs[index - 1].focus();
            }
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                codeInputs[index - 1].focus();
            }
        });
        
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasteData = e.clipboardData.getData('text').slice(0, 6);
            pasteData.split('').forEach((char, charIndex) => {
                if (codeInputs[charIndex]) {
                    codeInputs[charIndex].value = char;
                }
            });
            codeInputs[Math.min(pasteData.length - 1, 5)].focus();
        });
    });
}

function clearCodeInputs() {
    const codeInputs = document.querySelectorAll('.code-input');
    codeInputs.forEach(input => {
        input.value = '';
    });
    codeInputs[0].focus();
}

function getEntered2FACode() {
    const codeInputs = document.querySelectorAll('.code-input');
    return Array.from(codeInputs).map(input => input.value).join('');
}

async function verify2FACode() {
    const enteredCode = getEntered2FACode();
    const verifyBtn = document.getElementById('verifyCodeBtn');
    
    if (enteredCode.length !== 6) {
        showMessage('Please enter the complete 6-digit code', 'error');
        return;
    }
    
    try {
        verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
        verifyBtn.disabled = true;
        
        if (enteredCode === twoFACode) {
            // Code is correct - complete login
            await completeLogin();
        } else {
            showMessage('Invalid verification code. Please try again.', 'error');
            clearCodeInputs();
        }
    } catch (error) {
        console.error('2FA verification error:', error);
        showMessage('Verification failed. Please try again.', 'error');
    } finally {
        verifyBtn.innerHTML = 'Verify Code';
        verifyBtn.disabled = false;
    }
}

async function completeLogin() {
    try {
        // Register device if it's new
        if (loginAttemptData) {
            await registerDevice(loginAttemptData.user);
        }
        
        // Redirect based on user role
        await checkUserRoleAndRedirect(loginAttemptData.user);
        
    } catch (error) {
        console.error('Login completion error:', error);
        showMessage('Login completed but redirect failed.', 'error');
    }
}

async function registerDevice(user) {
    try {
        const deviceData = {
            userId: user.uid,
            deviceId: generateDeviceId(),
            userAgent: navigator.userAgent,
            lastLogin: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };
        
        await addDoc(collection(db, 'userDevices'), deviceData);
    } catch (error) {
        console.error('Device registration error:', error);
    }
}

function generateDeviceId() {
    // Simple device fingerprinting (in real app, use more sophisticated method)
    const components = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        new Date().getTimezoneOffset()
    ];
    
    return btoa(components.join('|')).slice(0, 32);
}

async function checkUserRoleAndRedirect(user) {
    try {
        // Check if user has admin role
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            if (userData.role === 'admin') {
                window.location.href = 'admin-dashboard.html';
            } else {
                window.location.href = 'member-dashboard.html';
            }
        } else {
            // Default to member dashboard if no role specified
            window.location.href = 'member-dashboard.html';
        }
    } catch (error) {
        console.error('Role check error:', error);
        // Default to member dashboard on error
        window.location.href = 'member-dashboard.html';
    }
}

async function approveNewDevice() {
    const approvalKey = document.getElementById('approvalKey').value;
    const approveBtn = document.getElementById('approveDeviceBtn');
    
    if (!approvalKey) {
        showMessage('Please enter your secret approval key', 'error');
        return;
    }
    
    try {
        approveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
        approveBtn.disabled = true;
        
        // In a real app, you would verify the key against stored hash
        // For demo, we'll use a simple check
        const isValidKey = await verifyApprovalKey(loginAttemptData.user.uid, approvalKey);
        
        if (isValidKey) {
            closeNewDeviceModal();
            await initiate2FA(loginAttemptData.user);
        } else {
            showMessage('Invalid approval key. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Device approval error:', error);
        showMessage('Approval failed. Please try again.', 'error');
    } finally {
        approveBtn.innerHTML = 'Approve Device';
        approveBtn.disabled = false;
    }
}

async function verifyApprovalKey(userId, key) {
    try {
        // In a real app, you would check against a hashed key in Firestore
        const userDoc = await getDoc(doc(db, 'users', userId));
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            // Demo: Check if key matches a simple pattern
            return key === userData.approvalKey || key === 'GGIC2024'; // Fallback for demo
        }
        
        return false;
    } catch (error) {
        console.error('Key verification error:', error);
        return false;
    }
}

function resend2FACode() {
    if (loginAttemptData && loginAttemptData.user) {
        initiate2FA(loginAttemptData.user);
        startResendTimer();
        showMessage('New verification code sent to your email.', 'success');
    }
}

function startResendTimer() {
    const resendCode = document.getElementById('resendCode');
    const timer = document.getElementById('resendTimer');
    const timerCount = document.getElementById('timerCount');
    
    resendCode.style.display = 'none';
    timer.style.display = 'block';
    
    let count = 60;
    const interval = setInterval(() => {
        timerCount.textContent = count;
        count--;
        
        if (count < 0) {
            clearInterval(interval);
            resendCode.style.display = 'block';
            timer.style.display = 'none';
        }
    }, 1000);
}

function handleLoginError(error) {
    let message = 'Login failed. Please try again.';
    
    switch (error.code) {
        case 'auth/invalid-email':
            message = 'Invalid email address format.';
            break;
        case 'auth/user-disabled':
            message = 'This account has been disabled.';
            break;
        case 'auth/user-not-found':
            message = 'No account found with this email.';
            break;
        case 'auth/wrong-password':
            message = 'Incorrect password. Please try again.';
            break;
        case 'auth/too-many-requests':
            message = 'Too many failed attempts. Please try again later.';
            break;
        case 'auth/network-request-failed':
            message = 'Network error. Please check your connection.';
            break;
    }
    
    showMessage(message, 'error');
}

async function handleForgotPassword(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    
    if (!email) {
        showMessage('Please enter your email address first.', 'error');
        return;
    }
    
    // In a real app, you would implement password reset
    showMessage('Password reset feature would be implemented here. Please contact support.', 'info');
}

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
