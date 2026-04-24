import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function Home({ filter }) {
  const [heroes, setHeroes] = useState([]);
  const [busqueda, setBusqueda] = useState('');

  const fetchHeroes = async () => {
    try {
      const url = filter ? `http://localhost:3000/heroes?casa=${filter}` : 'http://localhost:3000/heroes';
      const res = await axios.get(url);
      setHeroes(res.data);
    } catch (error) {
      toast.error('Error al cargar superhéroes');
    }
  };

  useEffect(() => { fetchHeroes(); }, [filter]);

  const handleDelete = async (id) => {
    if (window.confirm("¿Seguro que querés eliminarlo?")) {
      try {
        await axios.delete(`http://localhost:3000/heroes/${id}`);
        toast.success('Eliminado con éxito', { style: { background: '#333', color: '#fff' }});
        fetchHeroes();
      } catch (error) { toast.error('Error al eliminar'); }
    }
  };

  const filtrados = heroes.filter(h => h.nombre.toLowerCase().includes(busqueda.toLowerCase()));

  return (
    <div>
      <h1 style={{ marginBottom: '20px' }}>{filter ? `Universo ${filter}` : 'Todos los Superhéroes'}</h1>
      <input 
        type="text" 
        className="search-input"
        placeholder="Buscar por nombre..." 
        value={busqueda} 
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <div className="heroes-grid">
        {filtrados.map(hero => (
          <div key={hero._id} className="card">
            {/* Si por algún motivo la foto local no existe, le ponemos un fallback */}
            <img src={hero.imagenes[0]} alt={hero.nombre} className="card-img" onError={(e) => e.target.src = '/images/default.jpg'} />
            <div className="card-content">
              <h3 className="card-title">{hero.nombre}</h3>
              <p className="card-subtitle">{hero.nombreReal}</p>
              <p className="card-bio">{hero.biografia.substring(0, 80)}...</p>
              <Link to={`/hero/${hero._id}`} className="btn btn-primary">Ver Detalle</Link>
              <button onClick={() => handleDelete(hero._id)} className="btn btn-danger">Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}