import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Home from './pages/Home';
import Detail from './pages/Detail';
import CreateHero from './pages/CreateHero';

function App() {
  return (
    <Router>
      <Toaster position="bottom-right" theme="dark" />
      <nav className="navbar">
        <Link to="/" className="nav-link">Todos</Link>
        <Link to="/marvel" className="nav-link">Marvel</Link>
        <Link to="/dc" className="nav-link">DC</Link>
        <Link to="/crear" className="nav-link create">+ Cargar Nuevo</Link>
      </nav>

      <div className="container">
        <Routes>
          <Route path="/" element={<Home filter="" />} />
          <Route path="/marvel" element={<Home filter="Marvel" />} />
          <Route path="/dc" element={<Home filter="DC" />} />
          <Route path="/hero/:id" element={<Detail />} />
          <Route path="/crear" element={<CreateHero />} />
        </Routes>
      </div>
    </Router>
  );
}
export default App;