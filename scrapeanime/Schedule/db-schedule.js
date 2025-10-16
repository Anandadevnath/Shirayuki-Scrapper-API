import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.DB_User;
const collectionName = 'schedules';

export async function fetchScheduleFromDB() {
    const client = new MongoClient(uri, { useUnifiedTopology: true, serverSelectionTimeoutMS: 5000 });
    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        const doc = await collection.findOne({}, { sort: { createdAt: -1 } });
        if (!doc || !doc.schedule_data) {
            return [];
        }
        return doc.schedule_data;
    } catch (err) {
        console.error('Error fetching schedule from MongoDB:', err);
        throw new Error('MongoDB connection or query failed: ' + err.message);
    } finally {
        await client.close();
    }
}
