const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const bcrypt = require('bcrypt');

// Use /data/ on Render (persistent disk) or __dirname locally
const dataDir = process.env.RENDER ? '/data' : __dirname;
const dbPath = path.join(dataDir, 'tickets.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode and foreign keys
db.exec('PRAGMA foreign_keys = ON;');

// Initialize tables
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_number TEXT UNIQUE NOT NULL,
      subject TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Open',
      department TEXT NOT NULL,
      requester_name TEXT NOT NULL,
      requester_email TEXT,
      requester_phone TEXT,
      location TEXT,
      description TEXT NOT NULL,
      attachment TEXT,
      assigned_to TEXT DEFAULT 'Belum Ditugaskan',
      resolution_notes TEXT,
      internal_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS ticket_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      author_name TEXT NOT NULL,
      author_role TEXT NOT NULL,
      action_type TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      department TEXT,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed tickets if empty
  const countTickets = db.prepare('SELECT COUNT(*) as total FROM tickets').get().total;
  if (countTickets === 0) {
    seedSampleData();
  }

  // Seed users if empty
  const countUsers = db.prepare('SELECT COUNT(*) as total FROM users').get().total;
  if (countUsers === 0) {
    seedUsers();
  }
}

function seedUsers() {
  const insertUser = db.prepare(`
    INSERT INTO users (username, password_hash, full_name, email, department, phone, role)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const users = [
    {
      username: 'admin',
      password: 'admin123',
      full_name: 'Ahmad (IT Lead)',
      email: 'ahmad@perusahaan.co.id',
      department: 'IT Support',
      phone: '081200000001',
      role: 'admin'
    },
    {
      username: 'siti.rahma',
      password: 'user123',
      full_name: 'Siti Rahmawati',
      email: 'siti.rahma@perusahaan.co.id',
      department: 'Finance & Accounting',
      phone: '081234567890',
      role: 'user'
    },
    {
      username: 'bambang.w',
      password: 'user123',
      full_name: 'Bambang Wijaya',
      email: 'bambang.w@perusahaan.co.id',
      department: 'Direksi & Manajemen',
      phone: '081198765432',
      role: 'user'
    },
    {
      username: 'anisa.m',
      password: 'user123',
      full_name: 'Anisa Melani',
      email: 'anisa.m@perusahaan.co.id',
      department: 'Human Resources (HRD)',
      phone: '081377889900',
      role: 'user'
    },
    {
      username: 'dedi.k',
      password: 'user123',
      full_name: 'Dedi Kurniawan',
      email: 'dedi.k@perusahaan.co.id',
      department: 'Operasional & Logistik',
      phone: '085612345678',
      role: 'user'
    },
    {
      username: 'hendra.s',
      password: 'user123',
      full_name: 'Hendra Saputra',
      email: 'hendra.s@perusahaan.co.id',
      department: 'Finance & Accounting',
      phone: '087812983471',
      role: 'user'
    }
  ];

  for (const u of users) {
    const hash = bcrypt.hashSync(u.password, 10);
    insertUser.run(u.username, hash, u.full_name, u.email, u.department, u.phone, u.role);
  }

  console.log('✅ User accounts seeded successfully.');
}

function generateTicketNumber() {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `TICK-${year}-${randomNum}`;
}

function seedSampleData() {
  const sampleTickets = [
    {
      ticket_number: 'TICK-2026-1042',
      subject: 'Laptop mati mendadak saat render laporan bulanan',
      category: 'Hardware',
      priority: 'High',
      status: 'In Progress',
      department: 'Finance & Accounting',
      requester_name: 'Siti Rahmawati',
      requester_email: 'siti.rahma@perusahaan.co.id',
      requester_phone: '081234567890',
      location: 'Gedung A, Lt. 2 (Ruang Akuntansi)',
      description: 'Laptop Lenovo ThinkPad tiba-tiba mati total dan tercium bau agak panas. Lampu indikator charger tidak menyala saat dicolokkan ke stopkontak lain.',
      attachment: null,
      assigned_to: 'Rian Hidayat (Hardware Specialist)',
      resolution_notes: null,
      internal_notes: 'Kemungkinan adapter atau port power motherboard kendor. Sudah dipinjamkan laptop cadangan sementara.',
      created_at: '2026-11-15 09:15:00',
      updated_at: '2026-11-15 10:30:00'
    },
    {
      ticket_number: 'TICK-2026-1043',
      subject: 'Tidak bisa akses WiFi kantor di Ruang Rapat Utama',
      category: 'Jaringan & Internet',
      priority: 'Critical',
      status: 'Open',
      department: 'Direksi & Manajemen',
      requester_name: 'Bambang Wijaya',
      requester_email: 'bambang.w@perusahaan.co.id',
      requester_phone: '081198765432',
      location: 'Gedung B, Lt. 4 (Boardroom)',
      description: 'Semua peserta rapat direksi mendadak putus koneksi dari WiFi "CORP-INTERNAL". Mohon dibantu secepatnya karena sedang zoom dengan investor.',
      attachment: null,
      assigned_to: 'Dimas Pratama (Network & Sysadmin)',
      resolution_notes: null,
      internal_notes: 'AP UniFi di ruang rapat utama perlu direboot atau PoE injector bermasalah.',
      created_at: '2026-11-16 08:30:00',
      updated_at: '2026-11-16 08:30:00'
    },
    {
      ticket_number: 'TICK-2026-1039',
      subject: 'Printer Epson L3110 paper jam dan lampu tinta berkedip',
      category: 'Printer & Scanner',
      priority: 'Medium',
      status: 'Resolved',
      department: 'Human Resources (HRD)',
      requester_name: 'Anisa Melani',
      requester_email: 'anisa.m@perusahaan.co.id',
      requester_phone: '081377889900',
      location: 'Gedung A, Lt. 1 (HR Dept)',
      description: 'Kertas tersangkut di roller bagian dalam saat cetak kontrak kerja, sudah dicoba ditarik perlahan tapi lampu merah masih berkedip.',
      attachment: null,
      assigned_to: 'Budi Santoso (Desktop Support)',
      resolution_notes: 'Roller telah dibersihkan dari sisa robekan kertas kecil, sensor paper feed di-reset dan test print 5 lembar berjalan normal.',
      internal_notes: 'User diimbau untuk tidak memasukkan kertas yang bergelombang atau bekas staples.',
      created_at: '2026-11-14 13:20:00',
      updated_at: '2026-11-14 15:45:00',
      resolved_at: '2026-11-14 15:45:00'
    },
    {
      ticket_number: 'TICK-2026-1040',
      subject: 'Reset Password Akun SAP & Email Outlook',
      category: 'Akun & Hak Akses',
      priority: 'Low',
      status: 'Closed',
      department: 'Operasional & Logistik',
      requester_name: 'Dedi Kurniawan',
      requester_email: 'dedi.k@perusahaan.co.id',
      requester_phone: '085612345678',
      location: 'Gudang Cakung, Pos 2',
      description: 'Lupa password setelah cuti 1 minggu, akun terkunci karena salah 3x input pin.',
      attachment: null,
      assigned_to: 'Ahmad (IT Lead)',
      resolution_notes: 'Password Active Directory dan SAP berhasil direset ke default sementara, user telah diarahkan ganti password baru.',
      internal_notes: 'Sudah diverifikasi via telp ke atasan langsung pemohon.',
      created_at: '2026-11-13 10:00:00',
      updated_at: '2026-11-13 11:10:00',
      resolved_at: '2026-11-13 11:10:00'
    },
    {
      ticket_number: 'TICK-2026-1044',
      subject: 'Install Microsoft Excel formula add-in untuk tim Pajak',
      category: 'Software',
      priority: 'Medium',
      status: 'Open',
      department: 'Finance & Accounting',
      requester_name: 'Hendra Saputra',
      requester_email: 'hendra.s@perusahaan.co.id',
      requester_phone: '087812983471',
      location: 'Gedung A, Lt. 2 (Tax Division)',
      description: 'Butuh bantuan instalasi e-Faktur dan add-in e-SPT PPh 21 terbaru di PC workstation baru.',
      attachment: null,
      assigned_to: 'Belum Ditugaskan',
      resolution_notes: null,
      internal_notes: null,
      created_at: '2026-11-16 11:00:00',
      updated_at: '2026-11-16 11:00:00'
    }
  ];

  const insertTicket = db.prepare(`
    INSERT INTO tickets (
      ticket_number, subject, category, priority, status, department,
      requester_name, requester_email, requester_phone, location,
      description, attachment, assigned_to, resolution_notes, internal_notes,
      created_at, updated_at, resolved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertActivity = db.prepare(`
    INSERT INTO ticket_activities (
      ticket_id, author_name, author_role, action_type, message, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const t of sampleTickets) {
    const res = insertTicket.run(
      t.ticket_number, t.subject, t.category, t.priority, t.status, t.department,
      t.requester_name, t.requester_email, t.requester_phone, t.location,
      t.description, t.attachment, t.assigned_to, t.resolution_notes, t.internal_notes,
      t.created_at, t.updated_at, t.resolved_at || null
    );
    const ticketId = res.lastInsertRowid;

    insertActivity.run(
      ticketId, t.requester_name, 'user', 'created',
      `Tiket diajukan dengan prioritas ${t.priority} pada kategori ${t.category}.`,
      t.created_at
    );

    if (t.assigned_to && t.assigned_to !== 'Belum Ditugaskan') {
      insertActivity.run(
        ticketId, 'IT System', 'system', 'assignment',
        `Tiket ditugaskan ke ${t.assigned_to}`,
        t.created_at
      );
    }

    if (t.status === 'In Progress') {
      insertActivity.run(
        ticketId, t.assigned_to, 'admin', 'status_change',
        'Status diubah menjadi In Progress. Perangkat sedang dalam pemeriksaan awal.',
        t.updated_at
      );
    }

    if (t.status === 'Resolved' || t.status === 'Closed') {
      insertActivity.run(
        ticketId, t.assigned_to, 'admin', 'resolved',
        `Masalah selesai diatasi: ${t.resolution_notes}`,
        t.resolved_at || t.updated_at
      );
    }
  }
}

// Database helper functions
const dbService = {
  // ─── USER AUTH ─────────────────────────────────────────────────────────────
  getUserByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  },

  getUserById(id) {
    return db.prepare('SELECT id, username, full_name, email, department, phone, role FROM users WHERE id = ?').get(id);
  },

  getAllUsers() {
    return db.prepare('SELECT id, username, full_name, email, department, phone, role, created_at FROM users ORDER BY role DESC, full_name ASC').all();
  },

  // ─── TICKETS ───────────────────────────────────────────────────────────────
  getTickets(filters = {}) {
    let query = 'SELECT * FROM tickets WHERE 1=1';
    const params = [];

    if (filters.status && filters.status !== 'All') {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.priority && filters.priority !== 'All') {
      query += ' AND priority = ?';
      params.push(filters.priority);
    }
    if (filters.category && filters.category !== 'All') {
      query += ' AND category = ?';
      params.push(filters.category);
    }
    if (filters.department && filters.department !== 'All') {
      query += ' AND department = ?';
      params.push(filters.department);
    }
    if (filters.requester_email) {
      query += ' AND LOWER(requester_email) = LOWER(?)';
      params.push(filters.requester_email);
    }
    if (filters.requester_name) {
      query += ' AND LOWER(requester_name) LIKE LOWER(?)';
      params.push(`%${filters.requester_name}%`);
    }
    if (filters.search) {
      query += ` AND (
        LOWER(ticket_number) LIKE LOWER(?) OR
        LOWER(subject) LIKE LOWER(?) OR
        LOWER(requester_name) LIKE LOWER(?) OR
        LOWER(description) LIKE LOWER(?) OR
        LOWER(department) LIKE LOWER(?)
      )`;
      const s = `%${filters.search}%`;
      params.push(s, s, s, s, s);
    }

    query += ' ORDER BY id DESC';
    return db.prepare(query).all(...params);
  },

  getTicketById(id) {
    return db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
  },

  getTicketByNumber(ticketNumber) {
    return db.prepare('SELECT * FROM tickets WHERE ticket_number = ?').get(ticketNumber);
  },

  createTicket(data) {
    const ticketNumber = generateTicketNumber();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const stmt = db.prepare(`
      INSERT INTO tickets (
        ticket_number, subject, category, priority, status, department,
        requester_name, requester_email, requester_phone, location,
        description, attachment, assigned_to, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      ticketNumber, data.subject, data.category,
      data.priority || 'Medium', data.status || 'Open', data.department,
      data.requester_name, data.requester_email || '',
      data.requester_phone || '', data.location || '',
      data.description, data.attachment || null,
      data.assigned_to || 'Belum Ditugaskan', now, now
    );

    const ticketId = result.lastInsertRowid;

    this.addActivity({
      ticket_id: ticketId,
      author_name: data.requester_name,
      author_role: data.author_role || 'user',
      action_type: 'created',
      message: `Tiket baru dibuat dengan kategori [${data.category}] dan prioritas [${data.priority || 'Medium'}].`
    });

    return this.getTicketById(ticketId);
  },

  updateTicket(id, data, updatedBy = 'IT Support') {
    const existing = this.getTicketById(id);
    if (!existing) return null;

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    let resolvedAt = existing.resolved_at;

    if (data.status === 'Resolved' && existing.status !== 'Resolved') {
      resolvedAt = now;
    } else if (data.status !== 'Resolved' && data.status !== 'Closed') {
      resolvedAt = null;
    }

    db.prepare(`
      UPDATE tickets SET
        subject = ?, category = ?, priority = ?, status = ?,
        department = ?, assigned_to = ?, resolution_notes = ?,
        internal_notes = ?, updated_at = ?, resolved_at = ?
      WHERE id = ?
    `).run(
      data.subject !== undefined ? data.subject : existing.subject,
      data.category !== undefined ? data.category : existing.category,
      data.priority !== undefined ? data.priority : existing.priority,
      data.status !== undefined ? data.status : existing.status,
      data.department !== undefined ? data.department : existing.department,
      data.assigned_to !== undefined ? data.assigned_to : existing.assigned_to,
      data.resolution_notes !== undefined ? data.resolution_notes : existing.resolution_notes,
      data.internal_notes !== undefined ? data.internal_notes : existing.internal_notes,
      now, resolvedAt, id
    );

    if (data.status && data.status !== existing.status) {
      this.addActivity({
        ticket_id: id, author_name: updatedBy, author_role: 'admin',
        action_type: 'status_change',
        message: `Status diubah dari "${existing.status}" menjadi "${data.status}".`
      });
    }
    if (data.assigned_to && data.assigned_to !== existing.assigned_to) {
      this.addActivity({
        ticket_id: id, author_name: updatedBy, author_role: 'admin',
        action_type: 'assignment',
        message: `Teknisi penanggung jawab diubah menjadi "${data.assigned_to}".`
      });
    }
    if (data.priority && data.priority !== existing.priority) {
      this.addActivity({
        ticket_id: id, author_name: updatedBy, author_role: 'admin',
        action_type: 'priority_change',
        message: `Prioritas diubah dari "${existing.priority}" menjadi "${data.priority}".`
      });
    }
    if (data.resolution_notes && data.resolution_notes !== existing.resolution_notes) {
      this.addActivity({
        ticket_id: id, author_name: updatedBy, author_role: 'admin',
        action_type: 'resolved',
        message: `Solusi/Penyelesaian ditambahkan: ${data.resolution_notes}`
      });
    }

    return this.getTicketById(id);
  },

  deleteTicket(id) {
    const res = db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
    return res.changes > 0;
  },

  addActivity(data) {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    return db.prepare(`
      INSERT INTO ticket_activities (ticket_id, author_name, author_role, action_type, message, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      data.ticket_id, data.author_name, data.author_role || 'user',
      data.action_type || 'public_comment', data.message, now
    );
  },

  getTicketActivities(ticketId) {
    return db.prepare(`
      SELECT * FROM ticket_activities WHERE ticket_id = ? ORDER BY id ASC
    `).all(ticketId);
  },

  getStats() {
    const total = db.prepare('SELECT COUNT(*) as c FROM tickets').get().c;
    const open = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE status='Open'").get().c;
    const inProgress = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE status='In Progress'").get().c;
    const resolved = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE status='Resolved'").get().c;
    const closed = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE status='Closed'").get().c;
    const critical = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE priority='Critical' AND status NOT IN ('Resolved','Closed')").get().c;
    const resolutionRate = total > 0 ? Math.round(((resolved + closed) / total) * 100) : 0;

    const categoryStats = db.prepare("SELECT category, COUNT(*) as count FROM tickets GROUP BY category ORDER BY count DESC").all();
    const priorityStats = db.prepare("SELECT priority, COUNT(*) as count FROM tickets GROUP BY priority").all();
    const departmentStats = db.prepare("SELECT department, COUNT(*) as count FROM tickets GROUP BY department ORDER BY count DESC LIMIT 6").all();

    return {
      total, open, in_progress: inProgress, resolved, closed,
      critical_active: critical, resolution_rate: resolutionRate,
      category_breakdown: categoryStats,
      priority_breakdown: priorityStats,
      department_breakdown: departmentStats
    };
  },

  resetAndSeed() {
    db.exec(`DELETE FROM ticket_activities; DELETE FROM tickets;`);
    seedSampleData();
  }
};

initDb();

module.exports = { db, dbService };
