/**
 * Migration: Copy all active elements from MasterData to every Project.
 *
 * Run once:
 *   node scripts/migrate-elements-to-projects.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MasterData = require('../models/MasterData');
const Project    = require('../models/Project');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // 1. Fetch all active elements from MasterData
  const masterElements = await MasterData.find({ category: 'element', isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  if (!masterElements.length) {
    console.log('⚠️  No elements found in MasterData — nothing to migrate.');
    process.exit(0);
  }

  console.log(`📋 Found ${masterElements.length} elements in MasterData:`);
  masterElements.forEach((e, i) => console.log(`   ${i + 1}. ${e.name}`));

  // 2. Fetch all projects
  const projects = await Project.find({}).lean();
  console.log(`\n🏗️  Found ${projects.length} projects`);

  // 3. For each project, add missing elements (skip duplicates)
  let updatedCount = 0;

  for (const proj of projects) {
    const existingNames = new Set(
      (proj.elements || []).map(e => e.name.trim().toLowerCase())
    );

    const toAdd = masterElements
      .filter(e => !existingNames.has(e.name.trim().toLowerCase()))
      .map((e, i) => ({
        name: e.name.trim(),
        sortOrder: (proj.elements?.length || 0) + i,
        isActive: true,
      }));

    if (!toAdd.length) {
      console.log(`   ⏭  ${proj.name} — already has all elements, skipped`);
      continue;
    }

    await Project.findByIdAndUpdate(proj._id, {
      $push: { elements: { $each: toAdd } },
    });

    console.log(`   ✅ ${proj.name} — added ${toAdd.length} elements`);
    updatedCount++;
  }

  console.log(`\n🎉 Done! Updated ${updatedCount}/${projects.length} projects.`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
