import { Router } from 'express';
import { getDb, getRedisGeo, getRedisPop } from './db.js';

const router = Router();

// GET /airports - Get all airports (optional ?minimal=true)
router.get('/airports', async (req, res) => {
  try {
    const db = getDb();
    const minimal = req.query.minimal === 'true';
    
    // If minimal is requested, only project essential fields for Leaflet markers
    const projection = minimal ? { iata_faa: 1, name: 1, lat: 1, lng: 1 } : {};
    
    const airports = await db.collection('airports')
      .find({}, { projection })
      .toArray();
      
    res.json(airports);
  } catch (err) {
    console.error('Error fetching airports:', err);
    res.status(500).json({ error: 'Failed to fetch airports' });
  }
});

// GET /airports/popular - Get top 10 most popular airports
router.get('/airports/popular', async (req, res) => {
  try {
    const db = getDb();
    const redisPop = getRedisPop();

    // Fetch top 10 items from ZSET in reverse order (highest score first)
    const rawScores = await redisPop.sendCommand(['ZREVRANGE', 'airport_popularity', '0', '9', 'WITHSCORES']);
    
    const popularList = [];
    for (let i = 0; i < rawScores.length; i += 2) {
      popularList.push({
        iata: rawScores[i],
        visits: parseInt(rawScores[i + 1], 10)
      });
    }

    if (popularList.length === 0) {
      return res.json([]);
    }

    // Fetch details of popular airports from MongoDB
    const iataCodes = popularList.map(p => p.iata);
    const airports = await db.collection('airports')
      .find({ iata_faa: { $in: iataCodes } })
      .toArray();

    // Map details preserving the sorted order from Redis
    const result = popularList.map(p => {
      const airport = airports.find(a => a.iata_faa === p.iata);
      if (airport) {
        return { ...airport, visits: p.visits };
      }
      return { iata_faa: p.iata, name: 'Unknown Airport', visits: p.visits };
    });

    res.json(result);
  } catch (err) {
    console.error('Error fetching popular airports:', err);
    res.status(500).json({ error: 'Failed to fetch popular airports' });
  }
});

// GET /airports/nearby - Get airports near a coordinate using GEORADIUS
router.get('/airports/nearby', async (req, res) => {
  try {
    const db = getDb();
    const redisGeo = getRedisGeo();

    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radius = parseFloat(req.query.radius);

    if (isNaN(lat) || isNaN(lng) || isNaN(radius)) {
      return res.status(400).json({ error: 'Invalid parameters. Need lat, lng, and radius (in km)' });
    }

    // Call GEORADIUS to find nearby members
    const rawResults = await redisGeo.sendCommand([
      'GEORADIUS', 
      'airports-geo', 
      lng.toString(), 
      lat.toString(), 
      radius.toString(), 
      'km', 
      'WITHDIST',
      'ASC'
    ]);

    if (!rawResults || rawResults.length === 0) {
      return res.json([]);
    }

    // Parse Redis response: Array of [member, distance]
    const nearby = rawResults.map(item => ({
      iata: item[0],
      distance: parseFloat(item[1])
    }));

    // Retrieve full airport details from MongoDB
    const iataCodes = nearby.map(n => n.iata);
    const airports = await db.collection('airports')
      .find({ iata_faa: { $in: iataCodes } })
      .toArray();

    // Merge details with distance, maintaining order sorted by distance
    const result = nearby.map(n => {
      const airport = airports.find(a => a.iata_faa === n.iata);
      if (airport) {
        return { ...airport, distance: n.distance };
      }
      return null;
    }).filter(Boolean);

    res.json(result);
  } catch (err) {
    console.error('Error querying nearby airports:', err);
    res.status(500).json({ error: 'Failed to fetch nearby airports' });
  }
});

// GET /airports/:iata_code - Get single airport & increment popularity
router.get('/airports/:iata_code', async (req, res) => {
  try {
    const db = getDb();
    const redisPop = getRedisPop();
    const iataCode = req.params.iata_code.toUpperCase().trim();

    // 1. Fetch from MongoDB
    const airport = await db.collection('airports').findOne({ iata_faa: iataCode });
    if (!airport) {
      return res.status(404).json({ error: `Airport with IATA code ${iataCode} not found` });
    }

    // 2. Increment score (+1) in Redis Popularity
    await redisPop.zIncrBy('airport_popularity', 1, iataCode);
    
    // 3. Set expiration of ZSET to 1 day (86400 seconds)
    await redisPop.expire('airport_popularity', 86400);

    // 4. Retrieve current visits score
    const visits = await redisPop.zScore('airport_popularity', iataCode);

    res.json({
      ...airport,
      visits: parseInt(visits, 10) || 0
    });
  } catch (err) {
    console.error('Error fetching airport details:', err);
    res.status(500).json({ error: 'Failed to fetch airport details' });
  }
});

