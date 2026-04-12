from flask import Flask, request, jsonify
from flask_cors import CORS
import redis

app = Flask(__name__)
CORS(app)

# Conexión a Redis (usamos el nombre del servicio en Docker: 'redis')
r = redis.Redis(host='redis', port=6379, decode_responses=True)

# 1. Agregar lugar (Punto 2 de la consigna)
@app.route('/agregar', methods=['POST'])
def agregar_lugar():
    data = request.json
    # data: { "grupo": "cervecerias", "nombre": "Antares", "lon": -58.123, "lat": -34.456 }
    r.geoadd(data['grupo'], (data['lon'], data['lat'], data['nombre']))
    return jsonify({"msg": "Lugar agregado con éxito"})

# 2. Listar por radio de 5km (Punto 3 de la consigna)
@app.route('/buscar', methods=['GET'])
def buscar_cercanos():
    grupo = request.args.get('grupo')
    lon = float(request.args.get('lon'))
    lat = float(request.args.get('lat'))
    
    # Buscamos en un radio de 5 km
    lugares = r.georadius(grupo, lon, lat, 5, unit='km', withdist=True)
    
    # Formateamos la respuesta
    resultado = [{"nombre": l[0], "distancia": round(l[1], 2)} for l in lugares]
    return jsonify(resultado)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)