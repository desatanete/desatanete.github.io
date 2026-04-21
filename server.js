const express = require('express');
const path = require('path');
const fs = require('fs');
const basicAuth = require('express-basic-auth');
const dayjs = require('dayjs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Views
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static: existing assets and public files
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Data paths
const newsFile = path.join(__dirname, 'data', 'news.json');
const complaintsFile = path.join(__dirname, 'data', 'complaints.json');

function ensureDataFiles() {
  if (!fs.existsSync(newsFile)) fs.writeFileSync(newsFile, '[]', 'utf-8');
  if (!fs.existsSync(complaintsFile)) fs.writeFileSync(complaintsFile, '[]', 'utf-8');
}
ensureDataFiles();

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Routes
app.get('/', (req, res) => {
  const news = readJson(newsFile)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6);
  res.render('index', { news });
});

// News list page
app.get('/berita', (req, res) => {
  const news = readJson(newsFile).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.render('news', { news });
});

// News detail
app.get('/berita/:slug', (req, res) => {
  const news = readJson(newsFile);
  const item = news.find(n => n.slug === req.params.slug);
  if (!item) return res.status(404).render('404');
  res.render('news-detail', { item });
});

// Complaint submission (GET form + POST handler)
app.get('/pengaduan', (req, res) => {
  res.render('complaint-form');
});

app.post('/pengaduan', (req, res) => {
  const { nama, kontak, kategori, isi } = req.body;
  if (!nama || !isi) {
    return res.status(400).render('complaint-form', { error: 'Nama dan isi pengaduan wajib diisi.' });
  }
  const complaints = readJson(complaintsFile);
  complaints.push({
    id: String(Date.now()),
    nama,
    kontak: kontak || '',
    kategori: kategori || 'Umum',
    isi,
    status: 'baru',
    createdAt: dayjs().toISOString()
  });
  writeJson(complaintsFile, complaints);
  res.render('complaint-success');
});

// Basic admin
const adminUsers = {};
if (process.env.ADMIN_USER && process.env.ADMIN_PASS) {
  adminUsers[process.env.ADMIN_USER] = process.env.ADMIN_PASS;
} else {
  adminUsers['admin'] = 'admin123';
}

app.use('/admin', basicAuth({ users: adminUsers, challenge: true }));

app.get('/admin', (req, res) => {
  const news = readJson(newsFile).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const complaints = readJson(complaintsFile).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.render('admin/dashboard', { news, complaints });
});

// Admin create news
app.post('/admin/berita', (req, res) => {
  const { judul, isi, gambar } = req.body;
  if (!judul || !isi) return res.status(400).send('Judul dan isi wajib.');
  const news = readJson(newsFile);
  const slug = judul
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 80);
  news.push({
    id: String(Date.now()),
    judul,
    isi,
    gambar: gambar || '',
    slug,
    createdAt: dayjs().toISOString()
  });
  writeJson(newsFile, news);
  res.redirect('/admin');
});

// Admin update complaint status
app.post('/admin/pengaduan/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const complaints = readJson(complaintsFile);
  const idx = complaints.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).send('Tidak ditemukan');
  complaints[idx].status = status || complaints[idx].status;
  complaints[idx].updatedAt = dayjs().toISOString();
  writeJson(complaintsFile, complaints);
  res.redirect('/admin');
});

// Fallback 404
app.use((req, res) => {
  res.status(404).render('404');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});