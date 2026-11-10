"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight, Camera, Compass, Mail, MapPin, MoveUpRight, Sparkles } from "lucide-react";
import { CampusMap, type MapLocation } from "./CampusMap";
import { FrogIllustration } from "./FrogIllustration";

type Entry = {
  id: string; standId: string; standName: string; sequence: number; createdAt: string; caption: string | null; placeName: string | null;
  latitude: number; longitude: number; locationSource: "gps" | "manual";
  photos: { id: string; url: string }[];
};

const dateFormat = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

export function HomeClient() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/journey", { cache: "no-store" }), fetch("/api/locations", { cache: "no-store" })])
      .then(async ([journeyResponse, locationsResponse]) => {
        const journey = await journeyResponse.json();
        const mapData = await locationsResponse.json();
        if (!journeyResponse.ok || !locationsResponse.ok) throw new Error(journey.error || mapData.error || "旅程加载失败");
        if (!active) return;
        setEntries(journey.entries);
        setNextCursor(journey.nextCursor);
        setLocations(mapData.locations);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "旅程加载失败"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await fetch(`/api/journey?cursor=${nextCursor}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "加载失败");
      setEntries((previous) => [...previous, ...data.entries]);
      setNextCursor(data.nextCursor);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "加载失败"); }
    finally { setLoadingMore(false); }
  }

  async function selectLocation(id: string) {
    setSelectedId(id);
    let node = document.getElementById(`visit-${id}`);
    if (!node) {
      let cursor = nextCursor;
      const added: Entry[] = [];
      while (cursor) {
        const response = await fetch(`/api/journey?cursor=${cursor}`, { cache: "no-store" });
        if (!response.ok) break;
        const data = await response.json();
        added.push(...data.entries);
        cursor = data.nextCursor;
        if (data.entries.some((entry: Entry) => entry.id === id)) break;
      }
      if (added.length) { setEntries((previous) => [...previous, ...added]); setNextCursor(cursor); }
      await new Promise((resolve) => setTimeout(resolve, 80));
      node = document.getElementById(`visit-${id}`);
    }
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const latest = entries[0];
  return (
    <main>
      <div className="site-shell">
        <header className="site-header">
          <Link className="brand" href="/" aria-label="奶蛙在东秦首页"><span className="brand-icon">●<i>●</i></span><span>奶蛙在东秦<small>NAIWA IN NEUQ</small></span></Link>
          <nav aria-label="主导航"><a href="#journey">流动日记</a><a href="#map">足迹地图</a><Link className="nav-cta" href="/upload">我接到奶蛙了 <MoveUpRight size={16}/></Link></nav>
        </header>

        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot"/>东北大学秦皇岛分校 · 校园接力中</div>
            <h1 id="hero-title">这只奶蛙，<br/><em>今天去哪儿？</em></h1>
            <p>一块块奶蛙立牌，正在东秦校园里各自旅行。接过手里的那只、拍下这一站，再把快乐交给下一个人。</p>
            <div className="hero-actions"><Link href="/upload" className="button button-dark">我接到奶蛙了 <ArrowRight size={19}/></Link><a href="#journey" className="text-link">看看它的旅程 <ArrowDown size={18}/></a></div>
            <div className="hero-note"><Sparkles size={16}/> 每一张照片，都是奶蛙的新故事</div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="hero-art-circle"/>
            <div className="hero-orbit orbit-one"/>
            <div className="hero-orbit orbit-two"/>
            <span className="art-sticker sticker-left">下一站<br/><b>未知！</b></span>
            <span className="art-sticker sticker-right">东秦<br/>漫游中 ✦</span>
            <span className="art-spark spark-one">✳</span><span className="art-spark spark-two">✦</span><span className="art-spark spark-three">✳</span>
            <img className="hero-mascot" src="/naiwa_mascot.svg" alt=""/>
            <span className="hero-art-caption">奶蛙立牌的校园旅行计划</span>
          </div>
        </section>

        <section className="stats-strip" aria-label="旅程统计">
          <div><span className="stat-symbol">✳</span><strong>{locations.length}</strong><span>次快乐接力</span></div>
          <div><span className="stat-symbol">◉</span><strong>{new Set(locations.map((item) => `${item.latitude.toFixed(4)},${item.longitude.toFixed(4)}`)).size}</strong><span>处校园足迹</span></div>
          <div className="stats-latest"><span className="stat-symbol">↗</span><strong>{latest?.placeName || "等你开启"}</strong><span>最近一站</span></div>
        </section>

        <section id="journey" className="section journey-section">
          <div className="section-heading"><div><span className="section-kicker">THE JOURNEY / 01</span><h2>奶蛙的<span>流动日记</span></h2><p>按下快门，留下它来到这里的证据。</p></div><span className="heading-doodle" aria-hidden="true">✻</span></div>
          {error && <div className="notice notice-error" role="alert">{error}</div>}
          {loading ? <div className="loading-card">正在翻开奶蛙的旅行日记…</div> : entries.length === 0 ? (
            <div className="empty-journey">
              <div className="empty-photo"><div className="empty-photo-inner"><FrogIllustration compact/></div><span>NO. 001 · 等待第一张照片</span></div>
              <div><span className="pill">旅程即将开始</span><h3>第一站，会是哪里？</h3><p>奶蛙已经准备好出发。拿到立牌后，拍下它在校园的第一张旅行照片吧。</p><Link href="/upload" className="button button-dark">成为第一位记录者 <ArrowRight size={18}/></Link></div>
            </div>
          ) : (
            <div className="timeline">
              {entries.map((entry, index) => <article id={`visit-${entry.id}`} key={entry.id} className={`timeline-item ${selectedId === entry.id ? "selected" : ""}`}>
                <div className="timeline-axis"><span className="timeline-dot"/><span>#{String(entry.sequence).padStart(3, "0")}</span></div>
                <div className="timeline-card">
                  <div className="timeline-meta"><span><span className="stand-tag">{entry.standName}</span><MapPin size={16}/>{entry.placeName || "东秦校园的一角"}</span><time dateTime={entry.createdAt}>{dateFormat.format(new Date(entry.createdAt))}</time></div>
                  <div className={`photo-grid photo-count-${entry.photos.length}`}>{entry.photos.map((photo, photoIndex) => <div className="photo-frame" key={photo.id}><img src={photo.url} alt={`奶蛙第 ${entry.sequence} 站照片 ${photoIndex + 1}`} loading={index < 2 ? "eager" : "lazy"}/></div>)}</div>
                  <div className="timeline-bottom"><p>{entry.caption || "奶蛙在这里留下一张照片，继续向下一站出发。"}</p><button onClick={() => { setSelectedId(entry.id); document.getElementById("map")?.scrollIntoView({ behavior: "smooth" }); }} className="card-map-button">在地图上看 <MoveUpRight size={16}/></button></div>
                </div>
              </article>)}
              {nextCursor && <button className="button button-outline load-more" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "正在加载…" : "继续翻看旧照片"} <ArrowDown size={17}/></button>}
            </div>
          )}
        </section>

        <section id="map" className="section map-section">
          <div className="section-heading"><div><span className="section-kicker">THE MAP / 02</span><h2>奶蛙的<span>校园足迹</span></h2><p>地图上的每一个点，都是一次真实的相遇。</p></div><Compass className="heading-icon" size={50} strokeWidth={1.25}/></div>
          <div className="map-card"><div className="map-card-top"><span><span className="live-dot"/>东秦 · 秦皇岛</span><span>{locations.length} 个足迹标记</span></div><CampusMap locations={locations} selectedId={selectedId} onSelect={selectLocation}/><div className="map-card-bottom"><span>点击标记，回到那张照片</span><span>地图服务 © 高德地图</span></div></div>
        </section>

        <section className="how-section"><div className="how-heading"><span className="section-kicker">HOW IT WORKS / 03</span><h2>快乐如何<span>继续流动？</span></h2></div><div className="how-grid">
          <div className="how-card"><span className="how-number">01</span><Camera size={35} strokeWidth={1.5}/><h3>带它去拍照</h3><p>带奶蛙逛逛校园，在喜欢的角落留下合影。</p></div>
          <div className="how-card"><span className="how-number">02</span><MapPin size={35} strokeWidth={1.5}/><h3>记下这一站</h3><p>输入手机号和交接码，上传照片并标记地点。</p></div>
          <div className="how-card"><span className="how-number">03</span><ArrowRight size={35} strokeWidth={1.5}/><h3>交给下一位</h3><p>填写下家手机号，把新的交接码随立牌交给 ta。</p></div>
        </div><Link href="/upload" className="button button-yellow">轮到我接棒了 <ArrowRight size={19}/></Link></section>

        <footer className="site-footer"><div><span className="footer-frog">●<i>●</i></span><strong>奶蛙在东秦</strong><p>每只奶蛙，都有自己的好天气。</p></div><div><span>想联系奶蛙的发起人？</span><a href="mailto:jjzz08@icloud.com"><Mail size={16}/> jjzz08@icloud.com</a><Link href="/admin" className="footer-admin">管理入口</Link></div></footer>
      </div>
    </main>
  );
}
