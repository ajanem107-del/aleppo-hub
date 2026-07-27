const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== رابط قاعدة البيانات =====
const MONGODB_URI = 'mongodb+srv://ajanem107_db_user:a12s12d12@cluster0.za1bebp.mongodb.net/?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ تم الاتصال بـ MongoDB بنجاح'))
  .catch(err => console.error('❌ فشل الاتصال:', err));

// ===== إعداد رفع الصور =====
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// ===== Middleware =====
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'aleppo_industrial_secret_key_2026',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// ============================================================
// دالة التحقق من المصادقة
// ============================================================
function requireAuth(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    const redirectUrl = req.originalUrl;
    res.redirect(`/login.html?redirect=${encodeURIComponent(redirectUrl)}`);
}

// ============================================================
// نماذج البيانات (Schemas)
// ============================================================

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['industrial', 'worker', 'provider', 'admin'], default: 'worker' },
  phone: String,
  company_name: String,
  created_at: { type: Date, default: Date.now }
});

const productSchema = new mongoose.Schema({
  industrial_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  description: String,
  price: Number,
  image_url: String,
  is_active: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

const jobSchema = new mongoose.Schema({
  industrial_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  requirements: String,
  salary: String,
  worker_type: { type: String, default: '' },
  is_active: { type: Boolean, default: true },
  is_approved: { type: Boolean, default: false }, // ✅ يحتاج موافقة الأدمن
  created_at: { type: Date, default: Date.now }
});

const applicationSchema = new mongoose.Schema({
  job_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  worker_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: String,
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  is_approved: { type: Boolean, default: false }, // ✅ يحتاج موافقة الأدمن
  applied_at: { type: Date, default: Date.now }
});

const serviceSchema = new mongoose.Schema({
  provider_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  price_range: String,
  contact_phone: String,
  image_url: String,
  is_active: { type: Boolean, default: true },
  is_approved: { type: Boolean, default: false }, // ✅ يحتاج موافقة الأدمن
  created_at: { type: Date, default: Date.now }
});

const serviceRequestSchema = new mongoose.Schema({
  service_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  requester_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requester_role: String,
  message: String,
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  is_approved: { type: Boolean, default: false }, // ✅ يحتاج موافقة الأدمن
  created_at: { type: Date, default: Date.now }
});

const externalAdSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  image_url: String,
  link_url: String,
  advertiser_name: String,
  advertiser_phone: String,
  advertiser_email: String,
  is_active: { type: Boolean, default: false },
  is_paid: { type: Boolean, default: false },
  ad_fee: { type: Number, default: 0 },
  is_approved: { type: Boolean, default: false }, // ✅ يحتاج موافقة الأدمن
  created_at: { type: Date, default: Date.now },
  approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const settingSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: { type: mongoose.Schema.Types.Mixed }
});

const User = mongoose.model('User', userSchema);
const Product = mongoose.model('Product', productSchema);
const Job = mongoose.model('Job', jobSchema);
const Application = mongoose.model('Application', applicationSchema);
const Service = mongoose.model('Service', serviceSchema);
const ServiceRequest = mongoose.model('ServiceRequest', serviceRequestSchema);
const ExternalAd = mongoose.model('ExternalAd', externalAdSchema);
const Setting = mongoose.model('Setting', settingSchema);

// ============================================================
// دوال المصادقة
// ============================================================

function isAuthenticated(req, res, next) {
  if (req.session.userId) return next();
  res.status(401).json({ error: 'الرجاء تسجيل الدخول أولاً' });
}

function isRole(role) {
  return async (req, res, next) => {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ error: 'مستخدم غير موجود' });
    if (user.role !== role && user.role !== 'admin') {
      return res.status(403).json({ error: 'غير مصرح لك بهذه العملية' });
    }
    next();
  };
}

// ============================================================
// إنشاء مستخدم مسؤول افتراضي
// ============================================================
(async function createAdmin() {
  try {
    const existing = await User.findOne({ email: 'admin@aleppo.com' });
    if (!existing) {
      const hashed = await bcrypt.hash('admin123', 10);
      const admin = new User({
        name: 'المدير العام',
        email: 'admin@aleppo.com',
        password: hashed,
        role: 'admin',
        phone: '000000000'
      });
      await admin.save();
      console.log('✅ تم إنشاء حساب المسؤول: admin@aleppo.com / admin123');
    }
  } catch(err) { console.error('خطأ في إنشاء المسؤول:', err); }
})();

