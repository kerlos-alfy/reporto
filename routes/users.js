/**
 * @file routes/users.js
 * @description Admin user management routes.
 *
 * Mounted at /admin/users in app.js.
 * All routes require authentication and the `canManageUsers` permission.
 *
 * Route summary:
 *   GET    /admin/users              — List all users
 *   GET    /admin/users/create       — Show create-user form
 *   POST   /admin/users              — Create a new user
 *   GET    /admin/users/:id/edit     — Show edit-user form
 *   PUT    /admin/users/:id          — Update a user
 *   PATCH  /admin/users/:id/toggle   — Toggle active/inactive
 *   DELETE /admin/users/:id          — Delete a user
 */

'use strict';

const express        = require('express');
const router         = express.Router();
const { requireAuth, requirePermission } = require('../middlewares/auth');
const userController = require('../controllers/userController');

// Apply auth + permission guard to every route in this file
router.use(requireAuth, requirePermission('canManageUsers'));

router.get('/',               userController.listUsers);
router.get('/create',         userController.showCreateForm);
router.post('/',              userController.createUser);
router.get('/:id/edit',       userController.showEditForm);
router.put('/:id',            userController.updateUser);
router.patch('/:id/toggle',   userController.toggleActive);
router.delete('/:id',         userController.deleteUser);

module.exports = router;
