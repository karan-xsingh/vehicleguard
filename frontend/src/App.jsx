import { useState, useEffect, useRef, useCallback } from "react";

const API = "http://localhost:8000";

const RISK = {
  ALERT:    { color: "#00ff88", glow: "#00ff8844", label: "ALERT",    emoji: "✅", bg: "#001a0d" },
  DROWSY:   { color: "#ffaa00", glow: "#ffaa0044", label: "DROWSY",   emoji: "😴", bg: "#1a0e00" },
  CRITICAL: { color: "#ff3355", glow: "#ff335544", label: "CRITICAL", emoji: "🚨", bg: "#1a0008" },
};

function timeAgo(iso) {
  const d = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d/60)}m ago`;
  return `${Math.floor(d/3600)}h ago`;
}

// Animated speedometer-style gauge
function RiskGauge({ value, riskLevel }) {
  const r = RISK[riskLevel] || RISK.ALERT;
  const angle = -135 + (value / 100) * 270;
  const circumference = 2 * Math.PI * 54;
  const dash = (value / 100) * circumference * 0.75;

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"20px 0" }}>
      <div style={{ position:"relative", width:160, height:160 }}>
        <svg width="160" height="160" viewBox="0 0 160 160">
          {/* Background arc */}
          <circle cx="80" cy="80" r="54" fill="none" stroke="#1a1a2e" strokeWidth="12"
            strokeDasharray={`${circumference * 0.75} ${circumference}`}
            strokeDashoffset={circumference * 0.125}
            strokeLinecap="round" transform="rotate(135 80 80)"/>
          {/* Value arc */}
          <circle cx="80" cy="80" r="54" fill="none" stroke={r.color} strokeWidth="12"
            strokeDasharray={`${dash} ${circumference}`}
            strokeDashoffset={circumference * 0.125}
            strokeLinecap="round" transform="rotate(135 80 80)"
            style={{ filter:`drop-shadow(0 0 8px ${r.color})`, transition:"all 0.5s ease" }}/>
          {/* Tick marks */}
          {[0,25,50,75,100].map(v => {
            const a = (-135 + v * 2.7) * Math.PI / 180;
            const x1 = 80 + 48 * Math.cos(a), y1 = 80 + 48 * Math.sin(a);
            const x2 = 80 + 40 * Math.cos(a), y2 = 80 + 40 * Math.sin(a);
            return <line key={v} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#333" strokeWidth="2"/>;
          })}
          {/* Needle */}
          <line
            x1="80" y1="80"
            x2={80 + 42 * Math.cos((angle - 90) * Math.PI / 180)}
            y2={80 + 42 * Math.sin((angle - 90) * Math.PI / 180)}
            stroke={r.color} strokeWidth="2.5" strokeLinecap="round"
            style={{ filter:`drop-shadow(0 0 4px ${r.color})`, transition:"all 0.5s ease" }}/>
          <circle cx="80" cy="80" r="5" fill={r.color} style={{ filter:`drop-shadow(0 0 6px ${r.color})` }}/>
        </svg>
        <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", marginTop:16 }}>
          <div style={{ fontSize:28, fontWeight:900, color:r.color, fontFamily:"monospace",
            textShadow:`0 0 20px ${r.color}`, transition:"all 0.3s" }}>
            {value}%
          </div>
        </div>
      </div>
      <div style={{ marginTop:8, padding:"6px 20px", borderRadius:20, background:r.bg,
        border:`1px solid ${r.color}44`, color:r.color, fontWeight:800, fontSize:14, letterSpacing:3,
        textShadow:`0 0 10px ${r.color}` }}>
        {r.label}
      </div>
    </div>
  );
}

// Glowing stat card
function StatCard({ label, value, color, icon }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #0a0a1a, #111128)",
      border: `1px solid ${color}33`,
      borderRadius: 16, padding: "16px 20px", flex: 1, minWidth: 120,
      boxShadow: `0 4px 24px ${color}11`,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position:"absolute", top:-20, right:-20, width:80, height:80,
        borderRadius:"50%", background:color, opacity:0.04 }}/>
      <div style={{ fontSize:22, marginBottom:4 }}>{icon}</div>
      <div style={{ color, fontSize:28, fontWeight:900, fontFamily:"monospace",
        textShadow:`0 0 12px ${color}88` }}>{value}</div>
      <div style={{ color:"#555", fontSize:10, letterSpacing:2, textTransform:"uppercase", marginTop:2 }}>{label}</div>
    </div>
  );
}

// Alert item
function AlertItem({ alert }) {
  const isIntruder = alert.type === "INTRUDER_DETECTED";
  const color = isIntruder ? "#ff3355" : "#ffaa00";
  return (
    <div style={{
      background: "linear-gradient(135deg, #0a0a1a, #111128)",
      border: `1px solid ${color}22`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 12, padding: "12px 16px",
      display: "flex", alignItems: "center", gap: 12,
      boxShadow: `0 2px 12px ${color}11`,
    }}>
      <div style={{ fontSize: 24 }}>{isIntruder ? "🚨" : "😴"}</div>
      <div style={{ flex: 1 }}>
        <div style={{ color, fontWeight: 700, fontSize: 13 }}>
          {isIntruder ? "Intruder Detected" : `Drowsiness — ${alert.risk_level || ""}`}
        </div>
        <div style={{ color: "#444", fontSize: 11, marginTop: 2 }}>
          {timeAgo(alert.timestamp)}
          {alert.gps && ` · ${alert.gps.lat?.toFixed(4)}, ${alert.gps.lng?.toFixed(4)}`}
        </div>
      </div>
      {alert.image_b64 && (
        <img src={`data:image/png;base64,${alert.image_b64}`}
          style={{ width:44, height:44, borderRadius:8, objectFit:"cover", border:`2px solid ${color}44` }}/>
      )}
    </div>
  );
}

export default function App() {
  const monitorVidRef  = useRef(null);
  const securityVidRef = useRef(null);
  const canvasRef      = useRef(null);
  const intervalRef    = useRef(null);
  const streamRef      = useRef(null);

  const [tab,          setTab]         = useState("monitor");
  const [cameraOn,     setCameraOn]    = useState(false);
  const [detecting,    setDetecting]   = useState(false);
  const [riskLevel,    setRiskLevel]   = useState("ALERT");
  const [drowsyProb,   setDrowsyProb]  = useState(0);
  const [latency,      setLatency]     = useState(null);
  const [stats,        setStats]       = useState(null);
  const [alerts,       setAlerts]      = useState([]);
  const [gps,          setGps]         = useState(null);
  const [ownerReg,     setOwnerReg]    = useState(false);
  const [verifyResult, setVerify]      = useState(null);
  const [apiStatus,    setApiStatus]   = useState("checking");
  const [intruderImg,  setIntruderImg] = useState(null);
  const [userLocation, setUserLocation]= useState(null);
  const [locError,     setLocError]    = useState(null);

  // Get real browser GPS
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocError("Geolocation not supported by browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocError(null);
      },
      (err) => setLocError(err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
    // Watch for position changes
    const wid = navigator.geolocation.watchPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(wid);
  }, []);

  // API health
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch(`${API}/health`);
        const d = await r.json();
        setApiStatus("online");
        setOwnerReg(d.owner_registered);
      } catch { setApiStatus("offline"); }
    };
    check();
    const t = setInterval(check, 8000);
    return () => clearInterval(t);
  }, []);

  // Refresh data
  const refresh = useCallback(async () => {
    if (apiStatus !== "online") return;
    try {
      const [sRes, aRes] = await Promise.all([
        fetch(`${API}/stats`), fetch(`${API}/alerts`)
      ]);
      setStats(await sRes.json());
      const ad = await aRes.json();
      setAlerts(ad.alerts || []);
      // Update GPS with real location if available
      if (userLocation) setGps({ ...userLocation, timestamp: new Date().toISOString() });
    } catch {}
  }, [apiStatus, userLocation]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  // Camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:"user" } });
      streamRef.current = stream;
      [monitorVidRef, securityVidRef].forEach(ref => {
        if (ref.current) { ref.current.srcObject = stream; ref.current.play(); }
      });
      setCameraOn(true);
    } catch (e) { alert("Camera access denied: " + e.message); }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    [monitorVidRef, securityVidRef].forEach(ref => { if (ref.current) ref.current.srcObject = null; });
    setCameraOn(false);
    setDetecting(false);
    clearInterval(intervalRef.current);
  };

  const captureFrame = (size = 128) => {
    const vRef = tab === "monitor" ? monitorVidRef.current : securityVidRef.current;
    if (!vRef || !canvasRef.current) return null;
    const c = canvasRef.current;
    c.width = size; c.height = size;
    c.getContext("2d").drawImage(vRef, 0, 0, size, size);
    return c;
  };

  const captureAndDetect = useCallback(async () => {
    const vRef = monitorVidRef.current;
    if (!vRef || !canvasRef.current) return;
    const c = canvasRef.current;
    c.width = 128; c.height = 128;
    c.getContext("2d").drawImage(vRef, 0, 0, 128, 128);
    c.toBlob(async blob => {
      const form = new FormData();
      form.append("file", blob, "frame.png");
      try {
        const r = await fetch(`${API}/detect-drowsiness`, { method:"POST", body:form });
        const d = await r.json();
        setRiskLevel(d.risk_level);
        setDrowsyProb(d.drowsy_prob);
        setLatency(d.latency_ms);
        if (d.is_drowsy) refresh();
      } catch {}
    }, "image/png");
  }, [refresh]);

  const toggleDetection = () => {
    if (detecting) { clearInterval(intervalRef.current); setDetecting(false); }
    else { setDetecting(true); captureAndDetect(); intervalRef.current = setInterval(captureAndDetect, 1000); }
  };

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const registerOwner = async () => {
    if (!cameraOn) { alert("Start camera first"); return; }
    const vRef = securityVidRef.current;
    if (!vRef || !canvasRef.current) return;
    const c = canvasRef.current; c.width = 224; c.height = 224;
    c.getContext("2d").drawImage(vRef, 0, 0, 224, 224);
    c.toBlob(async blob => {
      const form = new FormData(); form.append("file", blob, "owner.png");
      const r = await fetch(`${API}/register-owner`, { method:"POST", body:form });
      const d = await r.json();
      if (d.success) { setOwnerReg(true); alert("✅ Owner registered!"); }
    }, "image/png");
  };

  const verifyDriver = async () => {
    if (!cameraOn) { alert("Start camera first"); return; }
    const vRef = securityVidRef.current;
    if (!vRef || !canvasRef.current) return;
    const c = canvasRef.current; c.width = 224; c.height = 224;
    c.getContext("2d").drawImage(vRef, 0, 0, 224, 224);
    c.toBlob(async blob => {
      const form = new FormData(); form.append("file", blob, "driver.png");
      try {
        const r = await fetch(`${API}/verify-driver`, { method:"POST", body:form });
        const d = await r.json();
        setVerify(d);
        if (!d.is_owner && d.intruder_image) setIntruderImg(d.intruder_image);
        refresh();
      } catch (e) { alert("Error: " + e.message); }
    }, "image/png");
  };

  const risk = RISK[riskLevel] || RISK.ALERT;
  const loc = userLocation || gps;

  // ── Styles ──────────────────────────────────────────────────
  const tabLabels = { monitor:"🚗 Monitor", security:"🔒 Security", alerts:"🚨 Alerts", map:"📍 Location" };

  return (
    <div style={{ minHeight:"100vh", background:"#050510", color:"#e0e0ff", fontFamily:"'Inter','Segoe UI',sans-serif" }}>

      {/* Header */}
      <div style={{
        background:"linear-gradient(90deg,#0a0a20,#0d0d25)",
        borderBottom:"1px solid #ffffff11",
        padding:"0 32px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        height:64,
        boxShadow:"0 4px 32px #00000088",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{
            width:36, height:36, borderRadius:10,
            background:"linear-gradient(135deg,#00ff88,#00aaff)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:20, boxShadow:"0 0 16px #00ff8844"
          }}>🛡️</div>
          <div>
            <div style={{ fontWeight:900, fontSize:18, letterSpacing:-0.5 }}>
              Vehicle<span style={{ color:"#00ff88", textShadow:"0 0 12px #00ff88" }}>Guard</span>
            </div>
            <div style={{ color:"#444", fontSize:10, letterSpacing:2, textTransform:"uppercase" }}>
              Intelligent Safety System
            </div>
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          {latency && detecting && (
            <div style={{ color:"#555", fontSize:11, fontFamily:"monospace" }}>
              {latency}ms · {(1000/latency).toFixed(1)} FPS
            </div>
          )}
          <div style={{
            display:"flex", alignItems:"center", gap:6,
            background: apiStatus==="online" ? "#001a0d" : "#1a0008",
            border: `1px solid ${apiStatus==="online"?"#00ff8844":"#ff335544"}`,
            borderRadius:20, padding:"4px 12px",
          }}>
            <div style={{
              width:7, height:7, borderRadius:"50%",
              background: apiStatus==="online" ? "#00ff88" : "#ff3355",
              boxShadow: `0 0 8px ${apiStatus==="online"?"#00ff88":"#ff3355"}`,
              animation: apiStatus==="online" ? "pulse 2s infinite" : "none",
            }}/>
            <span style={{ fontSize:11, fontWeight:700, color:apiStatus==="online"?"#00ff88":"#ff3355" }}>
              {apiStatus==="online" ? "SYSTEM ONLINE" : "OFFLINE"}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display:"flex", gap:2, padding:"0 32px",
        background:"#080818", borderBottom:"1px solid #ffffff08",
      }}>
        {Object.entries(tabLabels).map(([key, label]) => (
          <button key={key} onClick={()=>setTab(key)} style={{
            padding:"14px 20px", border:"none", cursor:"pointer", fontWeight:700, fontSize:12,
            background:"transparent", letterSpacing:1, textTransform:"uppercase",
            color: tab===key ? "#00ff88" : "#333",
            borderBottom: tab===key ? "2px solid #00ff88" : "2px solid transparent",
            boxShadow: tab===key ? "0 0 12px #00ff8822" : "none",
            transition:"all 0.2s",
          }}>{label}</button>
        ))}
      </div>

      <div style={{ padding:"24px 32px" }}>

        {/* Stats bar */}
        <div style={{ display:"flex", gap:12, marginBottom:24, flexWrap:"wrap" }}>
          <StatCard label="Total Alerts"    value={stats?.total_alerts      ?? "—"} color="#00aaff" icon="📊"/>
          <StatCard label="Drowsiness"      value={stats?.drowsiness_alerts ?? "—"} color="#ffaa00" icon="😴"/>
          <StatCard label="Intruders"       value={stats?.intruder_alerts   ?? "—"} color="#ff3355" icon="🚨"/>
          <StatCard label="Critical Events" value={stats?.critical_alerts   ?? "—"} color="#ff3355" icon="⚠️"/>
          <StatCard label="Owner"           value={ownerReg?"ACTIVE":"NONE"} color={ownerReg?"#00ff88":"#555"} icon={ownerReg?"✅":"👤"}/>
        </div>

        <canvas ref={canvasRef} style={{ display:"none" }}/>

        {/* ── MONITOR ── */}
        {tab==="monitor" && (
          <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>

            {/* Camera */}
            <div style={{
              flex:1, minWidth:300,
              background:"linear-gradient(135deg,#0a0a1a,#0d0d22)",
              border:"1px solid #ffffff0a", borderRadius:20,
              padding:20, boxShadow:"0 8px 32px #00000066",
            }}>
              <div style={{ fontSize:10, letterSpacing:3, color:"#333", textTransform:"uppercase", marginBottom:12 }}>
                Live Camera Feed
              </div>
              <div style={{
                position:"relative", borderRadius:14, overflow:"hidden",
                background:"#000", aspectRatio:"4/3",
                boxShadow: detecting ? `0 0 24px ${risk.glow}` : "none",
                transition:"box-shadow 0.3s",
              }}>
                <video ref={monitorVidRef} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} muted playsInline/>
                {!cameraOn && (
                  <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column",
                    alignItems:"center", justifyContent:"center", gap:8 }}>
                    <div style={{ fontSize:40 }}>📷</div>
                    <div style={{ color:"#333", fontSize:13 }}>Click Start Camera</div>
                  </div>
                )}
                {detecting && (
                  <div style={{
                    position:"absolute", top:12, right:12,
                    background:risk.bg, color:risk.color,
                    border:`1px solid ${risk.color}55`,
                    borderRadius:8, padding:"4px 12px",
                    fontSize:11, fontWeight:800, letterSpacing:2,
                    boxShadow:`0 0 12px ${risk.glow}`,
                    animation:"blink 2s infinite",
                  }}>
                    ● {risk.label}
                  </div>
                )}
                {detecting && (
                  <div style={{
                    position:"absolute", inset:0,
                    border:`2px solid ${risk.color}22`,
                    borderRadius:14, pointerEvents:"none",
                    boxShadow:`inset 0 0 40px ${risk.glow}`,
                    transition:"all 0.5s",
                  }}/>
                )}
              </div>
              <div style={{ display:"flex", gap:8, marginTop:14, flexWrap:"wrap" }}>
                {!cameraOn
                  ? <Btn color="#00ff88" onClick={startCamera}>▶ Start Camera</Btn>
                  : <Btn color="#ff3355" onClick={stopCamera}>■ Stop Camera</Btn>
                }
                {cameraOn && (
                  <Btn color={detecting ? "#ff3355" : "#00aaff"} onClick={toggleDetection}>
                    {detecting ? "⏹ Stop Detection" : "▶ Start Detection"}
                  </Btn>
                )}
              </div>
            </div>

            {/* Risk panel */}
            <div style={{
              flex:1, minWidth:280,
              background:"linear-gradient(135deg,#0a0a1a,#0d0d22)",
              border:"1px solid #ffffff0a", borderRadius:20,
              padding:20, boxShadow:"0 8px 32px #00000066",
              display:"flex", flexDirection:"column", alignItems:"center",
            }}>
              <div style={{ fontSize:10, letterSpacing:3, color:"#333", textTransform:"uppercase", marginBottom:4, alignSelf:"flex-start" }}>
                Risk Monitor
              </div>
              <RiskGauge value={drowsyProb} riskLevel={riskLevel}/>

              {/* Threshold bars */}
              <div style={{ width:"100%", marginTop:16 }}>
                {[
                  { label:"Safe Zone",    range:"0 – 49%",  color:"#00ff88", from:0,  to:49  },
                  { label:"Drowsy Zone",  range:"50 – 84%", color:"#ffaa00", from:50, to:84  },
                  { label:"Critical Zone",range:"85 – 100%",color:"#ff3355", from:85, to:100 },
                ].map(z => (
                  <div key={z.label} style={{ marginBottom:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                      <span style={{ fontSize:11, color:drowsyProb>=z.from && drowsyProb<=z.to ? z.color : "#333", fontWeight:700 }}>
                        {drowsyProb>=z.from && drowsyProb<=z.to ? "▶ " : "  "}{z.label}
                      </span>
                      <span style={{ fontSize:11, color:"#333", fontFamily:"monospace" }}>{z.range}</span>
                    </div>
                    <div style={{ height:4, borderRadius:4, background:"#111128", overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${z.to - z.from}%`, background:z.color,
                        opacity: drowsyProb>=z.from && drowsyProb<=z.to ? 1 : 0.2,
                        boxShadow: drowsyProb>=z.from && drowsyProb<=z.to ? `0 0 8px ${z.color}` : "none",
                        transition:"all 0.3s" }}/>
                    </div>
                  </div>
                ))}
              </div>

              {latency && (
                <div style={{ marginTop:12, width:"100%", background:"#0a0a1a", borderRadius:8, padding:"8px 12px",
                  border:"1px solid #ffffff08", display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:11, color:"#333" }}>Inference latency</span>
                  <span style={{ fontSize:11, color:"#00aaff", fontFamily:"monospace" }}>{latency}ms</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SECURITY ── */}
        {tab==="security" && (
          <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
            <div style={{
              flex:1, minWidth:300,
              background:"linear-gradient(135deg,#0a0a1a,#0d0d22)",
              border:"1px solid #ffffff0a", borderRadius:20, padding:20,
            }}>
              <div style={{ fontSize:10, letterSpacing:3, color:"#333", textTransform:"uppercase", marginBottom:12 }}>
                Owner Registration
              </div>
              <div style={{ color:"#444", fontSize:13, marginBottom:14, lineHeight:1.7 }}>
                Register your face as the vehicle owner. When an unknown person enters, the system triggers an alert.
              </div>
              <div style={{ position:"relative", borderRadius:14, overflow:"hidden", background:"#000", aspectRatio:"4/3", marginBottom:14,
                border: ownerReg ? "1px solid #00ff8833" : "1px solid #ffffff0a" }}>
                <video ref={securityVidRef} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} muted playsInline/>
                {!cameraOn && (
                  <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8 }}>
                    <div style={{ fontSize:40 }}>📷</div>
                    <div style={{ color:"#333", fontSize:13 }}>Camera Off</div>
                  </div>
                )}
              </div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {!cameraOn
                  ? <Btn color="#00ff88" onClick={startCamera}>▶ Start Camera</Btn>
                  : <Btn color="#ff3355" onClick={stopCamera}>■ Stop</Btn>
                }
                <Btn color={ownerReg?"#00ff88":"#6366f1"} onClick={registerOwner}>
                  {ownerReg ? "↻ Re-Register" : "👤 Register Face"}
                </Btn>
              </div>
              {ownerReg && (
                <div style={{ marginTop:14, background:"#001a0d", border:"1px solid #00ff8833",
                  borderRadius:10, padding:"10px 14px", color:"#00ff88", fontSize:13, display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ fontSize:18 }}>✅</span> Owner face registered — security active
                </div>
              )}
            </div>

            <div style={{
              flex:1, minWidth:280,
              background:"linear-gradient(135deg,#0a0a1a,#0d0d22)",
              border:"1px solid #ffffff0a", borderRadius:20, padding:20,
            }}>
              <div style={{ fontSize:10, letterSpacing:3, color:"#333", textTransform:"uppercase", marginBottom:12 }}>
                Driver Verification
              </div>
              <div style={{ color:"#444", fontSize:13, marginBottom:20, lineHeight:1.7 }}>
                Capture and verify the current driver against the registered owner profile.
              </div>
              <Btn color="#ffaa00" onClick={verifyDriver}>📸 Verify Current Driver</Btn>

              {verifyResult && (
                <div style={{ marginTop:20, background: verifyResult.is_owner ? "#001a0d" : "#1a0008",
                  border:`1px solid ${verifyResult.is_owner?"#00ff88":"#ff3355"}33`,
                  borderRadius:14, padding:20,
                  boxShadow:`0 0 24px ${verifyResult.is_owner?"#00ff8811":"#ff335511"}` }}>
                  <div style={{ fontSize:22, fontWeight:900, marginBottom:10,
                    color:verifyResult.is_owner?"#00ff88":"#ff3355",
                    textShadow:`0 0 12px ${verifyResult.is_owner?"#00ff88":"#ff3355"}` }}>
                    {verifyResult.is_owner ? "✅ Owner Verified" : "🚨 INTRUDER DETECTED"}
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {[
                      ["Distance", verifyResult.distance?.toFixed(4)],
                      ["Threshold", verifyResult.threshold],
                      ["GPS", loc ? `${loc.lat?.toFixed(4)}, ${loc.lng?.toFixed(4)}` : "Unavailable"],
                    ].map(([k,v]) => (
                      <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                        <span style={{ color:"#444" }}>{k}</span>
                        <span style={{ color:"#aaa", fontFamily:"monospace" }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  {!verifyResult.is_owner && intruderImg && (
                    <div style={{ marginTop:14 }}>
                      <div style={{ fontSize:10, color:"#ff3355", marginBottom:6, letterSpacing:2 }}>CAPTURED IMAGE</div>
                      <img src={`data:image/png;base64,${intruderImg}`}
                        style={{ width:72, height:72, borderRadius:10, objectFit:"cover", border:"2px solid #ff335566",
                          boxShadow:"0 0 16px #ff335533" }}/>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ALERTS ── */}
        {tab==="alerts" && (
          <div style={{
            background:"linear-gradient(135deg,#0a0a1a,#0d0d22)",
            border:"1px solid #ffffff0a", borderRadius:20, padding:24,
          }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div>
                <div style={{ fontSize:10, letterSpacing:3, color:"#333", textTransform:"uppercase" }}>Alert History</div>
                <div style={{ color:"#555", fontSize:12, marginTop:2 }}>{alerts.length} total events recorded</div>
              </div>
              <button onClick={async()=>{ await fetch(`${API}/alerts`,{method:"DELETE"}); refresh(); }}
                style={{ background:"#1a0008", border:"1px solid #ff335544", color:"#ff3355",
                  borderRadius:8, padding:"8px 16px", cursor:"pointer", fontSize:12, fontWeight:700 }}>
                🗑 Clear All
              </button>
            </div>
            {alerts.length === 0
              ? <div style={{ textAlign:"center", padding:"60px 0", color:"#222", fontSize:14 }}>
                  <div style={{ fontSize:48, marginBottom:12 }}>🛡️</div>
                  No alerts recorded — system is safe
                </div>
              : <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {alerts.map((a,i) => <AlertItem key={i} alert={a}/>)}
                </div>
            }
          </div>
        )}

        {/* ── MAP ── */}
        {tab==="map" && (
          <div style={{
            background:"linear-gradient(135deg,#0a0a1a,#0d0d22)",
            border:"1px solid #ffffff0a", borderRadius:20, padding:24,
          }}>
            <div style={{ fontSize:10, letterSpacing:3, color:"#333", textTransform:"uppercase", marginBottom:16 }}>
              Vehicle Location
            </div>

            {locError && (
              <div style={{ background:"#1a0800", border:"1px solid #ffaa0033", borderRadius:10,
                padding:"12px 16px", color:"#ffaa00", fontSize:13, marginBottom:16 }}>
                ⚠️ Location access: {locError}. Please allow location in browser settings.
              </div>
            )}

            {loc ? (
              <>
                <div style={{ display:"flex", gap:12, marginBottom:16, flexWrap:"wrap" }}>
                  {[
                    { label:"Latitude",  value: loc.lat?.toFixed(6), color:"#00aaff" },
                    { label:"Longitude", value: loc.lng?.toFixed(6), color:"#00aaff" },
                    { label:"Updated",   value: loc.timestamp ? timeAgo(loc.timestamp) : "Live", color:"#00ff88" },
                  ].map(item => (
                    <div key={item.label} style={{ background:"#0a0a1a", border:"1px solid #ffffff0a",
                      borderRadius:10, padding:"12px 18px", flex:1, minWidth:120 }}>
                      <div style={{ color:"#333", fontSize:10, letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>{item.label}</div>
                      <div style={{ color:item.color, fontFamily:"monospace", fontWeight:700, fontSize:16,
                        textShadow:`0 0 8px ${item.color}88` }}>{item.value}</div>
                    </div>
                  ))}
                </div>
                <iframe
                  title="Live Location"
                  width="100%" height="400" frameBorder="0" scrolling="no"
                  style={{ borderRadius:14, border:"1px solid #ffffff0a",
                    boxShadow:"0 8px 32px #00000066", display:"block" }}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${loc.lng-0.008},${loc.lat-0.008},${loc.lng+0.008},${loc.lat+0.008}&layer=mapnik&marker=${loc.lat},${loc.lng}`}
                />
                <div style={{ marginTop:8, fontSize:10, color:"#222", textAlign:"right" }}>
                  Real-time location via browser GPS · OpenStreetMap
                </div>
              </>
            ) : (
              <div style={{ textAlign:"center", padding:"60px 0", color:"#222" }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📍</div>
                {locError ? "Location permission required" : "Fetching your location..."}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.7} }
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:#0a0a1a; }
        ::-webkit-scrollbar-thumb { background:#1a1a3a; borderRadius:4px; }
      `}</style>
    </div>
  );
}

function Btn({ color, onClick, children }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={()=>setHover(true)}
      onMouseLeave={()=>setHover(false)}
      style={{
        background: hover ? color : "transparent",
        color: hover ? "#000" : color,
        border: `1px solid ${color}`,
        borderRadius: 8, padding:"9px 18px",
        fontWeight:700, fontSize:12, cursor:"pointer",
        letterSpacing:0.5,
        boxShadow: hover ? `0 0 16px ${color}66` : "none",
        transition:"all 0.2s",
      }}>
      {children}
    </button>
  );
}