const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

exports.sendPasswordResetEmail = async (email, resetUrl) => {
  const mailOptions = {
    from: `"Trainwise" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Réinitialisation de votre mot de passe - Trainwise',
    html: `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Réinitialisation du mot de passe</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #051923; margin: 0; padding: 0; }
          .container { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 80px rgba(0,0,0,0.4); }
          .header { background: #051923; padding: 32px; text-align: center; }
          .header h1 { color: #00a6fb; font-size: 28px; margin: 0; letter-spacing: 1px; }
          .body { padding: 40px 32px; }
          .body p { color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
          .btn { display: block; width: fit-content; margin: 28px auto; padding: 14px 32px; background: #00a6fb; color: #ffffff; text-decoration: none; border-radius: 10px; font-size: 15px; font-weight: 600; }
          .footer { background: #f9fafb; padding: 20px 32px; text-align: center; }
          .footer p { color: #9ca3af; font-size: 12px; margin: 0; }
          .warning { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 12px 16px; margin-top: 20px; }
          .warning p { color: #92400e; font-size: 13px; margin: 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Trainwise</h1>
          </div>
          <div class="body">
            <p>Bonjour,</p>
            <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
            <a href="${resetUrl}" class="btn">Réinitialiser mon mot de passe</a>
            <div class="warning">
              <p>⚠️ Ce lien est valable pendant <strong>30 minutes</strong>. Si vous n'avez pas demandé de réinitialisation, ignorez cet email — votre compte est en sécurité.</p>
            </div>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Trainwise. Tous droits réservés.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  await transporter.sendMail(mailOptions);
};
