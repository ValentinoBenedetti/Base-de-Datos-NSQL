import fs from 'fs';
import path from 'path';
import { getDb, getRedisGeo, getRedisPop } from './db.js';

export async function runImporter() {
  const db = getDb();
  const airportsCollection = db.collection('airports');

  // Check if database is already populated
  const count = await airportsCollection.countDocuments();
  if (count > 0) {
    console.log(`Database already contains ${count} airports. Skipping initial import.`);
    return;
  }

  console.log('MongoDB airports collection is empty. Starting initial data import...');

  const filePath = path.join(process.cwd(), 'airports.json');
  if (!fs.existsSync(filePath)) {
    console.error(`Error: airports.json not found at ${filePath}. Make sure it is copied.`);
    return;
  }

  let airports = [];
  try {
    const rawContent = fs.readFileSync(filePath, 'utf8');
    const trimmed = rawContent.trim();
    // Parse concatenated JSON objects by replacing delimiters to form a valid JSON array
    const jsonArrayString = '[' + trimmed.replace(/\}\s*\n\s*\{/g, '},{') + ']';
    airports = JSON.parse(jsonArrayString);
    console.log(`Parsed ${airports.length} airports from airports.json.`);
  } catch (err) {
    console.error('Failed to parse airports.json:', err.message);
    return;
  }

  // 1. Insert into MongoDB
  try {
    // Let's create an index on iata_faa for fast lookups
    await airportsCollection.createIndex({ iata_faa: 1 });
    console.log('Created MongoDB index on iata_faa.');

    const insertResult = await airportsCollection.insertMany(airports);
    console.log(`Successfully imported ${insertResult.insertedCount} airports into MongoDB.`);
  } catch (err) {
    console.error('Failed to insert airports into MongoDB:', err.message);
    return;
  }

  // 2. Load into Redis GEO
  try {
    const redisGeo = getRedisGeo();
    
    // Filter out airports that don't have valid coordinates and IATA codes
    const geoData = [];
    airports.forEach(a => {
      const lat = parseFloat(a.lat);
      const lng = parseFloat(a.lng);
      const iata = a.iata_faa;
      
      const hasValidCoords = !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
      const hasValidIata = iata && iata !== '\\N' && iata.trim() !== '';

      if (hasValidCoords && hasValidIata) {
        geoData.push({
          longitude: lng,
          latitude: lat,
          member: iata.trim().toUpperCase()
        });
      }
    });

    console.log(`Filtered ${geoData.length} airports for Redis GEO.`);

    // Clear existing index to avoid duplicates if any
    await redisGeo.del('airports-geo');

    // Insert in chunks of 500
    const chunkSize = 500;
    for (let i = 0; i < geoData.length; i += chunkSize) {
      const chunk = geoData.slice(i, i + chunkSize);
      await redisGeo.geoAdd('airports-geo', chunk);
    }
    console.log(`Successfully imported ${geoData.length} airports into Redis GEO.`);
  } catch (err) {
    console.error('Failed to import airports into Redis GEO:', err.message);
  }

  // 3. Clear Redis Popularity to ensure it starts empty
  try {
    const redisPop = getRedisPop();
    await redisPop.del('airport_popularity');
    console.log('Redis Popularity (ZSET) has been cleared/initialized empty.');
  } catch (err) {
    console.error('Failed to initialize Redis Popularity:', err.message);
  }

  console.log('Data import process completed successfully.');
}
