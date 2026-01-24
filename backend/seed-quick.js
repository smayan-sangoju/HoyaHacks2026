/**
 * Quick manual seed script - run this to add trash cans directly
 * Usage: node seed-quick.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const TrashCan = require('./models/TrashCan');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/clearcycle';

async function seed() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ Connected!');

    // Define trash cans
    const trashCans = [
      {
        id: 'TC001',
        label: 'Outside Trash Can',
        location: 'Smayans house',
        image: '/uploads/outside-trash-can.png',
        description: 'Main outdoor trash can'
      }
    ];

    // Seed each trash can
    for (const can of trashCans) {
      const existing = await TrashCan.findOne({ id: can.id });
      
      if (existing) {
        // Update existing
        Object.assign(existing, can);
        await existing.save();
        console.log(`✏️  Updated: ${can.id} - ${can.label}`);
      } else {
        // Create new
        await TrashCan.create(can);
        console.log(`✨ Created: ${can.id} - ${can.label}`);
      }
    }

    console.log('\n✅ Seeding complete!');
    console.log('\nYour trash can is ready:');
    console.log('  ID: TC001');
    console.log('  Label: Outside Trash Can');
    console.log('  Location: Smayans house');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

seed();
