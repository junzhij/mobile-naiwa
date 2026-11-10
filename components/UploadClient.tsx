"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Camera, Check, Copy, LocateFixed, MapPin, UploadCloud } from "lucide-react";
import { CampusMap, type PickedLocation } from "./CampusMap";
import { FrogIllustration } from "./FrogIllustration";

const MAX_PHOTO_BYTES = 2_500_000;

async function decodePhoto(file: File): Promise<{ image: CanvasImageSource; width: number; height: number; dispose: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { image: bitmap, width: bitmap.width, height: bitmap.height, dispose: () => bitmap.close() };
    } catch { /* Some Safari versions can display HEIC but cannot create an ImageBitmap from it. */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("image decode failed"));
      image.src = url;
    });
    return { image, width: image.naturalWidth, height: image.naturalHeight, dispose: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error(`无法读取 ${file.name}，请换一张照片或先转为 JPG。`);
  }
}

function encodePhoto(canvas: HTMLCanvasElement, type: "image/webp" | "image/jpeg", quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

async function compressedPhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) throw new Error("请选择照片文件。");
  const decoded = await decodePhoto(file);
  const canvas = document.createElement("canvas");
  let type: "image/webp" | "image/jpeg" = "image/webp";
  try {
    for (const maxDimension of [1800, 1400, 1100, 800, 600]) {
      const scale = Math.min(1, maxDimension / Math.max(decoded.width, decoded.height));
      canvas.width = Math.max(1, Math.round(decoded.width * scale));
      canvas.height = Math.max(1, Math.round(decoded.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("浏览器无法处理照片。");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(decoded.image, 0, 0, canvas.width, canvas.height);
      for (const quality of [.82, .65, .48, .35]) {
        let blob = await encodePhoto(canvas, type, quality);
        if (blob?.type !== type && type === "image/webp") {
          type = "image/jpeg";
          blob = await encodePhoto(canvas, type, quality);
        }
        if (blob?.type !== type) throw new Error("当前浏览器无法压缩照片，请使用系统相册导出 JPG 后重试。");
        if (blob.size <= MAX_PHOTO_BYTES) return blob;
      }
    }
    throw new Error(`${file.name} 处理后仍超过上传上限，请先裁剪照片再试。`);
  } finally {
    decoded.dispose();
  }
}

export function UploadClient() {
  const [stands, setStands] = useState<{ id: string; name: string }[]>([]);
  const [standId, setStandId] = useState("");
  const [standsLoading, setStandsLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [nextPhone, setNextPhone] = useState("");
  const [caption, setCaption] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [picked, setPicked] = useState<PickedLocation | null>(null);
  const [locationSource, setLocationSource] = useState<"gps" | "manual">("manual");
  const [locationMessage, setLocationMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ standName: string; nextCode: string; nextPhone: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [files]);

  useEffect(() => {
    let active = true;
    fetch("/api/stands", { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "立牌列表加载失败。");
      if (!active) return;
      setStands(data.stands);
      setStandId((current) => current || data.stands[0]?.id || "");
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "立牌列表加载失败。"); })
      .finally(() => { if (active) setStandsLoading(false); });
    return () => { active = false; };
  }, []);

  function locate() {
    if (!navigator.geolocation) { setLocationMessage("当前浏览器不支持定位，请在地图上手动选点。"); return; }
    setLocationMessage("正在获取位置…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setPicked({ latitude: coords.latitude, longitude: coords.longitude }); setLocationSource("gps"); setLocationMessage("已定位。你也可以点击地图微调位置。"); },
      () => setLocationMessage("定位未成功，请在地图上点选拍照位置。"),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 }
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!standId) { setError("请先选择已经开始流动的立牌。"); return; }
    if (files.length < 1 || files.length > 3) { setError("请选择 1 至 3 张照片。"); return; }
    if (!picked) { setError("请定位或在地图上点选拍照地点。"); return; }
    let intentId = "";
    try {
      setBusy("正在整理照片…");
      const blobs: Blob[] = [];
      for (const file of files) blobs.push(await compressedPhoto(file));
      setBusy("正在准备上传…");
      const intentResponse = await fetch("/api/upload-intent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ standId, phone, code, types: blobs.map((blob) => blob.type) }) });
      const intent = await intentResponse.json();
      if (!intentResponse.ok) throw new Error(intent.error || "无法开始上传。");
      intentId = intent.intentId;
      setBusy("正在上传照片到 Cloudflare R2…");
      for (let index = 0; index < blobs.length; index++) {
        const upload = await fetch(intent.uploads[index].url, { method: "PUT", headers: { "Content-Type": blobs[index].type }, body: blobs[index] });
        if (!upload.ok) throw new Error(`第 ${index + 1} 张照片上传失败，请稍后再试。`);
      }
      setBusy("正在记录这一站…");
      const response = await fetch("/api/handoff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        standId, phone, code, nextPhone, intentId, caption, placeName,
        latitude: picked.latitude, longitude: picked.longitude, locationSource,
      }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "提交失败，请重试。");
      setResult({ standName: data.standName, nextCode: data.nextCode, nextPhone: data.nextPhone });
      setBusy("");
    } catch (cause) {
      setBusy("");
      setError(cause instanceof Error ? cause.message : "提交失败，请稍后再试。");
      if (intentId) {
        fetch("/api/upload-intent", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ standId, phone, code, intentId }) }).catch(() => {});
      }
    }
  }

  if (result) return <main className="form-page"><div className="form-shell"><Link href="/" className="back-link"><ArrowLeft size={17}/> 返回奶蛙旅程</Link><div className="success-card"><span className="success-icon"><Check size={36}/></span><span className="section-kicker">HANDOFF COMPLETE · {result.standName}</span><h1>这一站，记下啦！</h1><p>照片已经进入流动日记。请将「{result.standName}」立牌和下方交接码一起交给手机号为 <strong>{result.nextPhone}</strong> 的下家。</p><div className="code-card"><span>下一位的 4 位交接码</span><strong>{result.nextCode}</strong><button onClick={async () => { await navigator.clipboard.writeText(result.nextCode); setCopied(true); }}><Copy size={17}/>{copied ? "已复制" : "复制交接码"}</button></div><p className="code-warning">请现在保存并当面告知下家。此交接码不会再次显示；遗失后可联系管理员重置。</p><Link href="/" className="button button-dark">看看新的时间线 <ArrowRight size={18}/></Link></div></div></main>;

  return <main className="form-page"><div className="form-shell"><div className="form-top"><Link href="/" className="back-link"><ArrowLeft size={17}/> 返回奶蛙旅程</Link><span>NAIWA IN NEUQ / 接棒记录</span></div><div className="form-intro"><div><span className="section-kicker">YOUR TURN / 你的这一站</span><h1>奶蛙到你手里啦！</h1><p>拍张照片、点亮地图上的这一站，再把奶蛙送向下一个人。</p></div><div className="intro-frog"><FrogIllustration compact/></div></div>
    <form onSubmit={submit} className="upload-form">
      <section className="form-card"><div className="form-card-heading"><span className="form-step">00</span><div><h2>选择你手里的立牌</h2><p>每个立牌有自己的持有人和交接码。</p></div></div><label className="full-field">立牌名称<select value={standId} onChange={(event) => setStandId(event.target.value)} disabled={standsLoading || stands.length === 0} required><option value="">{standsLoading ? "正在加载立牌…" : "请选择立牌"}</option>{stands.map((stand) => <option value={stand.id} key={stand.id}>{stand.name}</option>)}</select></label>{!standsLoading && stands.length === 0 && <p className="holder-empty">管理员尚未创建并启用立牌。</p>}</section>
      <section className="form-card"><div className="form-card-heading"><span className="form-step">01</span><div><h2>先证明你是这一站的主人</h2><p>输入上一位交给你的手机号和 4 位交接码。</p></div></div><div className="field-grid"><label>你的手机号<input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="11 位手机号" required/></label><label>交接码<input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" pattern="[0-9]{4}" placeholder="4 位数字" maxLength={4} required/></label></div></section>
      <section className="form-card"><div className="form-card-heading"><span className="form-step">02</span><div><h2>上传奶蛙的新照片</h2><p>选 1–3 张照片，我们会在上传前压缩并移除照片中的 EXIF 信息。</p></div></div><label className="photo-drop"><input type="file" accept="image/*,.heic,.heif" multiple onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 3))}/><UploadCloud size={31}/><strong>点击选择照片</strong><span>支持手机相册 · 最多 3 张</span></label>{previews.length > 0 && <div className="preview-grid">{previews.map((url, index) => <img src={url} alt={`待上传照片 ${index + 1}`} key={url}/>)}</div>}<label className="full-field">给这一站写句话 <span>可选</span><textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={140} rows={3} placeholder="例如：今天带奶蛙去图书馆吹空调。"/></label></section>
      <section className="form-card"><div className="form-card-heading"><span className="form-step">03</span><div><h2>把这一站标在地图上</h2><p>可以使用手机定位，也可以直接点击地图选点。</p></div></div><div className="location-actions"><button type="button" className="button button-outline" onClick={locate}><LocateFixed size={18}/> 使用当前定位</button><span>{locationMessage || (picked ? `已选位置：${picked.latitude.toFixed(5)}, ${picked.longitude.toFixed(5)}` : "还没有选择地点")}</span></div><div className="form-map"><CampusMap editable picked={picked} onPick={(point) => { setPicked(point); setLocationSource("manual"); setLocationMessage("已手动选择拍照位置。"); }}/></div><label className="full-field">给地点起个名字 <span>可选</span><input value={placeName} onChange={(event) => setPlaceName(event.target.value)} maxLength={50} placeholder="例如：图书馆门口、操场看台"/></label></section>
      <section className="form-card"><div className="form-card-heading"><span className="form-step">04</span><div><h2>把奶蛙交给下一位</h2><p>提交后会生成新交接码，请随立牌当面告诉下家。</p></div></div><label className="full-field">下家的手机号<input value={nextPhone} onChange={(event) => setNextPhone(event.target.value)} inputMode="tel" placeholder="11 位手机号" required/></label></section>
      {error && <div className="notice notice-error" role="alert">{error}</div>}<button className="button button-dark submit-button" type="submit" disabled={Boolean(busy) || !standId}>{busy || "发布这一站，交给下一位"}<ArrowRight size={19}/></button><p className="privacy-note"><MapPin size={15}/> 公开页面只展示照片、立牌名称、时间与地图位置，不展示手机号。</p>
    </form><footer className="form-footer"><span>奶蛙在东秦</span><a href="mailto:jjzz08@icloud.com">jjzz08@icloud.com</a></footer></div></main>;
}
