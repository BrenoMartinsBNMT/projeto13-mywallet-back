import express, { json } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import dayjs from "dayjs";
const app = express();
app.use(cors());
app.use(json());

dotenv.config();
const mongoClient = new MongoClient(process.env.MONGO_URL);
let db;
mongoClient.connect().then((element) => {
  console.log("conexão feita");
  db = element.db(process.env.DATABASE);
});

app.post("/signUp", async (req, res) => {
  const { email, name, password } = req.body;
  let hasUser = await db.collection("users").findOne({ email });
  try {
    if (hasUser) {
      return res.status(403).send("email já cadastrado!");
    }
    await db.collection("users").insertOne({
      email,
      name,
      password: bcrypt.hashSync(password, 10),
      balance: 0,
      transactions: [],
    });
    res.sendStatus(201);
  } catch {
    res.sendStatus(400);
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  let infosUser = await db.collection("users").findOne({ email });

  try {
    if (!infosUser) {
      return res.sendStatus(404);
    }
    await db.collection("login").deleteOne({ email });

    if (!bcrypt.compareSync(password, infosUser.password)) {
      return res.sendStatus(401);
    }
    let token = uuidv4();
    await db.collection("login").insertOne({ email, token });

    return res.send({ token });
  } catch {
    return res.sendStatus(500);
  }
});
app.post("/logout", async (req, res) => {
  const { token } = req.body;

  try {
    let logoutUser = await db.collection("login").deleteOne({ token });
    res.sendStatus(200);
  } catch {
    res.sendStatus(404);
  }
});

app.post("/historico-de-transacoes", async (req, res) => {
  let { token } = req.body;
  let { email } = await db.collection("login").findOne({ token });
  if (!email) {
    return res.sendStatus(401);
  }
  try {
    let { name, transactions, balance } = await db
      .collection("users")
      .findOne({ email });

    res.send({ name, transactions, balance });
  } catch {
    res.sendStatus(404);
  }
});

app.post("/historico-de-transacoes/adicionar-saldo", async (req, res) => {
  let { balance, token, description } = req.body;
  try {
    let { email } = await db.collection("login").findOne({ token });

    let { transactions } = await db.collection("users").findOne({ email });

    await db.collection("users").updateOne(
      { email },

      {
        $set: {
          transactions: [
            ...transactions,
            {
              data: `${dayjs().get("month") + "/" + dayjs().get("date")}`,
              description,
              balance,
              type: "add",
            },
          ],
        },
        $inc: { balance: balance },
      }
    );

    res.sendStatus(201);
  } catch {
    res.sendStatus(403);
  }
});
app.post("/historico-de-transacoes/retirar-saldo", async (req, res) => {
  let { balance, token, description } = req.body;
  try {
    let { email } = await db.collection("login").findOne({ token });

    let { transactions } = await db.collection("users").findOne({ email });

    await db.collection("users").updateOne(
      { email },

      {
        $set: {
          transactions: [
            ...transactions,
            {
              data: `${dayjs().get("month") + "/" + dayjs().get("date")}`,
              description,
              balance,
              type: "subs",
            },
          ],
        },
        $inc: { balance: -balance },
      }
    );

    res.sendStatus(201);
  } catch {
    res.sendStatus(403);
  }
});
app.listen(process.env.PORT);
