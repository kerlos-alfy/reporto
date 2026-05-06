const masterDataService = require('../services/masterDataService');
const MasterData = require('../models/MasterData');
const Engineer = require('../models/Engineer');
const Project = require('../models/Project');

exports.showMasterData = async (req, res, next) => {
  try {
    const [engineers, projects, elements, activities, laborSourceTypes, supplierCompanies, subcontractorCompanies] = await Promise.all([
      Engineer.find().sort({ name: 1 }).lean(),
      Project.find().sort({ name: 1 }).lean(),
      MasterData.find({ category: 'element' }).sort({ sortOrder: 1, name: 1 }).lean(),
      MasterData.find({ category: 'activity' }).sort({ sortOrder: 1, name: 1 }).lean(),
      MasterData.find({ category: 'laborSourceType' }).sort({ sortOrder: 1, name: 1 }).lean(),
      MasterData.find({ category: 'supplierCompany' }).sort({ sortOrder: 1, name: 1 }).lean(),
      MasterData.find({ category: 'subcontractorCompany' }).sort({ sortOrder: 1, name: 1 }).lean(),
    ]);

    res.render('master-data/index', {
      title: 'Master Data Management',
      engineers,
      projects,
      elements,
      activities,
      laborSourceTypes,
      supplierCompanies,
      subcontractorCompanies,
    });
  } catch (err) {
    next(err);
  }
};

// --- Engineers ---
exports.addEngineer = async (req, res) => {
  try {
    const engineer = await masterDataService.addEngineer(req.body);

    return res.status(201).json({
      success: true,
      message: 'Engineer added successfully',
      engineer,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

exports.updateEngineer = async (req, res) => {
  try {
    const { isActive, ...rest } = req.body;

    const engineer = await masterDataService.updateEngineer(req.params.id, {
      ...rest,
      isActive: isActive === 'true' || isActive === true,
    });

    return res.json({
      success: true,
      message: 'Engineer updated successfully',
      engineer,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

// --- Projects ---
exports.addProject = async (req, res) => {
  try {
    const { name, code, location, levels } = req.body;

    const parsedLevels = (levels || '')
      .split(',')
      .map((l, i) => ({
        name: l.trim(),
        sortOrder: i,
        isActive: true,
      }))
      .filter((l) => l.name);

    const project = await masterDataService.addProject({
      name,
      code,
      location,
      levels: parsedLevels,
    });

    return res.status(201).json({
      success: true,
      message: 'Project added successfully',
      project,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

exports.addProjectLevel = async (req, res) => {
  try {
    const { name, sortOrder } = req.body;

    const project = await masterDataService.addProjectLevel(req.params.id, {
      name,
      sortOrder: sortOrder || 0,
      isActive: true,
    });

    let addedLevel = null;

    if (project && Array.isArray(project.levels) && project.levels.length) {
      addedLevel = project.levels[project.levels.length - 1];
    }

    return res.status(201).json({
      success: true,
      message: 'Level added successfully',
      level: addedLevel,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

exports.removeProjectLevel = async (req, res) => {
  try {
    await masterDataService.removeProjectLevel(req.params.id, req.params.levelId);

    return res.json({
      success: true,
      message: 'Level removed successfully',
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

exports.addProjectElement = async (req, res) => {
  try {
    const { name } = req.body;

    const project = await masterDataService.addProjectElement(req.params.id, {
      name,
      isActive: true,
    });

    let addedElement = null;
    if (project && Array.isArray(project.elements) && project.elements.length) {
      addedElement = project.elements[project.elements.length - 1];
    }

    return res.status(201).json({
      success: true,
      message: 'Element added successfully',
      element: addedElement,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

exports.removeProjectElement = async (req, res) => {
  try {
    await masterDataService.removeProjectElement(req.params.id, req.params.elementId);

    return res.json({
      success: true,
      message: 'Element removed successfully',
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

// --- Master Data Items (elements, activities, laborSourceTypes) ---
exports.addMasterDataItem = async (req, res) => {
  try {
    const { category, name } = req.body;

    const item = await masterDataService.addMasterDataItem(category, name);

    return res.status(201).json({
      success: true,
      message: `${category} item added successfully`,
      item,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

exports.toggleEngineer = async (req, res) => {
  try {
    const engineer = await Engineer.findById(req.params.id);

    if (!engineer) {
      return res.status(404).json({
        success: false,
        message: 'Engineer not found',
      });
    }

    engineer.isActive = !engineer.isActive;
    await engineer.save();

    return res.json({
      success: true,
      message: `Engineer ${engineer.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: engineer.isActive,
      engineer,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

exports.toggleEngineerAlerts = async (req, res) => {
  try {
    const engineer = await Engineer.findById(req.params.id);
    if (!engineer) {
      return res.status(404).json({ success: false, message: 'Engineer not found' });
    }
    engineer.excludeFromAlerts = !engineer.excludeFromAlerts;
    await engineer.save();
    return res.json({
      success: true,
      message: `Engineer ${engineer.excludeFromAlerts ? 'excluded from' : 'included in'} alerts`,
      excludeFromAlerts: engineer.excludeFromAlerts,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.toggleMasterDataItem = async (req, res) => {
  try {
    const item = await MasterData.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Not found',
      });
    }

    item.isActive = !item.isActive;
    await item.save();

    return res.json({
      success: true,
      message: 'Item status updated successfully',
      isActive: item.isActive,
      item,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};