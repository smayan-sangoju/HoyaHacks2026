/**
 * Seed script to load trash cans from trash-cans.json into MongoDB
 * Run with: node trash-cans/seedTrashCans.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/clearcycle';

async function seedTrashCans() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const TrashCan = require('../models/TrashCan');
    
    // Read trash cans from JSON file
    const jsonPath = path.join(__dirname, 'trash-cans.json');
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const trashCans = JSON.parse(rawData);

    console.log(`Found ${trashCans.length} trash cans to seed...`);

    for (const can of trashCans) {
      try {
        // Check if already exists
        const existing = await TrashCan.findOne({ id: can.id });
        if (existing) {
          console.log(`⚠️  Trash can ${can.id} already exists, skipping...`);
          continue;
        }

        // Create new trash can
        const newCan = await TrashCan.create(can);
        console.log(`✅ Created trash can: ${can.id} - ${can.label} at ${can.location}`);
      } catch (err) {
        console.error(`❌ Error creating trash can ${can.id}:`, err.message);
      }
    }

    console.log('Seeding complete!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seedTrashCans();