// POST /airports - Create new airport
router.post('/airports', async (req, res) => {
  try {
    const db = getDb();
    const redisGeo = getRedisGeo();

    const { name, city, iata_faa, icao, lat, lng, alt, tz } = req.body;

    if (!name || !iata_faa) {
      return res.status(400).json({ error: 'Fields name and iata_faa are required' });
    }

    const iataCode = iata_faa.toUpperCase().trim();
    
    // Check if airport already exists
    const existing = await db.collection('airports').findOne({ iata_faa: iataCode });
    if (existing) {
      return res.status(400).json({ error: `Airport with IATA code ${iataCode} already exists` });
    }

    const newAirport = {
      name,
      city: city || '',
      iata_faa: iataCode,
      icao: icao || '',
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      alt: alt ? parseInt(alt, 10) : 0,
      tz: tz || ''
    };

    // 1. Save to MongoDB
    await db.collection('airports').insertOne(newAirport);

    // 2. Add to Redis GEO if coordinates are valid
    if (!isNaN(newAirport.lat) && !isNaN(newAirport.lng)) {
      await redisGeo.geoAdd('airports-geo', {
        longitude: newAirport.lng,
        latitude: newAirport.lat,
        member: iataCode
      });
    }

    res.status(201).json(newAirport);
  } catch (err) {
    console.error('Error creating airport:', err);
    res.status(500).json({ error: 'Failed to create airport' });
  }
});

// PUT /airports/:iata_code - Modify airport
router.put('/airports/:iata_code', async (req, res) => {
  try {
    const db = getDb();
    const redisGeo = getRedisGeo();
    const iataCode = req.params.iata_code.toUpperCase().trim();

    const { name, city, icao, lat, lng, alt, tz } = req.body;

    const existing = await db.collection('airports').findOne({ iata_faa: iataCode });
    if (!existing) {
      return res.status(404).json({ error: `Airport with IATA code ${iataCode} not found` });
    }

    const updatedData = {
      name: name || existing.name,
      city: city !== undefined ? city : existing.city,
      icao: icao !== undefined ? icao : existing.icao,
      lat: lat !== undefined ? parseFloat(lat) : existing.lat,
      lng: lng !== undefined ? parseFloat(lng) : existing.lng,
      alt: alt !== undefined ? parseInt(alt, 10) : existing.alt,
      tz: tz !== undefined ? tz : existing.tz
    };

    // 1. Update in MongoDB
    await db.collection('airports').updateOne(
      { iata_faa: iataCode },
      { $set: updatedData }
    );

    // 2. Update in Redis GEO if coords are valid
    if (!isNaN(updatedData.lat) && !isNaN(updatedData.lng)) {
      await redisGeo.geoAdd('airports-geo', {
        longitude: updatedData.lng,
        latitude: updatedData.lat,
        member: iataCode
      });
    } else {
      // Remove from geo if coords became invalid
      await redisGeo.zRem('airports-geo', iataCode);
    }

    res.json({ iata_faa: iataCode, ...updatedData });
  } catch (err) {
    console.error('Error updating airport:', err);
    res.status(500).json({ error: 'Failed to update airport' });
  }
});

// DELETE /airports/:iata_code - Delete airport
router.delete('/airports/:iata_code', async (req, res) => {
  try {
    const db = getDb();
    const redisGeo = getRedisGeo();
    const redisPop = getRedisPop();
    const iataCode = req.params.iata_code.toUpperCase().trim();

    // 1. Delete from MongoDB
    const result = await db.collection('airports').deleteOne({ iata_faa: iataCode });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: `Airport with IATA code ${iataCode} not found` });
    }

    // 2. Delete from Redis GEO
    await redisGeo.zRem('airports-geo', iataCode);

    // 3. Delete from Redis Popularity
    await redisPop.zRem('airport_popularity', iataCode);

    res.json({ message: `Airport ${iataCode} deleted successfully` });
  } catch (err) {
    console.error('Error deleting airport:', err);
    res.status(500).json({ error: 'Failed to delete airport' });
  }
});

export default router;
