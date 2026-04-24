const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://localhost:27017/comicsDB')
  .then(() => console.log('Conectado a MongoDB'))
  .catch(err => console.error('Error al conectar:', err));

const HeroSchema = new mongoose.Schema({
  nombre: String,
  nombreReal: String,
  aparicion: Number,
  casa: String,
  biografia: String,
  equipamiento: [String],
  imagenes: [String]
});

const Hero = mongoose.model('Hero', HeroSchema);

// RUTAS CRUD (Puntos 9 y 11)
app.get('/heroes', async (req, res) => {
  const { casa } = req.query;
  const filter = casa ? { casa: new RegExp(`^${casa}$`, 'i') } : {};
  const heroes = await Hero.find(filter);
  res.json(heroes);
});

app.get('/heroes/:id', async (req, res) => {
  const hero = await Hero.findById(req.params.id);
  res.json(hero);
});

app.post('/heroes', async (req, res) => {
  try {
    const hero = new Hero(req.body);
    await hero.save();
    res.status(201).json({ success: true, message: 'Superhéroe creado' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al crear' });
  }
});

app.put('/heroes/:id', async (req, res) => {
  try {
    await Hero.findByIdAndUpdate(req.params.id, req.body);
    res.json({ success: true, message: 'Superhéroe actualizado' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al actualizar' });
  }
});

app.delete('/heroes/:id', async (req, res) => {
  try {
    await Hero.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Superhéroe eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar' });
  }
});

// SCRIPT PARA CARGAR 40 PERSONAJES AUTOMÁTICAMENTE (Punto 13)
const seedDatabase = async () => {
  await Hero.deleteMany({});
  console.log("Limpiando DB... Configurando para 2 fotos máx. por carrusel (.png)...");

  const marvelNames = ['Spider-Man', 'Iron Man', 'Thor', 'Hulk', 'Black Widow', 'Captain America', 'Wolverine', 'Deadpool', 'Doctor Strange', 'Black Panther', 'Daredevil', 'Punisher', 'Ghost Rider', 'Silver Surfer', 'Cyclops', 'Medusa', 'Storm', 'Rogue', 'Mephisto', 'Magneto'];
  
  const dcNames = ['Aquaman', 'Batman', 'Brainiac', 'Catwoman', 'Cyborg', 'Darkseid', 'Deadman', 'Deathstroke', 'Dr Fate', 'Flash', 'Green Lantern', 'Harley Quinn', 'Joker', 'Kalibak', 'Martian Manhunter', 'Mr Freeze', 'Mr Miracle', 'Orion', 'Peacemaker', 'Penguin'];
  
  const heroesToInsert = [];

  const generarHeroe = (name, i, casa, year) => {
    // Limpiamos el nombre para el archivo (ej: "Dr Fate" -> "drfate")
    const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Configuramos: los primeros 5 de cada lista tendrán 2 fotos, el resto solo 1
    const imagenes = i < 5 
      ? [`/images/${safeName}-1.png`, `/images/${safeName}-2.png`] 
      : [`/images/${safeName}-1.png`];

    return {
      nombre: name, 
      nombreReal: `Real ${name}`, 
      aparicion: year + i, 
      casa: casa,
      biografia: `${name} es un personaje clave del universo ${casa}. Esta biografía se muestra truncada en la vista principal pero completa aquí.`,
      equipamiento: ['Ítem 1', 'Traje especial'],
      imagenes: imagenes
    };
  };

  marvelNames.forEach((name, i) => heroesToInsert.push(generarHeroe(name, i, 'Marvel', 1960)));
  dcNames.forEach((name, i) => heroesToInsert.push(generarHeroe(name, i, 'DC', 1939)));

  await Hero.insertMany(heroesToInsert);
  console.log("¡Base de datos actualizada con éxito!");
};

app.listen(3000, async () => {
  console.log('Servidor Backend en http://localhost:3000');
  await seedDatabase();
});