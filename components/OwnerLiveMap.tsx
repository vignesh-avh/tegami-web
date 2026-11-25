"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getIncomingCustomers, getToken, getAllShopLocations } from "../lib/api";
import { CustomerLocationUpdate, IncomingCustomersResponse, ShopDetails, ShopLocationMapData } from "../lib/types";
import { calculateDistance, decodePolyline } from "../lib/utils";

const PHASE_COLORS = {
  TO_ME: "#1A73E8",   // Blue
  AT_SHOP: "#10B981", // Green
  TO_OTHER: "#F59E0B",// Orange
  UNKNOWN: "#6B7280", // Gray
};

function formatMeters(m: number): string {
  if (m < 1000) return `${Math.max(10, Math.floor(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export default function OwnerLiveMap({ ownerId, shop, allShops }: { ownerId: string, shop: ShopDetails | null, allShops: ShopLocationMapData[] }) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: maplibregl.Marker }>({});
  const hasManuallyZoomed = useRef(false);
  
  const [customers, setCustomers] = useState<Record<string, CustomerLocationUpdate>>({});
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  const ownerLat = shop?.latitude || 0;
  const ownerLng = shop?.longitude || 0;

  // ── 1. WEBSOCKET & HTTP FALLBACK LOGIC ──
  const fetchHTTPCustomers = async () => {
    try {
      const res: IncomingCustomersResponse = await getIncomingCustomers(ownerId);
      if (res && res.customers) {
        setCustomers((prev) => {
          const updated = { ...prev };
          res.customers.forEach((c) => {
            if (c.latitude && c.longitude) {
              updated[c.customerId] = {
                customer_id: c.customerId,
                customer_name: c.customerName,
                shop_ids: [],
                latitude: c.latitude,
                longitude: c.longitude,
                eta: c.eta,
                route_polyline: c.routePolyline,
                heading: c.heading,
              };
            }
          });
          return updated;
        });
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (!ownerId) return;
    const token = getToken();
    const wsUrl = `wss://api.avapp.in/ws/owner-map/${ownerId}?token=${token}`;

    const connectWS = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        reconnectAttempts.current = 0;
        fetchHTTPCustomers(); // Sync immediately on connect
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Handle Cancellations
          if (
            data.type === "order_cancelled" || 
            data.type === "navigation_cancelled" || 
            data.type === "order_picked_up"
          ) {
            if (data.customer_id) {
              setCustomers((prev) => {
                const updated = { ...prev };
                delete updated[data.customer_id];
                return updated;
              });
            }
            return;
          }

          // Handle Live Location Updates
          if (data.customer_id && data.latitude && data.longitude) {
            setCustomers((prev) => ({
              ...prev,
              [data.customer_id]: data as CustomerLocationUpdate,
            }));
          }
        } catch (e) {}
      };

      ws.onclose = () => {
        setWsConnected(false);
        wsRef.current = null;
        // Exponential Backoff Reconnect
        const delay = Math.min(16000, Math.pow(2, reconnectAttempts.current) * 1000);
        reconnectAttempts.current++;
        reconnectTimeoutRef.current = setTimeout(connectWS, delay);
      };

      ws.onerror = () => ws.close();
    };

    connectWS();

    // Periodic fallback sync every 15s
    const syncInterval = setInterval(() => {
      if (!wsConnected) fetchHTTPCustomers();
    }, 15000);

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      clearInterval(syncInterval);
    };
  }, [ownerId]);

  // ── 2. STATUS CALCULATION ──
  const getCustomerStatus = (c: CustomerLocationUpdate) => {
    if (!ownerLat) return { phase: "UNKNOWN", otherShopName: null, dist: 0 };

    const toMe = calculateDistance(c.latitude, c.longitude, ownerLat, ownerLng) * 1000;
    
    if (!c.route_polyline) return { phase: "UNKNOWN", otherShopName: null, dist: toMe };
    
    const path = decodePolyline(c.route_polyline);
    const end = path[path.length - 1];
    if (!end) return { phase: "UNKNOWN", otherShopName: null, dist: toMe };

    const distEndToMe = calculateDistance(end.lat, end.lng, ownerLat, ownerLng) * 1000;
    
    let otherShopName = null;
    let otherDist = Infinity;
    
    allShops.forEach((s) => {
      const distToOwner = calculateDistance(s.latitude, s.longitude, ownerLat, ownerLng) * 1000;
      if (distToOwner < 15) return; // Skip own shop
      
      const d = calculateDistance(end.lat, end.lng, s.latitude, s.longitude) * 1000;
      if (d < otherDist) {
        otherDist = d;
        otherShopName = s.name;
      }
    });

    let phase = "UNKNOWN";
    if (distEndToMe <= 80 && distEndToMe <= otherDist) {
      phase = toMe <= 30 ? "AT_SHOP" : "TO_ME";
    } else if (otherDist <= 80) {
      phase = "TO_OTHER";
    }

    return { phase, otherShopName, dist: toMe };
  };

  // ── 3. MAP INITIALIZATION & DRAWING ──
  useEffect(() => {
    if (!mapContainerRef.current || !ownerLat) return;
    const apiKey = process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY;

    const initMap = async () => {
      try {
        const styleUrl = `https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json?api_key=${apiKey}`;
        const res = await fetch(styleUrl);
        const styleJson = await res.json();
        styleJson.layers = styleJson.layers.filter((l: any) => l.id !== "3d_model_data" && l["source-layer"] !== "3d_model");

        mapRef.current = new maplibregl.Map({
          container: mapContainerRef.current!,
          style: styleJson,
          center: [ownerLng, ownerLat],
          zoom: 15,
          pitch: 0,
          validateStyle: false,
          transformRequest: (url) => {
            if (url.includes("api.olamaps.io") && !url.includes("api_key=")) {
              return { url: `${url}${url.includes("?") ? "&" : "?"}api_key=${apiKey}` };
            }
            return { url };
          },
        });

        mapRef.current.on("dragstart", () => { hasManuallyZoomed.current = true; });
        
        mapRef.current.on("load", () => {
          drawMap();
        });
      } catch (e) {}
    };

    initMap();
    return () => mapRef.current?.remove();
  }, [ownerLat]);

  // Redraw markers whenever customers state updates
  useEffect(() => {
    drawMap();
  }, [customers]);

  const drawMap = () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const routeFeatures: any[] = [];
    const activeIds = new Set(Object.keys(customers));

    // Remove disconnected customers
    Object.keys(markersRef.current).forEach((id) => {
      if (!activeIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    let farthestIncoming = 0;
    let incomingCount = 0;

    // Draw Customers
    Object.values(customers).forEach((c) => {
      const status = getCustomerStatus(c);
      if (status.phase === "TO_ME" || status.phase === "AT_SHOP") {
        incomingCount++;
        if (status.dist > farthestIncoming) farthestIncoming = status.dist;
      }

      // 1. Route Polyline
      if (c.route_polyline && status.phase !== "TO_OTHER") {
        const path = decodePolyline(c.route_polyline);
        if (path.length > 1) {
          routeFeatures.push({
            type: "Feature",
            geometry: { type: "LineString", coordinates: path.map((p) => [p.lng, p.lat]) },
            properties: {},
          });
        }
      }

      // 2. Custom HTML Marker
      const color = PHASE_COLORS[status.phase as keyof typeof PHASE_COLORS] || PHASE_COLORS.UNKNOWN;
      
      if (!markersRef.current[c.customer_id]) {
        const el = document.createElement("div");
        el.className = "flex items-center justify-center transition-transform duration-1000 ease-linear";
        // Custom Arrow Pin
        el.innerHTML = `
          <div style="position: relative; width: 40px; height: 40px; background: white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
            <div style="width: 30px; height: 30px; background: ${color}; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white" style="transform: rotate(${c.heading || 0}deg);">
                <path d="M12 2L4 20L12 16L20 20L12 2Z" />
              </svg>
            </div>
          </div>
        `;
        markersRef.current[c.customer_id] = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([c.longitude, c.latitude])
          .addTo(map);
      } else {
        markersRef.current[c.customer_id].setLngLat([c.longitude, c.latitude]);
      }
    });

    // Update Route Lines in MapLibre
    const source = map.getSource("customer-routes") as maplibregl.GeoJSONSource;
    const geoJsonData = { type: "FeatureCollection", features: routeFeatures } as any;

    if (source) {
      source.setData(geoJsonData);
    } else {
      map.addSource("customer-routes", { type: "geojson", data: geoJsonData });
      map.addLayer({
        id: "customer-routes-layer",
        type: "line",
        source: "customer-routes",
        paint: { "line-color": "#1A73E8", "line-width": 5 },
      });
    }

    // Auto-Zoom Camera
    if (!hasManuallyZoomed.current && incomingCount > 0) {
      const bounds = new maplibregl.LngLatBounds();
      bounds.extend([ownerLng, ownerLat]);
      Object.values(customers).forEach((c) => {
        const s = getCustomerStatus(c);
        if (s.phase !== "TO_OTHER") bounds.extend([c.longitude, c.latitude]);
      });
      map.fitBounds(bounds, { padding: 40, maxZoom: 17 });
    }
  };

  // ── 4. UI LIST GENERATION ──
  const customerList = useMemo(() => {
    return Object.values(customers).map((c) => {
      const s = getCustomerStatus(c);
      return {
        id: c.customer_id,
        name: c.customer_name.split(" ")[0] || "Customer",
        phase: s.phase,
        dist: s.dist,
        otherShopName: s.otherShopName,
        color: PHASE_COLORS[s.phase as keyof typeof PHASE_COLORS] || PHASE_COLORS.UNKNOWN,
      };
    }).sort((a, b) => {
      // TO_ME first, then by distance
      if (a.phase === "TO_OTHER" && b.phase !== "TO_OTHER") return 1;
      if (a.phase !== "TO_OTHER" && b.phase === "TO_OTHER") return -1;
      return a.dist - b.dist;
    });
  }, [customers]);

  const incoming = customerList.filter((c) => c.phase !== "TO_OTHER").length;
  const elsewhere = customerList.length - incoming;

  return (
    <div className="flex flex-col space-y-2 mb-4">
      <h3 className="text-[16px] font-bold text-black px-1">Live Customers</h3>
      
      {/* MAP CONTAINER */}
      <div className="w-full h-[260px] bg-gray-100 rounded-[16px] overflow-hidden border border-gray-200 shadow-sm relative">
        <div ref={mapContainerRef} className="w-full h-full" />
        
        {/* STATUS BUBBLE */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-white rounded-full px-3 py-1.5 shadow-md flex items-center space-x-2 border border-gray-100">
          <div className={`w-2 h-2 rounded-full ${incoming > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
          <span className="text-[12px] font-bold text-black whitespace-nowrap">
            {customerList.length === 0
              ? "No active customers"
              : incoming === 0
              ? `${elsewhere} visiting other shops`
              : `${incoming} on the way to you`}
          </span>
        </div>

        {/* RECENTER BUTTON */}
        <button 
          onClick={() => {
            hasManuallyZoomed.current = false;
            mapRef.current?.flyTo({ center: [ownerLng, ownerLat], zoom: 16 });
          }}
          className="absolute bottom-3 right-3 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center text-black"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
        </button>
      </div>

      {/* CUSTOMER LIST */}
      {customerList.length > 0 && (
        <div className="bg-white rounded-[12px] border border-gray-200 max-h-[160px] overflow-y-auto no-scrollbar shadow-sm">
          {customerList.map((c, i) => (
            <div key={c.id}>
              {i > 0 && <div className="h-px bg-gray-100 w-full" />}
              <div className="flex items-center p-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ backgroundColor: c.color }}>
                  {i + 1}
                </div>
                <div className="ml-3 flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-black truncate">{c.name}</p>
                  <p className="text-[12px] text-gray-500 truncate">
                    {c.phase === "AT_SHOP" && "At your shop"}
                    {c.phase === "TO_ME" && `Heading to you (${formatMeters(c.dist)})`}
                    {c.phase === "TO_OTHER" && `Visiting ${c.otherShopName}`}
                    {c.phase === "UNKNOWN" && `On the way (${formatMeters(c.dist)})`}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}