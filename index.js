import express from 'express';
import dotenv from 'dotenv';
import episodeRouter from './routes/episodeStream.js';
import homeRouter from './routes/home.js';

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
        version: "1.0.0",
        endpoints: [
            "/home",
            "/episode-stream?id=one-piece-dub&ep=1",
        ],
    });
});

app.use('/', episodeRouter);
app.use('/home', homeRouter);


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Anime Scraper API v2.1 running at http://localhost:${PORT}`);
});