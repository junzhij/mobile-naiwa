"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Copy, Eye, EyeOff, KeyRound, LockKeyhole, LogOut, Plus, RefreshCw, ShieldCheck } from "lucide-react";

type Stand = {
  id: string;
  name: string;
  active: boolean;
  holder: { phone: string; version: number; updatedAt: string; codeResetRequired: boolean } | null;
};
type Overview = {
  stands: Stand[];
  logs: { id: string; created_at: string; action: string; stand_id: string; stand_name: string; detail: Record<string, string | number> }[];
  visits: { id: string; sequence: number; created_at: string; place_name: string | null; hidden: boolean; stand_id: string; stand_name: string }[];
};

const actionLabel: Record<string, string> = {
  admin_start: "立牌开始流动",
  admin_change_holder: "管理员修改当前手机号",
  admin_reset_code: "管理员重置交接码",
  admin_rename_stand: "管理员修改立牌名称",
  handoff: "完成一次接棒",
  admin_hide_visit: "隐藏照片记录",
  admin_show_visit: "恢复照片记录",
};
const dateFormat = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

export function AdminClient() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [selectedStandId, setSelectedStandId] = useState("");
  const [key, setKey] = useState("");
  const [phone, setPhone] = useState("");
  const [renameName, setRenameName] = useState("");
  const [newStandName, setNewStandName] = useState("");
  const [newStandPhone, setNewStandPhone] = useState("");
  const [newCode, setNewCode] = useState<{ standName: string; code: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/overview", { cache: "no-store" });
    if (response.status === 401) { setOverview(null); setLoading(false); return; }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "管理数据加载失败。");
    setOverview(data);
    setSelectedStandId((current) => data.stands.some((stand: Stand) => stand.id === current) ? current : data.stands[0]?.id || "");
    setLoading(false);
  }, []);

  useEffect(() => { refresh().catch((cause) => { setError(cause instanceof Error ? cause.message : "加载失败"); setLoading(false); }); }, [refresh]);

  const selectedStand = overview?.stands.find((stand) => stand.id === selectedStandId);
  useEffect(() => {
    setPhone(selectedStand?.holder?.phone || "");
    setRenameName(selectedStand?.name || "");
  }, [selectedStand?.id, selectedStand?.name, selectedStand?.holder?.phone]);

  async function requestJson(path: string, method: string, body: Record<string, unknown>) {
    const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "操作失败，请重试。");
    return data;
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      await requestJson("/api/admin/session", "POST", { key });
      setKey("");
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "登录失败"); }
    finally { setBusy(false); }
  }

  async function setHolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true); setNewCode(null);
    try {
      const data = await requestJson("/api/admin/holder", "POST", { standId: selectedStandId, phone });
      setNewCode({ standName: selectedStand?.name || "当前立牌", code: data.code });
      setCopied(false);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "修改失败"); }
    finally { setBusy(false); }
  }

  async function createStand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true); setNewCode(null);
    try {
      const data = await requestJson("/api/admin/stands", "POST", { name: newStandName, phone: newStandPhone });
      setNewCode({ standName: data.stand.name, code: data.code });
      setCopied(false);
      setNewStandName(""); setNewStandPhone("");
      setSelectedStandId(data.stand.id);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "创建失败"); }
    finally { setBusy(false); }
  }

  async function renameStand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      await requestJson(`/api/admin/stands/${selectedStandId}`, "PATCH", { name: renameName });
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "改名失败"); }
    finally { setBusy(false); }
  }

  async function toggleVisit(id: string, hidden: boolean) {
    setError("");
    try {
      await requestJson(`/api/admin/visits/${id}`, "PATCH", { hidden: !hidden });
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "操作失败"); }
  }

  async function logout() { await fetch("/api/admin/session", { method: "DELETE" }); setOverview(null); setNewCode(null); }

  return <main className="form-page admin-page"><div className="form-shell">
    <div className="form-top"><Link href="/" className="back-link"><ArrowLeft size={17}/> 返回网站</Link><span>NAIWA IN NEUQ / ADMIN</span></div>
    {loading ? <div className="loading-card">正在打开管理页…</div> : !overview ? (
      <div className="admin-login"><span className="admin-login-icon"><LockKeyhole size={30}/></span><span className="section-kicker">PRIVATE ACCESS</span><h1>奶蛙管理入口</h1><p>输入管理密钥，查看每块立牌的持有人与流转日志。</p>
        <form onSubmit={login}><label>管理密钥<input type="password" value={key} onChange={(event) => setKey(event.target.value)} autoComplete="off" placeholder="输入 ADMIN_KEY" required/></label>{error && <div className="notice notice-error">{error}</div>}<button type="submit" className="button button-dark" disabled={busy}>{busy ? "验证中…" : "进入管理页"}<ArrowRight size={18}/></button></form>
        <div className="admin-login-foot"><ShieldCheck size={16}/> 密钥只在服务端验证，不会保存在浏览器里。</div>
      </div>
    ) : (
      <div className="admin-dashboard">
        <div className="admin-heading"><div><span className="section-kicker">CONTROL ROOM</span><h1>奶蛙控制室</h1><p>{overview.stands.length} 块立牌独立流动，照片汇入同一条时间线。</p></div><button className="admin-logout" onClick={logout}><LogOut size={17}/> 退出</button></div>
        {error && <div className="notice notice-error" role="alert">{error}</div>}
        {newCode && <div className="admin-code admin-code-prominent"><span>「{newCode.standName}」的新 4 位交接码，请立即交给当前持有人</span><strong>{newCode.code}</strong><button onClick={async () => { await navigator.clipboard.writeText(newCode.code); setCopied(true); }}><Copy size={16}/>{copied ? "已复制" : "复制交接码"}</button></div>}
        <div className="admin-grid">
          <section className="admin-panel holder-panel">
            <div className="admin-panel-title"><KeyRound size={22}/><h2>立牌与当前持有人</h2></div>
            <div className="stand-switcher" aria-label="选择立牌">{overview.stands.map((stand) => <button type="button" key={stand.id} className={stand.id === selectedStandId ? "stand-choice active" : "stand-choice"} onClick={() => { setSelectedStandId(stand.id); setNewCode(null); }}>{stand.name}</button>)}</div>
            {selectedStand && <>
              {selectedStand.holder ? <><span className="admin-panel-label">{selectedStand.name} · 当前手机号</span><strong className="holder-phone">{selectedStand.holder.phone}</strong><p>状态版本 #{selectedStand.holder.version} · 最近更新 {dateFormat.format(new Date(selectedStand.holder.updatedAt))}</p>{selectedStand.holder.codeResetRequired && <div className="notice notice-error">旧版交接码已停用。请用下方按钮生成 4 位数字交接码。</div>}</> : <div className="holder-empty">这块立牌尚未设置持有人。</div>}
              <form onSubmit={setHolder}><label>当前手机号，可保留原号只重置交接码<input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="11 位手机号" required/></label><button className="button button-dark" type="submit" disabled={busy}>{busy ? "保存中…" : "保存手机号并生成 4 位码"}<RefreshCw size={17}/></button></form>
              <form className="rename-form" onSubmit={renameStand}><label>立牌名称<input value={renameName} onChange={(event) => setRenameName(event.target.value)} maxLength={50} required/></label><button className="button button-outline" type="submit" disabled={busy || renameName.trim() === selectedStand.name}>保存名称</button></form>
            </>}
          </section>
          <section className="admin-panel create-stand-panel">
            <div className="admin-panel-title"><Plus size={22}/><h2>新增一块立牌</h2></div>
            <p className="admin-help">新立牌会有自己的手机号和交接码，创建后立即可以独立接棒。</p>
            <form onSubmit={createStand}><label>立牌名称<input value={newStandName} onChange={(event) => setNewStandName(event.target.value)} maxLength={50} placeholder="例如：图书馆奶蛙" required/></label><label>首位持有人手机号<input value={newStandPhone} onChange={(event) => setNewStandPhone(event.target.value)} inputMode="tel" placeholder="11 位手机号" required/></label><button className="button button-dark" type="submit" disabled={busy}>{busy ? "创建中…" : "创建立牌并生成交接码"}<Plus size={17}/></button></form>
          </section>
        </div>
        <section className="admin-panel log-panel"><div className="admin-panel-title"><ShieldCheck size={22}/><h2>流转日志</h2></div>{overview.logs.length === 0 ? <p className="admin-empty">还没有操作记录。</p> : <ul className="log-list">{overview.logs.map((log) => <li key={log.id}><span className="log-bullet"/><div><strong><span className="stand-tag">{log.stand_name}</span>{actionLabel[log.action] || log.action}</strong><span>{[log.detail.from && `${log.detail.from} →`, log.detail.to, log.detail.photoCount && `${log.detail.photoCount} 张照片`].filter(Boolean).join(" ")}</span></div><time>{dateFormat.format(new Date(log.created_at))}</time></li>)}</ul>}</section>
        <section className="admin-panel visits-panel"><div className="admin-panel-title"><Eye size={22}/><h2>公开照片记录</h2></div>{overview.visits.length === 0 ? <p className="admin-empty">还没有照片记录。</p> : <div className="admin-visits">{overview.visits.map((visit) => <div key={visit.id}><span>#{String(visit.sequence).padStart(3, "0")}</span><strong><span className="stand-tag">{visit.stand_name}</span>{visit.place_name || "东秦校园的一角"}</strong><time>{dateFormat.format(new Date(visit.created_at))}</time><button onClick={() => toggleVisit(visit.id, visit.hidden)}>{visit.hidden ? <><Eye size={16}/> 恢复展示</> : <><EyeOff size={16}/> 隐藏记录</>}</button></div>)}</div>}</section>
      </div>
    )}
    <footer className="form-footer"><span>奶蛙在东秦 · 管理页</span><a href="mailto:jjzz08@icloud.com">jjzz08@icloud.com</a></footer>
  </div></main>;
}
