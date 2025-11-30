const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// Initialize Firebase Admin
admin.initializeApp();

// Configure email transporter (using Gmail as example)
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: functions.config().gmail?.user,
    pass: functions.config().gmail?.password
  }
});

/**
 * Daily Profit Automation
 * Runs every day at 6:00 AM GMT
 */
exports.dailyProfitAutomation = functions.pubsub
  .schedule('0 6 * * *')
  .timeZone('GMT')
  .onRun(async (context) => {
    try {
      const db = admin.firestore();
      const now = new Date();
      
      // Get all active investments
      const investmentsSnapshot = await db.collection('investments')
        .where('status', '==', 'active')
        .get();

      if (investmentsSnapshot.empty) {
        console.log('No active investments found');
        return null;
      }

      const batch = db.batch();
      let processedCount = 0;

      // Process each investment
      for (const investmentDoc of investmentsSnapshot.docs) {
        const investment = investmentDoc.data();
        const userId = investment.userId;
        
        // Calculate daily profit
        const dailyProfit = investment.amount * (investment.dailyRate / 100);
        
        // Update investment balance
        const newBalance = (investment.currentBalance || investment.amount) + dailyProfit;
        
        // Create profit transaction
        const transactionRef = db.collection('transactions').doc();
        batch.set(transactionRef, {
          userId: userId,
          type: 'profit',
          amount: dailyProfit,
          description: 'Daily investment return',
          status: 'completed',
          createdAt: now,
          investmentId: investmentDoc.id
        });

        // Update investment document
        const investmentRef = db.collection('investments').doc(investmentDoc.id);
        batch.update(investmentRef, {
          currentBalance: newBalance,
          lastProfitDate: now,
          updatedAt: now
        });

        // Update user's total balance
        const userRef = db.collection('users').doc(userId);
        batch.update(userRef, {
          currentBalance: admin.firestore.FieldValue.increment(dailyProfit),
          updatedAt: now
        });

        processedCount++;
        
        // Commit batch every 500 operations to avoid limits
        if (processedCount % 500 === 0) {
          await batch.commit();
          console.log(`Processed ${processedCount} investments`);
        }
      }

      // Commit remaining operations
      if (processedCount % 500 !== 0) {
        await batch.commit();
      }

      console.log(`Successfully processed daily profits for ${processedCount} investments`);
      return null;

    } catch (error) {
      console.error('Error in dailyProfitAutomation:', error);
      return null;
    }
  });

/**
 * Maturity Checker
 * Runs every day at 8:00 AM GMT
 */
exports.maturityChecker = functions.pubsub
  .schedule('0 8 * * *')
  .timeZone('GMT')
  .onRun(async (context) => {
    try {
      const db = admin.firestore();
      const now = new Date();
      
      // Find investments that matured today
      const maturedInvestmentsSnapshot = await db.collection('investments')
        .where('maturityDate', '<=', now)
        .where('status', '==', 'active')
        .get();

      if (maturedInvestmentsSnapshot.empty) {
        console.log('No matured investments found');
        return null;
      }

      const batch = db.batch();

      // Mark investments as ready for payout
      maturedInvestmentsSnapshot.docs.forEach(doc => {
        const investmentRef = db.collection('investments').doc(doc.id);
        batch.update(investmentRef, {
          status: 'ready_for_payout',
          updatedAt: now
        });

        // Create maturity notification
        const notificationRef = db.collection('notifications').doc();
        batch.set(notificationRef, {
          userId: doc.data().userId,
          type: 'maturity',
          title: 'Investment Matured',
          message: `Your investment of ₵${doc.data().amount.toLocaleString()} has matured and is ready for payout.`,
          read: false,
          createdAt: now
        });
      });

      await batch.commit();
      console.log(`Marked ${maturedInvestmentsSnapshot.size} investments as ready for payout`);
      return null;

    } catch (error) {
      console.error('Error in maturityChecker:', error);
      return null;
    }
  });

/**
 * Send Welcome Email to New Members
 */
