const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { dbService } = require('./database');

const app = express();
const PORT = process.env.PORT || 8080;

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Multer storage config for attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'ticket-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf|docx|txt|zip/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (allowed.test(ext)) cb(null, true);
    else cb(new Error('Format file tidak didukung.'));
  }
});

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'it-helpdesk-secret-2026-xK9p',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 hours
}));

// ─── Auth Middleware ─────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: 'Silakan login terlebih dahulu.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya admin yang diizinkan.' });
  }
  next();
}

// ─── Auth API Routes ─────────────────────────────────────────────────────────

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username dan password wajib diisi.' });
    }

    const user = dbService.getUserByUsername(username.trim());
    if (!user) {
      return res.status(401).json({ success: false, message: 'Username atau password salah.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Username atau password salah.' });
    }

    // Store safe user info in session
    req.session.user = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      department: user.department,
      phone: user.phone,
      role: user.role
    };

    res.json({
      success: true,
      message: `Selamat datang, ${user.full_name}!`,
      data: req.session.user
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ success: false, message: 'Gagal logout.' });
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Berhasil logout.' });
  });
});

// GET /api/auth/me
app.get('/api/auth/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: 'Belum login.' });
  }
  res.json({ success: true, data: req.session.user });
});

// ─── Page Routes ─────────────────────────────────────────────────────────────
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

app.get('/', (req, res) => res.redirect('/login'));

app.get('/user', (req, res) => res.sendFile(path.join(__dirname, 'public', 'user.html')));

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// ─── Meta ────────────────────────────────────────────────────────────────────
const META = {
  categories: ['Hardware', 'Software', 'Jaringan & Internet', 'Akun & Hak Akses', 'Printer & Scanner', 'Email & Komunikasi', 'Lain-lain'],
  priorities: [
    { id: 'Low', label: 'Rendah (Low)', desc: 'Tidak menghambat pekerjaan rutin' },
    { id: 'Medium', label: 'Sedang (Medium)', desc: 'Menghambat sebagian pekerjaan tapi ada alternatif' },
    { id: 'High', label: 'Tinggi (High)', desc: 'Pekerjaan terhenti, butuh segera' },
    { id: 'Critical', label: 'Kritis (Urgent/Critical)', desc: 'Sistem operasional lumpuh total / Direksi' }
  ],
  statuses: ['Open', 'In Progress', 'Pending User', 'Resolved', 'Closed'],
  departments: [
    'Finance & Accounting', 'Human Resources (HRD)', 'Marketing & Kreatif',
    'Sales & Commercial', 'Operasional & Logistik', 'General Affairs (GA)',
    'Direksi & Manajemen', 'Legal & Compliance', 'Customer Support'
  ],
  technicians: [
    'Ahmad (IT Lead)', 'Budi Santoso (Desktop Support)',
    'Dimas Pratama (Network & Sysadmin)', 'Rian Hidayat (Hardware Specialist)',
    'Eko Prasetyo (Helpdesk Officer)'
  ]
};

app.get('/api/meta', (req, res) => res.json({ success: true, data: META }));

