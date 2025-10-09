import mongoose from 'mongoose';

const episodeSchema = new mongoose.Schema({
    anime_id: {
        type: String,
        required: true,
        index: true
    },
    episode_number: {
        type: String,
        required: true
    },
    episode_url: {
        type: String,
        required: true,
        unique: true
    },
    streaming_data: {
        title: String,
        episode_number: String,
        streaming_link: String,
        range_id: String,
        all_ranges: [String]
    },
    extraction_time_seconds: {
        type: Number,
        required: true
    },
    last_updated: {
        type: Date,
        default: Date.now
    },
    cache_expires_at: {
        type: Date,
        required: true
    }
}, {
    timestamps: true
});

// Compound index for faster queries
episodeSchema.index({ anime_id: 1, episode_number: 1 });
episodeSchema.index({ episode_url: 1 });
episodeSchema.index({ cache_expires_at: 1 });
episodeSchema.index({ last_updated: -1 });

const Episode = mongoose.model('Episode', episodeSchema);

export default Episode;