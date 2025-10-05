import express from 'express';
import dotenv from 'dotenv';
import { scrapeSingleEpisode } from './scrapeanime/scrapeSingleEpisode.js';

dotenv.config();
const app = express();
app.use(express.json());

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});


app.get('/', (req, res) => {
    res.json({
        message: "🎬 Anime Scraper API is running!",
        version: "2.1.0",
        endpoints: [
            "/episode-stream?id=one-piece-dub&ep=1",,
        ],
    });
});


// http://localhost:5000/episode-stream?id=one-piece-dub&ep=1
app.get('/episode-stream', async (req, res) => {
    try {
        const animeId = req.query.id;
        const episodeNumber = req.query.ep;

        if (!animeId || !episodeNumber) {
            return res.status(400).json({
                error: 'Both id and ep parameters are required',
                example: 'http://localhost:5000/episode-stream?id=sentai-daishikkaku-2nd-season-dub&ep=1'
            });
        }

        // Validate episode number is numeric
        if (isNaN(episodeNumber) || episodeNumber < 1) {
            return res.status(400).json({
                error: 'Episode number must be a positive integer',
                example: 'http://localhost:5000/episode-stream?id=anime-name&ep=1'
            });
        }

        const episodeUrl = `https://w1.123animes.ru/anime/${animeId}/episode/${episodeNumber}`;

        console.log(`🎯 Fetching streaming link for: ${animeId} Episode ${episodeNumber}`);

        const startTime = Date.now();
        const result = await scrapeSingleEpisode(episodeUrl);
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;

        if (result.success) {
            console.log(`✅ Found streaming link in ${duration.toFixed(2)} seconds`);
            res.json({
                success: true,
                anime_id: animeId,
                episode: episodeNumber,
                data: result.data,
                extraction_time_seconds: duration
            });
        } else {
            console.log(`❌ Failed to find streaming link: ${result.error}`);
            res.status(404).json({
                success: false,
                error: result.error,
                anime_id: animeId,
                episode: episodeNumber,
                extraction_time_seconds: duration
            });
        }

    } catch (error) {
        console.error('❌ Error fetching episode stream:', error.message);
        res.status(500).json({
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Anime Scraper API v2.1 running at http://localhost:${PORT}`);
});