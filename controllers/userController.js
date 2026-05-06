const logger = require('../utils/logger');
const AdminUser = require('../models/AdminUser');
const Engineer = require('../models/Engineer');
const Project = require('../models/Project');

// ─── helpers ──────────────────────────────────────────────────────────────────
async function _getEngineerAndProjects() {
  const [engineers, projects] = await Promise.all([
    Engineer.find({ isActive: true }).sort({ name: 1 }).lean(),
    Project.find({ isActive: true }).sort({ name: 1 }).lean(),
  ]);
  return { engineers, projects };
}

// ─── List Users ──────────────────────────────────────────────────────────────
exports.listUsers = async (req, res) => {
  try {
    const users = await AdminUser.find({})
      .populate('createdBy', 'name username')
      .sort({ createdAt: -1 })
      .lean();

    res.render('admin/users/index', {
      title: 'User Management',
      users,
      currentUser: req.session.adminUser,
    });
  } catch (err) {
    logger.error('listUsers error:', err);
    req.flash('error', 'Failed to load users.');
    res.redirect('/admin/dashboard');
  }
};

// ─── Show Create Form ────────────────────────────────────────────────────────
exports.showCreateForm = async (req, res) => {
  try {
    const { engineers, projects } = await _getEngineerAndProjects();
    res.render('admin/users/create', {
      title: 'Add New User',
      formData: {},
      engineers,
      projects,
      currentUser: req.session.adminUser,
    });
  } catch (err) {
    logger.error('showCreateForm error:', err);
    res.redirect('/admin/users');
  }
};

// ─── Create User ─────────────────────────────────────────────────────────────
exports.createUser = async (req, res) => {
  try {
    const { name, username, email, password, role, permissions, linkedEngineer, allowedProjects } = req.body;

    const { engineers, projects } = await _getEngineerAndProjects();

    // Validate
    if (!name || !username || !password || !role) {
      req.flash('error', 'Name, username, password and role are required.');
      return res.render('admin/users/create', {
        title: 'Add New User',
        formData: req.body,
        engineers,
        projects,
        currentUser: req.session.adminUser,
      });
    }

    // Check duplicate
    const exists = await AdminUser.findOne({ username: username.toLowerCase().trim() });
    if (exists) {
      req.flash('error', `Username "${username}" is already taken.`);
      return res.render('admin/users/create', {
        title: 'Add New User',
        formData: req.body,
        engineers,
        projects,
        currentUser: req.session.adminUser,
      });
    }

    // Password strength
    if (password.length < 8) {
      req.flash('error', 'Password must be at least 8 characters.');
      return res.render('admin/users/create', {
        title: 'Add New User',
        formData: req.body,
        engineers,
        projects,
        currentUser: req.session.adminUser,
      });
    }

    const passwordHash = await AdminUser.hashPassword(password);
    const perms = _parsePermissions(permissions);

    // Parse allowedProjects (checkbox array or single value)
    const allowedProjectIds = _parseAllowedProjects(allowedProjects);

    await AdminUser.create({
      name:            name.trim(),
      username:        username.toLowerCase().trim(),
      email:           email?.toLowerCase().trim() || '',
      passwordHash,
      role,
      permissions:     perms,
      linkedEngineer:  linkedEngineer || null,
      allowedProjects: allowedProjectIds,
      isActive:        true,
      createdBy:       req.session.adminUser.id,
    });

    req.flash('success', `User "${username}" created successfully.`);
    res.redirect('/admin/users');
  } catch (err) {
    logger.error('createUser error:', err);
    req.flash('error', 'Failed to create user.');
    res.redirect('/admin/users/new');
  }
};

