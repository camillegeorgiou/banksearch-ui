require("dotenv").config({ path: "./.env" });
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = 5002;

app.use(cors());
app.use(express.json());
app.use(cors({ origin: "*" }));

const API_URL = process.env.ELASTICSEARCH_URL;
const API_KEY = process.env.ELASTICSEARCH_API_KEY;

app.post("/search", async (req, res) => {
    try {
      console.log("Request:", JSON.stringify(req.body, null, 2)); 
      const response = await axios.post(
        `${API_URL}/transaction_index/_search`,
        req.body,
        {
          headers: {
            Authorization: `ApiKey ${API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      res.json(response.data);
    } catch (error) {
      console.error("Proxy Error:", error.response?.data || error.message);
      res.status(500).json({
        error: "Internal Server Error",
        details: error.response?.data || error.message,
      });
    }
  });


app.listen(PORT, () => {
  console.log(`Proxy Running at http://127.0.0.1:${PORT}`);
});

console.log("🔍 ELASTICSEARCH_URL:", process.env.ELASTICSEARCH_URL);
console.log("🔍 ELASTICSEARCH_API_KEY:", process.env.ELASTICSEARCH_API_KEY ? "Loaded" : "Missing!");
