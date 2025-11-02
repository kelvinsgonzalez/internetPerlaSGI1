import { useEffect, useState, useRef } from 'react';
import Map, { Marker, NavigationControl, Popup } from 'react-map-gl';
import { motion } from 'framer-motion';
import { MapPin, Users, Satellite } from 'lucide-react';
import api from '../services/api';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const glassCard =
  'backdrop-blur-xl bg-white/80 shadow-xl shadow-emerald-100/60 border border-white/30';
const collaboratorPanel =
  'shadow-xl shadow-emerald-100/60 border border-white/30';

interface Worker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  isOnline: boolean;
}

export function WorkersMap() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [mapStyle, setMapStyle] = useState(
    'mapbox://styles/mapbox/streets-v11'
  );
  const mapRef = useRef<any>();

  useEffect(() => {
    api.get('/users/with-location').then((res) => {
      const workersWithStatus: Worker[] = res.data.map(
        (w: any, index: number): Worker => ({
          id: w.id,
          name: w.name,
          latitude: w.latitude,
          longitude: w.longitude,
          isOnline: index % 2 === 0,
        })
      );
      setWorkers(workersWithStatus);

      if (workersWithStatus.length > 0) {
        const firstWorker =
          workersWithStatus.find((w) => w.isOnline) || workersWithStatus[0];
        mapRef.current?.flyTo({
          center: [firstWorker.longitude, firstWorker.latitude],
          zoom: 13,
        });
      }
    });
  }, []);

  const handleWorkerClick = (worker: Worker) => {
    if (worker.isOnline) {
      setSelectedWorker(worker);
      mapRef.current?.flyTo({
        center: [worker.longitude, worker.latitude],
        zoom: 15,
        duration: 2000,
      });
    }
  };

  const toggleMapStyle = () => {
    setMapStyle((current) =>
      current === 'mapbox://styles/mapbox/streets-v11'
        ? 'mapbox://styles/mapbox/satellite-streets-v12'
        : 'mapbox://styles/mapbox/streets-v11'
    );
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden px-3 py-6 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.25),_transparent_55%),_radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.25),_transparent_60%)]" />
      <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[140%] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(16,185,129,0.12),rgba(14,165,233,0.08),rgba(16,185,129,0.12))] blur-3xl opacity-35" />

      <div className="relative z-10 flex flex-1 flex-col gap-8 overflow-hidden">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <motion.h1
              className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              Mapa de Colaboradores
            </motion.h1>
            <motion.p
              className="mt-3 max-w-3xl text-sm text-slate-600 sm:text-base"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              Visualiza la ubicación en tiempo real de los colaboradores activos
              en el campo.
            </motion.p>
          </div>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <button
              onClick={toggleMapStyle}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-600"
            >
              <Satellite className="h-4 w-4" />
              Cambiar Vista
            </button>
          </motion.div>
        </header>

        <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <motion.div
            className={`${collaboratorPanel} order-2 lg:order-1 rounded-3xl p-4 flex flex-col relative overflow-hidden`}
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <div className="absolute inset-0 overflow-hidden rounded-3xl">
              <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-bl from-green-700/15 to-transparent rounded-full blur-3xl animate-pulse"></div>
              <div
                className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-green-800/15 to-transparent rounded-full blur-3xl animate-pulse"
                style={{ animationDelay: '1s' }}
              ></div>
            </div>
            <div className="relative z-10 flex items-center gap-3 p-2 mb-2">
              <Users className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-slate-900">
                Colaboradores
              </h2>
            </div>
            <div className="relative z-10 overflow-y-auto custom-scrollbar pr-2">
              <ul className="space-y-3 px-1 py-2">
                {workers.map((worker: Worker) => (
                  <li
                    key={worker.id}
                    onClick={() => handleWorkerClick(worker)}
                    className={`flex items-center justify-between rounded-full px-4 py-2.5 transition-all duration-300 ${
                      selectedWorker?.id === worker.id && worker.isOnline
                        ? 'bg-emerald-100/90 shadow-inner'
                        : worker.isOnline
                        ? 'bg-white/80 hover:bg-emerald-50/70'
                        : 'bg-slate-50/60'
                    } ${
                      worker.isOnline ? 'cursor-pointer' : 'cursor-not-allowed'
                    }`}
                  >
                    <p
                      className={`font-semibold text-sm ${
                        worker.isOnline
                          ? 'text-slate-800'
                          : 'text-slate-500 line-through'
                      }`}
                    >
                      {worker.name}
                    </p>
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${
                        worker.isOnline ? 'bg-green-500' : 'bg-slate-400'
                      }`}
                    ></div>
                  </li>
                ))}
                {workers.length === 0 && (
                  <li className="p-3 text-center text-sm text-slate-500">
                    No hay colaboradores con ubicación activa.
                  </li>
                )}
              </ul>
            </div>
          </motion.div>

          <motion.div
            className={`${glassCard} order-1 lg:order-2 rounded-3xl overflow-hidden`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.4 }}
          >
            <div className="w-full h-[75vh] sm:h-[85vh] lg:h-[70vh] lg:min-h-[520px]">
            <Map
              ref={mapRef}
              initialViewState={{
                latitude: 14.7833,
                longitude: -86.5,
                zoom: 7,
              }}
              mapStyle={mapStyle}
              mapboxAccessToken={MAPBOX_TOKEN}
              style={{ width: '100%', height: '100%' }}
            >
              <NavigationControl position="top-left" />
              {workers
                .filter((w: Worker) => w.isOnline)
                .map((worker: Worker) => (
                  <div key={`marker-container-${worker.id}`}>
                    <Marker
                      latitude={worker.latitude}
                      longitude={worker.longitude}
                      onClick={() => handleWorkerClick(worker)}
                    >
                      <div className="transform-gpu transition-transform duration-300 hover:scale-125 cursor-pointer">
                        <MapPin
                          className={`h-8 w-8 ${
                            selectedWorker?.id === worker.id
                              ? 'text-red-500 animate-pulse'
                              : 'text-emerald-600'
                          }`}
                          fill="currentColor"
                        />
                      </div>
                    </Marker>
                    <Popup
                      latitude={worker.latitude}
                      longitude={worker.longitude}
                      closeButton={false}
                      closeOnClick={false}
                      anchor="bottom"
                      offset={30}
                      className="z-10"
                    >
                      <div className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-md backdrop-blur-sm">
                        {worker.name}
                      </div>
                    </Popup>
                  </div>
                ))}
            </Map>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
