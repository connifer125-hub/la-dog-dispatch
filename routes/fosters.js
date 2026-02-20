const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /api/fosters — list for rescue portal
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, first_name, last_name, city, zip, available_date, duration,
              sizes, breeds, other_pets, kids, space_info, contact_pref,
              specific_dog, email, phone
       FROM foster_applications ORDER BY created_at DESC`
    );
    res.json({ fosters: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch fosters' });
  }
});

// POST /api/fosters — submit a foster application
router.post('/', async (req, res) => {
  try {
    const {
      first_name, last_name, email, phone,
      city, zip,
      available_date, duration, specific_dog, notes,
      sizes, breeds, other_pets, space, kids
    } = req.body;

    // Basic validation
    if (!first_name || !last_name || !email || !phone || !available_date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Save to database
    await db.query(
      `CREATE TABLE IF NOT EXISTS foster_applications (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(100), last_name VARCHAR(100),
        email VARCHAR(255), phone VARCHAR(50),
        city VARCHAR(100), zip VARCHAR(20),
        space_info TEXT, kids_info TEXT,
        available_date DATE, duration VARCHAR(50),
        specific_dog VARCHAR(200), notes TEXT,
        sizes TEXT, breeds TEXT, other_pets TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )`
    );

    await db.query(
      `INSERT INTO foster_applications (
        first_name, last_name, email, phone,
        city, zip,
        available_date, duration, specific_dog, notes,
        sizes, breeds, other_pets
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        first_name, last_name, email, phone,
        city, zip,
        available_date || null, duration, specific_dog, notes,
        (sizes || []).join(', '),
        (breeds || []).join(', '),
        (other_pets || []).join(', ')
      ]
    );

    console.log(`🏠 New foster application: ${first_name} ${last_name} <${email}>`);

    // Send emails if SENDGRID_API_KEY is configured
    if (process.env.SENDGRID_API_KEY) {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      const fromEmail = process.env.FROM_EMAIL || 'hello@ladogdispatch.org';
      const teamEmail = process.env.TEAM_EMAIL || fromEmail;

      // 1. Confirmation to applicant
      await sgMail.send({
        to: email,
        from: fromEmail,
        subject: '🐾 Foster Application Received — LA Dog Dispatch',
        html: `
          <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #3a3632;">
            <h2 style="color: #1a1614; font-size: 1.4rem; margin-bottom: 0.5rem;">Hi ${first_name},</h2>
            <p style="margin-bottom: 1rem; line-height: 1.7;">Thank you for applying to foster with LA Dog Dispatch. We received your application and will be in touch within 48 hours to discuss next steps.</p>
            ${specific_dog ? `<p style="margin-bottom: 1rem; line-height: 1.7;"><strong>You mentioned:</strong> ${specific_dog} — we'll prioritize matching you with this dog if still available.</p>` : ''}
            <p style="margin-bottom: 1rem; line-height: 1.7;">In the meantime, you can see all the dogs currently on the urgent list at <a href="https://la-dog-dispatch-production.up.railway.app" style="color: #c4281c;">LA Dog Dispatch</a>.</p>
            <p style="line-height: 1.7; color: #6b6560; font-size: 0.9rem;">Questions? Reply to this email and we'll get back to you.<br><br>— The LA Dog Dispatch Team</p>
          </div>
        `
      });

      // 2. Notification to team
      await sgMail.send({
        to: teamEmail,
        from: fromEmail,
        subject: `🏠 New Foster Application — ${first_name} ${last_name}`,
        html: `
          <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #3a3632;">
            <h2 style="color: #1a1614;">New Foster Application</h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
              <tr><td style="padding: 6px 0; color: #6b6560; width: 140px;">Name</td><td><strong>${first_name} ${last_name}</strong></td></tr>
              <tr><td style="padding: 6px 0; color: #6b6560;">Email</td><td><a href="mailto:${email}">${email}</a></td></tr>
              <tr><td style="padding: 6px 0; color: #6b6560;">Phone</td><td>${phone}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b6560;">Location</td><td>${city || '—'} ${zip || ''}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b6560;">Space</td><td>${(space || []).join(', ') || '—'}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b6560;">Kids</td><td>${(kids || []).join(', ') || '—'}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b6560;">Dog Sizes</td><td>${(sizes || []).join(', ') || '—'}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b6560;">Breeds</td><td>${(breeds || []).join(', ') || '—'}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b6560;">Other Pets</td><td>${(other_pets || []).join(', ') || '—'}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b6560;">Available</td><td>${available_date || '—'}</td></tr>
              <tr><td style="padding: 6px 0; color: #6b6560;">Duration</td><td>${duration || '—'}</td></tr>
              ${specific_dog ? `<tr><td style="padding: 6px 0; color: #c4281c; font-weight: bold;">Specific Dog</td><td><strong>${specific_dog}</strong></td></tr>` : ''}
              ${notes ? `<tr><td style="padding: 6px 0; color: #6b6560; vertical-align: top;">Notes</td><td>${notes}</td></tr>` : ''}
            </table>
          </div>
        `
      });

      console.log(`📧 Emails sent for foster application: ${email}`);
    } else {
      console.log('⚠️  SENDGRID_API_KEY not set — emails skipped');
    }

    res.json({ success: true, message: 'Application received' });

  } catch (err) {
    console.error('❌ Foster application error:', err.message);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

module.exports = router;