// ============================================================
// واجهات المصادقة
// ============================================================

app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, role, phone, company_name } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'البريد الإلكتروني مستخدم مسبقاً' });
    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashed, role, phone, company_name });
    await user.save();
    res.status(201).json({ message: '✅ تم إنشاء الحساب بنجاح', userId: user._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'بريد إلكتروني غير صحيح' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'كلمة مرور غير صحيحة' });
    req.session.userId = user._id;
    
    // التوجيه بناءً على الدور
    let redirectUrl = '/';
    if (user.role === 'admin') {
      redirectUrl = '/admin-dashboard.html';
    } else if (user.role === 'industrial') {
      redirectUrl = '/industrial-panel.html';
    } else if (user.role === 'worker') {
      redirectUrl = '/worker-panel.html';
    } else if (user.role === 'provider') {
      redirectUrl = '/provider-panel.html';
    }
    
    res.json({ 
      message: '✅ تم تسجيل الدخول', 
      user: { id: user._id, name: user.name, role: user.role },
      redirect: redirectUrl
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: '✅ تم تسجيل الخروج' });
});

app.get('/api/me', async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).json({ error: 'غير مسجل' });
    const user = await User.findById(req.session.userId).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// حماية جميع صفحات المنصة
// ============================================================
app.get('/industrial-panel.html', requireAuth);
app.get('/worker-panel.html', requireAuth);
app.get('/provider-panel.html', requireAuth);
app.get('/admin-dashboard.html', requireAuth);

// ============================================================
// واجهات الأدمن للموافقة على الطلبات
// ============================================================

// جلب جميع الطلبات المعلقة (للأدمن)
app.get('/api/admin/pending-requests', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const pendingJobs = await Job.find({ is_approved: false }).populate('industrial_id', 'name company_name');
    const pendingApplications = await Application.find({ is_approved: false }).populate('worker_id', 'name').populate('job_id', 'title');
    const pendingServices = await Service.find({ is_approved: false }).populate('provider_id', 'name');
    const pendingServiceRequests = await ServiceRequest.find({ is_approved: false }).populate('requester_id', 'name').populate('service_id', 'title');
    const pendingAds = await ExternalAd.find({ is_approved: false });
    
    res.json({
      jobs: pendingJobs,
      applications: pendingApplications,
      services: pendingServices,
      serviceRequests: pendingServiceRequests,
      ads: pendingAds
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// الموافقة على طلب معين
app.put('/api/admin/approve/:type/:id', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const { type, id } = req.params;
    let model;
    switch(type) {
      case 'job': model = Job; break;
      case 'application': model = Application; break;
      case 'service': model = Service; break;
      case 'serviceRequest': model = ServiceRequest; break;
      case 'ad': model = ExternalAd; break;
      default: return res.status(400).json({ error: 'نوع غير صالح' });
    }
    const item = await model.findById(id);
    if (!item) return res.status(404).json({ error: 'غير موجود' });
    item.is_approved = true;
    if (type === 'job' || type === 'service' || type === 'ad') {
      item.is_active = true;
    }
    await item.save();
    res.json({ message: '✅ تمت الموافقة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// رفض طلب معين (حذفه)
app.delete('/api/admin/reject/:type/:id', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const { type, id } = req.params;
    let model;
    switch(type) {
      case 'job': model = Job; break;
      case 'application': model = Application; break;
      case 'service': model = Service; break;
      case 'serviceRequest': model = ServiceRequest; break;
      case 'ad': model = ExternalAd; break;
      default: return res.status(400).json({ error: 'نوع غير صالح' });
    }
    await model.findByIdAndDelete(id);
    res.json({ message: '✅ تم رفض الطلب وحذفه' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// باقي واجهات API (المنتجات، الوظائف، الخدمات، الإعلانات)
// ============================================================

// ... (يتم الاحتفاظ ببقية الواجهات كما هي مع إضافة is_approved في الاستعلامات)

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ خادم Aleppo Hub يعمل على http://localhost:${PORT}`);
  console.log('👑 حساب المسؤول: admin@aleppo.com / admin123');
});