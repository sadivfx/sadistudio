require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --------------- MIDDLEWARE ---------------
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts/styles
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));
app.use(express.static(path.join(__dirname, 'public')));

// Genel rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla istek. Lütfen daha sonra tekrar deneyin.' }
});
app.use('/api', limiter);

// Login için sıkı rate limiter
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: { error: 'Çok fazla başarısız giriş. 15 dakika sonra tekrar deneyin.' }
});
app.use('/api/auth/login', loginLimiter);

// --------------- MONGODB BAĞLANTISI ---------------
mongoose.connect(process.env.MONGODB_URI, {
  serverApi: {
    version: '1',
    strict: true,
    deprecationErrors: true,
  }
})
  .then(() => console.log('✅ MongoDB bağlantısı başarılı'))
  .catch(err => {
    console.error('❌ MongoDB bağlantı hatası:', err.message);
    process.exit(1);
  });

// --------------- MODELLER ---------------
const categorySchema = new mongoose.Schema({
  key: {
    type: String,
    required: [true, 'Anahtar zorunludur'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9-]+$/, 'Geçersiz anahtar formatı']
  },
  label: { type: String, required: [true, 'Etiket zorunludur'], trim: true },
  short: {
    type: String,
    required: [true, 'Kısa kod zorunludur'],
    uppercase: true,
    trim: true,
    maxlength: [5, 'En fazla 5 karakter']
  }
}, { timestamps: true });

const assetSchema = new mongoose.Schema({
  cat: { type: String, required: true, lowercase: true, trim: true, index: true },
  name: { type: String, required: [true, 'İsim zorunludur'], trim: true },
  comp: { type: String, required: [true, 'Comp adı zorunludur'], trim: true },
  dur: {
    type: String,
    required: [true, 'Süre zorunludur'],
    trim: true,
    match: [/^\d{2}:\d{2}:\d{2}:\d{2}$/, 'Format: 00:00:00:00']
  },
  fps: { type: Number, default: 30, min: 1, max: 120 },
  free: { type: Boolean, default: false },
  price: { type: String, default: '$0 · Free' }
}, { timestamps: true });

const adminSchema = new mongoose.Schema({
  username: { type: String, default: 'admin' },
  passwordHash: { type: String, required: true }
});

const Category = mongoose.model('Category', categorySchema);
const Asset = mongoose.model('Asset', assetSchema);
const Admin = mongoose.model('Admin', adminSchema);

// --------------- DEFAULT VERİLER ---------------
async function seedDefaults() {
  // Admin
  const adminExists = await Admin.findOne();
  if (!adminExists) {
    const hash = bcrypt.hashSync(process.env.ADMIN_DEFAULT_PASSWORD || 'sadi2024', 10);
    await Admin.create({ username: 'admin', passwordHash: hash });
    console.log('🔑 Varsayılan admin oluşturuldu.');
  }

  // Kategoriler
  const catCount = await Category.countDocuments();
  if (catCount === 0) {
    await Category.insertMany([
      { key: 'text', label: 'Text Effects', short: 'TXT' },
      { key: 'transitions', label: 'Transitions', short: 'TRN' },
      { key: 'motion', label: 'Motion Graphics', short: 'MOG' },
      { key: 'color', label: 'Color Presets', short: 'CLR' }
    ]);
    console.log('📁 Varsayılan kategoriler oluşturuldu.');
  }

  // Asset'ler
  const assetCount = await Asset.countDocuments();
  if (assetCount === 0) {
    await Asset.insertMany([
      { cat: 'text', name: 'Kinetic Type — Reveal 04', comp: 'Comp_TextReveal_04', dur: '00:00:02:14', fps: 30, free: true, price: '$0 · Free' },
      { cat: 'text', name: 'Glitch Slam — Bold Titles', comp: 'Comp_GlitchSlam_01', dur: '00:00:01:22', fps: 60, free: false, price: '$14' },
      { cat: 'text', name: 'Handwritten Trace-On', comp: 'Comp_HandTrace_02', dur: '00:00:03:08', fps: 30, free: false, price: '$9' },
      { cat: 'transitions', name: 'Whip Pan — Directional 6-Pack', comp: 'Comp_WhipPan_06', dur: '00:00:00:18', fps: 60, free: false, price: '$19' },
      { cat: 'transitions', name: 'Film Burn Wipe', comp: 'Comp_FilmBurn_03', dur: '00:00:00:24', fps: 30, free: true, price: '$0 · Free' },
      { cat: 'transitions', name: 'Shutter Blocks — Grid Wipe', comp: 'Comp_ShutterGrid_02', dur: '00:00:01:04', fps: 30, free: false, price: '$12' },
      { cat: 'motion', name: 'Orbit Loader — Infinite Loop', comp: 'Comp_OrbitLoad_01', dur: '00:00:02:00', fps: 30, free: false, price: '$16' },
      { cat: 'motion', name: 'Isometric Grid Builder', comp: 'Comp_IsoGrid_05', dur: '00:00:04:12', fps: 30, free: false, price: '$22' },
      { cat: 'motion', name: 'Lower-Third — Signal Bars', comp: 'Comp_LowerThird_09', dur: '00:00:01:16', fps: 30, free: true, price: '$0 · Free' },
      { cat: 'color', name: 'Teal & Orange — Cinematic', comp: 'Comp_LUT_TealOrange', dur: '00:00:00:30', fps: 24, free: false, price: '$7' },
      { cat: 'color', name: 'Faded Film — Bleach Bypass', comp: 'Comp_LUT_BleachBypass', dur: '00:00:00:30', fps: 24, free: false, price: '$7' },
      { cat: 'color', name: 'Clean Broadcast — Rec.709 Match', comp: 'Comp_LUT_Broadcast', dur: '00:00:00:30', fps: 24, free: true, price: '$0 · Free' }
    ]);
    console.log('🎬 Varsayılan assetler oluşturuldu.');
  }
}