// ─── Stats (Admin only) ───────────────────────────────────────────────────────
app.get('/api/stats', requireAuth, requireAdmin, (req, res) => {
  try {
    res.json({ success: true, data: dbService.getStats() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Tickets ──────────────────────────────────────────────────────────────────

// GET /api/tickets — user sees only own, admin sees all
app.get('/api/tickets', requireAuth, (req, res) => {
  try {
    const { user } = req.session;
    const filters = { ...req.query };

    if (user.role === 'user') {
      // Force filter: only return tickets belonging to this user
      filters.requester_email = user.email;
    }

    const tickets = dbService.getTickets(filters);
    res.json({ success: true, count: tickets.length, data: tickets });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/tickets/:id
app.get('/api/tickets/:id', requireAuth, (req, res) => {
  try {
    const id = req.params.id;
    let ticket = isNaN(id) ? dbService.getTicketByNumber(id) : dbService.getTicketById(parseInt(id, 10));

    if (!ticket) return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan.' });

    // Users can only view their own tickets
    if (req.session.user.role === 'user' &&
        ticket.requester_email.toLowerCase() !== req.session.user.email.toLowerCase()) {
      return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }

    const activities = dbService.getTicketActivities(ticket.id);
    res.json({ success: true, data: { ...ticket, activities } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/tickets — authenticated users can create
app.post('/api/tickets', requireAuth, upload.single('attachment'), (req, res) => {
  try {
    const user = req.session.user;
    const {
      subject, category, priority, department,
      requester_name, requester_email, requester_phone,
      location, description, assigned_to
    } = req.body;

    // For users: identity comes from session. For admin: must supply full data.
    const finalRequesterName = user.role === 'user' ? user.full_name : (requester_name || '');
    const finalRequesterEmail = user.role === 'user' ? user.email : (requester_email || '');
    const finalDepartment = user.role === 'user' ? (user.department || department || '') : (department || '');
    const finalPhone = user.role === 'user' ? (user.phone || requester_phone || '') : (requester_phone || '');

    // Validate required fields (adjusted per role)
    if (user.role === 'admin') {
      if (!subject || !category || !finalDepartment || !finalRequesterName || !description) {
        return res.status(400).json({
          success: false,
          message: 'Mohon lengkapi kolom wajib: Nama Pelapor, Departemen, Kategori, Subjek, dan Deskripsi Masalah.'
        });
      }
    } else {
      if (!subject || !category || !description) {
        return res.status(400).json({
          success: false,
          message: 'Mohon lengkapi kolom wajib: Kategori, Subjek, dan Deskripsi Masalah.'
        });
      }
    }

    const newTicket = dbService.createTicket({
      subject, category,
      priority: priority || 'Medium',
      department: finalDepartment,
      requester_name: finalRequesterName,
      requester_email: finalRequesterEmail,
      requester_phone: finalPhone,
      location,
      description,
      attachment: req.file ? `/uploads/${req.file.filename}` : null,
      assigned_to: user.role === 'admin' ? (assigned_to || 'Belum Ditugaskan') : 'Belum Ditugaskan',
      author_role: user.role
    });

    res.status(201).json({
      success: true,
      message: `Tiket berhasil dibuat dengan nomor ${newTicket.ticket_number}`,
      data: newTicket
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/tickets/:id — Admin only
app.put('/api/tickets/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updatedBy = req.session.user.full_name || 'IT Support Admin';
    const updated = dbService.updateTicket(id, req.body, updatedBy);

    if (!updated) return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan.' });

    res.json({ success: true, message: 'Data tiket berhasil diperbarui.', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/tickets/:id — Admin only
app.delete('/api/tickets/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const success = dbService.deleteTicket(id);
    if (!success) return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan.' });
    res.json({ success: true, message: 'Tiket berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/tickets/:id/activities — authenticated
app.post('/api/tickets/:id/activities', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { message, action_type } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Pesan komentar tidak boleh kosong.' });
    }

    const ticket = dbService.getTicketById(id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan.' });

    // Users can only comment on their own tickets
    if (req.session.user.role === 'user' &&
        ticket.requester_email.toLowerCase() !== req.session.user.email.toLowerCase()) {
      return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }

    const user = req.session.user;
    dbService.addActivity({
      ticket_id: id,
      author_name: user.full_name,
      author_role: user.role,
      action_type: action_type || 'public_comment',
      message: message.trim()
    });

    const activities = dbService.getTicketActivities(id);
    res.json({ success: true, message: 'Komentar berhasil ditambahkan.', data: activities });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/export-csv — Admin only
app.get('/api/export-csv', requireAuth, requireAdmin, (req, res) => {
  try {
    const tickets = dbService.getTickets();
    const headers = ['No. Tiket','Subjek','Kategori','Prioritas','Status','Departemen','Pelapor','Email','Telepon','Lokasi','Teknisi','Tgl Dibuat','Tgl Selesai','Solusi'];
    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      return `"${String(str).replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
    };
    const csvRows = [headers.join(',')];
    for (const t of tickets) {
      csvRows.push([
        escapeCsv(t.ticket_number), escapeCsv(t.subject), escapeCsv(t.category),
        escapeCsv(t.priority), escapeCsv(t.status), escapeCsv(t.department),
        escapeCsv(t.requester_name), escapeCsv(t.requester_email), escapeCsv(t.requester_phone),
        escapeCsv(t.location), escapeCsv(t.assigned_to), escapeCsv(t.created_at),
        escapeCsv(t.resolved_at), escapeCsv(t.resolution_notes)
      ].join(','));
    }
    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="laporan-tiket-it-support.csv"');
    res.send(csvContent);
  } catch (err) {
    res.status(500).send('Gagal mengekspor data: ' + err.message);
  }
});

// POST /api/reset-demo — Admin only
app.post('/api/reset-demo', requireAuth, requireAdmin, (req, res) => {
  try {
    dbService.resetAndSeed();
    res.json({ success: true, message: 'Data simulasi berhasil direset ke pengaturan awal.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/users — Admin only (list all user accounts)
app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
  try {
    res.json({ success: true, data: dbService.getAllUsers() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 IT Support Helpdesk Ticketing System is running!`);
  console.log(`🌐 Server URL: http://localhost:${PORT}`);
  console.log(`====================================================`);
  console.log(`  Login page : http://localhost:${PORT}/login`);
  console.log(`  User panel : http://localhost:${PORT}/user`);
  console.log(`  Admin panel: http://localhost:${PORT}/admin`);
  console.log(`====================================================`);
  console.log(`  Default accounts:`);
  console.log(`  admin / admin123   → Admin Dashboard`);
  console.log(`  siti.rahma / user123 → User Portal`);
  console.log(`====================================================`);
});
