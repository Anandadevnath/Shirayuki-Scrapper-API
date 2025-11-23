import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

let isConnected = false;

const connectDB = async () => {
    if (isConnected) {
        console.log('📄 Using existing MongoDB connection');
        return;
    }

    try {
        const mongoUri = process.env.MONGODB_URI;
        
        if (!mongoUri) {
            throw new Error('MONGODB_URI environment variable is not defined');
        }

        const connection = await mongoose.connect(mongoUri, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        isConnected = true;
        console.log(`🗄️ MongoDB connected: ${connection.connection.host}`);
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

export default connectDB;