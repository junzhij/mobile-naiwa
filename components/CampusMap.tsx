"use client";

import { useEffect, useRef, useState } from "react";
import { gcj02ToWgs84, wgs84ToGcj02, type GeoPoint } from "@/lib/geo";

export type MapLocation = GeoPoint & { id: string; sequence?: number; placeName?: string | null; standName?: string | null };
export type PickedLocation = GeoPoint;

type LngLat = { getLng(): number; getLat(): number };
type MapClick = { lnglat: LngLat };
type AMapMarker = { on(event: string, handler: () => void): void; setMap(map: AMapMap | null): void };
type AMapMap = {
  on(event: string, handler: (event: MapClick) => void): void;
  setCenter(position: [number, number]): void;
  setZoom(zoom: number): void;
  getZoom(): number;
  zoomIn(): void;
  zoomOut(): void;
  destroy(): void;
};
type AMapApi = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => AMapMap;
  Marker: new (options: Record<string, unknown>) => AMapMarker;
  Pixel: new (x: number, y: number) => unknown;
};

declare global {
  interface Window {
    AMap?: AMapApi;
    _AMapSecurityConfig?: { serviceHost: string };
  }
}

const CENTER: GeoPoint = { latitude: 39.92095, longitude: 119.54468 };
let sdkPromise: Promise<AMapApi> | null = null;

function mapPosition(point: GeoPoint): [number, number] {
  const converted = wgs84ToGcj02(point);
  return [converted.longitude, converted.latitude];
}

function loadAmap(): Promise<AMapApi> {
  if (window.AMap) return Promise.resolve(window.AMap);
  if (sdkPromise) return sdkPromise;
  const key = process.env.NEXT_PUBLIC_AMAP_KEY;
  if (!key) return Promise.reject(new Error("地图服务尚未配置。"));
  window._AMapSecurityConfig = { serviceHost: `${window.location.origin}/_AMapService` };
  const promise = new Promise<AMapApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}`;
    script.async = true;
    script.onload = () => window.AMap ? resolve(window.AMap) : reject(new Error("高德地图没有正确初始化。"));
    script.onerror = () => reject(new Error("高德地图加载失败，请检查网络后重试。"));
    document.head.appendChild(script);
  }).catch((error) => { sdkPromise = null; throw error; });
  sdkPromise = promise;
  return promise;
}

function markerContent(label: string, active = false) {
  const wrapper = document.createElement("div");
  wrapper.className = "map-marker-wrap";
  const pin = document.createElement("span");
  pin.className = `map-marker${active ? " active" : ""}`;
  pin.textContent = label;
  wrapper.appendChild(pin);
  return wrapper;
}

export function CampusMap({ locations = [], selectedId, onSelect, editable = false, picked, onPick }: {
  locations?: MapLocation[]; selectedId?: string | null; onSelect?: (id: string) => void;
  editable?: boolean; picked?: PickedLocation | null; onPick?: (point: PickedLocation) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<AMapMap | null>(null);
  const api = useRef<AMapApi | null>(null);
  const markers = useRef<AMapMarker[]>([]);
  const callbacks = useRef({ onSelect, onPick });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  callbacks.current = { onSelect, onPick };

  useEffect(() => {
    let cancelled = false;
    loadAmap().then((AMap) => {
      if (cancelled || !element.current) return;
      api.current = AMap;
      const instance = new AMap.Map(element.current, {
        zoom: 16,
        center: mapPosition(CENTER),
        viewMode: "2D",
        mapStyle: "amap://styles/whitesmoke",
        resizeEnable: true,
      });
      instance.on("click", (event) => {
        if (editable) callbacks.current.onPick?.(gcj02ToWgs84({ latitude: event.lnglat.getLat(), longitude: event.lnglat.getLng() }));
      });
      map.current = instance;
      setReady(true);
    }).catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "地图加载失败。"); });
    return () => {
      cancelled = true;
      markers.current.forEach((marker) => marker.setMap(null));
      markers.current = [];
      map.current?.destroy();
      map.current = null;
      api.current = null;
    };
  }, [editable]);

  useEffect(() => {
    if (!ready || !map.current || !api.current) return;
    markers.current.forEach((marker) => marker.setMap(null));
    markers.current = [];
    for (const location of locations) {
      const marker = new api.current.Marker({
        position: mapPosition(location),
        content: markerContent(String(location.sequence ?? "●"), location.id === selectedId),
        offset: new api.current.Pixel(-21, -44),
        title: [location.standName, location.placeName].filter(Boolean).join(" · ") || "奶蛙足迹",
      });
      marker.setMap(map.current);
      marker.on("click", () => callbacks.current.onSelect?.(location.id));
      markers.current.push(marker);
    }
    if (editable && picked) {
      const marker = new api.current.Marker({
        position: mapPosition(picked),
        content: markerContent("✓", true),
        offset: new api.current.Pixel(-21, -44),
      });
      marker.setMap(map.current);
      markers.current.push(marker);
    }
  }, [ready, locations, selectedId, editable, picked]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const selected = selectedId ? locations.find((location) => location.id === selectedId) : null;
    if (selected) {
      map.current.setCenter(mapPosition(selected));
      if (map.current.getZoom() < 16) map.current.setZoom(16);
    } else if (editable && picked) {
      map.current.setCenter(mapPosition(picked));
    }
  }, [ready, selectedId, locations, editable, picked]);

  return <div className="campus-map-wrap">
    <div className="campus-map" ref={element} aria-label={editable ? "点击地图选择拍照位置" : "奶蛙在校园的打卡地图"}/>
    {error && <div className="map-error" role="alert">{error}</div>}
    {ready && <div className="map-zoom" aria-label="地图缩放">
      <button type="button" onClick={() => map.current?.zoomIn()} aria-label="放大地图">+</button>
      <button type="button" onClick={() => map.current?.zoomOut()} aria-label="缩小地图">−</button>
    </div>}
  </div>;
}
