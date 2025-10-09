import mongoose from 'mongoose';

const scheduleItemSchema = new mongoose.Schema({
    day: {
        type: String,
        required: true,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Error']
    },
    anime: {
        type: String,
        required: true
    },
    time: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

const scheduleSchema = new mongoose.Schema({
    week_id: {
        type: String,
        required: true,
        unique: true
    },
    schedule_data: [scheduleItemSchema],
    extraction_time_seconds: {
        type: Number,
        required: true
    },
    total_episodes: {
        type: Number,
        default: 0
    },
    last_updated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for faster queries
scheduleSchema.index({ week_id: 1 });
scheduleSchema.index({ last_updated: -1 });

const Schedule = mongoose.model('Schedule', scheduleSchema);

export default Schedule;