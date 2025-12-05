import express from 'express';
import dotenv from 'dotenv';
import episodeRouter from './routes/episodeStream.js';
import homeRouter from './routes/home.js';
import top10Router from './routes/top10.js';
import monthlyRouter from './routes/monthly.js';
import weeklyRouter from './routes/weekly.js';
import animeListRouter from './routes/anime-list.js';
import animedetailsRouter from './scrapeanime/AnimeDetails/animedetails.js';
import scheduleRouter from './routes/schedule.js';
import dbScheduleRouter from './routes/db-schedule.js';
import genreRouter from './routes/genre.js';
import searchRouter from './routes/search.js';
import ongingRouter from './routes/ongoing.js';
import recentUpdatesRouter from './routes/recent_updates.js';
import underratedRouter from './routes/underrated.js';
import overratedRouter from './routes/overrated.js';
import mostPopularRouter from './routes/most_popular.js';
import mostFavoriteRouter from './routes/most_favorite.js';
import topAiringRouter from './routes/top_airing.js';
import trendingRouter from './routes/trending.js';
import sliderRouter from './routes/slider.js';
import watchRouter from './routes/watch.js';

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
            {
                home: [
                    "/home",
                    "/slider",
                    "/trending",
                    "/ongoing",
                    "/recent_updates",
                    "/underrated",
                    "/overrated",
                    "/most_popular",
                    "/most_favorite",
                    "/top_airing",
                ]
            },
            { name: "Top 10 animes", path: "/top10" },
            { name: "Monthly Top 10 animes", path: "/monthly10" },
            { name: "Weekly Top 10 animes", path: "/weekly10" },
            { name: "A-Z animes based on alphabets", path: "/az-all-anime/all/?page=1" },
            { name: "Anime by Genre", path: "/genere/Action?page=2" },
            { name: "Search Anime", path: "/search?keyword=one%20piece" },
            { name: "Search Suggestions", path: "/search/suggestions?q=demon%20slayer" },
            { name: "Streaming url", path: "/episode-stream?id=one-piece-dub&ep=1" },
            { name: "AnimeDetails by title", path: "/anime/one-piece" },
            { name: "Watch Anime URL", path: "/watch/one-piece-100" },
            { name: "Anime Schedule", path: "/schedule" },
            { name: "Schedule from DB", path: "/db-schedule" },
        ]
    });
});

app.use('/', episodeRouter);
app.use('/home', homeRouter);
app.use('/slider', sliderRouter);
app.use('/trending', trendingRouter);
app.use('/top10', top10Router);
app.use('/monthly10', monthlyRouter);
app.use('/weekly10', weeklyRouter);
app.use('/schedule', scheduleRouter);
app.get('/anime/:slug', animedetailsRouter);
app.use('/genere', genreRouter);
app.use('/search', searchRouter);
app.use('/az-all-anime', animeListRouter);
app.use('/db-schedule', dbScheduleRouter);
app.use('/onging', ongingRouter);
app.use('/ongoing', ongingRouter);
app.use('/recent_updates', recentUpdatesRouter);
app.use('/underrated', underratedRouter);
app.use('/overrated', overratedRouter);
app.use('/most_popular', mostPopularRouter);
app.use('/most_favorite', mostFavoriteRouter);
app.use('/top_airing', topAiringRouter);
app.use('/watch', watchRouter);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Anime Scraper API v2.1 running at http://localhost:${PORT}`);
});