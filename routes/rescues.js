const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /api/rescues/fosters — list foster volunteers for rescue portal
router.get('/fosters', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, first_name, last_name, city, zip, available_date, duration,
              sizes, breeds, other_pets, kids, space_info, contact_pref,
              specific_dog, notes, email, phone
       FROM foster_applications
       ORDER BY created_at DESC`
    );
    res.json({ fosters: result.rows });
  } catch (err) {
    console.error('❌ Error fetching fosters:', err.message);
    res.status(500).json({ error: 'Failed to fetch fosters' });
  }
});

// POST /api/rescues/commit — rescue commits to pulling a dog
router.post('/commit', async (req, res) => {
  try {
    const { dog_id, shelter_id, dog_name, org, contact, email, foster_status, notes } = req.body;

    if (!org || !contact || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create table if needed
    await db.query(`
      CREATE TABLE IF NOT EXISTS rescue_commits (
        id SERIAL PRIMARY KEY,
        dog_id INTEGER, shelter_id VARCHAR(50), dog_name VARCHAR(255),
        org VARCHAR(255), contact VARCHAR(255), email VARCHAR(255),
        foster_status VARCHAR(100), notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.query(
      `INSERT INTO rescue_commits (dog_id, shelter_id, dog_name, org, contact, email, foster_status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [dog_id, shelter_id, dog_name, org, contact, email, foster_status, notes]
    );

    console.log(`🐾 Rescue commit: ${org} committed to ${dog_name || shelter_id}`);

    // Send emails if SendGrid configured
    if (process.env.SENDGRID_API_KEY) {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      const fromEmail = process.env.FROM_EMAIL || 'hello@ladogdispatch.org';
      const teamEmail = process.env.TEAM_EMAIL || fromEmail;

      // Notify team
      await sgMail.send({
        to: teamEmail,
        from: fromEmail,
        subject: `🐾 Rescue Commit — ${dog_name || shelter_id} — ${org}`,
        html: `
          <div style="font-family: Georgia, serif; max-width: 560px; color: #3a3632;">
            <h2 style="color: #1a1614;">Rescue Commitment Received</h2>
            <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
              <tr><td style="padding:5px 0;color:#6b6560;width:130px;">Dog</td><td><strong>${dog_name || shelter_id}</strong></td></tr>
              <tr><td style="padding:5px 0;color:#6b6560;">Rescue Org</td><td><strong>${org}</strong></td></tr>
              <tr><td style="padding:5px 0;color:#6b6560;">Contact</td><td>${contact}</td></tr>
              <tr><td style="padding:5px 0;color:#6b6560;">Email</td><td><a href="mailto:${email}">${email}</a></td></tr>
              <tr><td style="padding:5px 0;color:#6b6560;">Foster Status</td><td>${foster_status || '—'}</td></tr>
              ${notes ? `<tr><td style="padding:5px 0;color:#6b6560;vertical-align:top;">Notes</td><td>${notes}</td></tr>` : ''}
            </table>
          </div>`
      });

      // Confirm to rescue
      await sgMail.send({
        to: email,
        from: fromEmail,
        subject: `✅ Commitment Confirmed — ${dog_name || shelter_id}`,
        html: `
          <div style="font-family: Georgia, serif; max-width: 560px; color: #3a3632;">
            <h2 style="color: #1a1614;">Hi ${contact},</h2>
            <p style="line-height:1.7;margin-bottom:1rem;">We've recorded your commitment to pull <strong>${dog_name || shelter_id}</strong>. The LA Dog Dispatch team will follow up shortly to coordinate next steps, including any donor funds held for this dog.</p>
            <p style="line-height:1.7;color:#6b6560;font-size:0.9rem;">Questions? Reply to this email.<br><br>— The LA Dog Dispatch Team</p>
          </div>`
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Rescue commit error:', err.message);
    res.status(500).json({ error: 'Failed to record commitment' });
  }
});

module.exports = router;
