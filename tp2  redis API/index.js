const express = require('express');
const redis = require('redis');
const app = express();

app.use(express.json());
app.use(express.static('public'));

const client = redis.createClient();

// Datos de los capítulos de The Mandalorian
const caps = [
    { id: 1, t: "El mandaloriano", s: 1 }, { id: 2, t: "El niño", s: 1 }, { id: 3, t: "El pecado", s: 1 }, { id: 4, t: "Santuario", s: 1 },
    { id: 5, t: "El pistolero", s: 1 }, { id: 6, t: "El prisionero", s: 1 }, { id: 7, t: "El ajuste de cuentas", s: 1 }, { id: 8, t: "Redención", s: 1 },
    { id: 9, t: "El mariscal", s: 2 }, { id: 10, t: "La pasajera", s: 2 }, { id: 11, t: "La heredera", s: 2 }, { id: 12, t: "El asedio", s: 2 },
    { id: 13, t: "La Jedi", s: 2 }, { id: 14, t: "La tragedia", s: 2 }, { id: 15, t: "El creyente", s: 2 }, { id: 16, t: "El rescate", s: 2 },
    { id: 17, t: "El apóstata", s: 3 }, { id: 18, t: "Las minas de Mandalore", s: 3 }, { id: 19, t: "El converso", s: 3 }, { id: 20, t: "El huérfano", s: 3 },
    { id: 21, t: "El pirata", s: 3 }, { id: 22, t: "Pistoleros a sueldo", s: 3 }, { id: 23, t: "Los espías", s: 3 }, { id: 24, t: "El regreso", s: 3 }
];

// Punto 1: Listar capítulos y estados
app.get('/api/capitulos', async (req, res) => {
    let resultado = [];
    for (let c of caps) {
        const [reserva, alquiler] = await Promise.all([
            client.get(`reserva:${c.id}`),
            client.get(`alquiler:${c.id}`)
        ]);
        let estado = "disponible";
        if (alquiler) estado = "alquilado";
        else if (reserva) estado = "reservado";
        resultado.push({ ...c, estado });
    }
    res.json(resultado);
});

// Punto 2: Reservar por 4 minutos (240 segundos)
app.post('/api/reservar/:id', async (req, res) => {
    const id = req.params.id;
    await client.set(`reserva:${id}`, "proceso", { EX: 240 }); 
    res.json({ mensaje: `Capítulo ${id} reservado por 4 min.` });
});

// Punto 3: Confirmar pago por 24 horas (86400 segundos)
app.post('/api/confirmar', async (req, res) => {
    const { id, precio } = req.body;
    await client.del(`reserva:${id}`);
    await client.set(`alquiler:${id}`, `pago:${precio}`, { EX: 86400 });
    res.json({ mensaje: `Pago de $${precio} confirmado. Alquilado por 24hs.` });
});

async function conectar() {
    await client.connect();
    app.listen(3000, () => console.log("Servidor en http://localhost:3000"));
}
conectar();