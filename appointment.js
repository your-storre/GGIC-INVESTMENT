import { db, storage, collection, addDoc, ref, uploadBytes, getDownloadURL } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', function() {
    // Set minimum date for appointment to tomorrow
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];
    document.getElementById('appointmentDate').min = minDate;

    // Handle custom amount selection
    const investmentAmount = document.getElementById('investmentAmount');
    const customAmountGroup = document.getElementById('customAmountGroup');
    
    investmentAmount.addEventListener('change', function() {
        if (this.value === 'custom') {
            customAmountGroup.style.display = 'block';
        } else {
            customAmountGroup.style.display = 'none';
        }
    });

    // File upload handling
    const fileUploadArea = document.getElementById('fileUploadArea');
    const fileInput = document.getElementById('idFile');
    const fileName = document.getElementById('fileName');

    fileUploadArea.addEventListener('click', function() {
        fileInput.click();
    });

    fileInput.addEventListener('change', function() {
        if (this.files.length > 0) {
            const file = this.files[0];
            fileName.textContent = file.name;
            
            // Validate file size (5MB max)
            if (file.size > 5 * 1024 * 1024) {
                showMessage('File size must be less than 5MB', 'error');
                this.value = '';
                fileName.textContent = 'No file chosen';
                return;
            }
            
            // Validate file type
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
            if (!validTypes.includes(file.type)) {
                showMessage('Please upload JPG, PNG, or PDF files only', 'error');
                this.value = '';
                fileName.textContent = 'No file chosen';
                return;
            }
        }
    });

    // Form submission
    const appointmentForm = document.getElementById('appointmentForm');
    const submitBtn = document.getElementById('submitBtn');
    const loadingIndicator = document.getElementById('loadingIndicator');

    appointmentForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Validate form
        if (!validateForm()) {
            return;
        }

        // Show loading state
        submitBtn.style.display = 'none';
        loadingIndicator.style.display = 'block';

        try {
            // Get form data
            const formData = {
                fullName: document.getElementById('fullName').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                ghanaCard: document.getElementById('ghanaCard').value,
                investmentAmount: getInvestmentAmount(),
                investmentDuration: document.getElementById('investmentDuration').value,
                investmentReason: document.getElementById('investmentReason').value,
                appointmentDate: document.getElementById('appointmentDate').value,
                status: 'pending',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Upload ID file if exists
            const file = fileInput.files[0];
            if (file) {
                const fileUrl = await uploadFile(file);
                formData.idFileUrl = fileUrl;
            }

            // Save to Firestore
            await saveAppointmentToFirestore(formData);
            
            // Show success message
            showSuccessModal();
            
            // Reset form
            appointmentForm.reset();
            fileName.textContent = 'No file chosen';
            customAmountGroup.style.display = 'none';

        } catch (error) {
            console.error('Error submitting appointment:', error);
            showMessage('Error submitting appointment request. Please try again.', 'error');
        } finally {
            // Hide loading state
            submitBtn.style.display = 'block';
            loadingIndicator.style.display = 'none';
        }
    });
});

function validateForm() {
    const requiredFields = [
        'fullName', 'email', 'phone', 'ghanaCard', 
        'investmentAmount', 'investmentDuration', 
        'investmentReason', 'appointmentDate'
    ];

    for (const fieldId of requiredFields) {
        const field = document.getElementById(fieldId);
        if (!field.value.trim()) {
            showMessage(`Please fill in the ${field.labels[0].textContent}`, 'error');
            field.focus();
            return false;
        }
    }

    // Validate email format
    const email = document.getElementById('email').value;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showMessage('Please enter a valid email address', 'error');
        return false;
    }

    // Validate phone format (Ghanaian numbers)
    const phone = document.getElementById('phone').value;
    const phoneRegex = /^(?:\+233|0)[235]\d{8}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
        showMessage('Please enter a valid Ghanaian phone number', 'error');
        return false;
    }

    // Validate Ghana Card format (simplified)
    const ghanaCard = document.getElementById('ghanaCard').value;
    if (ghanaCard.length < 6) {
        showMessage('Please enter a valid Ghana Card number', 'error');
        return false;
    }

    // Check if file is uploaded
    const fileInput = document.getElementById('idFile');
    if (!fileInput.files.length) {
        showMessage('Please upload your Ghana Card or National ID', 'error');
        return false;
    }

    // Check terms agreement
    const termsAgreement = document.getElementById('termsAgreement');
    if (!termsAgreement.checked) {
        showMessage('Please agree to the Terms and Conditions', 'error');
        return false;
    }

    return true;
}

function getInvestmentAmount() {
    const amountSelect = document.getElementById('investmentAmount');
    if (amountSelect.value === 'custom') {
        return document.getElementById('customAmount').value || '0';
    }
    return amountSelect.value;
}

async function uploadFile(file) {
    try {
        // Create a unique filename
        const timestamp = new Date().getTime();
        const fileName = `id_verification/${timestamp}_${file.name}`;
        
        // Create storage reference
        const storageRef = ref(storage, fileName);
        
        // Upload file
        const snapshot = await uploadBytes(storageRef, file);
        
        // Get download URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        return downloadURL;
    } catch (error) {
        console.error('Error uploading file:', error);
        throw new Error('Failed to upload ID file');
    }
}

async function saveAppointmentToFirestore(appointmentData) {
    try {
        // Add to Firestore collection
        const docRef = await addDoc(collection(db, 'appointmentRequests'), appointmentData);
        console.log('Appointment saved with ID:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('Error saving appointment:', error);
        throw new Error('Failed to save appointment request');
    }
}

function showSuccessModal() {
    const modal = document.getElementById('successModal');
    modal.style.display = 'flex';
}

function closeSuccessModal() {
    const modal = document.getElementById('successModal');
    modal.style.display = 'none';
    window.location.href = 'index.html';
}

function showTermsModal() {
    alert('Terms and Conditions:\n\n1. Investment involves risk\n2. Past performance not indicative of future results\n3. All investments subject to approval\n4. GGIC follows strict regulatory guidelines\n\nFull terms available upon request.');
}

function showPrivacyModal() {
    alert('Privacy Policy:\n\n1. We protect your personal information\n2. Data used solely for investment purposes\n3. We comply with data protection laws\n4. Your information is never sold to third parties\n\nFull policy available upon request.');
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
        background: ${type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--error)' : 'var(--warning)'};
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
    
    .text-small {
        font-size: 0.875rem;
        color: var(--text-light);
    }
    
    .active {
        color: var(--accent-gold) !important;
    }
`;
document.head.appendChild(style);