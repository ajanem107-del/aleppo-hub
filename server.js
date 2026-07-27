const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const MONGODB_URI = 'mongodb+srv://ajanem107_db_user:a12s12d12@cluster0.za1bebp.mongodb.net/?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ تم الاتصال بـ MongoDB بنجاح'))
  .catch(err => console.error('❌ فشل الاتصال:', err));

// إعداد رفع الملفات
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = 'public/uploads/';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('نوع الملف غير مدعوم'), false);
    }
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } });

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(session({
  secret: 'aleppo_industrial_secret_key_2026',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// ============================================================
// دوال المصادقة والحماية
// ============================================================
function requireAuth(req, res, next) {
    if (req.session.userId) {
        return next();
    }
    const redirectUrl = req.originalUrl;
    res.redirect(`/login.html?redirect=${encodeURIComponent(redirectUrl)}`);
}

function isAuthenticated(req, res, next) {
    if (req.session.userId) return next();
    res.status(401).json({ error: 'الرجاء تسجيل الدخول أولاً' });
}

function isRole(role) {
    return async (req, res, next) => {
        try {
            const user = await User.findById(req.session.userId);
            if (!user) return res.status(401).json({ error: 'مستخدم غير موجود' });
            if (user.role !== role && user.role !== 'admin') {
                return res.status(403).json({ error: 'غير مصرح لك بهذه العملية' });
            }
            next();
        } catch(err) {
            res.status(500).json({ error: err.message });
        }
    };
}

// حماية جميع اللوحات
app.get('/industrial-panel.html', requireAuth);
app.get('/worker-panel.html', requireAuth);
app.get('/provider-panel.html', requireAuth);
app.get('/ads-panel.html', requireAuth);
app.get('/admin-dashboard.html', requireAuth);

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
  file_url: { type: String, default: '' },
  file_type: { type: String, enum: ['image', 'video', ''], default: '' },
  is_active: { type: Boolean, default: false },
  is_approved: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

const jobSchema = new mongoose.Schema({
  industrial_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  requirements: String,
  salary: String,
  worker_type: { type: String, default: '' },
  file_url: { type: String, default: '' },
  file_type: { type: String, enum: ['image', 'video', ''], default: '' },
  is_active: { type: Boolean, default: false },
  is_approved: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

const applicationSchema = new mongoose.Schema({
  job_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  worker_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: String,
  file_url: { type: String, default: '' },
  file_type: { type: String, enum: ['image', 'video', 'pdf', ''], default: '' },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  is_approved: { type: Boolean, default: false },
  applied_at: { type: Date, default: Date.now }
});

const serviceSchema = new mongoose.Schema({
  provider_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  price_range: String,
  contact_phone: String,
  file_url: { type: String, default: '' },
  file_type: { type: String, enum: ['image', 'video', ''], default: '' },
  is_active: { type: Boolean, default: false },
  is_approved: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

const serviceRequestSchema = new mongoose.Schema({
  service_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  requester_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requester_role: String,
  message: String,
  file_url: { type: String, default: '' },
  file_type: { type: String, enum: ['image', 'video', ''], default: '' },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  is_approved: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

const externalAdSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  file_url: { type: String, default: '' },
  file_type: { type: String, enum: ['image', 'video', ''], default: '' },
  link_url: String,
  advertiser_name: { type: String, required: true },
  advertiser_phone: String,
  advertiser_email: String,
  payment_code: { type: String, default: '' },
  payment_status: { type: String, enum: ['pending', 'paid', 'confirmed'], default: 'pending' },
  is_active: { type: Boolean, default: false },
  is_approved: { type: Boolean, default: false },
  ad_fee: { type: Number, default: 0 },
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
    let redirectUrl = '/';
    if (user.role === 'admin') redirectUrl = '/admin-dashboard.html';
    else if (user.role === 'industrial') redirectUrl = '/industrial-panel.html';
    else if (user.role === 'worker') redirectUrl = '/worker-panel.html';
    else if (user.role === 'provider') redirectUrl = '/provider-panel.html';
    res.json({ message: '✅ تم تسجيل الدخول', user: { id: user._id, name: user.name, role: user.role }, redirect: redirectUrl });
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
// واجهات المنتجات (مع تصحيح الأخطاء)
// ============================================================
app.get('/api/my-products', isAuthenticated, isRole('industrial'), async (req, res) => {
  try {
    const products = await Product.find({ industrial_id: req.session.userId });
    res.json(products);
  } catch (err) {
    console.error('خطأ في جلب المنتجات:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', isAuthenticated, isRole('industrial'), upload.single('file'), async (req, res) => {
  try {
    const { name, description, price } = req.body;
    const file_url = req.file ? `/uploads/${req.file.filename}` : '';
    const file_type = req.file ? (req.file.mimetype.startsWith('video') ? 'video' : 'image') : '';
    const product = new Product({
      industrial_id: req.session.userId,
      name, description, price,
      file_url, file_type,
      is_active: false,
      is_approved: false
    });
    await product.save();
    res.status(201).json({ message: '✅ تم إضافة المنتج، ينتظر موافقة الإدارة', product });
  } catch (err) {
    console.error('خطأ في إضافة المنتج:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// واجهات الوظائف (مع تصحيح الأخطاء)
// ============================================================
app.get('/api/my-jobs', isAuthenticated, isRole('industrial'), async (req, res) => {
  try {
    const jobs = await Job.find({ industrial_id: req.session.userId });
    res.json(jobs);
  } catch (err) {
    console.error('خطأ في جلب الوظائف:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/jobs', isAuthenticated, isRole('industrial'), upload.single('file'), async (req, res) => {
  try {
    const { title, description, requirements, salary, worker_type } = req.body;
    const file_url = req.file ? `/uploads/${req.file.filename}` : '';
    const file_type = req.file ? (req.file.mimetype.startsWith('video') ? 'video' : 'image') : '';
    const job = new Job({
      industrial_id: req.session.userId,
      title, description, requirements, salary, worker_type,
      file_url, file_type,
      is_active: false,
      is_approved: false
    });
    await job.save();
    res.status(201).json({ message: '✅ تم نشر الوظيفة، تنتظر موافقة الإدارة', job });
  } catch (err) {
    console.error('خطأ في نشر الوظيفة:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// باقي الواجهات (مختصرة)
// ============================================================
app.get('/api/industrial/applications', isAuthenticated, isRole('industrial'), async (req, res) => {
  try {
    const jobs = await Job.find({ industrial_id: req.session.userId });
    const jobIds = jobs.map(j => j._id);
    const applications = await Application.find({ job_id: { $in: jobIds } })
      .populate('worker_id', 'name phone email')
      .populate('job_id', 'title worker_type');
    res.json(applications);
  } catch (err) {
    console.error('خطأ في جلب طلبات التوظيف:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/application/:id', isAuthenticated, isRole('industrial'), async (req, res) => {
  try {
    const { status } = req.body;
    const application = await Application.findById(req.params.id).populate('job_id');
    if (!application) return res.status(404).json({ error: 'طلب غير موجود' });
    if (application.job_id.industrial_id.toString() !== req.session.userId) {
      return res.status(403).json({ error: 'ليس لديك صلاحية' });
    }
    application.status = status;
    await application.save();
    res.json({ message: `✅ تم تحديث الحالة إلى ${status}`, application });
  } catch (err) {
    console.error('خطأ في تحديث الطلب:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// واجهات الإعلانات الممولة (للمسؤول)
// ============================================================
app.post('/api/admin/external-ad', isAuthenticated, isRole('admin'), upload.single('file'), async (req, res) => {
  try {
    const { title, description, link_url, advertiser_name, advertiser_phone, advertiser_email } = req.body;
    const file_url = req.file ? `/uploads/${req.file.filename}` : '';
    const file_type = req.file ? (req.file.mimetype.startsWith('video') ? 'video' : 'image') : '';
    const fee = await Setting.findOne({ key: 'ad_fee' }) || { value: 10 };
    const payment_code = 'PAY-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const ad = new ExternalAd({
      title, description, file_url, file_type, link_url,
      advertiser_name, advertiser_phone, advertiser_email,
      ad_fee: fee.value,
      payment_code,
      payment_status: 'pending',
      is_active: false,
      is_approved: false,
      approved_by: req.session.userId
    });
    await ad.save();
    res.status(201).json({ 
      message: `✅ تم إضافة الإعلان. كود الدفع: ${payment_code} - المبلغ: ${fee.value}$`,
      ad,
      payment_code
    });
  } catch (err) {
    console.error('خطأ في إضافة الإعلان:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/confirm-payment/:adId', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const { payment_code } = req.body;
    const ad = await ExternalAd.findById(req.params.adId);
    if (!ad) return res.status(404).json({ error: 'إعلان غير موجود' });
    if (ad.payment_code !== payment_code) {
      return res.status(400).json({ error: 'كود الدفع غير صحيح' });
    }
    ad.payment_status = 'confirmed';
    ad.is_paid = true;
    ad.is_active = true;
    ad.is_approved = true;
    await ad.save();
    res.json({ message: '✅ تم تأكيد الدفع ونشر الإعلان' });
  } catch (err) {
    console.error('خطأ في تأكيد الدفع:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/external-ads', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const ads = await ExternalAd.find().sort({ created_at: -1 });
    res.json(ads);
  } catch (err) {
    console.error('خطأ في جلب الإعلانات:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/external-ad/:id', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    await ExternalAd.findByIdAndDelete(req.params.id);
    res.json({ message: '✅ تم حذف الإعلان' });
  } catch (err) {
    console.error('خطأ في حذف الإعلان:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// واجهات الأدمن للموافقة على الطلبات
// ============================================================
app.get('/api/admin/pending-requests', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const products = await Product.find({ is_approved: false }).populate('industrial_id', 'name company_name');
    const jobs = await Job.find({ is_approved: false }).populate('industrial_id', 'name company_name');
    const services = await Service.find({ is_approved: false }).populate('provider_id', 'name');
    const applications = await Application.find({ is_approved: false }).populate('worker_id', 'name').populate('job_id', 'title');
    const serviceRequests = await ServiceRequest.find({ is_approved: false }).populate('requester_id', 'name').populate('service_id', 'title');
    const ads = await ExternalAd.find({ is_approved: false });
    res.json({ products, jobs, services, applications, serviceRequests, ads });
  } catch (err) {
    console.error('خطأ في جلب الطلبات المعلقة:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/approve/:type/:id', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const { type, id } = req.params;
    let model;
    switch(type) {
      case 'product': model = Product; break;
      case 'job': model = Job; break;
      case 'service': model = Service; break;
      case 'application': model = Application; break;
      case 'serviceRequest': model = ServiceRequest; break;
      case 'ad': model = ExternalAd; break;
      default: return res.status(400).json({ error: 'نوع غير صالح' });
    }
    const item = await model.findById(id);
    if (!item) return res.status(404).json({ error: 'غير موجود' });
    item.is_approved = true;
    if (type !== 'application' && type !== 'serviceRequest') {
      item.is_active = true;
    }
    await item.save();
    res.json({ message: '✅ تمت الموافقة بنجاح' });
  } catch (err) {
    console.error('خطأ في الموافقة:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/reject/:type/:id', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const { type, id } = req.params;
    let model;
    switch(type) {
      case 'product': model = Product; break;
      case 'job': model = Job; break;
      case 'service': model = Service; break;
      case 'application': model = Application; break;
      case 'serviceRequest': model = ServiceRequest; break;
      case 'ad': model = ExternalAd; break;
      default: return res.status(400).json({ error: 'نوع غير صالح' });
    }
    await model.findByIdAndDelete(id);
    res.json({ message: '✅ تم رفض الطلب وحذفه' });
  } catch (err) {
    console.error('خطأ في الرفض:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// واجهات العرض العام (المحتوى المعتمد فقط)
// ============================================================
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find({ is_active: true, is_approved: true })
      .populate('industrial_id', 'name company_name phone email');
    res.json(products);
  } catch (err) {
    console.error('خطأ في جلب المنتجات للعرض العام:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/jobs', async (req, res) => {
  try {
    const jobs = await Job.find({ is_active: true, is_approved: true })
      .populate('industrial_id', 'company_name name');
    res.json(jobs);
  } catch (err) {
    console.error('خطأ في جلب الوظائف للعرض العام:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/services', async (req, res) => {
  try {
    const services = await Service.find({ is_active: true, is_approved: true })
      .populate('provider_id', 'name phone');
    res.json(services);
  } catch (err) {
    console.error('خطأ في جلب الخدمات للعرض العام:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/external-ads', async (req, res) => {
  try {
    const ads = await ExternalAd.find({ is_active: true, is_approved: true });
    res.json(ads);
  } catch (err) {
    console.error('خطأ في جلب الإعلانات للعرض العام:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// تشغيل الخادم
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ خادم Aleppo Hub يعمل على http://localhost:${PORT}`);
  console.log('👑 حساب المسؤول: admin@aleppo.com / admin123');
});