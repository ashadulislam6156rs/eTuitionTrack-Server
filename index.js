require('dotenv').config()
const express = require('express');
const cors = require('cors');

//------> app <------\\
const app = express();

//------> Server Port <------\\
const port = process.env.PORT || 5000;

//------> middleWare <------\\
app.use(express.json());
app.use(cors());



//------> Root api <------\\
app.get("/", (req, res) => {
    res.send("eTuitionTrack Server is Running.....");
})

//------> Database <------\\
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `${process.env.DB_URL}`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    
    await client.connect();
    
      const db = client.db("eTuitionTrack_DB");
      const usersCollection = db.collection("users");
      const tuitionsCollection = db.collection("tuitions");
      
    // Users Related api's

    app.post("/users", async (req, res) => {
      const newUser = req.body;
      const email = req.body.email;
      const isExist = await usersCollection.findOne({ email });

      if (isExist) {
        return res.send({ message: "User Alredy Exist!" });
      } 
        newUser.createdAt = new Date();
        const result = await usersCollection.insertOne(newUser);
        res.send(result);
      
      
    })


    app.get("/users", async (req, res) => {
      const email = req.query.email;
      const query = { email };
      const result = await usersCollection.findOne(query)
      res.send(result)
    })
    


    // Tuitions Related api's
      
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
  
    
  }
}
run().catch(console.dir);




//------> app listener <------\\
app.listen(port, () => {
    console.log(`eTuitionTrack Server is Running Port: ${port}`); 
})