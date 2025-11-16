require('dotenv').config();
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

const TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const SEARCH_URL = process.env.SEARCH_URL;
const KEYWORDS = (process.env.KEYWORDS || '').split(',').map(k => k.trim().toLowerCase());
const SEEN_FILE = path.join(__dirname, 'seen.json');

async function loadSeen() {
  try {
    const text = await fs.readFile(SEEN_FILE, 'utf8');
    return new Set(JSON.parse(text));
  } catch {
    return new Set();
  }
}

async function saveSeen(set) {
  await fs.writeFile(SEEN_FILE, JSON.stringify([...set], null, 2));
}

async function fetchProjects() {
  const res = await fetch(SEARCH_URL, { headers: { "User-Agent": "Mozilla/5.0" }});
  const html = await res.text();
  const $ = cheerio.load(html);

  const projects = [];
  $(".project, .project-card, article").each((i, el) => {
    const title = $(el).find("h2, .title, .project-title").text().trim();
    const link = $(el).find("a").attr("href");
    if (!link) return;

    const idMatch = link.match(/\d+/);
    const id = idMatch ? idMatch[0] : link;

    const desc = $(el).find(".description, p").text().trim();

    projects.push({
      id,
      title,
      link: new URL(link, SEARCH_URL).toString(),
      desc,
    });
  });

  return projects;
}

function matchesKeywords(project) {
  const text = (project.title + " " + project.desc).toLowerCase();
  return KEYWORDS.some(k => text.includes(k));
}

async function sendMessage(text) {
  const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: "HTML"
    })
  });
}

async function main() {
  const seen = await loadSeen();
  const projects = await fetchProjects();

  let updated = false;

  for (const p of projects) {
    if (!matchesKeywords(p)) continue;
    if (seen.has(p.id)) continue;

    const msg = `🔔 <b>مشروع برمجة جديد!</b>\n\n<b>${p.title}</b>\n${p.link}\n\n${p.desc.slice(0, 200)}`;
    await sendMessage(msg);

    seen.add(p.id);
    updated = true;
    console.log("Sent:", p.title);
  }

  if (updated) await saveSeen(seen);
}

main();
