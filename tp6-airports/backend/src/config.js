import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/airport_db',
  redisGeoUrl: process.env.REDIS_GEO_URL || 'redis://localhost:6379',
  redisPopUrl: process.env.REDIS_POP_URL || 'redis://localhost:6380',
};
