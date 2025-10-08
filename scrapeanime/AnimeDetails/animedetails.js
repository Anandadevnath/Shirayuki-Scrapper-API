import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
const router = express.Router();

router.get('/anime/:slug', async (req, res) => {
  const { slug } = req.params;
  const animeUrl = `https://123animehub.cc/anime/${slug}`;

  try {
    const { data: html } = await axios.get(animeUrl);
    const $ = cheerio.load(html);

    // Title
    const title = $('h2.title').text().trim() || $('h1').first().text().trim();

    // Image
    const image = $('.thumb img').attr('src') || $('img').first().attr('src');

    // Description
    let description = '';
    if ($('.desc .long').length) {
      description = $('.desc .long').text().replace(/\s+/g, ' ').trim();
    } else if ($('.desc').length) {
      description = $('.desc').text().replace(/\s+/g, ' ').trim();
    }

    // Meta info
    let type = '', country = '', genres = [], status = '', released = '', quality = '';
    $('.meta').each((i, el) => {
      const meta = $(el);
      meta.find('dt').each((j, dt) => {
        const key = $(dt).text().trim().toLowerCase();
        const value = $(dt).next('dd');
        if (key === 'type:') type = value.text().trim();
        if (key === 'country:') country = value.text().trim();
        if (key === 'genre:') {
          genres = value.find('a').map((i, a) => $(a).text().trim()).get();
        }
        if (key === 'status:') status = value.text().trim();
        if (key === 'released:') released = value.text().trim();
      });
    });


    // Quality
    const qualityDiv = $("div:contains('Quality:')");
    if (qualityDiv.length) {
      const qualitySpan = qualityDiv.find('span.quality').first();
      if (qualitySpan.length) {
        quality = qualitySpan.text().trim();
      } else {
        const text = qualityDiv.text();
        const match = text.match(/Quality:\s*(\w+)/i);
        if (match) quality = match[1];
      }
    }

    res.json({
      title,
      image,
      description,
      type,
      country,
      genres,
      status,
      released,
      quality
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch anime details', details: error.message });
  }
});

export default router;
