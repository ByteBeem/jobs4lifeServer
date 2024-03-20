const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const firebase = require("firebase-admin");
const saltRounds = 12;
const saltRoundsTokenApp = 10;

const apptoken = process.env.appToken || 'DonaldRSA04?';

const db = firebase.database();
const secretKey = process.env.secret_key || "DonaldMxolisiRSA04?????";


router.use(async (req, res, next) => {
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

const fetchChatContactsForUser = async (userId) => {
  try {
    const snapshot = await db.ref('messages').orderByKey().once('value');
    const chatContacts = new Set(); 
    
    snapshot.forEach((chatSnapshot) => {
      const [senderId, recipientId] = chatSnapshot.key.split('_').map(id => parseInt(id));
      
      // Check if the specified user is either the sender or the recipient
      if (senderId === userId) {
        chatContacts.add(recipientId);
      } else if (recipientId === userId) {
        chatContacts.add(senderId);
      }
    });

    // Convert Set to Array to prepare for querying the users table
    const uniqueUserIds = Array.from(chatContacts);
    
    // Query the users table to get IDs and usernames of the chat contacts
    const chatContactsDetails = await Promise.all(
      uniqueUserIds.map(async (contactId) => {
        const userSnapshot = await db.ref('users').orderByKey().equalTo(contactId).once('value');
        const userData = userSnapshot.val();
        const username = userData ? userData.username : null;
        return { id: contactId, username: username };
      })
    );

    return chatContactsDetails.filter(contact => contact.username); 
  } catch (error) {
    console.error('Error fetching chat contacts for user:', error);
    return [];
  }
};

router.post("/data", async (req, res) => {
    const token = req.body.token;
    const userId = req.body.userId;

    if (!token) {
        return res.status(401).json({ error: "Unauthorized. Token not provided." });
    }

    try {
        const decodedToken = jwt.verify(token, secretKey);

        if (!decodedToken.cell || !decodedToken.name) {
            return res.status(400).json({ error: "Malformed token. Missing required fields." });
        }

        // Fetch chat contacts for the user
        const chatContacts = await fetchChatContactsForUser(userId);
        console.log('chatContacts',chatContacts);

        // Return the chat contacts data
        return res.status(200).json(chatContacts);
    } catch (err) {
        console.error("Error fetching user data:", err);
        if (err instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ error: "Invalid token." });
        }
        return res.status(500).json({ error: "Internal server error. Please try again later." });
    }
});


router.post("/:id/update", async (req, res) => {
    // Update user data logic
});

module.exports = router;
