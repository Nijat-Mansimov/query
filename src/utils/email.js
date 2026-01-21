// src/utils/email.js
const nodemailer = require("nodemailer");

// Create transporter
let transporter = null;

// Only initialize if email credentials are provided
if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  // Verify connection
  transporter.verify((error, success) => {
    if (error) {
      console.warn("⚠ Email service not available:", error.message);
      console.warn("⚠ Email features will be disabled");
      transporter = null;
    } else {
      console.log("✓ Email server ready");
    }
  });
} else {
  console.warn("⚠ Email credentials not configured - email features disabled");
}

// Helper function to check if email is enabled
const isEmailEnabled = () => {
  return transporter !== null;
};

// Send verification email
exports.sendVerificationEmail = async (email, token) => {
  if (!isEmailEnabled()) {
    console.warn("⚠ Email disabled - verification email not sent to:", email);
    return;
  }

  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${token}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Verify Your Email - Security Rules Platform",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Welcome to Security Rules Platform!</h2>
        <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #2563eb; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Verify Email
          </a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #666; word-break: break-all;">${verificationUrl}</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          This link will expire in 24 hours. If you didn't create an account, please ignore this email.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Verification email sent to:", email);
  } catch (error) {
    console.error("Failed to send verification email:", error.message);
    // Don't throw error - email is not critical
  }
};

// Send password reset email
exports.sendPasswordResetEmail = async (email, token) => {
  if (!isEmailEnabled()) {
    console.warn("⚠ Email disabled - password reset email not sent to:", email);
    return;
  }

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Password Reset Request - Security Rules Platform",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Password Reset Request</h2>
        <p>We received a request to reset your password. Click the button below to set a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #dc2626; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #666; word-break: break-all;">${resetUrl}</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Password reset email sent to:", email);
  } catch (error) {
    console.error("Failed to send password reset email:", error.message);
  }
};

// Send rule approval notification
exports.sendRuleApprovedEmail = async (email, username, ruleTitle) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Your Rule Has Been Approved! - Security Rules Platform",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">🎉 Rule Approved!</h2>
        <p>Hi ${username},</p>
        <p>Great news! Your rule "<strong>${ruleTitle}</strong>" has been approved and is now live on the platform.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/rules" 
             style="background-color: #16a34a; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            View Your Rules
          </a>
        </div>
        <p>Thank you for contributing to the security community!</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Failed to send approval email:", error);
  }
};

// Send rule rejection notification
exports.sendRuleRejectedEmail = async (email, username, ruleTitle, reason) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Rule Review Update - Security Rules Platform",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Rule Review Update</h2>
        <p>Hi ${username},</p>
        <p>Your rule "<strong>${ruleTitle}</strong>" requires some updates before it can be published.</p>
        <div style="background-color: #fee; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
          <strong>Reviewer Notes:</strong>
          <p style="margin: 10px 0 0 0;">${reason}</p>
        </div>
        <p>Please review the feedback and make the necessary changes. You can edit your rule and resubmit it for review.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/rules/edit" 
             style="background-color: #2563eb; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Edit Rule
          </a>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Failed to send rejection email:", error);
  }
};

// Send purchase confirmation
exports.sendPurchaseConfirmationEmail = async (
  email,
  username,
  ruleTitle,
  amount,
) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Purchase Confirmation - Security Rules Platform",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Purchase Successful!</h2>
        <p>Hi ${username},</p>
        <p>Thank you for your purchase! You now have full access to:</p>
        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0;">${ruleTitle}</h3>
          <p style="margin: 0; color: #666;">Amount: $${amount}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/my-purchases" 
             style="background-color: #2563eb; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            View Purchase
          </a>
        </div>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          Receipt and download links are available in your account dashboard.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Failed to send purchase confirmation:", error);
  }
};
