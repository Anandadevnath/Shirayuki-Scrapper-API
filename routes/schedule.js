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
        // Connect to MongoDB
        await connectDB();
        
        const currentWeekId = getCurrentWeekId();
        
        // Check if we have recent data (less than 6 hours old)
        const existingSchedule = await Schedule.findOne({
            week_id: currentWeekId,
            last_updated: { $gte: new Date(Date.now() - 6 * 60 * 60 * 1000) } // 6 hours ago
        }).sort({ last_updated: -1 });

        if (existingSchedule) {
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

        // Scrape fresh data
        console.log(`🔄 Scraping fresh schedule data for ${currentWeekId}`);
        const scheduleData = await scrapeSchedule();
        const duration = (Date.now() - start) / 1000;

        // Store in MongoDB
        const savedSchedule = await Schedule.findOneAndUpdate(
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

        // Clean up old data (keep only last 4 weeks)
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
            saved_to_db: true
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

// Additional endpoint to get schedule history
router.get('/history', async (req, res) => {
    try {
        await connectDB();
        
        const limit = parseInt(req.query.limit) || 10;
        const scheduleHistory = await Schedule.find({})
            .select('week_id total_episodes last_updated extraction_time_seconds')
            .sort({ last_updated: -1 })
            .limit(limit);

        res.json({
            success: true,
            data: scheduleHistory,
            total_records: scheduleHistory.length
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// Endpoint to force refresh schedule data
router.post('/refresh', async (req, res) => {
    const start = Date.now();
    
    try {
        await connectDB();
        
        console.log('🔄 Force refreshing schedule data...');
        const scheduleData = await scrapeSchedule();
        const duration = (Date.now() - start) / 1000;
        
        const currentWeekId = getCurrentWeekId();
        
        // Update or create new schedule
        const updatedSchedule = await Schedule.findOneAndUpdate(
            { week_id: currentWeekId },
            {
                schedule_data: scheduleData,
                extraction_time_seconds: duration,
                total_episodes: scheduleData.length,
                last_updated: new Date()
            },
            { upsert: true, new: true }
        );

        console.log(`💾 Force updated schedule data: ${scheduleData.length} episodes`);

        res.json({
            success: true,
            data: scheduleData,
            extraction_time_seconds: duration,
            week_id: currentWeekId,
            total_episodes: scheduleData.length,
            force_refreshed: true
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message,
            extraction_time_seconds: (Date.now() - start) / 1000
        });
    }
});

export default router;