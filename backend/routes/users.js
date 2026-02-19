const router = require("express").Router();
const User = require("../models/User");
const WorkLog = require("../models/WorkLog");
const { auth, adminOnly, superadminOnly } = require("../middleware/auth");

// GET /api/users — list all users (admin) or get own data (user)
router.get("/", auth, async (req, res) => {
  try {
    // Allow both admin and superadmin to view all users
    if (req.user.role === "admin" || req.user.role === "superadmin") {
      // Exclude superadmin from the list, only show user role (not admin or superadmin)
      const users = await User.find({ role: "user" }).sort({ createdAt: -1 });

      // Enrich with work stats
      const enriched = await Promise.all(
        users.map(async (u) => {
          const stats = await WorkLog.aggregate([
            { $match: { userId: u._id, status: "Selesai" } },
            {
              $group: {
                _id: null,
                berkas: { $sum: "$berkas" },
                buku: { $sum: "$buku" },
                bundle: { $sum: "$bundle" },
              },
            },
          ]);
          const s = stats[0] || { berkas: 0, buku: 0, bundle: 0 };
          return {
            ...u.toJSON(),
            totalBerkas: s.berkas,
            totalBuku: s.buku,
            totalBundle: s.bundle,
          };
        }),
      );

      return res.json({ success: true, data: enriched });
    }

    // User: return own data
    res.json({ success: true, data: [req.user.toJSON()] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== ADMIN ROUTES (Superadmin only) - MUST BE BEFORE /:id =====
// GET /api/users/admins/list — list all admins
router.get("/admins/list", auth, superadminOnly, async (req, res) => {
  try {
    const admins = await User.find({ role: "admin" }).sort({ createdAt: -1 });
    res.json({ success: true, data: admins.map(u => u.toJSON()) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/users/admins — create new admin
router.post("/admins", auth, superadminOnly, async (req, res) => {
  try {
    const { name, email, password, username } = req.body;
    if (!name || !email)
      return res
        .status(400)
        .json({ success: false, message: "Nama dan email wajib diisi." });

    if (username) {
      const existingUsername = await User.findOne({ username: username.trim().toLowerCase() });
      if (existingUsername)
        return res
          .status(400)
          .json({ success: false, message: "Username sudah digunakan." });
    }

    const existing = await User.findOne({ email });
    if (existing)
      return res
        .status(400)
        .json({ success: false, message: "Email sudah terdaftar." });

    const user = await User.create({
      name,
      email,
      password: password || "admin123",
      role: "admin",
      status: "Aktif",
      username: username ? username.trim().toLowerCase() : undefined,
    });

    res
      .status(201)
      .json({
        success: true,
        message: "Admin berhasil ditambahkan.",
        data: user.toJSON(),
      });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/users/admins/:id — update admin
router.put("/admins/:id", auth, superadminOnly, async (req, res) => {
  try {
    const { name, email, username } = req.body;
    const user = await User.findOne({ _id: req.params.id, role: "admin" });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "Admin tidak ditemukan." });

    if (email && email !== user.email) {
      const existing = await User.findOne({ email });
      if (existing)
        return res
          .status(400)
          .json({ success: false, message: "Email sudah terdaftar." });
    }

    if (username && username !== user.username) {
      const existingUsername = await User.findOne({ username: username.trim().toLowerCase() });
      if (existingUsername)
        return res
          .status(400)
          .json({ success: false, message: "Username sudah digunakan." });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (username !== undefined) user.username = username ? username.trim().toLowerCase() : '';

    await user.save();
    res.json({
      success: true,
      message: "Data admin berhasil diupdate.",
      data: user.toJSON(),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/users/admins/:id — delete admin
router.delete("/admins/:id", auth, superadminOnly, async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: "admin" });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "Admin tidak ditemukan." });

    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Admin berhasil dihapus." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/users/:id — MUST BE AFTER specific routes
router.get("/:id", auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User tidak ditemukan." });

    // Only admin or superadmin can view other users
    if (req.user.role !== "admin" && req.user.role !== "superadmin" && req.userId.toString() !== req.params.id) {
      return res
        .status(403)
        .json({ success: false, message: "Akses ditolak." });
    }

    const stats = await WorkLog.aggregate([
      { $match: { userId: user._id, status: "Selesai" } },
      {
        $group: {
          _id: null,
          berkas: { $sum: "$berkas" },
          buku: { $sum: "$buku" },
          bundle: { $sum: "$bundle" },
        },
      },
    ]);
    const s = stats[0] || { berkas: 0, buku: 0, bundle: 0 };

    res.json({
      success: true,
      data: {
        ...user.toJSON(),
        totalBerkas: s.berkas,
        totalBuku: s.buku,
        totalBundle: s.bundle,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/users — admin create user
router.post("/", auth, adminOnly, async (req, res) => {
  try {
    const { name, email, password, instansi, status, username, role } = req.body;
    if (!name || !email)
      return res
        .status(400)
        .json({ success: false, message: "Nama dan email wajib diisi." });

    if (username) {
      const existingUsername = await User.findOne({ username: username.trim().toLowerCase() });
      if (existingUsername)
        return res
          .status(400)
          .json({ success: false, message: "Username sudah digunakan." });
    }

    const existing = await User.findOne({ email });
    if (existing)
      return res
        .status(400)
        .json({ success: false, message: "Email sudah terdaftar." });

    // Only superadmin can create admin, default role is user
    let userRole = "user";
    if (role === "admin" && req.user.role === "superadmin") {
      userRole = "admin";
    }

    const user = await User.create({
      name,
      email,
      password: password || "magang123",
      instansi,
      status: status || "Aktif",
      role: userRole,
      username: username ? username.trim().toLowerCase() : undefined,
    });

    res
      .status(201)
      .json({
        success: true,
        message: userRole === "admin" ? "Admin berhasil ditambahkan." : "Peserta berhasil ditambahkan.",
        data: user.toJSON(),
      });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/users/:id — admin update user
router.put("/:id", auth, adminOnly, async (req, res) => {
  try {
    const { name, email, instansi, status, username } = req.body;
    const user = await User.findById(req.params.id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User tidak ditemukan." });

    if (name) user.name = name;
    if (email) user.email = email;
    if (instansi) user.instansi = instansi;
    if (status) user.status = status;
    if (username !== undefined) user.username = username ? username.trim().toLowerCase() : '';

    await user.save();
    res.json({
      success: true,
      message: "Data peserta berhasil diupdate.",
      data: user.toJSON(),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/users/:id/reset-password — admin reset user password
router.put("/:id/reset-password", auth, adminOnly, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ success: false, message: "Password minimal 6 karakter." });
    }

    const user = await User.findById(req.params.id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User tidak ditemukan." });

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: "Password berhasil direset." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/users/:id — admin delete user
router.delete("/:id", auth, adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User tidak ditemukan." });
    res.json({ success: true, message: "Peserta berhasil dihapus." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/users/:id/role — superadmin update user role
router.patch("/:id/role", auth, async (req, res) => {
  try {
    // Only superadmin can update roles
    if (req.user.role !== "superadmin") {
      return res
        .status(403)
        .json({
          success: false,
          message: "Hanya superadmin yang dapat mengubah role user.",
        });
    }

    const { role } = req.body;
    if (!role) {
      return res
        .status(400)
        .json({ success: false, message: "Role harus diberikan." });
    }

    const validRoles = ["user", "admin", "superadmin"];
    if (!validRoles.includes(role)) {
      return res
        .status(400)
        .json({
          success: false,
          message: `Role harus salah satu dari: ${validRoles.join(", ")}`,
        });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true },
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User tidak ditemukan." });
    }

    res.json({
      success: true,
      message: `Role user berhasil diubah menjadi ${role}.`,
      data: user.toJSON(),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Auto-generate username for users without username
router.post("/migrate-usernames", auth, adminOnly, async (req, res) => {
  try {
    // Find all users without username
    const usersWithoutUsername = await User.find({ 
      $or: [
        { username: { $exists: false } },
        { username: null },
        { username: "" }
      ]
    });
    
    let updated = 0;
    let skipped = 0;
    
    for (const user of usersWithoutUsername) {
      // Generate username from name: lowercase, remove spaces, remove special chars
      let baseUsername = user.name
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[^a-z0-9]/g, "");
      
      if (!baseUsername) {
        baseUsername = user.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      }
      
      let username = baseUsername;
      let counter = 1;
      
      // Check uniqueness and append number if needed
      while (await User.findOne({ username, _id: { $ne: user._id } })) {
        username = `${baseUsername}${counter}`;
        counter++;
      }
      
      user.username = username;
      await user.save();
      updated++;
    }
    
    res.json({
      success: true,
      message: `Migrasi selesai. ${updated} user diupdate, ${skipped} diskip.`,
      data: { updated, skipped, total: usersWithoutUsername.length }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