// ─── Show Edit Form ──────────────────────────────────────────────────────────
exports.showEditForm = async (req, res) => {
  try {
    const [user, { engineers, projects }] = await Promise.all([
      AdminUser.findById(req.params.id).lean(),
      _getEngineerAndProjects(),
    ]);
    if (!user) {
      req.flash('error', 'User not found.');
      return res.redirect('/admin/users');
    }

    // Prevent editing another superadmin (except self)
    if (user.role === 'superadmin' && user._id.toString() !== req.session.adminUser.id) {
      req.flash('error', 'Cannot edit another Super Admin.');
      return res.redirect('/admin/users');
    }

    res.render('admin/users/edit', {
      title: `Edit User — ${user.name}`,
      editUser: user,
      engineers,
      projects,
      currentUser: req.session.adminUser,
    });
  } catch (err) {
    logger.error('showEditForm error:', err);
    res.redirect('/admin/users');
  }
};

// ─── Update User ─────────────────────────────────────────────────────────────
exports.updateUser = async (req, res) => {
  try {
    const user = await AdminUser.findById(req.params.id);
    if (!user) {
      req.flash('error', 'User not found.');
      return res.redirect('/admin/users');
    }

    // Prevent downgrading another superadmin
    if (user.role === 'superadmin' && user._id.toString() !== req.session.adminUser.id) {
      req.flash('error', 'Cannot edit another Super Admin.');
      return res.redirect('/admin/users');
    }

    const { name, email, role, password, permissions, linkedEngineer, allowedProjects } = req.body;

    user.name  = name?.trim() || user.name;
    user.email = email?.toLowerCase().trim() || user.email;

    // Don't let superadmin change their own role
    if (user._id.toString() !== req.session.adminUser.id) {
      user.role = role || user.role;
    }

    // Update permissions
    user.permissions = _parsePermissions(permissions);

    // Update engineer link + project restrictions
    user.linkedEngineer  = linkedEngineer || null;
    user.allowedProjects = _parseAllowedProjects(allowedProjects);

    // Change password if provided
    if (password && password.trim().length >= 8) {
      user.passwordHash = await AdminUser.hashPassword(password.trim());
    }

    await user.save();

    req.flash('success', `User "${user.username}" updated successfully.`);
    res.redirect('/admin/users');
  } catch (err) {
    logger.error('updateUser error:', err);
    req.flash('error', 'Failed to update user.');
    res.redirect('/admin/users');
  }
};

// ─── Toggle Active ────────────────────────────────────────────────────────────
exports.toggleActive = async (req, res) => {
  try {
    const user = await AdminUser.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Can't deactivate yourself
    if (user._id.toString() === req.session.adminUser.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account.' });
    }

    // Can't deactivate another superadmin
    if (user.role === 'superadmin') {
      return res.status(403).json({ error: 'Cannot deactivate a Super Admin.' });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({ success: true, isActive: user.isActive });
  } catch (err) {
    logger.error('toggleActive error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ─── Delete User ──────────────────────────────────────────────────────────────
exports.deleteUser = async (req, res) => {
  try {
    const user = await AdminUser.findById(req.params.id);
    if (!user) {
      req.flash('error', 'User not found.');
      return res.redirect('/admin/users');
    }

    if (user._id.toString() === req.session.adminUser.id) {
      req.flash('error', 'You cannot delete your own account.');
      return res.redirect('/admin/users');
    }

    if (user.role === 'superadmin') {
      req.flash('error', 'Cannot delete a Super Admin.');
      return res.redirect('/admin/users');
    }

    await user.deleteOne();
    req.flash('success', `User "${user.username}" deleted.`);
    res.redirect('/admin/users');
  } catch (err) {
    logger.error('deleteUser error:', err);
    req.flash('error', 'Failed to delete user.');
    res.redirect('/admin/users');
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function _parsePermissions(permsBody = {}) {
  const allPerms = ['canViewDashboard', 'canViewReports', 'canViewReportsList', 'canEditReports', 'canSubmitReports', 'canManageMasters', 'canManageUsers', 'canExportData', 'canViewAlerts', 'canViewManpowerSummary'];
  const result = {};
  for (const p of allPerms) {
    result[p] = permsBody[p] === 'on' || permsBody[p] === true || permsBody[p] === '1';
  }
  return result;
}

function _parseAllowedProjects(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value].filter(Boolean);
}
