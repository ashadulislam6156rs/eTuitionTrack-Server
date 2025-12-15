require('dotenv').config()
const express = require('express');
const cors = require('cors');

//------> app <------\\
const app = express();

//------> Server Port <------\\
const port = process.env.PORT || 5000;


// admin initialized
const admin = require("firebase-admin");

const serviceAccount = require("./etuitiontrack-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


//------> middleWare <------\\
app.use(express.json());
app.use(cors());

const stripe = require('stripe')(process.env.STRIPE_SECRET);


/// firebase Token varify
const varyfyFBToken = async (req, res, next) => {

  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).send({message: "Unauthorized access!"})
  }

  try {
    const tokenId = token.split(" ")[1];
    
    const decode = await admin.auth().verifyIdToken(tokenId);
    req.decoded_email = decode.email;

    next();
     
  } catch {
     return res.status(401).send({message: "Unauthorized access!"})
  }
  
}

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
    
    // Varify Admin
    
//     const varifyAdmin = async (req, res, next) => {
  
//     const email = req.decoded_email;
//     const query = {email}
//     const user = await usersCollection.findOne(query);

//     if (!user || user.role !== "Admin") {
//       return res.status(403).send({ message: "Forbidden access!" });
//     }

//     next();
  
// }
      
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

      console.log(email);
      
      if (!email) {
        const result = await usersCollection.find().sort({createdAt: -1}).toArray();
    return res.send(result);
     }
      
        const result = await usersCollection.findOne({email})
        res.send(result)
      
      
    })

     app.patch("/user/:id/update", varyfyFBToken, async (req, res) => {

       const id = req.params.id;
       const { fullName, photoURL, contactNumber, userRole, address} = req.body;
       const query = { _id: new ObjectId(id) }

       if (!userRole) {
         const updateInfo = {
         $set: {
         fullName,
         photoURL,
         contactNumber,
         address,
         }
       }

     const result = await usersCollection.updateOne(query, updateInfo);
         res.send(result);
         
       }

       if (!address) {
        const updateInfo = {
         $set: {
           fullName,
         photoURL,
         contactNumber,
         userRole,
         }
       }

      const result = await usersCollection.updateOne(query, updateInfo);
      res.send(result);
      }
       
      
     })
    
    
    app.patch("/user/role/:id/update", varyfyFBToken, async (req, res) => {

       const id = req.params.id;
       const { userRole} = req.body;
       const query = { _id: new ObjectId(id) }
       const updateInfo = {
         $set: {
         userRole
         }
       }
      const result = await usersCollection.updateOne(query, updateInfo);
      res.send(result);
      
    })


    app.delete("/user/:id/delete", varyfyFBToken, async (req, res) => {

       const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await usersCollection.deleteOne(query);
      res.send(result);
      
    })
  


    // Tuitions Related api's

      app.post("/tuitions", varyfyFBToken, async (req, res) => {
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
  const searchText = req.query.searchText;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 8;
  const skip = (page - 1) * limit;
  const sortBy = req.query.sortBy || "latest";

  const query = { tuitionStatus: "Approved" };

  if (searchText) {
    query.$or = [
      { subject: { $regex: searchText, $options: "i" } },
      { location: { $regex: searchText, $options: "i" } },
    ];
  }


  let sortOption = {};
  if (sortBy === "high") {
    sortOption = { budget: -1 };
  } else if (sortBy === "low") {
    sortOption = { budget: 1 };
  } else {
    sortOption = { createdAt: -1 };
  }

  const total = await tuitionsCollection.countDocuments(query);

  const result = await tuitionsCollection
    .find(query)
    .sort(sortOption)
    .skip(skip)
    .limit(limit)
    .toArray();

  res.send({
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
    data: result,
  });
});


    app.get("/latest/tuitions", async (req, res) => {
      const result = await tuitionsCollection.find({tuitionStatus: "Approved"}).sort({createdAt: -1}).limit(8).toArray();
      res.send(result);
    })

    app.get("/tuitions/:id/details",  async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await tuitionsCollection.findOne(query);
      res.send(result);
    })

    app.get("/my-tuitions/approved", varyfyFBToken, async (req, res) => {
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

     app.patch("/my-tuitions/:id/update", varyfyFBToken, async (req, res) => {
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
    
    app.get("/my-tuitions/:id/update", varyfyFBToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await tuitionsCollection.findOne(query);
      res.send(result);
    })

    app.delete("/my-tuitions/:id/delete", varyfyFBToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await tuitionsCollection.deleteOne(query);
      res.send(result);
    })

    // Tuitions Requests Related api's
    
    app.post("/tuition-requests", varyfyFBToken, async (req, res) => {
      const newRequest = req.body;
      newRequest.createdAt = new Date();
      newRequest.tutorRequestStatus = "Pending"
      const result = await tuitionRequestsCollection.insertOne(newRequest);
      res.send(result);
    })

    app.get("/tuition-requests", varyfyFBToken, async (req, res) => {
      const email = req.query.email;
      const query = {}
      if (email) {
        query.studentEmail = email;
      }
      const result = await tuitionRequestsCollection.find(query).sort({createdAt: -1}).toArray();
      res.send(result);
    })


    app.patch("/tuition-requests/:id", varyfyFBToken, async (req, res) => {
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



    // Tutor Related Api's

     app.get("/tutor-applications", varyfyFBToken, async (req, res) => {
      const email = req.query.email;
      const  query = {tutorEmail: email}
      const result = await tuitionRequestsCollection.find(query).sort({createdAt: -1}).toArray();
      res.send(result);
     })
    
    app.get("/users/tutor/role", async (req, res) => {
       
       const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 6;
      const skip = (page - 1) * limit;
      const query = {userRole: "Tutor"}
      
      const total = await usersCollection.countDocuments(query);
       const result = await usersCollection.find(query).sort({createdAt: -1}).skip(skip)
        .limit(limit).toArray();
      
       res.send({
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
    data:result,
  });
  
    })
    
    
      app.get("/users/tutor/latest", async (req, res) => {

       const result = await usersCollection.find({userRole: "Tutor"}).sort({createdAt: -1}).limit(8).toArray();
    return res.send(result);
 
    })
    
     app.delete("/tutor-applications/:id/delete", varyfyFBToken, async (req, res) => {
      const id = req.params.id;
      const  query = {_id: new ObjectId(id)}
      const result = await tuitionRequestsCollection.deleteOne(query)
      res.send(result);
     })
    
     app.patch("/tutor-applications/:id/update", varyfyFBToken, async (req, res) => {
       const id = req.params.id;
       const { expectedSalary, experience, qualifications} = req.body;
       const query = { _id: new ObjectId(id) }
       const updateInfo = {
         $set: {
           expectedSalary,
           experience,
           qualifications
         }
       }
      const result = await tuitionRequestsCollection.updateOne(query, updateInfo)
      res.send(result);
    })


    // Payment Related Api's

    app.post('/create-checkout-session', varyfyFBToken, async (req, res) => {
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
 app.patch("/payment-success", varyfyFBToken, async (req, res) => {
   const sessionId = req.query.session_id;
   
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
            paidAt: new Date(),
            
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
    
    
    //payment History
    app.get("/payment-history", varyfyFBToken, async (req, res) => {
      const email = req.query.email;
      const query = {}

      if (email) {
        query.customerEmail = email;
      }

      const result = await paymentsCollection.find(query).toArray();
      res.send(result)
    })
    
    // Admin Related api's
    
    app.get("/tuitions", varyfyFBToken, async (req, res) => {
      const result = await tuitionsCollection.find().sort({createdAt: -1}).toArray();

      res.send(result);
    })

    app.patch("/tuitions/:id/tuitionStatus", varyfyFBToken, async (req, res) => {
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