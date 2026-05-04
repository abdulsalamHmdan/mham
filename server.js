require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/corporate_dashboard';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev_secret_change_me';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const sessionMiddleware = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGODB_URI }),
  cookie: { maxAge: 1000 * 60 * 60 * 8 }
});
app.use(sessionMiddleware);

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.path = req.path;
  next();
});

app.set('io', io);

app.use('/', require('./routes/auth'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/employee', require('./routes/employee'));
app.use('/tasks', require('./routes/tasks'));
app.use('/api', require('./routes/api'));

app.use((req, res) => {
  res.status(404).render('error', { title: 'صفحة غير موجودة', message: 'الصفحة المطلوبة غير موجودة.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { title: 'خطأ', message: 'حدث خطأ غير متوقع.' });
});

io.on('connection', (socket) => {
  socket.on('joinRoom', (room) => socket.join(room));
});

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✓ متصل بقاعدة البيانات');
    server.listen(PORT, () => console.log(`✓ الخادم يعمل على http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('فشل الاتصال بقاعدة البيانات:', err.message);
    process.exit(1);
  });
