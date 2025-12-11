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

const stripe = require('stripe')(process.env.STRIPE_SECRET);




//------> Root api <------\\
app.get("/", (req, res) => {
    res.send("eTuitionTrack Server is Running.....");
})

//------> Database <------\\
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

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
     const tuitionRequestsCollection = db.collection("tuitionRequests");
     const paymentsCollection = db.collection("payments");
      
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
        res.send({ message: "Tuition added successfully", insertedId: result.insertedId });
      
      
    })


    app.get("/users", async (req, res) => {
      const email = req.query.email;
      const query = { email };
      const result = await usersCollection.findOne(query)
      res.send(result)
    })
  


    // Tuitions Related api's

      app.post("/tuitions", async (req, res) => {
        const newTuition = req.body;
        const studentEmail = req.body.studentEmail;

         if (!studentEmail) {
      return res.status(400).send({ message: "studentEmail is required" });
    }
        const user = await usersCollection.findOne({ email: studentEmail });
        if (!user) {
          return res.status(404).send({ message: "Student not found" });
        }

        newTuition.studentId = user._id;
        newTuition.createdAt = new Date();
       newTuition.tuitionStatus = "Pending";

        const result = await tuitionsCollection.insertOne(newTuition);
        res.send(result);
      
      
      })
    
    app.get("/tuitions/approved", async (req, res) => {
      const result = await tuitionsCollection.find({tuitionStatus: "Approved"}).sort({createdAt: -1}).toArray();

      res.send(result);
    })

    app.get("/latest/tuitions", async (req, res) => {
      const result = await tuitionsCollection.find({tuitionStatus: "Approved"}).sort({createdAt: -1}).limit(8).toArray();
      res.send(result);
    })

    app.get("/tuitions/:id/details", async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await tuitionsCollection.findOne(query);
      res.send(result);
    })

    app.get("/my-tuitions/approved", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.studentEmail = email;
      }
      const result = await tuitionsCollection.find(query).sort({createdAt: -1}).toArray();

      res.send(result);
    })

    //budget,
    // className,
    // details,
    // location,
    // phone,
    // scheduleTime,
    // studentImage,
    // studentName,
    // subject,
    // subjectImage,
    // studentEmail,

     app.patch("/my-tuitions/:id/update", async (req, res) => {
       try {
         const id = req.params.id;
       const {budget, className, details, location, phone,scheduleTime,studentImage,studentName,subject,subjectImage,studentEmail} = req.body;
       const query = { _id: new ObjectId(id) }
       
       const updateInfo = {
         $set: {
           budget, className, details, location, phone,scheduleTime,studentImage,studentName,subject,subjectImage,studentEmail
         }
       }
      const result = await tuitionsCollection.updateOne(query, updateInfo);
      res.send(result);
       }
       catch (error) {
         res.status(400).send({message: error.message})
       }
     })
    
    app.get("/my-tuitions/:id/update", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await tuitionsCollection.findOne(query);
      res.send(result);
    })

    app.delete("/my-tuitions/:id/delete", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await tuitionsCollection.deleteOne(query);
      res.send(result);
    })

    // Tuitions Requests Related api's
    
    app.post("/tuition-requests", async (req, res) => {
      const newRequest = req.body;
      newRequest.createdAt = new Date();
      newRequest.tutorRequestStatus = "Pending"
      const result = await tuitionRequestsCollection.insertOne(newRequest);
      res.send(result);
    })

    app.get("/tuition-requests", async (req, res) => {
      const email = req.query.email;
      if (!email) {
    return res.status(400).send({ message: "Email is required" });
  }
      const  query = {studentEmail: email}
      const result = await tuitionRequestsCollection.find(query).sort({createdAt: -1}).toArray();
      res.send(result);
    })

    app.patch("/tuition-requests/:id", async (req, res) => {
      const id = req.params.id;
      const tutorRequestStatus = req.body.tutorRequestStatus;
      const query = { _id: new ObjectId(id) }
      const updateInfo = {
        $set: {
          tutorRequestStatus: tutorRequestStatus
        }
      }

      const result = await tuitionRequestsCollection.updateOne(query, updateInfo)

      res.send(result);
    })



    // Payment Related Api's

    app.post('/create-checkout-session', async (req, res) => {
      const paymentInfo = req.body;
    //  const amount = (Math.round(Number(paymentInfo?.expectedSalary) / 128)) * 100;
      const amount = Number(paymentInfo?.expectedSalary) * 100;
    
      
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: "BDT",
          unit_amount: amount,
          product_data: {
          name: paymentInfo.subjectName || "Tuition Payment", 
        },
         
        },
    
        quantity: 1,
      },
    ],
     customer_email: paymentInfo?.studentEmail,
    mode: 'payment',
    metadata: {
      tuitionId: paymentInfo?.tuitionId,
    },
    success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancel`,
  });

      // console.log(session);
      
  res.send({url: session.url});
    });
    
    // payment/success

 app.patch("/payment-success", async (req, res) => {
   const sessionId = req.query.session_id;
  //  console.log(sessionId);
   
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      const query = { transactionId: session.payment_intent };
   const paymentExist = await paymentsCollection.findOne(query);
   
      if (paymentExist) {
        return res.send({ message: "Already Exist" });
      }

      if (session.payment_status === "paid") {
        id = session.metadata.tuitionId;
        const query = {
          _id: new ObjectId(id)
        }
        const update = {
          $set: {
            tutorRequestStatus: "Approved",
            paymentStatus: "Paid",
          }
        }
        const result = await tuitionRequestsCollection.updateOne(query, update)
        

        const payment = {
          totalAmount: session.amount_total / 100,
          currency: session.currency,
          customerEmail: session.customer_email,
          tuitionId: session.metadata.tuitionId,
          subjectName: session.metadata.subjectName,
          transactionId: session.payment_intent,
          paymentStatus: session.payment_status,
          paidAt: new Date(),
        }

        if (session.payment_status === "paid") {
          const resultPayment = await paymentsCollection.insertOne(payment);

          res.send({success: true,transactionId: session.payment_intent, modifyParcel: result, paymentInfo: resultPayment});
          
        }
      }
      

      res.send({success: false})
   })
    
    // Admin Related api's
    
    app.get("/tuitions", async (req, res) => {
      const result = await tuitionsCollection.find().sort({createdAt: -1}).toArray();

      res.send(result);
    })

    app.patch("/tuitions/:id/tuitionStatus", async (req, res) => {
      const id = req.params.id;
      const tuitionStatus = req.body.tuitionStatus;

        if (!tuitionStatus) {
    return res.status(400).send({ message: "tuitionStatus is required" });
  }
      const query = { _id: new ObjectId(id) }

      const updateInfo = {
        $set: {
             tuitionStatus: tuitionStatus
           }
      };

      const result = await tuitionsCollection.updateOne(query, updateInfo)
      res.send(result);

    })


      
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