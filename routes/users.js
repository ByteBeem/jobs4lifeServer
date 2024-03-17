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
router.post("/data", async (req, res) => {
    const token = req.body.token;
    const userId = req.body.userId; 
    console.log('userId',userId);

    if (!token) {
        return res.status(401).json({ error: "Unauthorized. Token not provided." });
    }

    try {
        const decodedToken = jwt.verify(token, secretKey);

        if (!decodedToken.cell || !decodedToken.name) {
            return res.status(400).json({ error: "Malformed token. Missing required fields." });
        }

        // Query messages table to find messages where receiver is userId
        const messagesSnapshot = await db.ref('messages').orderByChild('receiver').equalTo(userId).once('value');
        const messages = messagesSnapshot.val();
        console.log('messages', messages);

        // Extract senderIds from messages
        const senderIds = Object.values(messages).map(message => message.senderId);
        console.log('senderIds', senderIds);

        // Create a set to store unique senderIds
        const uniqueSenderIds = new Set(senderIds);

        // Call findUsers function with senderIds
        const usersSnapshots = await findUsers([...uniqueSenderIds]); // Convert set to array
        console.log('usersSnapshots', usersSnapshots);

        const userInfo = [];
        usersSnapshots.forEach(snapshot => {
            const user = snapshot.val();
            [...uniqueSenderIds].forEach(senderId => { // Iterate through unique senderIds
                const userData = user[senderId];
                if (userData) {
                    userInfo.push({
                        id: senderId,
                        name: userData.username 
                    });
                }
            });
        });

        console.log('userInfo', userInfo);
        return res.status(200).json(userInfo);
    } catch (err) {
        console.error("Error fetching user data:", err);
        if (err instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ error: "Invalid token." });
        }
        return res.status(500).json({ error: "Internal server error. Please try again later." });
    }
});


async function findUsers(userIds) {
    try {
        const usersPromises = userIds.map(userId =>
            db.ref('users').orderByKey().equalTo(userId).once('value')
        );

        const usersSnapshots = await Promise.all(usersPromises);

        return usersSnapshots;
    } catch (error) {
        console.error("Error fetching users:", error);
        throw error;
    }
}



// POST /users/:id/update
router.post("/:id/update", async (req, res) => {
  // Update user data logic
});

module.exports = router;
