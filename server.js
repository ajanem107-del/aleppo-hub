const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== رابط قاعدة البيانات (استخدم رابطك الخاص) =====
const MONGODB_URI = 'mongodb+srv://ajanem107_db_user:a12s12d12@cluster0.za1bebp.mongodb.net/?retryWrites=true&w=majority';

// ===== الاتصال بقاعدة البيانات =====
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ تم الاتصال بـ MongoDB بنجاح'))
  .catch(err => console.error('❌ فشل الاتصال:', err));

// ===== ✅ هذا هو السطر المطلوب (يخدم الملفات الثابتة من مجلد public) =====
app.use(express.static(path.join(__dirname, 'public')));

// ===== باقي الـ middleware =====
app.use(bodyParser.json());
app.use(session({
  secret: 'aleppo_industrial_secret_key_2026',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

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
  company_address: String,
  skills: [String],
  experience: String,
  resume: String,
  created_at: { type: Date, default: Date.now }
});

const productSchema = new mongoose.Schema({
  industrial_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  description: String,
  price: Number,
  category: String,
  image_url: String,
  quantity: Number,
  is_active: { type: Boolean, default: false }, // غير نشط حتى الموافقة
  created_at: { type: Date, default: Date.now }
});

const jobSchema = new mongoose.Schema({
  industrial_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  requirements: String,
  salary: String,
  location: String,
  worker_type: { type: String, default: '' },
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now }
});

const applicationSchema = new mongoose.Schema({
  job_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  worker_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: String,
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
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
  created_at: { type: Date, default: Date.now }
});

const serviceRequestSchema = new mongoose.Schema({
  service_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  requester_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requester_role: String,
  message: String,
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
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
  created_at: { type: Date, default: Date.now },
  approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const settingSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: { type: mongoose.Schema.Types.Mixed }
});

