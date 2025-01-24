require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.DB_STRIPE_SPK);
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5b559.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );

    const dataBase = client.db("bistroBoss");
    const menuCollection = dataBase.collection("menu");
    const cartCollection = client.db("Cartmenu").collection("cart");
    const userCollection = client.db("Usercollection").collection("user");
    const BistrobossReview = client.db("BistrobossReview").collection("review");
    const paymentCollection = client
      .db("paymentCollection")
      .collection("payment");
    const verefyToken = (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res
          .status(401)
          .send({ message: "Unauthorized access: No token provided" });
      }

      const token = authHeader.split(" ")[1];
      jwt.verify(token, process.env.DB_TOKEN, (err, decoded) => {
        if (err) {
          console.error("Token verification failed:", err.message);
          return res.status(403).send({ message: "Forbidden access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // payment gat function
    app.post("/create-payment-intent", async (req, res) => {
      try {
        const { price } = req.body;

        if (!price || typeof price !== "number") {
          return res.status(400).send({ error: "Invalid price value." });
        }

        const amount = Math.round(price * 100);

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
        
      } catch (error) {
        console.error("Error creating payment intent:", error.message);
        res.status(500).send({ error: "Failed to create payment intent" });
      }
    });

    // token create start
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      if (!user.email) {
        return res.status(400).send({ message: "Email is required" });
      }
      const token = jwt.sign(user, process.env.DB_TOKEN, { expiresIn: "5h" });
      res.send({ token });
  });
  
    // token create end

    // verify admin
    // const verfyAdmin = async(req,res,next)=>{
    //   const email = req.decoded.email
    //   const query = {email: email}
    //   const user = await userCollection.findOne(query)
    //   const isAdmin = user?.role === "admin";
    //   if(!isAdmin){
    //     res.status(403).send({message:"Forbider access"})
    //   }
    //   next()
    // }

    // admin cheack
    app.get("/user/:email", verefyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        res.status(403).send({ message: "Unauthorized access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);

      let admin = false;
      if (user) {
        admin = user.role === "admin";
      }
      res.send({ admin });
    });
    // admin cheack

    app.get("/adminhome", verefyToken, async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();
      const menus = await menuCollection.estimatedDocumentCount();

      res.send({ users, orders, menus });
    });

    app.get("/user", verefyToken, async (req, res) => {
      console.log("Headers received:", req.headers);
      const result = await userCollection.find().toArray();
      return res.send(result);
    });
    app.post("/user", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const exset = await userCollection.findOne(query);
      if (exset) {
        res.send("user alredy added dtaabase");
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.delete("/user/:id", verefyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/user/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // payment history admin home get section

    // app.get("/payment-status", async (req, res) => {
    //   try {
    //     const result = await paymentCollection
    //       .aggregate([
    //         {
    //           $unwind: "$menuIds",
    //         },
    //         {
    //           $lookup: {
    //             from: "menu",
    //             localField: "menuIds",
    //             foreignField: "_id",
    //             as: "menuItems",
    //           },
    //         },
    //         {
    //           $unwind:'$menuItems'
    //         },
    //         {
    //           $group:{
    //             _id:"$menuItems.category",
    //             quaintity:{$sum: 1},
    //             totalRevenue:{ $sum : "$menuItems.price"}
    //           }
    //         }

    //       ])
    //       .toArray();
    //     res.send(result);
    //   } catch (error) {
    //     console.error("Error fetching payment status:", error);
    //     res.status(500).send({ error: "Failed to fetch payment status" });
    //   }
    // });

    // payment history admin home get section end

    //
    app.get("/review", async (req, res) => {
      const result = await BistrobossReview.find().toArray();
      res.send(result);
    });
    app.post("/review", async (req, res) => {
      const data = req.body;
      const result = await BistrobossReview.insertOne(data);
      res.send(result);
    });
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });
    app.post("/menu", async (req, res) => {
      const data = req.body;
      const result = await menuCollection.insertOne(data);
      res.send(result);
    });
    app.delete("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/cart", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.status(400).send({ message: "Email is required" });
      }
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });
    app.delete("/cart/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });
    app.post("/payment", async (req, res) => {
      const payment = req.body;
      console.log(payment);

      const query = {
        _id: {
          $in: payment.cardIds.map((id) => new ObjectId(id)),
        },
      };
      const deleteedId = await cartCollection.deleteMany(query);
      const result = await paymentCollection.insertOne(payment);
      res.send({ result, deleteedId });
    });
    app.get("/payment/:email", verefyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      if(req.params.email!== req.decoded.email){
        res.status(403).send({message:"forbenden access"})
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      const data = req.body;
      const result = await cartCollection.insertOne(data);
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Bistro Boss server is Ranning");
});

app.listen(port, () => {
  console.log("Bistro Boss server is Ranning");
});
