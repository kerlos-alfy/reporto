/**
 * @file config/database.js
 * @description MongoDB connection setup using Mongoose.
 *
 * Connects once at application startup and registers connection-lifecycle
 * event handlers. Registers SIGINT/SIGTERM handlers for graceful shutdown
 * so in-flight queries can complete before the process exits.
 *
 * Usage:
 *   const connectDB = require('./config/database');
 *   await connectDB();
 */

'use strict';

const mongoose = require('mongoose');

// ─── Connection ───────────────────────────────────────────────────────────────

/**
 * Establish the MongoDB connection.
 * Exits the process with code 1 if the initial connection fails —
 * the app cannot function without a database.
 *
 * @returns {Promise<mongoose.Connection>}
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Only build indexes automatically in non-production environments
      // to avoid performance impact on production startup.
      autoIndex: process.env.NODE_ENV !== 'production',
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`✓ MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);

    _registerConnectionEvents();

    return conn;
  } catch (err) {
    console.error(`✗ MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
};

// ─── Connection event listeners ───────────────────────────────────────────────

/** Attach Mongoose connection lifecycle listeners (called once after connect). */
function _registerConnectionEvents() {
  mongoose.connection.on('error', (err) => {
    console.error('✗ MongoDB connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠ MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('✓ MongoDB reconnected');
  });
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────

/**
 * Close the Mongoose connection cleanly and exit.
 * Called on SIGINT (Ctrl-C) and SIGTERM (container stop / PM2 reload).
 *
 * @param {string} signal  OS signal name for logging.
 */
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received — closing MongoDB connection...`);
  await mongoose.connection.close();
  console.log('✓ MongoDB connection closed');
  process.exit(0);
};

process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = connectDB;
