const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("tempo is running");
});

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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

    app.get("/classes", async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });

    // students api
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
  console.log(`tempo is running on port : ${port}`);
});
