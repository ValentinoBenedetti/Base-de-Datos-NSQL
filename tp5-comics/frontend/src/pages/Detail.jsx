import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function Detail() {
  const { id } = useParams();
  const [hero, setHero] = useState(null);
  const [imgIndex, setImgIndex] = useState(0);

  // Logos oficiales para la vista de detalle (Punto 8)
  const logoMarvel = "https://upload.wikimedia.org/wikipedia/commons/b/b9/Marvel_Logo.svg";
  const logoDC = "https://upload.wikimedia.org/wikipedia/commons/3/3d/DC_Comics_logo.svg";

  useEffect(() => {
    const fetchHero = async () => {
      try {
        const res = await axios.get(`http://localhost:3000/heroes/${id}`);
        setHero(res.data);
      } catch (error) {
        toast.error('Error al cargar los datos del personaje');
      }
    };
    fetchHero();
  }, [id]);

  if (!hero) return <h2 style={{ textAlign: 'center', marginTop: '50px' }}>Cargando base de datos...</h2>;

  return (
    <div className="detail-container">
      <Link to="/" className="btn btn-primary" style={{ display: 'inline-block', marginBottom: '20px' }}>
        ← Volver
      </Link>
      
      {/* Encabezado con Nombre y Logo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '3rem', margin: 0 }}>{hero.nombre}</h1>
          <h3 style={{ color: '#aaa', margin: 0 }}>({hero.nombreReal})</h3>
        </div>
        <img 
          src={hero.casa.toLowerCase() === 'marvel' ? logoMarvel : logoDC} 
          alt="Logo Casa" 
          style={{ height: '60px', background: 'white', padding: '5px', borderRadius: '5px' }} 
        />
      </div>
      
      <div style={{ display: 'flex', gap: '40px', marginTop: '30px', flexWrap: 'wrap' }}>
        
        {/* Columna Izquierda: Imagen y Carrusel dinámico (Punto 6) */}
        <div style={{ flex: '1', minWidth: '300px', textAlign: 'center' }}>
          <img 
            src={hero.imagenes[imgIndex]} 
            alt={hero.nombre} 
            className="carousel-img" 
            onError={(e) => e.target.src = '/images/default.png'} 
          />
          
          {/* Lógica dinámica: Solo muestra botones si hay más de 1 imagen */}
          {hero.imagenes.length > 1 && (
            <div className="carousel-controls" style={{ marginTop: '20px' }}>
              <button onClick={() => setImgIndex((imgIndex - 1 + hero.imagenes.length) % hero.imagenes.length)}>
                ◀ Ant.
              </button>
              <span style={{ margin: '0 20px', fontWeight: 'bold' }}> 
                {imgIndex + 1} / {hero.imagenes.length} 
              </span>
              <button onClick={() => setImgIndex((imgIndex + 1) % hero.imagenes.length)}>
                Sig. ▶
              </button>
            </div>
          )}
        </div>

        {/* Columna Derecha: Información del personaje (Punto 7) */}
        <div style={{ flex: '1', minWidth: '300px' }}>
          <p style={{ fontSize: '1.2rem', marginBottom: '20px', lineHeight: '1.6', color: '#ccc' }}>
            {hero.biografia}
          </p>
          <div style={{ background: '#2c2c2c', padding: '20px', borderRadius: '10px' }}>
            <p><strong>Año de aparición:</strong> {hero.aparicion}</p>
            <p><strong>Casa:</strong> {hero.casa}</p>
            <p><strong>Equipamiento:</strong> {hero.equipamiento.join(' • ')}</p>
          </div>
        </div>

      </div>
    </div>
  );
}