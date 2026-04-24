import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function CreateHero() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nombre: '',
    nombreReal: '',
    aparicion: '',
    casa: 'Marvel',
    biografia: '',
    equipamiento: '',
    imagenes: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); // Evita que la página se recargue

    // Formateamos los datos: separamos por comas el equipamiento y las imágenes
    const heroToSave = {
      ...formData,
      aparicion: Number(formData.aparicion),
      equipamiento: formData.equipamiento ? formData.equipamiento.split(',').map(i => i.trim()) : [],
      imagenes: formData.imagenes ? formData.imagenes.split(',').map(i => i.trim()) : ['https://via.placeholder.com/150']
    };

    try {
      await axios.post('http://localhost:3000/heroes', heroToSave);
      toast.success('Superhéroe cargado con éxito');
      navigate('/'); // Te manda de vuelta al inicio
    } catch (error) {
      toast.error('Error al cargar el héroe');
    }
  };

  return (
    <div style={{ maxWidth: '500px', margin: 'auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Agregar Nuevo Personaje</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        <input type="text" name="nombre" placeholder="Nombre (ej: Spider-Man)" onChange={handleChange} required />
        <input type="text" name="nombreReal" placeholder="Nombre Real (ej: Peter Parker)" onChange={handleChange} />
        <input type="number" name="aparicion" placeholder="Año de aparición (ej: 1962)" onChange={handleChange} required />
        
        <select name="casa" onChange={handleChange} required>
          <option value="Marvel">Marvel</option>
          <option value="DC">DC</option>
        </select>

        <textarea name="biografia" placeholder="Breve biografía..." onChange={handleChange} rows="4" required></textarea>
        
        <input type="text" name="equipamiento" placeholder="Equipamiento (separado por comas)" onChange={handleChange} />
        <input type="text" name="imagenes" placeholder="Links de imágenes (separados por comas)" onChange={handleChange} required />

        <button type="submit" style={{ background: 'green', color: 'white', padding: '10px', cursor: 'pointer' }}>
          Guardar Héroe
        </button>
      </form>
    </div>
  );
}