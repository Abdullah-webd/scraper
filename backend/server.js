import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { scrapeAllQuestions } from "./scraper.js";
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));

// Global variables for scraping progress
let scrapingClients = new Map();

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist'));
});

// MongoDB Connection
mongoose
  .connect(
    "mongodb+srv://webmastersmma:ZnojFZfnZc3wC2og@cluster0.qm8swic.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// Routes
app.get("/api/subjects", (req, res) => {
  const subjects = [
  { name: "Mathematics", slug: "mathematics" },
  { name: "English Language", slug: "english-language" },
  { name: "Further Mathematics", slug: "further-mathematics" },
  { name: "Chemistry", slug: "chemistry" },
  { name: "Physics", slug: "physics" },
  { name: "Biology", slug: "biology" },
  { name: "Economics", slug: "economics" },
  { name: "Government", slug: "government" },
  { name: "Civic Education", slug: "civic-education" },
  { name: "Literature in English", slug: "literature-in-english" },
  { name: "Geography", slug: "geography" },
  { name: "History", slug: "history" },
  { name: "Agricultural Science", slug: "agricultural-science" },
  { name: "Computer Science", slug: "computer-science" },
  { name: "Commerce", slug: "commerce" },
  { name: "Christian Religious Knowledge", slug: "christian-religious-knowledge" },
  { name: "Islamic Religious Knowledge", slug: "islamic-religious-knowledge" },
  { name: "Financial Accounting", slug: "financial-accounting" },
  { name: "Marketing", slug: "marketing" },
  { name: "Technical Drawing", slug: "technical-drawing" },
  { name: "Home Economics", slug: "home-economics" },
  { name: "Food and Nutrition", slug: "food-and-nutrition" },
  { name: "Health Education", slug: "health-education" },
  { name: "Physical Education", slug: "physical-education" },
  { name: "Auto Mechanics", slug: "auto-mechanics" },
  { name: "Data Processing", slug: "data-processing" },
  { name: "Building Construction", slug: "building-construction" },
  { name: "Catering Craft Practice", slug: "catering-craft-practice" },
  { name: "Insurance", slug: "insurance" },
  { name: "Office Practice", slug: "office-practice" },
];

  res.json(subjects);
});

// Server-Sent Events endpoint
app.get("/api/scraping-events/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Cache-Control"
  });

  // Store client connection
  scrapingClients.set(sessionId, res);

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: "connected", message: "Connected to scraping events" })}\n\n`);

  // Handle client disconnect
  req.on("close", () => {
    scrapingClients.delete(sessionId);
  });
});

// Start scraping endpoint
app.post("/api/start-scraping", async (req, res) => {
  const { subjectName, subjectSlug, sessionId } = req.body;

  if (!subjectName || !subjectSlug || !sessionId) {
    return res.status(400).json({ 
      error: "Missing required fields: subjectName, subjectSlug, sessionId" 
    });
  }

  try {
    // Send initial status
    const client = scrapingClients.get(sessionId);
    if (client) {
      client.write(`data: ${JSON.stringify({ 
        type: "info", 
        message: `🚀 Starting scrape for ${subjectName}...`,
        totalScraped: 0
      })}\n\n`);
    }

    // Start scraping in background
    scrapeAllQuestions(subjectName, subjectSlug, sessionId, scrapingClients)
      .then(() => {
        if (client) {
          client.write(`data: ${JSON.stringify({ 
            type: "success", 
            message: "🎉 Scraping completed for all question types!",
            completed: true
          })}\n\n`);
        }
      })
      .catch((error) => {
        if (client) {
          client.write(`data: ${JSON.stringify({ 
            type: "error", 
            message: `❌ Scraping failed: ${error.message}`,
            completed: true
          })}\n\n`);
        }
      });

    res.json({ message: "Scraping started successfully", sessionId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});