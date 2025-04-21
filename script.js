// index.js
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const exec = promisify(execCallback);
puppeteer.use(StealthPlugin());

const LOG_FILE_PATH = path.join(__dirname, 'latest_log.txt');
let entryCount = 0;

try {
  if (fs.existsSync(LOG_FILE_PATH)) {
    const content = fs.readFileSync(LOG_FILE_PATH, 'utf8');
    const matches = content.match(/^\d+\./gm);
    if (matches) entryCount = matches.length;
  } else {
    fs.writeFileSync(LOG_FILE_PATH, '');
  }
} catch (err) {
  fs.writeFileSync(LOG_FILE_PATH, '');
}

function addLogEntry() {
  const now = new Date();
  const timeString = now.toLocaleString('en-IN', {
    hour: 'numeric', minute: '2-digit', hour12: true, day: 'numeric',
    month: 'long', year: 'numeric'
  });
  entryCount++;
  const newEntry = `${entryCount}. ${timeString}\n`;
  fs.appendFileSync(LOG_FILE_PATH, newEntry);
  console.log(`✅ Log: ${newEntry}`);
}

async function runPuppeteerJob() {
  console.log('🚀 Puppeteer job started');
  addLogEntry();
  let browser;
  try {
    const { stdout } = await exec('which chromium');
    const executablePath = stdout.trim();
    browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 ... Safari/537.36');

    const keyword = 'cybersecurity';
    const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}&location=India`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    try {
      await Promise.race([
        page.waitForSelector('.jobs-search__results-list', { timeout: 10000 }),
        page.waitForSelector('ul.jobs-search-results__list', { timeout: 10000 })
      ]);
    } catch {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    const jobListings = await page.evaluate(() => {
      const listings = [];
      const jobCards = document.querySelectorAll('.jobs-search__results-list > li, ul.jobs-search-results__list > li');
      Array.from(jobCards).slice(0, 2).forEach(card => {
        const title = card.querySelector('.base-search-card__title, h3.base-card__title')?.textContent.trim() || 'Unknown';
        const company = card.querySelector('.base-search-card__subtitle, .base-card__subtitle')?.textContent.trim() || 'Unknown';
        const location = card.querySelector('.job-search-card__location, .job-card-container__metadata-item')?.textContent.trim() || 'Unknown';
        const link = card.querySelector('a.base-card__full-link')?.href || 'N/A';
        listings.push({ title, company, location, link });
      });
      return listings;
    });

    console.log('Found', jobListings.length, 'job(s)');
    jobListings.forEach((job, i) => {
      console.log(`\nJob ${i + 1}:`);
      console.log(`- Title: ${job.title}`);
      console.log(`- Company: ${job.company}`);
      console.log(`- Location: ${job.location}`);
      console.log(`- URL: ${job.link}`);
    });

    const screenshotPath = path.join(__dirname, 'screenshot.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (browser) await browser.close();
    console.log('🎯 Puppeteer job finished');
  }
}

// Run once when GitHub Action triggers
runPuppeteerJob();
