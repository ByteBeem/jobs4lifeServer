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
router.post('/postJobs',  async (req, res) => {
    const { title, description, requirements, address, salary, jobLink } = req.body;

    try {
        // Validate job details
        if (!title || !description || !requirements || !address || !salary || !jobLink) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Create job post object
        const jobPost = {
            title: title,
            description: description,
            requirements: requirements,
            address: address,
            salary: salary,
            jobLink: jobLink
        };

        // Store job post data in Firebase
        const jobRef = db.ref('jobPosts').push();
        await jobRef.set(jobPost);

        res.status(201).json({ message: "Job post added successfully." });
    } catch (err) {
        console.error("Error adding job post:", err);
        return res.status(500).json({ error: "Internal server error. Please try again later." });
    }
});

   
router.post("/messages", async (req, res) => {
    const receiverId = req.body.receiverId;
    const senderId = req.body.senderId;

    try {
        const messagesSnapshot = await db.ref('messages')
            .orderByChild('createdAt') 
            .once('value');

        const allMessages = messagesSnapshot.val() || {};
        const conversations = {};

        // Filter messages where senderId is the sender or receiver
        Object.keys(allMessages).forEach(key => {
            const message = allMessages[key];
            if ((message.senderId === senderId && message.reciever === receiverId) ||
                (message.senderId === receiverId && message.reciever === senderId)) {
                conversations[key] = message;
            }
        });

        console.log('conversations',conversations);

        res.status(200).json(conversations);
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

router.get("/fetch", async (req, res) => {
    try {
        const postsSnapshot = await db.ref('userposts').once('value');
        const postsData = postsSnapshot.val();

        // Check if postsData is null or empty
        if (!postsData || Object.keys(postsData).length === 0) {
            return res.status(404).json({ error: 'No posts found' });
        }

        const postsArray = Object.keys(postsData).map(key => ({ id: key, ...postsData[key] }));
        console.log(postsArray);

       

        res.json(postsArray);
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

    // Extract only the posts for the current page
    const startIndex = Math.max(postsArray.length - pageSize, 0);
    const endIndex = postsArray.length;
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
