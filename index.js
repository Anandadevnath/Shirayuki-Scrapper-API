import express from 'express';
import dotenv from 'dotenv';
import episodeRouter from './routes/episodeStream.js';
import homeRouter from './routes/home.js';
import top10Router from './routes/top10.js';
import monthlyRouter from './routes/monthly.js';
import weeklyRouter from './routes/weekly.js';
import animeListRouter from './routes/anime-list.js';
import animedetailsRouter from './scrapeanime/AnimeDetails/animedetails.js';

import genreRouter from './routes/genre.js';
import searchRouter from './routes/search.js';

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
        message: " Welcome to Shirayuki Anime Scraper!",
        version: "1.0.0",
        endpoints: [
            { name: "Homepage", path: "/home" },
            { name: "Top 10 animes", path: "/top10" },
            { name: "Monthly Top 10 animes", path: "/monthly10" },
            { name: "Weekly Top 10 animes", path: "/weekly10" },
            { name: "A-Z animes based on alphabets", path: "/az-all-anime/all/?page=1" },
            { name: "Anime by Genre", path: "/genere/Action?page=2" },
            { name: "Search Anime", path: "/search?keyword=one%20piece" },
            { name: "Search Suggestions", path: "/search/suggestions?q=demon%20slayer" },
            { name: "Streaming url", path: "/episode-stream?id=one-piece-dub&ep=1" },
            { name: "AnimeDetails by title", path: "/anime/sozai-saishuka-no-isekai-ryokouki" },
        ],
    });
});

app.use('/', episodeRouter);
app.use('/home', homeRouter);
app.use('/top10', top10Router);
app.use('/monthly10', monthlyRouter);
app.use('/weekly10', weeklyRouter);
app.get('/anime/:slug', animedetailsRouter);
app.use('/genere', genreRouter);
app.use('/search', searchRouter);
app.use('/az-all-anime', animeListRouter);


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Anime Scraper API v2.1 running at http://localhost:${PORT}`);
});