/**
 * Trash Can Manager - Utility functions for managing trash cans
 */

const fs = require('fs');
const path = require('path');

const TRASH_CANS_DB = path.join(__dirname, 'trash-cans.json');

/**
 * Load all trash cans from the JSON database
 * @returns {Array} Array of trash can objects
 */
function loadTrashCans() {
  try {
    const data = fs.readFileSync(TRASH_CANS_DB, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading trash cans database:', err);
    return [];
  }
}

/**
 * Save trash cans back to the JSON database
 * @param {Array} trashCans - Array of trash can objects
 */
function saveTrashCans(trashCans) {
  try {
    fs.writeFileSync(TRASH_CANS_DB, JSON.stringify(trashCans, null, 2), 'utf8');
    console.log('✅ Trash cans database updated');
  } catch (err) {
    console.error('Error writing trash cans database:', err);
    throw err;
  }
}

/**
 * Get a trash can by ID
 * @param {String} id - Trash can ID
 * @returns {Object|null} Trash can object or null if not found
 */
function getTrashCanById(id) {
  const cans = loadTrashCans();
  return cans.find(can => can.id === id) || null;
}

/**
 * Add a new trash can
 * @param {Object} canData - Trash can data
 * @returns {Object} The created trash can
 */
function addTrashCan(canData) {
  const cans = loadTrashCans();
  
  // Validate required fields
  if (!canData.id || !canData.label || !canData.location) {
    throw new Error('Missing required fields: id, label, location');
  }

  // Check for duplicates
  if (cans.some(can => can.id === canData.id)) {
    throw new Error(`Trash can with ID ${canData.id} already exists`);
  }

  // Create new trash can
  const newCan = {
    id: canData.id,
    label: canData.label,
    location: canData.location,
    image: canData.image || null,
    description: canData.description || null,
    createdAt: canData.createdAt || new Date().toISOString()
  };

  cans.push(newCan);
  saveTrashCans(cans);
  
  console.log(`✅ Added trash can: ${canData.id}`);
  return newCan;
}

/**
 * Update a trash can
 * @param {String} id - Trash can ID
 * @param {Object} updates - Fields to update
 * @returns {Object} The updated trash can
 */
function updateTrashCan(id, updates) {
  const cans = loadTrashCans();
  const index = cans.findIndex(can => can.id === id);
  
  if (index === -1) {
    throw new Error(`Trash can with ID ${id} not found`);
  }

  cans[index] = { ...cans[index], ...updates };
  saveTrashCans(cans);
  
  console.log(`✅ Updated trash can: ${id}`);
  return cans[index];
}

/**
 * Delete a trash can
 * @param {String} id - Trash can ID
 */
function deleteTrashCan(id) {
  const cans = loadTrashCans();
  const filtered = cans.filter(can => can.id !== id);
  
  if (filtered.length === cans.length) {
    throw new Error(`Trash can with ID ${id} not found`);
  }

  saveTrashCans(filtered);
  console.log(`✅ Deleted trash can: ${id}`);
}

/**
 * List all trash cans
 * @returns {Array} Array of all trash cans
 */
function listTrashCans() {
  return loadTrashCans();
}

/**
 * Search trash cans by location
 * @param {String} location - Location search term
 * @returns {Array} Matching trash cans
 */
function searchByLocation(location) {
  const cans = loadTrashCans();
  return cans.filter(can => 
    can.location.toLowerCase().includes(location.toLowerCase())
  );
}

module.exports = {
  loadTrashCans,
  saveTrashCans,
  getTrashCanById,
  addTrashCan,
  updateTrashCan,
  deleteTrashCan,
  listTrashCans,
  searchByLocation
};
