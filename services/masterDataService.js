const MasterData = require('../models/MasterData');
const Engineer = require('../models/Engineer');
const Project = require('../models/Project');

class MasterDataService {
  async getElements() {
    return MasterData.getByCategory('element');
  }

  async getActivities() {
    return MasterData.getByCategory('activity');
  }

  async getLaborSourceTypes() {
    return MasterData.getByCategory('laborSourceType');
  }

  async getSupplierCompanies() {
    return MasterData.getByCategory('supplierCompany');
  }

  async getSubcontractorCompanies() {
    return MasterData.getByCategory('subcontractorCompany');
  }

  async getActiveEngineers() {
    return Engineer.find({ isActive: true }).sort({ name: 1 }).lean();
  }

  async getActiveProjects(allowedProjectIds = null) {
    const filter = { isActive: true };
    if (allowedProjectIds && allowedProjectIds.length > 0) {
      filter._id = { $in: allowedProjectIds };
    }
    return Project.find(filter).sort({ name: 1 }).lean();
  }

  async getProjectLevels(projectId) {
    const project = await Project.findById(projectId).lean();
    if (!project) return [];
    return (project.levels || [])
      .filter((l) => l.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getProjectElements(projectId) {
    const project = await Project.findById(projectId).lean();
    if (!project) return [];
    return (project.elements || [])
      .filter((e) => e.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async validateLevelBelongsToProject(projectId, levelName) {
    const project = await Project.findById(projectId).lean();
    if (!project) return false;
    return project.levels.some((l) => l.name === levelName && l.isActive);
  }

  async getFormData(sessionUser = null) {
    // Determine project filter
    const allowedProjectIds =
      sessionUser &&
      sessionUser.role !== 'superadmin' &&
      sessionUser.role !== 'admin' &&
      sessionUser.allowedProjects &&
      sessionUser.allowedProjects.length > 0
        ? sessionUser.allowedProjects
        : null;

    const [engineers, projects, elements, activities, laborSourceTypes, supplierCompanies, subcontractorCompanies] = await Promise.all([
      this.getActiveEngineers(),
      this.getActiveProjects(allowedProjectIds),
      this.getElements(),
      this.getActivities(),
      this.getLaborSourceTypes(),
      this.getSupplierCompanies(),
      this.getSubcontractorCompanies(),
    ]);

    // If this user has a linked engineer, mark it so the form can pre-select & lock it
    const lockedEngineer = sessionUser?.linkedEngineer
      ? engineers.find(e => e._id.toString() === sessionUser.linkedEngineer) || null
      : null;

    return { engineers, projects, elements, activities, laborSourceTypes, supplierCompanies, subcontractorCompanies, lockedEngineer };
  }

  async getFilterOptions() {
    const [projects, engineers, activities, levels, sourceTypes] = await Promise.all([
      Project.find({ isActive: true }).select('name').sort({ name: 1 }).lean(),
      Engineer.find({ isActive: true }).select('name').sort({ name: 1 }).lean(),
      MasterData.find({ category: 'activity', isActive: true }).select('name').sort({ name: 1 }).lean(),
      Project.aggregate([
        { $match: { isActive: true } },
        { $unwind: '$levels' },
        { $match: { 'levels.isActive': true } },
        { $group: { _id: '$levels.name' } },
        { $sort: { _id: 1 } },
      ]),
      MasterData.find({ category: 'laborSourceType', isActive: true }).select('name').sort({ name: 1 }).lean(),
    ]);

    return {
      projects: projects.map((p) => ({ id: p._id, name: p.name })),
      engineers: engineers.map((e) => ({ id: e._id, name: e.name })),
      activities: activities.map((a) => a.name),
      levels: levels.map((l) => l._id),
      sourceTypes: sourceTypes.map((s) => s.name),
    };
  }

  // ---- CRUD for master data management ----

  async addEngineer(data) {
    return Engineer.create(data);
  }

  async updateEngineer(id, data) {
    return Engineer.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  async addProject(data) {
    return Project.create(data);
  }

  async updateProject(id, data) {
    return Project.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

async addProjectLevel(projectId, levelData) {
  const project = await Project.findById(projectId);
  if (!project) throw new Error('Project not found');

  const levelName = levelData.name?.trim();
  if (!levelName) throw new Error('Level name is required');

  const exists = (project.levels || []).some(
    (l) => l.name?.trim().toLowerCase() === levelName.toLowerCase()
  );

  if (exists) throw new Error('Level already exists');

  project.levels.push({
    name: levelName,
    isActive: true,
    sortOrder: (project.levels?.length || 0) + 1,
  });

  return project.save();
}

async removeProjectLevel(projectId, levelId) {
  const project = await Project.findById(projectId);
  if (!project) throw new Error('Project not found');

  const beforeCount = project.levels.length;

  project.levels = project.levels.filter(
    (level) => level._id.toString() !== levelId
  );

  if (project.levels.length === beforeCount) {
    throw new Error('Level not found');
  }

  return project.save();
}

async addProjectElement(projectId, elementData) {
  const project = await Project.findById(projectId);
  if (!project) throw new Error('Project not found');

  const elementName = elementData.name?.trim();
  if (!elementName) throw new Error('Element name is required');

  const exists = (project.elements || []).some(
    (e) => e.name?.trim().toLowerCase() === elementName.toLowerCase()
  );

  if (exists) throw new Error('Element already exists');

  project.elements.push({
    name: elementName,
    isActive: true,
    sortOrder: (project.elements?.length || 0) + 1,
  });

  return project.save();
}

async removeProjectElement(projectId, elementId) {
  const project = await Project.findById(projectId);
  if (!project) throw new Error('Project not found');

  const beforeCount = project.elements.length;

  project.elements = project.elements.filter(
    (el) => el._id.toString() !== elementId
  );

  if (project.elements.length === beforeCount) {
    throw new Error('Element not found');
  }

  return project.save();
}
  async addMasterDataItem(category, name) {
    return MasterData.create({ category, name });
  }

  async updateMasterDataItem(id, data) {
    return MasterData.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  async deleteMasterDataItem(id) {
    return MasterData.findByIdAndDelete(id);
  }
}

module.exports = new MasterDataService();