exports.sendWelcomeEmail = functions.firestore
  .document('users/{userId}')
  .onCreate(async (snapshot, context) => {
    try {
      const userData = snapshot.data();
      
      if (userData.role === 'member' && userData.email) {
        const mailOptions = {
          from: functions.config().gmail?.user,
          to: userData.email,
          subject: 'Welcome to Ghana Growth Investment Co',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1e3a8a;">Welcome to GGIC!</h2>
              <p>Dear ${userData.fullName},</p>
              <p>Welcome to Ghana Growth Investment Co! Your account has been successfully created.</p>
              <p>You can now access your investment dashboard to track your portfolio performance.</p>
              <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #1e3a8a;">Account Details:</h3>
                <p><strong>Email:</strong> ${userData.email}</p>
                <p><strong>Investment Amount:</strong> ₵${userData.investmentAmount?.toLocaleString() || '0'}</p>
                <p><strong>Investment Duration:</strong> ${userData.duration || '0'} months</p>
              </div>
              <p>If you have any questions, please contact our support team.</p>
              <p>Best regards,<br>The GGIC Team</p>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
        console.log('Welcome email sent to:', userData.email);
      }

      return null;
    } catch (error) {
      console.error('Error sending welcome email:', error);
      return null;
    }
  });

/**
 * Send Appointment Confirmation Email
 */
exports.sendAppointmentConfirmation = functions.firestore
  .document('appointmentRequests/{appointmentId}')
  .onUpdate(async (change, context) => {
    try {
      const beforeData = change.before.data();
      const afterData = change.after.data();

      // Check if appointment was just approved
      if (beforeData.status !== 'approved' && afterData.status === 'approved') {
        const mailOptions = {
          from: functions.config().gmail?.user,
          to: afterData.email,
          subject: 'GGIC Investment Consultation Confirmed',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1e3a8a;">Appointment Confirmed!</h2>
              <p>Dear ${afterData.fullName},</p>
              <p>Your investment consultation request has been approved.</p>
              <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #1e3a8a;">Appointment Details:</h3>
                <p><strong>Date:</strong> ${new Date(afterData.appointmentDate).toLocaleDateString()}</p>
                <p><strong>Investment Amount:</strong> ₵${afterData.investmentAmount?.toLocaleString() || '0'}</p>
                <p><strong>Duration:</strong> ${afterData.investmentDuration || '0'} months</p>
              </div>
              <p>Our investment advisor will contact you at ${afterData.phone} to confirm the exact time.</p>
              <p>Best regards,<br>The GGIC Team</p>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
        console.log('Appointment confirmation sent to:', afterData.email);
      }

      return null;
    } catch (error) {
      console.error('Error sending appointment confirmation:', error);
      return null;
    }
  });

/**
 * Send 2FA Code via Email
 */
exports.send2FACode = functions.https.onCall(async (data, context) => {
  try {
    const { email, code } = data;

    if (!email || !code) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Email and code are required'
      );
    }

    const mailOptions = {
      from: functions.config().gmail?.user,
      to: email,
      subject: 'GGIC - Two-Factor Authentication Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e3a8a;">Security Verification</h2>
          <p>Your GGIC account verification code is:</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e3a8a;">
              ${code}
            </div>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p style="color: #6b7280; font-size: 14px;">
            If you didn't request this code, please ignore this email or contact support.
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('2FA code sent to:', email);

    return { success: true };
  } catch (error) {
    console.error('Error sending 2FA code:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send 2FA code');
  }
});

/**
 * Detect New Login Locations
 */
exports.detectNewLoginLocation = functions.auth.user().onLogin(async (user) => {
  try {
    const db = admin.firestore();
    
    // Get user's previous login locations
    const devicesSnapshot = await db.collection('userDevices')
      .where('userId', '==', user.uid)
      .get();

    // In a real implementation, you would check IP geolocation
    // For demo, we'll use a simple check based on user agent
    const currentDeviceId = generateDeviceId(user);
    const isKnownDevice = !devicesSnapshot.empty && 
      devicesSnapshot.docs.some(doc => doc.data().deviceId === currentDeviceId);

    if (!isKnownDevice) {
      // Send security notification
      const notificationRef = db.collection('notifications').doc();
      await notificationRef.set({
        userId: user.uid,
        type: 'security',
        title: 'New Login Detected',
        message: 'We detected a login from a new device or location. If this was not you, please contact support immediately.',
        read: false,
        createdAt: new Date()
      });

      console.log('Security notification sent for new login:', user.email);
    }

    return null;
  } catch (error) {
    console.error('Error in detectNewLoginLocation:', error);
    return null;
  }
});

/**
 * Generate device ID based on user agent and other factors
 */
function generateDeviceId(user) {
  // Simple device fingerprinting (in real app, use more sophisticated method)
  const components = [
    user.metadata.creationTime,
    user.providerData[0]?.providerId
  ];
  
  return Buffer.from(components.join('|')).toString('base64').slice(0, 32);
}

/**
 * Backup Firestore Data (Weekly)
 */
exports.backupFirestoreData = functions.pubsub
  .schedule('0 2 * * 0') // Every Sunday at 2:00 AM
  .timeZone('GMT')
  .onRun(async (context) => {
    try {
      const client = new admin.firestore.v1.FirestoreAdminClient();
      const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
      const databaseName = client.databasePath(projectId, '(default)');
      const bucket = `gs://${projectId}-firestore-backups`;

      const responses = await client.exportDocuments({
        name: databaseName,
        outputUriPrefix: bucket,
        collectionIds: [] // Export all collections
      });

      const response = responses[0];
      console.log(`Firestore backup operation: ${response.name}`);
      return null;

    } catch (error) {
      console.error('Error in backupFirestoreData:', error);
      return null;
    }
  });
