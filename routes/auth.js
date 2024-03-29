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
        return res.status(401).send("Unauthorized");
    }

    try {
       
        const hashedTokenFromRequest = await bcrypt.hash(appCheckToken, saltRoundsTokenApp);

       
        const isMatch = await bcrypt.compare(apptoken, hashedTokenFromRequest);

        if (isMatch) {
            next();
        } else {
            return res.status(401).send("Unauthorized");
        }
    } catch (err) {
        console.error("Error during app token verification:", err);
        return res.status(500).send("Internal Server Error");
    }
});

// Fetch user data endpoint
router.get('/user', async (req, res) => {
  try {
    const token = req.header("Authorization").replace("Bearer ", "");
    const decodedToken = jwt.verify(token, secretKey);
    const cell = decodedToken.cell;

    // Retrieve user data based on cell
    const usersSnapshot = await db.ref('users').orderByChild('cell').equalTo(cell).once('value');
    const userData = usersSnapshot.val();

    if (!userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = Object.keys(userData)[0]; 

    res.status(200).json({ id: userId });
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post("/signup", async (req, res) => {
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

router.post("/login", async (req, res) => {
    const { phoneNumber, password } = req.body;

    try {
        const snapshot = await db.ref('users').orderByChild('cell').equalTo(phoneNumber).once('value');
        const userData = snapshot.val();

        if (!userData) {
            return res.status(401).json({ error: "User not found." });
        }

        const userId = Object.keys(userData)[0];
        const user = userData[userId];

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ error: "Incorrect password." });
        }

        const newToken = jwt.sign(
            {
                userId: userId,
                name: user.username,
                cell: user.cell,
            },
            secretKey,
            { expiresIn: "7D" }
        );

        // Include userId in the response
        res.status(200).json({ userId: userId, token: newToken });

    } catch (err) {
        console.error("Error during login:", err);
        return res.status(500).json({ error: "Internal server error. Please try again later." });
    }
});


module.exports = router;
