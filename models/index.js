/**
 * @file models/index.js
 * @description Barrel file — re-exports all Mongoose models from a single import point.
 *
 * Usage:
 *   const { DailyReport, Project } = require('../models');
 *
 * Importing via this barrel ensures each model is registered with Mongoose
 * exactly once, regardless of import order.
 */

'use strict';

module.exports = {
  AdminUser:   require('./AdminUser'),
  Engineer:    require('./Engineer'),
  Project:     require('./Project'),
  MasterData:  require('./MasterData'),
  Counter:     require('./Counter'),
  DailyReport: require('./DailyReport'),
  DailyAlert:  require('./DailyAlert'),
};
