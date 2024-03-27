const cluster = require("cluster");
const http = require("http");
const express = require("express");
const firebase = require("firebase-admin");
const helmet = require('helmet');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');

const app = express();
const port = process.env.PORT || 3000;
const server = http.createServer(app);

const firebaseServiceAccount = require("./key.json");

firebase.initializeApp({
  credential: firebase.credential.cert(firebaseServiceAccount),
  databaseURL: "https://jobs4life-d6926-default-rtdb.asia-southeast1.firebasedatabase.app",
  storageBucket: 'jobs4life-d6926.appspot.com', 
});

app.use(helmet());
app.use(hpp());
app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true, preload: true }));
app.set('trust proxy', 'loopback');
app.use(cors({
  origin: 'https://jobs4life-post-jobs.vercel.app/'
}));
app.options('*', cors());
app.use(compression());
app.use(express.json({ limit: '10kb' }));

app.use(mongoSanitize());
app.use(xss());

const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again later',
});
app.use('/auth/login', limiter);

app.use(morgan('combined'));

const authRouter = require('./routes/auth');
const userRouter = require('./routes/users');
const postRouter = require('./routes/posts');

app.use('/auth', authRouter);
app.use('/users', userRouter);
app.use('/posts', postRouter);

if (cluster.isMaster) {
  const numCPUs = require("os").cpus().length;
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}
