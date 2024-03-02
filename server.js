const cluster = require("cluster");
const http = require("http");
const express = require("express");
const firebase = require("firebase-admin");
const hpp = require('hpp');
const saltRounds = 12;
const saltRoundsTokenApp = 10;
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const helmet = require('helmet');





const app = express();
app.use(express.json());
const port = process.env.PORT || 3000;
const apptoken = process.env.TokenApp || 'DonaldRSA04?';

const server = http.createServer(app);

const firebaseServiceAccount = require("./key.json");

firebase.initializeApp({
  credential: firebase.credential.cert(firebaseServiceAccount),
  databaseURL: "https://jobs4life-d6926-default-rtdb.asia-southeast1.firebasedatabase.app",
});

const db = firebase.database();

app.use(express.json({ limit: '1mb' }));
app.use(helmet());

app.use(hpp());
app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true, preload: true }));

app.set('trust proxy', 'loopback');


const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: "Too many login attempts from this IP, please try again later",
});

const corsOptions = {
  origin: ['https://www.shopient.co.za', 'https://www.shopient.co.za', 'https://www.shopient.co.za'],
  credentials: true,
  exposedHeaders: ['Content-Length', 'X-Content-Type-Options', 'X-Frame-Options'],
};

app.use(cors(corsOptions));

const secretKey = process.env.secret_key || "DonaldMxolisiRSA04?????";

app.use((req, res, next) => {
  const allowedOrigins = ['https://www.shopient.co.za', 'https://www.shopient.co.za', 'https://www.shopient.co.za', 'https://www.shopient.co.za'];
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Credentials', true);

  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Access-Control-Allow-Origin', 'Content-Type, Authorization');
    return res.status(200).json({});
  }

  next();
});

const appCheckVerification = async (req, res, next) => {
  const appCheckToken = req.header("CustomAppCheck");


  if (!appCheckToken) {
    res.status(401).send("Unauthorized");
    return;
  }

  try {

    const hashedTokenFromRequest = await bcrypt.hash(appCheckToken, saltRoundsTokenApp);

    const isMatch = await bcrypt.compare(apptoken, hashedTokenFromRequest);


    if (isMatch) {
      next();
    } else {
      res.status(401).send("Unauthorized");
    }
  } catch (err) {
    console.error("Error during app token verification:", err);
    res.status(500).send("Internal Server Error");
  }
}


app.post("/signup", [appCheckVerification], async (req, res) => {
  const { username, phoneNumber, password } = req.body;

  try {


    const cellSnapshot = await db.ref('users').orderByChild('cell').equalTo(phoneNumber).once('value');
    if (cellSnapshot.exists()) {
      return res.status(409).json({ error: "Cell number already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const userRef = db.ref('users').push();
    await userRef.set({
      username: username,
      cell: phoneNumber,
      password: hashedPassword,

    });

    res.status(201).json({ message: "User created successfully." });
  } catch (err) {
    console.error("Error during signup:", err);
    return res.status(500).json({ error: "Internal server error. Please try again later." });
  }
});






app.post('/upload', async (req, res) => {
  const postData = req.body;
  

  if (!postData.caption) {
    postData.caption = "";
  }

  const userRef = db.ref('userposts').push();
  userRef.set({
    imageUrl: postData.imageUrl,
    caption: postData.caption,
    time: postData.timestamp,
    user: postData.token,
    content_type: postData.content_type,

  });

  res.status(200).json({ message: "Post created successfully." });
});

app.post('/PostComments', async (req, res) => {
  const postData = req.body;
  

  if (!postData.caption) {
    postData.caption = "";
  }

  const userRef = db.ref('comments').push();
  userRef.set({
    imageUrl: postData.imageUrl,
    caption: postData.caption,
    time: postData.timestamp,

    content_type: postData.content_type,
    postId: postData.postId
  });

  res.status(200).json({ message: "Post created successfully.", data: postData });
});


app.get("/getUserData", async (req, res) => {
  const token = req.header("Authorization");
  

  if (!token || !token.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized. Token not provided." });
  }

  const tokenValue = token.replace("Bearer ", "");

  try {
    const decodedToken = jwt.verify(tokenValue, secretKey);


    if (!decodedToken.cell || !decodedToken.name) {
      return res.status(400).json({ error: "Malformed token. Missing required fields." });
    }

    const cell = decodedToken.cell;
    const name = decodedToken.name;

    return res.status(200).json({ name: name, cell: cell });
  } catch (err) {
    console.error("Error fetching user info:", err);
    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: "Invalid token." });
    }
    return res.status(500).json({ error: "Internal server error. Please try again later." });
  }
});

