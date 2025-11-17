import express from "express";
import cors from "cors";
import multer from "multer";
import { Client, handle_file } from "@gradio/client";
import fs from "fs";
import path from "path";

const app = express();
app.use(cors());

// Multer setup for file upload (in-memory storage)
const upload = multer({ storage: multer.memoryStorage() });

console.log("Connecting to IDM-VTON model...");
let client = await Client.connect("yisol/IDM-VTON");
console.log("✅ Connected successfully!");

// ----------------------
// Home Route
// ----------------------
app.get("/", (req, res) => {
  res.json({
    status: "running",
    message: "Virtual Try-On Proxy Server (Node.js)",
    endpoint: "/api/virtual-tryon",
  });
});

// -----------------------
// Virtual Try-On Route
// -----------------------
app.post(
  "/api/virtual-tryon",
  upload.fields([
    { name: "person_image", maxCount: 1 },
    { name: "clothing_image", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      if (!req.files.person_image || !req.files.clothing_image) {
        return res
          .status(400)
          .json({ error: "Both person_image and clothing_image are required" });
      }

      const personBuffer = req.files.person_image[0].buffer;
      const clothingBuffer = req.files.clothing_image[0].buffer;

      console.log("Processing virtual try-on...");
      console.log("Person image size:", personBuffer.length);
      console.log("Clothing image size:", clothingBuffer.length);

      const result = await client.predict("/tryon", {
        dict: {
          background: await handle_file(personBuffer),
          layers: [],
          composite: null,
        },
        garm_img: await handle_file(clothingBuffer),
        garment_des: "A beautiful garment",
        is_checked: true,
        is_checked_crop: false,
        denoise_steps: 30,
        seed: 42,
      });

      console.log("Result received:", result);

      const outputImageUrl = result.data[0].url;

      // Fetch the image from the Gradio URL and send it back
      const imageResponse = await fetch(outputImageUrl);
      if (!imageResponse.ok) {
        throw new Error("Failed to fetch image from Gradio service");
      }
      const imageBuffer = await imageResponse.arrayBuffer();

      res.set("Content-Type", "image/png");
      return res.send(Buffer.from(imageBuffer));
    } catch (err) {
      console.log("❌ Error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ----------------------
// Health Route
// ----------------------
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    model: "IDM-VTON",
    backend: "Gradio Client (Node.js)",
  });
});

app.listen(3000, () => {
  console.log("🚀 Server started on http://localhost:3000");
});
