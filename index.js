const express = require("express");
const app = express();
require("dotenv").config();
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const cors = require("cors");
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: "Unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: "Unauthorized access" });
    }
    req.decoded = { email: decoded?.email };
    // console.log(decoded.email);
    next();
  });
};

app.get("/", (req, res) => {
  res.send("Tempo is running");
});

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { default: Stripe } = require("stripe");

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dowmgti.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const classCollection = client.db("tempoTunes").collection("classes");
    const studentCollection = client.db("tempoTunes").collection("students");
    const selectCollection = client.db("tempoTunes").collection("selects");
    const paymentCollection = client.db("tempoTunes").collection("payments");

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1h" });
      res.send(token);
    });

    app.get("/allclasses", verifyJWT, async (req, res) => {
      const email = req.query.userEmail;
      const result = await classCollection.find({ email }).toArray();
      res.send(result);
    });
    app.get("/allclass", async (req, res) => {
      // const status = req.query.status;
      const result = await classCollection.find().toArray();
      res.send(result);
    });

    app.get("/allusers", async (req, res) => {
      const result = await studentCollection.find().toArray();
      res.send(result);
    });

    app.get("/classes", verifyJWT, async (req, res) => {
      const result = await classCollection.find().limit(6).toArray();
      res.send(result);
    });

    app.post("/classes", verifyJWT, async (req, res) => {
      const newClass = req.body;
      const result = await classCollection.insertOne(newClass);
      res.send(result);
    });

    app.get("/selects", verifyJWT, async (req, res) => {
      const userEmail = req.query.userEmail;
      const result = await selectCollection.find({ userEmail }).toArray();
      res.send(result);
    });

    app.delete("/selects", verifyJWT, async (req, res) => {
      const userEmail = req.query.userEmail;
      const userId = req.query._id;
      const result = await selectCollection.deleteOne({
        userEmail,
        _id: new ObjectId(userId),
      });
      console.log(userEmail);
      res.send(result);
    });

    // payment apis
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);
      res.send(result);
    });

    app.get("/payments", verifyJWT, async (req, res) => {
      const userEmail = req.decoded?.email;
      const result = await paymentCollection.find({ userEmail: userEmail }).toArray();
      res.send(result);
    });

    app.post("/selects", verifyJWT, async (req, res) => {
      const { instrument, instructor, email, price, seats, image, status, enrolled, userEmail } = req.body;
      const result = await selectCollection.insertOne({
        instrument,
        instructor,
        email,
        price,
        seats,
        image,
        status,
        enrolled,
        userEmail,
      });
      res.send(result);
    });

    app.put("/classes/:classId", async (req, res) => {
      try {
        const classId = req.params.classId;
        const updatedClass = req.body;

        // Exclude the _id field from the update operation
        delete updatedClass._id;

        await classCollection.findOneAndUpdate({ _id: new ObjectId(classId) }, { $set: updatedClass });

        res.json(updatedClass);
      } catch (error) {
        console.error("Error updating class:", error);
        res.status(500).json({ error: "Failed to update class" });
      }
    });
    app.get("/selectedclasses", verifyJWT, async (req, res) => {
      const userEmail = req.decoded?.email;

      try {
        const result = await classCollection.find({ selectedBy: userEmail }).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching selected classes:", error);
        res.status(500).send({ message: "An error occurred while fetching selected classes." });
      }
    });

    app.put("/classes/:classId/approve", async (req, res) => {
      try {
        const classId = req.params.classId;

        const updatedClass = await classCollection.findOneAndUpdate(
          { _id: new ObjectId(classId) },
          { $set: { status: "approved" } },
          { returnOriginal: false }
        );

        if (!updatedClass.value) {
          return res.status(404).json({ error: "Class not found" });
        }

        res.json(updatedClass.value);
      } catch (error) {
        console.error("Error approving class:", error);
        res.status(500).json({ error: "Failed to approve class" });
      }
    });

    app.put("/classes/:classId/deny", async (req, res) => {
      try {
        const classId = req.params.classId;

        const updatedClass = await classCollection.findOneAndUpdate(
          { _id: new ObjectId(classId) },
          { $set: { status: "denied" } },
          { returnOriginal: false }
        );

        if (!updatedClass.value) {
          return res.status(404).json({ error: "Class not found" });
        }

        res.json(updatedClass.value);
      } catch (error) {
        console.error("Error denying class:", error);
        res.status(500).json({ error: "Failed to deny class" });
      }
    });

    app.get("/students", async (req, res) => {
      const result = await studentCollection.find().toArray();
      res.send(result);
    });

    app.post("/students", async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      const existingUser = await studentCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "User already exists." });
      }

      // Assign default role as "student" to the new user
      user.role = "student";
      const result = await studentCollection.insertOne(user);
      res.send(result);
    });

    app.patch("/students/role/:email", async (req, res) => {
      const email = req.params.email;
      const newRole = req.body.role;

      const query = { email: email };
      const updateDoc = {
        $set: {
          role: newRole,
        },
      };

      try {
        const result = await studentCollection.updateOne(query, updateDoc);
        res.send(result);
      } catch (error) {
        console.error("Error updating student role:", error);
        res.status(500).send({ message: "An error occurred while updating student role." });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`tempo is running on port: ${port}`);
});
