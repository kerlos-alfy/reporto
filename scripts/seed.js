#!/usr/bin/env node

/**
 * Reporto— Database Seed Script (CommonJS)
 * Usage:
 *   npm run seed          # upsert mode — safe to re-run
 *   npm run seed:fresh    # drops existing data and re-seeds
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");

dotenv.config();

const AdminUser = require("../models/AdminUser");
const Engineer = require("../models/Engineer");
const Project = require("../models/Project");
const MasterData = require("../models/MasterData");
const Counter = require("../models/Counter");
const DailyReport = require("../models/DailyReport");
const { generateReportId } = require("../utils/reportIdGenerator");

const FRESH = process.argv.includes("--fresh");
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/agile-prime";

// ─── helpers ────────────────────────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const maybe = (prob, val, fallback) => (Math.random() < prob ? val : fallback || "");

function buildManpower() {
	return {
		steelFixer: rInt(0, 8),
		steelFixerForemen: rInt(0, 3),
		carpenter: rInt(0, 6),
		carpenterForemen: rInt(0, 2),
		helper: rInt(0, 10),
		scaffolding: rInt(0, 4),
		engineersNo: rInt(0, 3),
	};
}

function sumMp(mp) {
	return (
		(mp.steelFixer || 0) +
		(mp.steelFixerForemen || 0) +
		(mp.carpenter || 0) +
		(mp.carpenterForemen || 0) +
		(mp.helper || 0) +
		(mp.scaffolding || 0) +
		(mp.engineersNo || 0)
	);
}

function shiftDuration(start, end) {
	const toMins = (t) => {
		const [h, m] = t.split(":").map(Number);
		return h * 60 + m;
	};
	let d = toMins(end) - toMins(start);
	if (d < 0) d += 1440;
	return d;
}

// [shiftType, startTime, endTime]
const SHIFT_SLOTS = [
	["Day", "07:00", "15:00"],
	["Day", "08:00", "17:00"],
	["Day", "06:30", "14:30"],
	["Night", "22:00", "06:00"],
	["Night", "20:00", "04:00"],
	["Night", "21:00", "05:00"],
];

// Date range: 30 Mar 2026 → 02 Apr 2026
const DATE_RANGE = [
	new Date("2026-03-30T00:00:00.000Z"),
	new Date("2026-03-31T00:00:00.000Z"),
	new Date("2026-04-01T00:00:00.000Z"),
	new Date("2026-04-02T00:00:00.000Z"),
];

// ─── main ────────────────────────────────────────────────────────────────────
async function seed() {
	console.log("🌱 ReportoSeed Script");
	console.log("   Mode : " + (FRESH ? "FRESH (cleanup + reseed)" : "UPSERT"));
	console.log("   Dates: 30 Mar 2026 → 02 Apr 2026\n");

	await mongoose.connect(MONGO_URI);
	console.log("✓ Connected to MongoDB\n");

	// ── cleanup ──────────────────────────────────────────────────────────────
	if (FRESH) {
		console.log("🧹 Cleaning selected data...");
		await Engineer.deleteMany({
			name: {
				$nin: [
					"Eng Karim Nabil",
					"Eng Mina Sameh",
					"Eng Youssef Adel",
					"Eng Peter Magdy",
					"Eng Fady Hany",
					"Eng Bishoy Nader",
					"Eng George Amir",
					"Eng Mark Ashraf",
				],
			},
		});

		await Project.deleteMany({
			name: {
				$nin: ["Marina Heights", "Creek Vista", "Jumeirah Pearl Villas", "Downtown Gate"],
			},
		});
		await Promise.all([DailyReport.deleteMany({}), Counter.deleteMany({}), MasterData.deleteMany({})]);
		console.log("✓ Cleanup complete\n");
	}

	// ── admin ─────────────────────────────────────────────────────────────────
	const adminUsername = process.env.ADMIN_USERNAME || "admin";
	const adminExists = await AdminUser.findOne({ username: adminUsername });
	if (!adminExists) {
		const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || "Admin@2026!", 12);
		await AdminUser.create({
			name: process.env.ADMIN_NAME || "System Administrator",
			username: adminUsername,
			email: process.env.ADMIN_EMAIL || "admin@agileprime.ae",
			passwordHash: hash,
			role: "superadmin",
			isActive: true,
			permissions: {
				canViewDashboard: true,
				canViewReports: true,
				canManageMasters: true,
				canManageUsers: true,
				canExportData: true,
			},
		});
		console.log("✓ Super Admin user created");
	} else {
		// Upgrade existing admin to superadmin if needed
		if (adminExists.role !== "superadmin") {
			await AdminUser.updateOne({ _id: adminExists._id }, { role: "superadmin" });
			console.log("→ Existing admin upgraded to superadmin");
		} else {
			console.log("→ Super Admin user already exists, skipping");
		}
	}

	// ── engineers ─────────────────────────────────────────────────────────────
	const engineerDefs = [
		{ name: "Eng Karim Nabil", phone: "+971501110001" },
		{ name: "Eng Mina Sameh", phone: "+971501110002" },
		{ name: "Eng Youssef Adel", phone: "+971501110003" },
		{ name: "Eng Peter Magdy", phone: "+971501110004" },
		{ name: "Eng Fady Hany", phone: "+971501110005" },
		{ name: "Eng Bishoy Nader", phone: "+971501110006" },
		{ name: "Eng George Amir", phone: "+971501110007" },
		{ name: "Eng Mark Ashraf", phone: "+971501110008" },
	];
	for (const eng of engineerDefs) {
		await Engineer.findOneAndUpdate({ name: eng.name }, { ...eng, isActive: true }, { upsert: true, new: true });
	}
	console.log("✓ " + engineerDefs.length + " engineers seeded");

	// ── projects ──────────────────────────────────────────────────────────────
	const projectDefs = [
		{
			name: "Marina Heights",
			code: "MRN-001",
			location: "Dubai Marina, Dubai",
			levels: [
				"Basement-4",
				"Basement-3",
				"Basement-2",
				"Basement-1",
				"Ground Floor",
				"Mezzanine",
				"Podium 1",
				"Podium 2",
				"Podium 3",
				"Podium 4",
				"Level 1",
				"Level 2",
				"Level 3",
				"Level 4",
				"Level 5",
				"Level 6",
				"Level 7",
				"Level 8",
				"Level 9",
				"Level 10",
				"Roof",
			],
		},
		{
			name: "Creek Vista",
			code: "CRK-002",
			location: "Dubai Creek Harbour, Dubai",
			levels: [
				"Foundation",
				"Basement-2",
				"Basement-1",
				"Ground Floor",
				"Level 1",
				"Level 2",
				"Level 3",
				"Level 4",
				"Level 5",
				"Roof",
				"External Works",
				"Landscape Area",
			],
		},
		{
			name: "Jumeirah Pearl Villas",
			code: "JPV-003",
			location: "Jumeirah, Dubai",
			levels: ["Foundation", "Ground Floor", "First Floor", "Roof", "Swimming Pool Area", "Boundary Wall", "External Works", "Landscaping"],
		},
		{
			name: "Downtown Gate",
			code: "DTG-004",
			location: "Downtown Dubai",
			levels: [
				"Basement-5",
				"Basement-4",
				"Basement-3",
				"Basement-2",
				"Basement-1",
				"Ground Floor",
				"Retail Level",
				"Podium 1",
				"Podium 2",
				"Level 1",
				"Level 2",
				"Level 3",
				"Level 4",
				"Level 5",
				"Level 6",
				"Level 7",
				"Level 8",
				"Level 9",
				"Level 10",
				"Roof Top Amenity",
			],
		},
	];
	for (const p of projectDefs) {
		await Project.findOneAndUpdate(
			{ name: p.name },
			{ name: p.name, code: p.code, location: p.location, levels: p.levels.map((name, i) => ({ name, sortOrder: i, isActive: true })), isActive: true },
			{ upsert: true, new: true },
		);
	}
	console.log("✓ " + projectDefs.length + " projects seeded");

	// ── elements ──────────────────────────────────────────────────────────────
	const elements = [
		"Footing",
		"Column Neck",
		"Column",
		"Core Wall",
		"Shear Wall",
		"Retaining Wall",
		"Beam",
		"Hidden Beam",
		"Transfer Beam",
		"Slab",
		"Flat Slab",
		"Staircase",
		"Ramp",
		"Lift Shaft",
		"Water Tank",
		"Planter Wall",
		"Parapet Wall",
		"Boundary Wall",
		"Swimming Pool Structure",
		"Podium Deck",
		"Facade Support",
		"Roof Slab",
	];
	for (let i = 0; i < elements.length; i++) {
		await MasterData.findOneAndUpdate(
			{ category: "element", name: elements[i] },
			{ category: "element", name: elements[i], sortOrder: i, isActive: true },
			{ upsert: true, new: true },
		);
	}
	console.log("✓ " + elements.length + " elements seeded");

	// ── activities ────────────────────────────────────────────────────────────
	const activities = [
		"Setting Out",
		"Excavation",
		"Blinding Concrete",
		"Waterproofing Works",
		"Protection Screed",
		"Rebar Fixing",
		"Formwork Installation",
		"Formwork Alignment",
		"Concrete Casting",
		"Concrete Finishing",
		"Curing Works",
		"Formwork Removal",
		"Blockwork",
		"Plaster Works",
		"Screed Works",
		"Tile Installation",
		"Paint Preparation",
		"Primer Application",
		"Final Painting",
		"MEP First Fix",
		"MEP Second Fix",
		"Inspection Request",
		"Snagging Works",
	];
	for (let i = 0; i < activities.length; i++) {
		await MasterData.findOneAndUpdate(
			{ category: "activity", name: activities[i] },
			{ category: "activity", name: activities[i], sortOrder: i, isActive: true },
			{ upsert: true, new: true },
		);
	}
	console.log("✓ " + activities.length + " activities seeded");

	// ── labor source types ────────────────────────────────────────────────────
	const sourceTypes = ["In-House", "Supplier", "Subcontractor"];
	for (let i = 0; i < sourceTypes.length; i++) {
		await MasterData.findOneAndUpdate(
			{ category: "laborSourceType", name: sourceTypes[i] },
			{ category: "laborSourceType", name: sourceTypes[i], sortOrder: i, isActive: true },
			{ upsert: true, new: true },
		);
	}
	console.log("✓ " + sourceTypes.length + " labor source types seeded");

	// ── supplier companies ────────────────────────────────────────────────────
	const supplierNames = [
		"BlueLine Manpower Services",
		"Prime Labor Supply",
		"Al Noor Workforce Solutions",
		"BuildForce Technical Supply",
		"Emirates Labor Hub",
		"Silver Gate Manpower",
		"Urban Crew Services",
		"Gulf Talent Workforce",
		"Rapid Site Manpower",
		"Vertex Labor Solutions",
	];
	for (let i = 0; i < supplierNames.length; i++) {
		await MasterData.findOneAndUpdate(
			{ category: "supplierCompany", name: supplierNames[i] },
			{ category: "supplierCompany", name: supplierNames[i], sortOrder: i, isActive: true },
			{ upsert: true, new: true },
		);
	}
	console.log("✓ " + supplierNames.length + " supplier companies seeded");

	// ── subcontractor companies ───────────────────────────────────────────────
	const subcontractorNames = [
		"Vertex Civil Contracting",
		"Skyline Concrete Works",
		"Urban Edge Construction",
		"Prime Structure Contracting",
		"BlueRock Engineering",
		"Falcon Build Contracting",
		"Royal Axis Construction",
		"MetroCore Technical Services",
		"SolidBase Contracting",
		"Crestline Fitout Works",
	];
	for (let i = 0; i < subcontractorNames.length; i++) {
		await MasterData.findOneAndUpdate(
			{ category: "subcontractorCompany", name: subcontractorNames[i] },
			{ category: "subcontractorCompany", name: subcontractorNames[i], sortOrder: i, isActive: true },
			{ upsert: true, new: true },
		);
	}
	console.log("✓ " + subcontractorNames.length + " subcontractor companies seeded");

	// ── counter ───────────────────────────────────────────────────────────────
	await Counter.findByIdAndUpdate("dsr-seed", { _id: "dsr-seed", seq: 0 }, { upsert: true, new: true });
	console.log("✓ Counter initialized");

	// ── sample reports (FRESH only) ───────────────────────────────────────────
	if (FRESH) {
		const engineers = await Engineer.find().lean();
		const projects = await Project.find().lean();

		const sampleReports = [];

		for (const date of DATE_RANGE) {
			const reportsPerDay = rInt(3, 5);

			for (let r = 0; r < reportsPerDay; r++) {
				const eng = pick(engineers);
				const proj = pick(projects);
				const projLvls = (proj.levels || []).filter((l) => l.isActive).map((l) => l.name);

				const itemCount = rInt(2, 5);
				const items = [];

				for (let i = 0; i < itemCount; i++) {
					const srcType = pick(sourceTypes);
					const isExt = srcType !== "In-House";
					const slot = pick(SHIFT_SLOTS);
					const shType = slot[0];
					const stTime = slot[1];
					const enTime = slot[2];

					const mp = buildManpower();
					const mpTot = sumMp(mp);

					const extMp = isExt
						? buildManpower()
						: { steelFixer: 0, steelFixerForemen: 0, carpenter: 0, carpenterForemen: 0, helper: 0, scaffolding: 0, engineersNo: 0 };
					const extMpTot = isExt ? sumMp(extMp) : 0;

					const companyName = srcType === "Supplier" ? pick(supplierNames) : srcType === "Subcontractor" ? pick(subcontractorNames) : "";

					items.push({
						itemNo: i + 1,
						element: pick(elements),
						level: projLvls.length > 0 ? pick(projLvls) : "Ground Floor",
						activity: pick(activities),
						progress: rInt(10, 100),
						itemComment: maybe(0.4, "Work proceeding as planned"),

						manpower: mp,
						totalManpower: mpTot,

						externalManpower: extMp,
						externalTotalManpower: extMpTot,

						laborSourceType: srcType,
						sourceCompanyName: companyName,
						sourceScopeNotes: isExt ? maybe(0.6, "Structural works support") : "",

						shiftType: shType,
						startTime: stTime,
						endTime: enTime,
						shiftDurationMinutes: shiftDuration(stTime, enTime),
					});
				}

				const reportId = await generateReportId(date);

				const totalMp = items.reduce((s, it) => s + it.totalManpower + it.externalTotalManpower, 0);
				const avgProg = Math.round((items.reduce((s, it) => s + it.progress, 0) / items.length) * 100) / 100;

				const dayCount = items.filter((it) => it.shiftType === "Day").length;
				const repShift = dayCount >= items.length - dayCount ? "Day" : "Night";
				const repSlot = SHIFT_SLOTS.find((s) => s[0] === repShift);
				const repStart = repSlot[1];
				const repEnd = repSlot[2];

				sampleReports.push({
					reportId,
					date,
					engineer: eng._id,
					engineerName: eng.name,
					site: proj._id,
					siteName: proj.name,

					shiftType: repShift,
					startTime: repStart,
					endTime: repEnd,
					shiftDurationMinutes: shiftDuration(repStart, repEnd),

					generalComment: maybe(0.5, "Normal operations"),
					generalDelays: maybe(0.25, "Minor delay due to material delivery"),

					items,
					itemsCount: items.length,
					totalManpower: totalMp,
					averageProgress: avgProg,
				});
			}
		}

		await DailyReport.insertMany(sampleReports);
		console.log("✓ " + sampleReports.length + " sample reports seeded across " + DATE_RANGE.length + " days");
		console.log("  " + DATE_RANGE.map((d) => d.toISOString().slice(0, 10)).join(" · "));
	}

	console.log("\n✅ Seed complete!");
	await mongoose.connection.close();
	process.exit(0);
}

seed().catch(async (err) => {
	console.error("❌ Seed error:", err);
	try {
		await mongoose.connection.close();
	} catch (_) {}
	process.exit(1);
});