const paymentSchema = new mongoose.Schema({
  ad_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ExternalAd' },
  amount: Number,
  status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  created_at: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Product = mongoose.model('Product', productSchema);
const Job = mongoose.model('Job', jobSchema);
const Application = mongoose.model('Application', applicationSchema);
const Service = mongoose.model('Service', serviceSchema);
const ServiceRequest = mongoose.model('ServiceRequest', serviceRequestSchema);
const ExternalAd = mongoose.model('ExternalAd', externalAdSchema);
const Setting = mongoose.model('Setting', settingSchema);
const Payment = mongoose.model('Payment', paymentSchema);

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
    res.json({ message: '✅ تم تسجيل الدخول', user: { id: user._id, name: user.name, role: user.role } });
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
// واجهات المنتجات (مع التحكم بالنشر)
// ============================================================

app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find({ is_active: true })
      .populate('industrial_id', 'name company_name phone email');
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', isAuthenticated, isRole('industrial'), async (req, res) => {
  try {
    const { name, description, price, category, image_url, quantity } = req.body;
    const product = new Product({
      industrial_id: req.session.userId,
      name, description, price, category, image_url, quantity,
      is_active: false
    });
    await product.save();
    res.status(201).json({
      message: '✅ تم إضافة المنتج، ينتظر موافقة الإدارة للنشر',
      product
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/my-products', isAuthenticated, isRole('industrial'), async (req, res) => {
  try {
    const products = await Product.find({ industrial_id: req.session.userId });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', isAuthenticated, isRole('industrial'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'غير موجود' });
    if (product.industrial_id.toString() !== req.session.userId) {
      return res.status(403).json({ error: 'ليس منتجك' });
    }
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: '✅ تم الحذف' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/product-contact/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('industrial_id', 'name company_name phone email');
    if (!product) return res.status(404).json({ error: 'منتج غير موجود' });
    if (!product.is_active) return res.status(403).json({ error: 'المنتج غير نشط' });
    res.json({
      industrial_name: product.industrial_id.name,
      company: product.industrial_id.company_name || 'غير محدد',
      phone: product.industrial_id.phone || 'غير متوفر',
      email: product.industrial_id.email || 'غير متوفر'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// واجهات المسؤول لإدارة المنتجات
// ============================================================

app.get('/api/admin/all-products', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const products = await Product.find().populate('industrial_id', 'name company_name');
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/pending-products', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const products = await Product.find({ is_active: false }).populate('industrial_id', 'name company_name');
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/approve-product/:id', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'منتج غير موجود' });
    product.is_active = true;
    await product.save();
    res.json({ message: '✅ تم نشر المنتج بنجاح', product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/reject-product/:id', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: '✅ تم حذف المنتج' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// واجهات الوظائف
// ============================================================

app.get('/api/jobs', async (req, res) => {
  try {
    const jobs = await Job.find({ is_active: true }).populate('industrial_id', 'company_name name');
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/jobs', isAuthenticated, isRole('industrial'), async (req, res) => {
  try {
    const { title, description, requirements, salary, location, worker_type } = req.body;
    const job = new Job({
      industrial_id: req.session.userId,
      title, description, requirements, salary, location, worker_type
    });
    await job.save();
    res.status(201).json({ message: '✅ تم نشر الوظيفة', job });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/my-jobs', isAuthenticated, isRole('industrial'), async (req, res) => {
  try {
    const jobs = await Job.find({ industrial_id: req.session.userId });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/apply', isAuthenticated, isRole('worker'), async (req, res) => {
  try {
    const { job_id, message } = req.body;
    const existing = await Application.findOne({ job_id, worker_id: req.session.userId });
    if (existing) return res.status(409).json({ error: 'لقد تقدمت لهذه الوظيفة مسبقاً' });
    const app = new Application({ job_id, worker_id: req.session.userId, message });
    await app.save();
    res.status(201).json({ message: '✅ تم التقدم للوظيفة' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/my-applications', isAuthenticated, isRole('worker'), async (req, res) => {
  try {
    const apps = await Application.find({ worker_id: req.session.userId }).populate('job_id', 'title');
    res.json(apps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/industrial/applications', isAuthenticated, isRole('industrial'), async (req, res) => {
  try {
    const jobs = await Job.find({ industrial_id: req.session.userId });
    const jobIds = jobs.map(j => j._id);
    const applications = await Application.find({ job_id: { $in: jobIds } })
      .populate('worker_id', 'name phone email')
      .populate('job_id', 'title worker_type');
    res.json(applications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/application/:id', isAuthenticated, isRole('industrial'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'حالة غير صالحة' });
    }
    const application = await Application.findById(req.params.id).populate('job_id');
    if (!application) return res.status(404).json({ error: 'طلب غير موجود' });
    if (application.job_id.industrial_id.toString() !== req.session.userId) {
      return res.status(403).json({ error: 'ليس لديك صلاحية تعديل هذا الطلب' });
    }
    application.status = status;
    await application.save();
    res.json({ message: `✅ تم تحديث الحالة إلى ${status}`, application });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// واجهات الخدمات
// ============================================================

app.get('/api/services', async (req, res) => {
  try {
    const services = await Service.find({ is_active: true }).populate('provider_id', 'name phone');
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/services', isAuthenticated, isRole('provider'), async (req, res) => {
  try {
    const { title, category, description, price_range, contact_phone, image_url } = req.body;
    const service = new Service({ provider_id: req.session.userId, title, category, description, price_range, contact_phone, image_url });
    await service.save();
    res.status(201).json({ message: '✅ تم نشر الخدمة', service });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/services/:id', isAuthenticated, isRole('provider'), async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ error: 'غير موجود' });
    if (service.provider_id.toString() !== req.session.userId) {
      return res.status(403).json({ error: 'ليست خدمتك' });
    }
    await Service.findByIdAndDelete(req.params.id);
    res.json({ message: '✅ تم حذف الخدمة' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/my-services', isAuthenticated, isRole('provider'), async (req, res) => {
  try {
    const services = await Service.find({ provider_id: req.session.userId });
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/service-request', isAuthenticated, async (req, res) => {
  try {
    const { service_id, message } = req.body;
    const user = await User.findById(req.session.userId);
    const existing = await ServiceRequest.findOne({ service_id, requester_id: req.session.userId });
    if (existing) return res.status(409).json({ error: 'لقد طلبت هذه الخدمة مسبقاً' });
    const sr = new ServiceRequest({ service_id, requester_id: req.session.userId, requester_role: user.role, message });
    await sr.save();
    res.status(201).json({ message: '✅ تم إرسال طلب الخدمة' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/service-requests/received', isAuthenticated, isRole('provider'), async (req, res) => {
  try {
    const services = await Service.find({ provider_id: req.session.userId });
    const serviceIds = services.map(s => s._id);
    const requests = await ServiceRequest.find({ service_id: { $in: serviceIds } })
      .populate('service_id', 'title')
      .populate('requester_id', 'name phone');
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/service-request/:id', isAuthenticated, isRole('provider'), async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await ServiceRequest.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json({ message: `✅ تم تحديث الحالة إلى ${status}`, updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// واجهات الإعلانات الخارجية (مدفوعة)
// ============================================================

app.get('/api/external-ads', async (req, res) => {
  try {
    const ads = await ExternalAd.find({ is_active: true });
    res.json(ads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/external-ad', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const { title, description, image_url, link_url, advertiser_name, advertiser_phone, advertiser_email } = req.body;
    const fee = await Setting.findOne({ key: 'ad_fee' });
    const amount = fee ? fee.value : 10;
    const ad = new ExternalAd({
      title, description, image_url, link_url,
      advertiser_name, advertiser_phone, advertiser_email,
      ad_fee: amount,
      is_paid: false,
      is_active: false,
      approved_by: req.session.userId
    });
    await ad.save();
    res.status(201).json({ message: '✅ تم إضافة الإعلان، انتظر الدفع للتفعيل', ad });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pay-external-ad', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const { ad_id } = req.body;
    const ad = await ExternalAd.findById(ad_id);
    if (!ad) return res.status(404).json({ error: 'إعلان غير موجود' });
    const payment = new Payment({ ad_id, amount: ad.ad_fee, status: 'paid' });
    await payment.save();
    ad.is_paid = true;
    ad.is_active = true;
    await ad.save();
    res.json({ message: `✅ تم دفع رسوم الإعلان (${ad.ad_fee}$) وتفعيله` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/external-ads', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const ads = await ExternalAd.find().sort({ created_at: -1 });
    res.json(ads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/external-ad/:id', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    await ExternalAd.findByIdAndDelete(req.params.id);
    res.json({ message: '✅ تم حذف الإعلان' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/ad-fee', async (req, res) => {
  try {
    const fee = await Setting.findOne({ key: 'ad_fee' });
    res.json({ fee: fee ? fee.value : 10 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/settings', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const { key, value } = req.body;
    const setting = await Setting.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
    res.json(setting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// واجهات المسؤول (إحصائيات، مستخدمين، ...)
// ============================================================

app.get('/api/admin/stats', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const users = await User.countDocuments();
    const products = await Product.countDocuments();
    const pending = await Product.countDocuments({ is_active: false });
    const jobs = await Job.countDocuments();
    const services = await Service.countDocuments();
    const applications = await Application.countDocuments();
    const serviceRequests = await ServiceRequest.countDocuments();
    const externalAds = await ExternalAd.countDocuments();
    res.json({ users, products, pending, jobs, services, applications, serviceRequests, externalAds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'مستخدم غير موجود' });
    await Product.deleteMany({ industrial_id: user._id });
    await Job.deleteMany({ industrial_id: user._id });
    await Service.deleteMany({ provider_id: user._id });
    await Application.deleteMany({ worker_id: user._id });
    await ServiceRequest.deleteMany({ requester_id: user._id });
    await User.findByIdAndDelete(user._id);
    res.json({ message: '✅ تم حذف المستخدم وجميع محتوياته' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/products/:id', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: '✅ تم حذف المنتج' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/jobs/:id', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    await Job.findByIdAndDelete(req.params.id);
    res.json({ message: '✅ تم حذف الوظيفة' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/services/:id', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    await Service.findByIdAndDelete(req.params.id);
    res.json({ message: '✅ تم حذف الخدمة' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/service-requests/:id', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    await ServiceRequest.findByIdAndDelete(req.params.id);
    res.json({ message: '✅ تم حذف طلب الخدمة' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/applications/:id', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    await Application.findByIdAndDelete(req.params.id);
    res.json({ message: '✅ تم حذف طلب التوظيف' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/all-products', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const products = await Product.find().populate('industrial_id', 'name company_name');
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/all-jobs', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const jobs = await Job.find().populate('industrial_id', 'name company_name');
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/all-services', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const services = await Service.find().populate('provider_id', 'name');
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/all-service-requests', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const requests = await ServiceRequest.find()
      .populate('service_id', 'title')
      .populate('requester_id', 'name');
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/all-applications', isAuthenticated, isRole('admin'), async (req, res) => {
  try {
    const apps = await Application.find()
      .populate('job_id', 'title')
      .populate('worker_id', 'name');
    res.json(apps);
  } catch (err) {
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