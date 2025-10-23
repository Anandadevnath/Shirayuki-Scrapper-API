import express from 'express';
import scrapeSchedule from '../scrapeanime/Schedule/schedule.js';
import connectDB from '../config/database.js';
import Schedule from '../models/Schedule.js';

const router = express.Router();

const getCurrentWeekId = () => {
    const now = new Date();
    const year = now.getFullYear();
    const weekNumber = getWeekNumber(now);
    return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
};

const getWeekNumber = (date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};

router.get('/', async (req, res) => {
    const start = Date.now();

    try {
        await connectDB();

        const currentWeekId = getCurrentWeekId();

        const existingSchedule = await Schedule.findOne({
            week_id: currentWeekId,
            last_updated: { $gte: new Date(Date.now() - 6 * 60 * 60 * 1000) }
        }).sort({ last_updated: -1 });

        if (existingSchedule) {
            const isErrorCache = Array.isArray(existingSchedule.schedule_data) &&
                existingSchedule.schedule_data.length === 1 &&
                existingSchedule.schedule_data[0] &&
                existingSchedule.schedule_data[0].day === 'Error';

            if (!isErrorCache) {
                console.log(`📋 Returning cached schedule data for ${currentWeekId}`);
                const cleanData = existingSchedule.schedule_data.map(item => ({
                    day: item.day,
                    anime: item.anime,
                    time: item.time
                }));

                return res.json({
                    success: true,
                    data: cleanData,
                    extraction_time_seconds: 0.001,
                    cached: true,
                    week_id: currentWeekId,
                    last_updated: existingSchedule.last_updated,
                    total_episodes: existingSchedule.total_episodes
                });
            }
            console.log(`⚠️ Ignoring cached error schedule for ${currentWeekId} and scraping fresh`);
        }

        console.log(`🔄 Scraping fresh schedule data for ${currentWeekId}`);
        const scheduleData = await scrapeSchedule();
        const duration = (Date.now() - start) / 1000;
        
        const isScrapeError = Array.isArray(scheduleData) &&
            scheduleData.length === 1 &&
            scheduleData[0] &&
            scheduleData[0].day === 'Error';

        let savedSchedule = null;
        if (!isScrapeError) {
            savedSchedule = await Schedule.findOneAndUpdate(
                { week_id: currentWeekId },
                {
                    schedule_data: scheduleData,
                    extraction_time_seconds: duration,
                    total_episodes: scheduleData.length,
                    last_updated: new Date()
                },
                { upsert: true, new: true }
            );

            console.log(`💾 Saved schedule data to MongoDB: ${scheduleData.length} episodes`);
        } else {
            console.log('⚠️ Scraper returned an error payload; not saving to DB');
        }

        const fourWeeksAgo = new Date();
        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

        const deleteResult = await Schedule.deleteMany({
            last_updated: { $lt: fourWeeksAgo }
        });

        if (deleteResult.deletedCount > 0) {
            console.log(`🧹 Cleaned up ${deleteResult.deletedCount} old schedule records`);
        }

        res.json({
            success: true,
            data: scheduleData,
            extraction_time_seconds: duration,
            cached: false,
            week_id: currentWeekId,
            total_episodes: scheduleData.length,
            saved_to_db: !isScrapeError
        });

    } catch (err) {
        console.error('❌ Schedule route error:', err);
        res.status(500).json({
            success: false,
            error: err.message,
            extraction_time_seconds: (Date.now() - start) / 1000
        });
    }
});


export default router;