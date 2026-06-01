import { MongoClient } from 'mongodb';
import { createClient } from 'redis';
import { config } from './config.js';

let mongoClient = null;
let db = null;
let redisGeoClient = null;
let redisPopClient = null;

export async function connectDbs() {
  console.log('Connecting to databases...');

  // 1. Connect MongoDB
  try {
    mongoClient = new MongoClient(config.mongoUri);
    await mongoClient.connect();
    db = mongoClient.db();
    console.log('Successfully connected to MongoDB.');
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    throw err;
  }

  // 2. Connect Redis GEO
  try {
    redisGeoClient = createClient({ url: config.redisGeoUrl });
    redisGeoClient.on('error', (err) => console.error('Redis GEO Client Error:', err));
    await redisGeoClient.connect();
    console.log('Successfully connected to Redis GEO.');
  } catch (err) {
    console.error('Failed to connect to Redis GEO:', err.message);
    throw err;
  }

  // 3. Connect Redis Popularity
  try {
    redisPopClient = createClient({ url: config.redisPopUrl });
    redisPopClient.on('error', (err) => console.error('Redis Popularity Client Error:', err));
    await redisPopClient.connect();
    console.log('Successfully connected to Redis Popularity.');
  } catch (err) {
    console.error('Failed to connect to Redis Popularity:', err.message);
    throw err;
  }
}

export function getDb() {
  if (!db) throw new Error('Database not initialized. Call connectDbs first.');
  return db;
}

export function getRedisGeo() {
  if (!redisGeoClient) throw new Error('Redis GEO not initialized. Call connectDbs first.');
  return redisGeoClient;
}

export function getRedisPop() {
  if (!redisPopClient) throw new Error('Redis Popularity not initialized. Call connectDbs first.');
  return redisPopClient;
}
