
import React, { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { collection, addDoc, onSnapshot, doc, updateDoc, serverTimestamp, query, orderBy, setDoc, getDoc } from "firebase/firestore";

const SCHEMES_DB = {
  loan_job: [
    { name: "PM MUDRA Yojana", url: "https://www.mudra.org.in/", desc: "Business loan up to 10 lakh - Shishu/Kishor/Tarun", eligibility: "18+ years, business plan" },
    { name: "PMEGP", url: "https://www.kviconline.gov.in/pmegpeportal/", desc: "Self employment generation", eligibility: "18+ years" },
    { name: "National Career Service", url: "https://www.ncs.gov.in/", desc: "Job portal & skill training", eligibility: "18+, ID proof" },
  ],
  education: [
    { name: "National Scholarship Portal", url: "https://scholarships.gov.in/", desc: "Central scholarships for students", eligibility: "Income <2.5L" },
    { name: "PM Vidya Lakshmi", url: "https://www.vidyalakshmi.co.in/", desc: "Education loan single window", eligibility: "Admission letter" },
  ],
  health: [
    { name: "Ayushman Bharat PM-JAY", url: "https://pmjay.gov.in/", desc: "Rs. 5 lakh free health insurance", eligibility: "BPL / SECC" },
    { name: "TN CM Health Insurance", url: "https://www.cmchistn.com/", desc: "TN state health coverage", eligibility: "TN resident" },
  ],
  housing: [{ name: "PMAY", url: "https://pmaymis.gov.in/", desc: "Housing for all", eligibility: "No pucca house" }],
  farmer: [
    { name: "PM-KISAN", url: "https://pmkisan.gov.in/", desc: "Rs. 6000/year direct benefit", eligibility: "Landholding farmer" },
    { name: "KCC", url: "https://www.pmkisan.gov.in/", desc: "Crop loan low interest", eligibility: "Land proof" },
  ],
};

function getSchemes(text) {
  const t = text.toLowerCase();
  const has = (a) => a.some(x => t.includes(x));
  if (has(["loan","job","unemployed","10 lakh","10lakh","debt","emi","business","startup","mudra"])) return SCHEMES_DB.loan_job;
  if (has(["fee","college","school","education","student","scholarship","exam","university"])) return SCHEMES_DB.education;
  if (has(["health","medical","hospital","treatment","disease","insurance","doctor"])) return SCHEMES_DB.health;
  if (has(["house","housing","home","rent","shelter","awas"])) return SCHEMES_DB.housing;
  if (has(["farm","farmer","crop","agriculture","kisan"])) return SCHEMES_DB.farmer;
  return [];
}

export default function App() {
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("user");
  const [fbUser, setFbUser] = useState(null);
  const [userRole, setUserRole] = useState("user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [personalText, setPersonalText] = useState("");
  const [publicText, setPublicText] = useState("");
  const [income, setIncome] = useState("");
  const [category, setCategory] = useState("");
  const [personalSchemes, setPersonalSchemes] = useState(null);
  const [gps, setGps] = useState(null);
  const [publicIssues, setPublicIssues] = useState([]);
  const [stats, setStats] = useState({ total:0, completed:0, volunteers:0, resolved:0 });
  const [photoPreview, setPhotoPreview] = useState(null);
  const [evidencePreviews, setEvidencePreviews] = useState({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFbUser(u);
      if (u) { try { const snap = await getDoc(doc(db, "users", u.uid)); if (snap.exists()) setUserRole(snap.data().role || "user"); } catch{} }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(pos => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }), () => {});
  }, []);

  useEffect(() => {
    const unsub1 = onSnapshot(query(collection(db, "publicIssues"), orderBy("createdAt","desc")), snap => { setPublicIssues(snap.docs.map(d=>({id:d.id, ...d.data()}))); });
    const unsub2 = onSnapshot(collection(db, "users"), snap => { setStats(s=>({...s, volunteers: snap.docs.filter(d=>d.data().role==="volunteer").length })); });
    return () => { unsub1(); unsub2(); };
  }, []);

  useEffect(() => {
    const total = publicIssues.length;
    const completed = publicIssues.filter(i=>i.status==="solved").length;
    setStats(s=>({...s, total, completed, resolved: total>0?Math.round(completed/total*100):0 }));
  }, [publicIssues]);

  const handleAuth = async () => {
    setError(""); setLoading(true);
    try {
      if (authMode==="register") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", cred.user.uid), { name, email, role, createdAt: serverTimestamp() });
        setUserRole(role);
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const snap = await getDoc(doc(db, "users", cred.user.uid));
        if (snap.exists()) setUserRole(snap.data().role || "user");
      }
    } catch(e){ setError(e.message); }
    setLoading(false);
  };

  const submitPersonal = async () => {
    if (!personalText.trim()) return alert("Enter description");
    const schemes = getSchemes(personalText);
    setPersonalSchemes(schemes);
    await addDoc(collection(db, "personalIssues"), { text: personalText, income, category, schemes, userId: fbUser.uid, status:"open", createdAt: serverTimestamp() });
    setPersonalText(""); setIncome(""); setCategory("");
  };

  const submitPublic = async () => {
    if (!publicText.trim()) return alert("Enter issue");
    await addDoc(collection(db, "publicIssues"), { text: publicText, gps, photoDataUrl: photoPreview, photoProvided: !!photoPreview, userId: fbUser.uid, status:"open", createdAt: serverTimestamp() });
    setPublicText(""); setPhotoPreview(null);
  };

  const claimTicket = async (id) => { await updateDoc(doc(db, "publicIssues", id), { status:"claimed", claimedBy: fbUser.uid }); };
  const solveTicket = async (id) => {
    if (!evidencePreviews[id]) return alert("Evidence photo required");
    await updateDoc(doc(db, "publicIssues", id), { status:"solved", evidenceDataUrl: evidencePreviews[id], solvedAt: serverTimestamp() });
  };

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    *{font-family: 'Inter', sans-serif; box-sizing: border-box;}
    body{margin:0; background:#070a12; color:#e4e4e7;}
    .card{background: rgba(18,20,28,0.9); border:1px solid rgba(39,39,42,0.8); backdrop-filter: blur(12px); border-radius:20px;}
    .btn-primary{background: linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%); color:#000; font-weight:600; border:none; cursor:pointer; transition:0.2s;}
    .btn-primary:hover{transform:translateY(-1px); box-shadow:0 8px 20px rgba(34,211,238,0.3);}
    .input{background: rgba(0,0,0,0.6); border:1px solid #27272a; color:white; border-radius:14px; padding:12px 16px; outline:none; width:100%;}
    .input:focus{border-color:#22d3ee; box-shadow:0 0 0 3px rgba(34,211,238,0.1);}
    .badge{background: rgba(39,39,42,0.8); border:1px solid #3f3f46; border-radius:999px; padding:6px 14px; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;}
  `;

  if (!fbUser) {
    return (
      <div style={{minHeight:"100vh", background:"radial-gradient(1200px 600px at 20% -10%, rgba(34,211,238,0.15), transparent), radial-gradient(800px 400px at 90% 20%, rgba(139,92,246,0.1), transparent), #070a12", display:"flex", alignItems:"center", justifyContent:"center", padding:"16px"}}>
        <style>{styles}</style>
        <div className="card" style={{width:"100%", maxWidth:"440px", padding:"32px"}}>
          <div style={{textAlign:"center", marginBottom:"28px"}}>
            <div style={{fontSize:"28px", fontWeight:"800", letterSpacing:"-0.5px", background:"linear-gradient(135deg, #fff 0%, #a1a1aa 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent"}}>CAREPULES</div>
            <div style={{fontSize:"11px", color:"#71717a", letterSpacing:"2px", marginTop:"8px", textTransform:"uppercase"}}>Community Problem Solving Platform</div>
            <div style={{fontSize:"10px", color:"#52525b", letterSpacing:"1.5px", marginTop:"4px"}}>By RAISE UP TOGETHER Team</div>
            <div style={{marginTop:"16px", height:"1px", background:"linear-gradient(90deg, transparent, #27272a, transparent)"}}></div>
          </div>
          <div style={{display:"flex", gap:"8px", padding:"4px", background:"rgba(0,0,0,0.5)", borderRadius:"999px", border:"1px solid #27272a", marginBottom:"24px"}}>
            <button onClick={()=>setAuthMode("login")} style={{flex:1, height:"36px", borderRadius:"999px", border:"none", cursor:"pointer", fontSize:"13px", fontWeight:"500", background: authMode==="login" ? "white" : "transparent", color: authMode==="login" ? "black" : "#71717a"}}>Login</button>
            <button onClick={()=>setAuthMode("register")} style={{flex:1, height:"36px", borderRadius:"999px", border:"none", cursor:"pointer", fontSize:"13px", fontWeight:"500", background: authMode==="register" ? "white" : "transparent", color: authMode==="register" ? "black" : "#71717a"}}>Register</button>
          </div>
          {authMode==="register" && <input className="input" style={{marginBottom:"12px"}} value={name} onChange={e=>setName(e.target.value)} placeholder="Full Name" />}
          <input className="input" style={{marginBottom:"12px"}} value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" />
          <input className="input" style={{marginBottom:"16px"}} value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password" />
          {authMode==="register" && (
            <div style={{display:"flex", gap:"16px", marginBottom:"20px"}}>
              <label style={{display:"flex", alignItems:"center", gap:"8px", fontSize:"13px", cursor:"pointer"}}><input type="radio" checked={role==="user"} onChange={()=>setRole("user")} /> Normal User</label>
              <label style={{display:"flex", alignItems:"center", gap:"8px", fontSize:"13px", cursor:"pointer"}}><input type="radio" checked={role==="volunteer"} onChange={()=>setRole("volunteer")} /> Volunteer</label>
            </div>
          )}
          {error && <div style={{marginBottom:"16px", padding:"10px 12px", borderRadius:"12px", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)", fontSize:"12px", color:"#fca5a5"}}>{error}</div>}
          <button onClick={handleAuth} disabled={loading} className="btn-primary" style={{width:"100%", height:"46px", borderRadius:"999px", fontSize:"14px"}}>{loading ? "Please wait..." : authMode==="register" ? "Create Account" : "Login to CAREPULES"}</button>
          <div style={{textAlign:"center", marginTop:"16px", fontSize:"12px", color:"#71717a"}}>
            {authMode==="register" ? <span>Already have account? <button onClick={()=>setAuthMode("login")} style={{background:"none", border:"none", color:"white", textDecoration:"underline", cursor:"pointer"}}>Login</button></span> : <span>Don't have account? <button onClick={()=>setAuthMode("register")} style={{background:"none", border:"none", color:"white", textDecoration:"underline", cursor:"pointer"}}>Register</button></span>}
          </div>
          <div style={{textAlign:"center", marginTop:"28px", fontSize:"10px", color:"#52525b", letterSpacing:"0.5px"}}>Copyright 2026 CAREPULES | By RAISE UP TOGETHER Team | Privacy-Safe</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight:"100vh", background:"#070a12"}}>
      <style>{styles}</style>
      <header style={{position:"sticky", top:0, zIndex:10, borderBottom:"1px solid rgba(39,39,42,0.6)", background:"rgba(7,10,18,0.85)", backdropFilter:"blur(12px)"}}>
        <div style={{maxWidth:"1000px", margin:"0 auto", padding:"0 20px", height:"60px", display:"flex", alignItems:"center", justifyContent:"space-between"}}>
          <div><div style={{fontWeight:"800", letterSpacing:"-0.5px", fontSize:"18px"}}>CAREPULES</div><div style={{fontSize:"9px", color:"#71717a", letterSpacing:"1px", textTransform:"uppercase"}}>By RAISE UP TOGETHER Team</div></div>
          <div style={{display:"flex", alignItems:"center", gap:"12px"}}><span style={{fontSize:"11px", color:"#71717a"}}>{fbUser.email} | {userRole}</span><button onClick={()=>signOut(auth)} style={{fontSize:"11px", padding:"6px 14px", borderRadius:"999px", border:"1px solid #3f3f46", background:"#18181b", color:"#a1a1aa", cursor:"pointer"}}>Logout</button></div>
        </div>
      </header>
      <main style={{maxWidth:"1000px", margin:"0 auto", padding:"24px 20px"}}>
        <div className="card" style={{padding:"20px"}}>
          <div style={{fontSize:"11px", letterSpacing:"1.5px", textTransform:"uppercase", color:"#71717a", marginBottom:"16px"}}>Community Impact - Live for All Users After Registration</div>
          <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:"12px"}}>
            <div style={{background:"rgba(0,0,0,0.6)", border:"1px solid #27272a", borderRadius:"16px", padding:"16px", textAlign:"center"}}><div style={{fontSize:"24px", fontWeight:"700"}}>{stats.total}</div><div style={{fontSize:"11px", color:"#71717a", marginTop:"4px"}}>Total Reported</div></div>
            <div style={{background:"rgba(0,0,0,0.6)", border:"1px solid #27272a", borderRadius:"16px", padding:"16px", textAlign:"center"}}><div style={{fontSize:"24px", fontWeight:"700", color:"#22d3ee"}}>{stats.completed}</div><div style={{fontSize:"11px", color:"#71717a", marginTop:"4px"}}>Completed</div></div>
            <div style={{background:"rgba(0,0,0,0.6)", border:"1px solid #27272a", borderRadius:"16px", padding:"16px", textAlign:"center"}}><div style={{fontSize:"24px", fontWeight:"700"}}>{stats.volunteers}</div><div style={{fontSize:"11px", color:"#71717a", marginTop:"4px"}}>Active Volunteers</div></div>
            <div style={{background:"rgba(0,0,0,0.6)", border:"1px solid #27272a", borderRadius:"16px", padding:"16px", textAlign:"center"}}><div style={{fontSize:"24px", fontWeight:"700", color:"#a78bfa"}}>{stats.resolved}%</div><div style={{fontSize:"11px", color:"#71717a", marginTop:"4px"}}>Resolved</div></div>
          </div>
        </div>

        {userRole==="user" && (
          <>
            <div className="card" style={{marginTop:"20px", padding:"24px"}}>
              <div style={{display:"flex", alignItems:"center", gap:"10px", marginBottom:"8px"}}><div style={{width:"28px", height:"28px", borderRadius:"8px", background:"rgba(34,211,238,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"14px"}}>馃敀</div><h3 style={{fontWeight:"600", fontSize:"15px", margin:0}}>Report Personal Vulnerability [PRIVATE]</h3></div>
              <p style={{fontSize:"11px", color:"#71717a", marginBottom:"16px"}}>100% anonymous, AI flags risk, shows government schemes with direct apply link</p>
              <textarea value={personalText} onChange={e=>setPersonalText(e.target.value)} placeholder="Describe personal difficulty - e.g., I don't have permanent job and I have 10 lakh loan..." style={{width:"100%", minHeight:"90px", resize:"vertical"}} className="input"></textarea>
              {personalText.length>10 && (
                <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", marginTop:"12px"}}>
                  <select value={income} onChange={e=>setIncome(e.target.value)} className="input"><option value="">Monthly Income</option><option value="<10000">Below 10,000</option><option value="10000-25000">10k - 25k</option><option value=">25000">Above 25k</option></select>
                  <select value={category} onChange={e=>setCategory(e.target.value)} className="input"><option value="">Category</option><option value="BPL">BPL</option><option value="APL">APL</option><option value="SC/ST">SC/ST</option></select>
                </div>
              )}
              <button onClick={submitPersonal} className="btn-primary" style={{marginTop:"14px", padding:"10px 22px", borderRadius:"999px", fontSize:"13px"}}>Submit Personal - Get Scheme Link</button>
              {personalSchemes && personalSchemes.length>0 && (
                <div style={{marginTop:"18px", display:"grid", gap:"10px"}}>
                  <div style={{fontSize:"12px", fontWeight:"600"}}>Relevant Schemes for your problem:</div>
                  {personalSchemes.map((s,i)=>(
                    <div key={i} style={{background:"rgba(0,0,0,0.5)", border:"1px solid #27272a", borderRadius:"14px", padding:"14px"}}>
                      <div style={{fontWeight:"600", fontSize:"13px"}}>{s.name}</div>
                      <div style={{fontSize:"11px", color:"#a1a1aa", marginTop:"4px"}}>{s.desc}</div>
                      <div style={{fontSize:"11px", color:"#71717a", marginTop:"4px"}}>Eligibility: {s.eligibility}</div>
                      <a href={s.url} target="_blank" style={{display:"inline-block", marginTop:"10px", fontSize:"11px", padding:"6px 14px", borderRadius:"999px", background:"white", color:"black", textDecoration:"none", fontWeight:"600"}}>Apply Now - Direct Link 鈫�</a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card" style={{marginTop:"20px", padding:"24px"}}>
              <div style={{display:"flex", alignItems:"center", gap:"10px", marginBottom:"8px"}}><div style={{width:"28px", height:"28px", borderRadius:"8px", background:"rgba(168,85,247,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"14px"}}>馃搷</div><h3 style={{fontWeight:"600", fontSize:"15px", margin:0}}>Report Street / Public Issue [PUBLIC]</h3></div>
              <p style={{fontSize:"11px", color:"#71717a", marginBottom:"16px"}}>Evidence: Photo + Auto GPS {gps ? `| Lat ${gps.lat.toFixed(4)} Lng ${gps.lng.toFixed(4)}` : "| Fetching GPS..."}</p>
              <textarea value={publicText} onChange={e=>setPublicText(e.target.value)} placeholder="Describe street issue - pothole, garbage, street light..." style={{width:"100%", minHeight:"80px"}} className="input"></textarea>
              <div style={{marginTop:"12px", display:"flex", gap:"10px", alignItems:"center"}}>
                <label style={{padding:"8px 16px", borderRadius:"999px", background:"#27272a", border:"1px solid #3f3f46", fontSize:"12px", cursor:"pointer"}}><input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{ const f=e.target.files[0]; if(f){ const r=new FileReader(); r.onload=ev=>setPhotoPreview(ev.target.result); r.readAsDataURL(f); } }} />馃摲 Choose Photo</label>
                <span style={{fontSize:"11px", color:"#71717a"}}>{photoPreview ? "Photo selected" : "No photo"}</span>
              </div>
              {photoPreview && <img src={photoPreview} style={{marginTop:"12px", width:"100%", height:"180px", objectFit:"cover", borderRadius:"14px", border:"1px solid #27272a"}} />}
              <button onClick={submitPublic} className="btn-primary" style={{marginTop:"14px", padding:"10px 22px", borderRadius:"999px", fontSize:"13px"}}>Submit Public with Proof</button>
            </div>
          </>
        )}

        {userRole==="volunteer" && (
          <div className="card" style={{marginTop:"20px", padding:"24px"}}>
            <h3 style={{fontWeight:"600", fontSize:"15px", marginBottom:"16px"}}>Volunteer Dashboard - Claim & Solve</h3>
            <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:"12px"}}>
              {publicIssues.filter(i=>i.status!=="solved").map(ticket=>(
                <div key={ticket.id} style={{background:"rgba(0,0,0,0.5)", border:"
