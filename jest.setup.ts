import dotenv from 'dotenv';
import path from 'path';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

// Set NODE_ENV to test (cast to any to bypass readonly check)
(process.env as any).NODE_ENV = 'test';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  try {
    // Ensure mongoose is disconnected before creating a new server
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    (process.env as any).MONGODB_URI = mongoUri;
    await mongoose.connect(mongoUri);
  } catch (error) {
    console.error('Failed to connect to MongoDB Memory Server:', error);
    throw error;
  }
});

afterAll(async () => {
  try {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
});

afterEach(async () => {
  try {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  } catch (error) {
    console.error('Error clearing collections:', error);
  }
});