// --------------- JWT MIDDLEWARE ---------------
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Yetkisiz erişim.' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Geçersiz token.' });
    req.user = user;
    next();
  });
}

// ====================== API ROUTES ======================

// Auth
app.post('/api/auth/login', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Şifre gerekli.' });
  const admin = await Admin.findOne();
  if (!admin) return res.status(500).json({ error: 'Admin kaydı bulunamadı.' });
  if (bcrypt.compareSync(password, admin.passwordHash)) {
    const token = jwt.sign({ username: admin.username }, process.env.JWT_SECRET, { expiresIn: '8h' });
    return res.json({ token });
  }
  res.status(401).json({ error: 'Hatalı şifre.' });
});

app.put('/api/auth/password', authenticateToken, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 3) return res.status(400).json({ error: 'Şifre en az 3 karakter olmalı.' });
  const admin = await Admin.findOne();
  admin.passwordHash = bcrypt.hashSync(newPassword, 10);
  await admin.save();
  res.json({ message: 'Şifre güncellendi.' });
});

// Kategoriler
app.get('/api/categories', async (req, res) => {
  const categories = await Category.find().lean();
  const result = {};
  categories.forEach(c => { result[c.key] = { label: c.label, short: c.short }; });
  res.json(result);
});

app.post('/api/categories', authenticateToken, async (req, res) => {
  const { key, label, short } = req.body;
  if (!key || !label || !short) return res.status(400).json({ error: 'Tüm alanlar zorunlu.' });
  try {
    const cat = await Category.create({ key, label, short });
    res.status(201).json({ [cat.key]: { label: cat.label, short: cat.short } });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'Bu anahtar zaten kullanılıyor.' });
    res.status(500).json({ error: 'Kategori eklenemedi.' });
  }
});

app.put('/api/categories/:key', authenticateToken, async (req, res) => {
  const { key } = req.params;
  const { label, short } = req.body;
  const cat = await Category.findOne({ key });
  if (!cat) return res.status(404).json({ error: 'Kategori bulunamadı.' });
  if (label) cat.label = label;
  if (short) cat.short = short;
  await cat.save();
  res.json({ [cat.key]: { label: cat.label, short: cat.short } });
});

app.delete('/api/categories/:key', authenticateToken, async (req, res) => {
  const { key } = req.params;
  const cat = await Category.findOne({ key });
  if (!cat) return res.status(404).json({ error: 'Kategori bulunamadı.' });
  const assetCount = await Asset.countDocuments({ cat: key });
  if (assetCount > 0) return res.status(400).json({ error: 'Bu kategoriye ait varlıklar var.' });
  await Category.deleteOne({ key });
  res.json({ message: 'Kategori silindi.' });
});

// Asset'ler
app.get('/api/assets', async (req, res) => {
  const { category, search, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (category && category !== 'all') filter.cat = category;
  if (search) {
    const regex = new RegExp(search, 'i');
    filter.$or = [{ name: regex }, { comp: regex }];
  }
  const total = await Asset.countDocuments(filter);
  const assets = await Asset.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .lean();
  res.json({ total, page: parseInt(page), limit: parseInt(limit), assets });
});

app.get('/api/assets/:id', async (req, res) => {
  const asset = await Asset.findById(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset bulunamadı.' });
  res.json(asset);
});

app.post('/api/assets', authenticateToken, async (req, res) => {
  const { cat, name, comp, dur, fps, free, price } = req.body;
  if (!cat || !name || !comp || !dur) return res.status(400).json({ error: 'Zorunlu alanlar eksik.' });
  try {
    const asset = await Asset.create({
      cat, name, comp, dur,
      fps: parseInt(fps) || 30,
      free: !!free,
      price: free ? '$0 · Free' : `$${parseInt(price) || 0}`
    });
    res.status(201).json(asset);
  } catch (err) {
    res.status(500).json({ error: 'Asset eklenemedi.' });
  }
});

app.put('/api/assets/:id', authenticateToken, async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset bulunamadı.' });
    const { cat, name, comp, dur, fps, free, price } = req.body;
    if (cat) asset.cat = cat;
    if (name) asset.name = name;
    if (comp) asset.comp = comp;
    if (dur) asset.dur = dur;
    if (fps) asset.fps = parseInt(fps);
    if (typeof free !== 'undefined') {
      asset.free = !!free;
      asset.price = free ? '$0 · Free' : `$${parseInt(price) || 0}`;
    } else if (price !== undefined) {
      asset.price = asset.free ? '$0 · Free' : `$${parseInt(price)}`;
    }
    await asset.save();
    res.json(asset);
  } catch (err) {
    res.status(500).json({ error: 'Asset güncellenemedi.' });
  }
});

app.delete('/api/assets/:id', authenticateToken, async (req, res) => {
  const asset = await Asset.findByIdAndDelete(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset bulunamadı.' });
  res.json({ message: 'Asset silindi.' });
});

// Frontend fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --------------- START ---------------
(async () => {
  await seedDefaults();
  app.listen(PORT, () => {
    console.log(`🚀 Sunucu http://localhost:${PORT} adresinde çalışıyor.`);
  });
})();