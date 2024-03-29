const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const firebase = require("firebase-admin");
const saltRounds = 12;
const saltRoundsTokenApp = 10;
const apptoken = process.env.appToken || 'DonaldRSA04?';
const serviceAccount = require('../key.json');
const db = firebase.database();
const secretKey = process.env.secret_key || "DonaldMxolisiRSA04?????";
const multer = require('multer');


const bucket = firebase.storage().bucket();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });



router.use(async(req, res, next) => {
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
});
router.get('/jobs', async (req, res) => {
  try {
    const { page, province } = req.query;
    const itemsPerPage = 10;
    const offset = (page - 1) * itemsPerPage;

    // Modify the query to avoid the use of startAt()
    const snapshot = await db.ref('jobPosts').orderByChild('province').equalTo(province).limitToFirst(itemsPerPage).once('value');
    let jobs = snapshot.val();

    // If jobs exist and it's an object, convert it to an array
    if (jobs && typeof jobs === 'object') {
      jobs = Object.values(jobs);
    } else {
      jobs = [];
    }

    res.json({ jobs });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



router.use(express.json());

router.post('/postJobs', upload.single('image'), async (req, res) => {
  const { title, description, requirements, address, salary, jobLink, province } = req.body;

  try {
    // Validate job details
    if (!title || !description || !requirements || !address || !salary || !jobLink || !province) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    let imageLink = '';
    if (req.file) {
      // If image was uploaded, get the download URL from Firebase Storage
      const imageUrl = await uploadImage(req.file);
      imageLink = imageUrl;
    }

    // Create job post object
    const jobPost = {
      title: title,
      description: description,
      requirements: requirements,
      address: address,
      salary: salary,
      jobLink: jobLink,
      province: province,
      imageLink: imageLink
    };

    // Store job post data in Firebase
    const jobRef = db.ref('jobs').push();
    await jobRef.set(jobPost);

    res.status(201).json({ message: "Job post added successfully." });
  } catch (err) {
    console.error("Error adding job post:", err);
    return res.status(500).json({ error: "Internal server error. Please try again later." });
  }
});

// Function to upload image to Firebase Storage and return the download URL
async function uploadImage(image) {
  const filename = `${Date.now()}-${image.originalname}`;

  // Create a reference to the Firebase Storage bucket
  const file = bucket.file(filename);

  // Create a write stream to upload the image
  const stream = file.createWriteStream({
    metadata: {
      contentType: image.mimetype,
    },
  });

  await new Promise((resolve, reject) => {
    stream.on('error', (err) => {
      console.error('Error uploading file:', err);
      reject(err);
    });

    stream.on('finish', async () => {
      // Make the image publicly accessible and get its download URL
      await file.makePublic();
      const downloadURL = `https://storage.googleapis.com/${bucket.name}/${filename}`;
      resolve(downloadURL);
    });

    // Write the image data to the Firebase Storage bucket
    stream.end(image.buffer);
  });

  return downloadURL;
}

   
router.post("/messages", async (req, res) => {
    try {
        const recipientId = req.body.recieverId;
        const senderId = req.body.senderId;

        const chatId = [senderId, recipientId].sort().join('_');
        console.log('chatId',chatId);
        const messagesSnapshot = await db.ref(`messages/${chatId}`).once('value');
        console.log('messagesSnapshot',messagesSnapshot.val());
        const allMessages = [];
        messagesSnapshot.forEach((childSnapshot) => {
            const message = childSnapshot.val();
            allMessages.push({
                createdAt: message.createdAt,
                message: message.message,
                receiver: message.recipientId,
                senderId: message.senderId
            });
        });
        console.log('allMessages',allMessages);
        res.status(200).json(allMessages);
    } catch (error) {
        console.error("Error fetching user messages:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





router.post('/like/:postId', async (req, res) => {
  const postId = req.params.postId;
  const userId = req.body.userId;

  try {
    // Update the likes count and include the user ID in the Firebase Realtime Database
    await firebase.database().ref(`userposts/${postId}`).transaction(post => {
      if (post) {
        if (!post.likes) post.likes = 0;
        if (!post.likedBy) post.likedBy = {};
        
        
        if (!post.likedBy[userId]) {
          post.likes++;
          post.likedBy[userId] = true;
        }

        return post;
      } else {
        return null;
      }
    });

    res.status(200).send('Post liked successfully.');
  } catch (error) {
    console.error('Error liking post:', error);
    res.status(500).send('An error occurred while liking the post.');
  }
});
router.get('/search/:searchThis', async (req, res) => {
    const searchTerm = req.params.searchThis.toLowerCase(); 

    try {
        const searchSnapshot = await db.ref('userposts').once('value');
        const searchResults = [];

        searchSnapshot.forEach(snapshot => {
            const postData = snapshot.val();
            // Check if postData contains the searchTerm in any of its fields
            if (postData && typeof postData === 'object') {
                if (postData.post.toLowerCase().includes(searchTerm) ||
                    postData.title.toLowerCase().includes(searchTerm) ||
                    (postData.description && postData.description.toLowerCase().includes(searchTerm))) {
                    searchResults.push(postData);
                }
            }
        });

        res.status(200).json(searchResults);
    } catch (error) {
        console.error('Error searching:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


router.get("/fetch", async (req, res) => {
    try {
        const postsSnapshot = await db.ref('userposts').once('value');
        const postsData = postsSnapshot.val();

        // Check if postsData is null or empty
        if (!postsData || Object.keys(postsData).length === 0) {
            return res.status(404).json({ error: 'No posts found' });
        }

        const postsArray = Object.keys(postsData).map(key => ({ id: key, ...postsData[key] }));
      

        // Fetch the first 10 posts
        const firstTenPosts = postsArray.slice(0, 10);

        res.json(firstTenPosts);
    } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


router.get("/fetchMore/:page", async (req, res) => {
  const page = parseInt(req.params.page); 
  const pageSize = 10; 

  try {
    const postsSnapshot = await db.ref('userposts')
      .orderByKey()
      .limitToLast(pageSize * page) 
      .once('value');

    const postsData = postsSnapshot.val();

    if (!postsData || Object.keys(postsData).length === 0) {
      return res.status(404).json({ error: 'No posts found' });
    }

    // Convert postsData to an array of posts
    const postsArray = Object.keys(postsData).map(key => ({ id: key, ...postsData[key] }));

    // Calculate start and end indices for the current page
    const startIndex = Math.max(postsArray.length - pageSize * (page + 1), 0);
    const endIndex = Math.max(postsArray.length - pageSize * page, 0);

    if (startIndex >= endIndex) {
      // No more posts found for this page
      return res.json([]);
    }

    const currentPagePosts = postsArray.slice(startIndex, endIndex);

    res.json(currentPagePosts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



router.get("/fetchMy", async (req, res) => {
    const userId = req.body.userId;
    try {
        const postsSnapshot = await db.ref('userposts').once('value');
        const postsData = postsSnapshot.val();

        if (!postsData || Object.keys(postsData).length === 0) {
            return res.status(404).json({ error: 'No posts found' });
        }

        // Filter posts based on userId
        const filteredPostsArray = Object.keys(postsData)
            .filter(key => postsData[key].userId === userId)
            .map(key => ({ id: key, ...postsData[key] }));

        if (filteredPostsArray.length === 0) {
            return res.status(404).json({ error: 'No posts found for the provided user' });
        }

        res.json(filteredPostsArray);
    } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }

    const originalName = req.file.originalname;

    
    const filename = `${Date.now()}-${originalName}`;

    // Create a reference to the Firebase Storage bucket
    const file = bucket.file(filename);

    // Create a write stream to upload the image
    const stream = file.createWriteStream({
      metadata: {
        contentType: req.file.mimetype,
      },
    });

    stream.on('error', (err) => {
      return res.status(500).send({ error: 'Error uploading file' });
    });

    stream.on('finish', async () => {
      // Make the image publicly accessible and get its download URL
      await file.makePublic();
      const downloadURL = `https://storage.googleapis.com/${bucket.name}/${filename}`;

      // Send the download URL back to the client
      res.status(200).send({ downloadURL });
    });

    // Write the image data to the Firebase Storage bucket
    stream.end(req.file.buffer);
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});


router.post("/PostSell", async (req, res) => {
    const token = req.header("Authorization");
    const tokenValue = token.replace("Bearer ", "");
    const postData = req.body;

    
    try {
        const decodedToken = jwt.verify(tokenValue, secretKey);
        
        const cell = decodedToken.cell;


        const userRef = db.ref('userposts').push();
        userRef.set({
            
            post: postData.text || '', 
            
            user: cell, 
            title:postData.title,
            userId: postData.userId,
            price:postData.price,
            location:postData.location,
            phone:postData.phone,
            imageLink:postData.imageLink,
        });
        console.log(postData.imageLink);
         const newPostData = {
            
            post: postData.text,
            user: cell,
        };

        res.status(200).json(newPostData); 
    } catch (error) {
        console.error('Error verifying token:', error);
        res.status(500).json({ error: 'Error verifying token.' });
    }
});



router.post("/Post", async (req, res) => {
    const token = req.header("Authorization");
    const tokenValue = token.replace("Bearer ", "");
    const postData = req.body;

    
    try {
        const decodedToken = jwt.verify(tokenValue, secretKey);
        
        const cell = decodedToken.cell;


        const userRef = db.ref('selling').push();
        userRef.set({
            
            post: postData.text || '', 
            time: Date.now(),
            user: cell, 
        });
         const newPostData = {
            
            post: postData.text,
            user: cell,
        };

        res.status(200).json(newPostData); 
    } catch (error) {
        console.error('Error verifying token:', error);
        res.status(500).json({ error: 'Error verifying token.' });
    }
});

module.exports = router;
