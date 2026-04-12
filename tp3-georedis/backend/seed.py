import redis

# Conexión local a Redis (usamos localhost porque lo corremos desde fuera del contenedor o podés usar docker exec)
r = redis.Redis(host='localhost', port=6379, decode_responses=True)

puntos = {
    "cervecerias": [
        ("7 Colinas", -58.2325, -32.4842),
        ("Drakkar", -58.2335, -32.4795)
    ],
    "universidades": [
        ("UADER", -58.2355, -32.4815),
        ("UTN", -58.2310, -32.4950)
    ],
    "farmacias": [
        ("Farmacia Central", -58.2340, -32.4830),
        ("Farmacia del Pueblo", -58.2360, -32.4850)
    ],
    "emergencias": [
        ("Hospital Urquiza", -58.2610, -32.4810),
        ("Alerta Emergencias", -58.2380, -32.4820)
    ],
    "supermercados": [
        ("Gran Rex", -58.2350, -32.4800),
        ("Supermercado Dia", -58.2390, -32.4860)
    ]
}

def cargar():
    for grupo, lugares in puntos.items():
        for nombre, lon, lat in lugares:
            r.geoadd(grupo, (lon, lat, nombre))
            print(f"Agregado: {nombre} a {grupo}")

if __name__ == "__main__":
    cargar()