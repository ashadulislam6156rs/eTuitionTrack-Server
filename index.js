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
    
      const db = client.db("eTuitionDB");
      const studentsCollection = db.collection("students");
      
      
      
      
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