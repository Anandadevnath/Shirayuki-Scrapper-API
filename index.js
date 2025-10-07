import express from 'express';
import dotenv from 'dotenv';
import episodeRouter from './routes/episodeStream.js';
import homeRouter from './routes/home.js';
import top10Router from './routes/top10.js';
import monthlyRouter from './routes/monthly.js';
import weeklyRouter from './routes/weekly.js';

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
            "/top10",
            "/monthly10",
            "/weekly10",
            "/episode-stream?id=one-piece-dub&ep=1",
        ],
    });
});

app.use('/', episodeRouter);
app.use('/home', homeRouter);
app.use('/top10', top10Router);
app.use('/monthly10', monthlyRouter);
app.use('/weekly10', weeklyRouter);


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Anime Scraper API v2.1 running at http://localhost:${PORT}`);
});