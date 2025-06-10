import puppeteer from "puppeteer";
import axios from "axios";
import * as cheerio from "cheerio";
import {WaecQuestion} from "./models/WaecQuestion.js"; // adjust path if needed

const baseUrl = "https://myschool.ng";

export async function scrapeByQuestionType(page, questionType, subjectName, subjectSlug, client) {
  let currentPage = 1;
  let totalScraped = 0;

  while (true) {
    const url = `${baseUrl}/classroom/${subjectSlug}?exam_type=waec&question_type=${questionType}&page=${currentPage}`;
    client?.write(`data: ${JSON.stringify({ type: "info", message: `📄 Scraping ${questionType.toUpperCase()} page ${currentPage}`, totalScraped })}\n\n`);

    let html;
    try {
      ({ data: html } = await axios.get(url));
    } catch (err) {
      client?.write(`data: ${JSON.stringify({ type: "error", message: `❌ Fetch failed for page ${currentPage}: ${err.message}`, totalScraped })}\n\n`);
      break;
    }

    const $ = cheerio.load(html);
    const blocks = $(".media-body");
    if (blocks.length === 0) {
      client?.write(`data: ${JSON.stringify({ type: "warning", message: `🛑 No ${questionType} questions found. Moving on.`, totalScraped })}\n\n`);
      break;
    }

    const questionList = [];
    blocks.each((_, blockEl) => {
      const block = $(blockEl);
      const question = block.find(".question-desc").text().trim();
      const options = block
        .find("ul.list-unstyled li")
        .toArray()
        .map(li => {
          const label = $("strong", li).text().trim();
          const text = $(li).text().replace(label, "").trim();
          return label ? `${label} ${text}` : text;
        });
      const link = block.find("a.btn-outline-danger").attr("href");
      const detailLink = link && link.startsWith("http") ? link : `${baseUrl}${link}`;
      const badge = block.find(".badge.bg-success.text-light").text().trim();
      const match = badge.match(/(WAEC|NECO|JAMB)\s+(\d{4})/i) || [];
      const examType = match[1]?.toUpperCase() || "WAEC";
      const year = match[2] || "Unknown";

      questionList.push({ question, options, detailLink, examType, year });
    });

    // Visit each detail page
    for (const q of questionList) {
      let answer = "N/A";
      let explanation = "No explanation";

      try {
        client?.write(`data: ${JSON.stringify({ type: "info", message: `🔗 Visiting detail: ${q.detailLink}`, totalScraped })}\n\n`);
        await page.goto(q.detailLink, { waitUntil: "networkidle2", timeout: 15000 });
        await page.waitForSelector("h5.text-success", { timeout: 8000 });

        answer = await page.$eval("h5.text-success", el =>
          el.textContent.replace("Correct Answer:", "").trim()
        );

        explanation = await page.evaluate(() => {
          const containers = document.querySelectorAll("div.mb-4");
          for (const c of containers) {
            const h5s = Array.from(c.querySelectorAll("h5"));
            if (h5s.some(h => h.textContent.trim().toLowerCase() === "explanation")) {
              const p = c.querySelector("p");
              return p?.textContent.trim() || "No explanation";
            }
          }
          return "No explanation";
        });

        client?.write(`data: ${JSON.stringify({ type: "success", message: `✅ Scraped answer & explanation`, totalScraped })}\n\n`);
      } catch (err) {
        client?.write(`data: ${JSON.stringify({ type: "warning", message: `⚠️ Detail scrape failed: ${err.message}`, totalScraped })}\n\n`);
      }

      try {
        await WaecQuestion.create({
          question: q.question,
          options: q.options,
          answer,
          explanation,
          examType: q.examType,
          year: q.year,
          subject: subjectName,
          questionType,
          detailLink: q.detailLink,
        });
        totalScraped++;
        client?.write(`data: ${JSON.stringify({ type: "saved", message: `💾 Saved question #${totalScraped}`, totalScraped })}\n\n`);
      } catch (err) {
        client?.write(`data: ${JSON.stringify({ type: "error", message: `❌ Save error: ${err.message}`, totalScraped })}\n\n`);
      }
    }

    currentPage++;
  }

  return totalScraped;
}

export async function scrapeAllQuestions(subjectName, subjectSlug, sessionId, clients) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--window-size=1920x1080"
    ],
  });

  const page = await browser.newPage();
  const client = clients.get(sessionId);

  client?.write(`data: ${JSON.stringify({ type: "start", message: `🚀 Starting scrape for ${subjectName}`, totalScraped: 0 })}\n\n`);

  let total = 0;
  for (const qt of ["objective", "theory", "practical"]) {
    const n = await scrapeByQuestionType(page, qt, subjectName, subjectSlug, client);
    total += n;
  }

  await browser.close();

  client?.write(`data: ${JSON.stringify({ type: "end", message: `🎉 Done! ${total} questions.`, totalScraped: total, completed: true })}\n\n`);
}