app.post('/TextComment', async (req, res) => {
  const postData = req.body;
 

  if (!postData.caption) {
    postData.caption = "";
  }

  const userRef = db.ref('comments').push();
  userRef.set({

    caption: postData.caption,
    time: postData.timestamp,
    postId: postData.postId,
    content_type: postData.content_type
  });

  res.status(200).json({ message: "Post created successfully.", data: postData });
});

app.post('/uploadText', async (req, res) => {
  const postData = req.body;
 

  if (!postData.caption) {
    postData.caption = "";
  }

  const userRef = db.ref('userposts').push();
  userRef.set({

    caption: postData.caption,
    time: postData.timestamp,
    user: postData.token,
    content_type: postData.content_type,

  });

  res.status(200).json({ message: "Post created successfully." });
});




app.get('/posts', async (req, res) => {
  try {
    
    const authHeader = req.headers['authorization'];
    let postsArray;

    if (authHeader) {
      const token = authHeader.substring(7);
      if (token === "") {
        const postsSnapshot = await db.ref('posts').once('value');
        const postsData = postsSnapshot.val();
        postsArray = Object.keys(postsData).map(key => ({ id: key, ...postsData[key] }));
      } else {
        const postsSnapshot = await db.ref('posts').once('value');
        const postsData = postsSnapshot.val();
        const filteredPosts = Object.keys(postsData)
          .filter(key => postsData[key].stream === token)
          .map(key => ({ id: key, ...postsData[key] }));
        postsArray = filteredPosts;
      }
    } else {
      const postsSnapshot = await db.ref('posts').once('value');
      const postsData = postsSnapshot.val();
      postsArray = Object.keys(postsData).map(key => ({ id: key, ...postsData[key] }));
    }

    postsArray.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json(postsArray);
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/comments', async (req, res) => {
  try {
   
    const authHeader = req.headers['authorization'];
    let commentsArray = [];

    if (authHeader) {
      const postId = authHeader.substring(7);


      const commentsSnapshot = await db.ref('comments').orderByChild('postId').equalTo(postId).once('value');
      const commentsData = commentsSnapshot.val();
      if (commentsData) {
        commentsArray = Object.values(commentsData);
      }
    }

    commentsArray.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json(commentsArray);
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.post("/login", loginLimiter, [appCheckVerification], async (req, res) => {
  const { phoneNumber, password } = req.body;

  try {
    // Check if the user exists
    const snapshot = await db.ref('users').orderByChild('cell').equalTo(phoneNumber).once('value');
    const userData = snapshot.val();

    if (!userData || Object.keys(userData).length === 0) {
      return res.status(401).json({ error: "User not found." });
    }

    // Get the user data
    const userId = Object.keys(userData)[0];
    const user = userData[userId];

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: "Incorrect password." });
    }

    // Generate token
    const newToken = jwt.sign(
      {
        userId: userId,
        name: user.username,
        cell: user.cell,
      },
      secretKey,
      { expiresIn: "7D" }
    );

    // Update user token in the database
    await db.ref(`users/${userId}`).update({ token: newToken });

    // Send token in the response
    res.status(200).json({ token: newToken });

  } catch (err) {
    console.error("Error during login:", err);
    return res.status(500).json({ error: "Internal server error. Please try again later." });
  }
});





if (cluster.isMaster) {
  const numCPUs = require("os").cpus().length;
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
  });
} else {
  server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}
