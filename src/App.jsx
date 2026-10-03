
import React, { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { collection, addDoc, onSnapshot, doc, updateDoc, serverTimestamp, query, orderBy, setDoc, getDoc } from "firebase/firestore";

const SCHEMES = {
  loan_job: [
    { name: "PM MUDRA Yojana", url: "https://www.mudra.org.in/", desc: "Business loan up to 10 lakh", eligibility: "18+ years, business plan" },
    { name: "PMEGP", url: "https://www.kviconline.gov.in/pmegpeportal/", desc: "Self employment", eligibility: "18+ years" },
    { name: "National Career Service", url: "https://www.ncs.gov.in/", desc: "Job portal", eligibility: "18+" },
  ],
  education: [
    { name: "National Scholarship Portal", url: "https://scholarships.gov.in/", desc: "Scholarships", eligibility: "Income <2.5L" },
    { name: "PM Vidya Lakshmi", url: "https://www.vidyalakshmi.co.in/", desc: "Education loan", eligibility: "Admission letter" },
  ],
  health: [
    { name: "Ayushman Bharat PM-JAY", url: "https://pmjay.gov.in/", desc: "Rs 5 lakh insurance", eligibility: "BPL" },
  ],
  housing: [{ name: "PMAY", url: "https://pmaymis.gov.in/", desc: "Housing for all", eligibility: "No pucca house" }],
  farmer: [{ name: "PM-KISAN", url: "https://pmkisan.gov.in/", desc: "Rs 6000/year", eligibility: "Farmer" }],
};

function getSchemes(text) {
  const t = text.toLowerCase();
  if (t.includes("loan") || t.includes("job") || t.includes("debt") || t.includes("emi") || t.includes("business") || t.includes("10 lakh")) return SCHEMES.loan_job;
  if (t.includes("fee") || t.includes("college") || t.includes("school") || t.includes("education") || t.includes("scholarship")) return SCHEMES.education;
  if (t.includes("health") || t.includes("medical") || t.includes("hospital")) return SCHEMES.health;
  if (t.includes("house") || t.includes("housing") || t.includes("home")) return SCHEMES.housing;
  if (t.includes("farm") || t.includes("farmer") || t.includes("crop") || t.includes("kisan")) return SCHEMES.farmer;
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
  const [personalSchemes, setPersonalSchemes] = useState(null);
  const [gps, setGps] = useState(null);
  const [publicIssues, setPublicIssues] = useState([]);
  const [stats, setStats] = useState({ total: 0, completed: 0, volunteers: 0, resolved: 0 });
  const [photoPreview, setPhotoPreview] = useState(null);
  const [evidencePreviews, setEvidencePreviews] = useState({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFbUser(u);
      if (u) {
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) setUserRole(snap.data().role || "user");
        } catch {}
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }), () => {});
    }
  }, []);

  useEffect(() => {
    const unsub1 = onSnapshot(query(collection(db, "publicIssues"), orderBy("createdAt", "desc")), (snap) => {
      setPublicIssues(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsub2 = onSnapshot(collection(db, "users"), (snap) => {
      const vols = snap.docs.filter((d) => d.data().role === "volunteer").length;
      setStats((s) => ({ ...s, volunteers: vols }));
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  useEffect(() => {
    const total = publicIssues.length;
    const completed = publicIssues.filter((i) => i.status === "solved").length;
    setStats((s) => ({ ...s, total, completed, resolved: total > 0 ? Math.round((completed / total) * 100) : 0 }));
  }, [publicIssues]);

  const handleAuth = async () => {
    setError("");
    setLoading(true);
    try {
      if (authMode === "register") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", cred.user.uid), { name, email, role, createdAt: serverTimestamp() });
        setUserRole(role);
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const snap = await getDoc(doc(db, "users", cred.user.uid));
        if (snap.exists()) setUserRole(snap.data().role || "user");
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const submitPersonal = async () => {
    if (!personalText.trim()) return alert("Enter description");
    const schemes = getSchemes(personalText);
    setPersonalSchemes(schemes);
    await addDoc(collection(db, "personalIssues"), { text: personalText, schemes, userId: fbUser.uid, status: "open", createdAt: serverTimestamp() });
    setPersonalText("");
  };

  const submitPublic = async () => {
    if (!publicText.trim()) return alert("Enter issue");
    await addDoc(collection(db, "publicIssues"), { text: publicText, gps, photoDataUrl: photoPreview, photoProvided: !!photoPreview, userId: fbUser.uid, status: "open", createdAt: serverTimestamp() });
    setPublicText("");
    setPhotoPreview(null);
  };

  const claimTicket = async (id) => { await updateDoc(doc(db, "publicIssues", id), { status: "claimed", claimedBy: fbUser.uid }); };
  const solveTicket = async (id) => {
    if (!evidencePreviews[id]) return alert("Evidence photo required");
    await updateDoc(doc(db, "publicIssues", id), { status: "solved", evidenceDataUrl: evidencePreviews[id], solvedAt: serverTimestamp() });
  };

  if (!fbUser) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "white", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", fontFamily: "system-ui" }}>
        <div style={{ width: "100%", maxWidth: "420px", background: "#121214", border: "1px solid #27272a", borderRadius: "24px", padding: "32px" }}>
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <div style={{ fontSize: "28px", fontWeight: "800" }}>CAREPULES</div>
            <div style={{ fontSize: "11px", color: "#71717a", marginTop: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>Community Problem Solving Platform</div>
            <div style={{ fontSize: "10px", color: "#52525b", marginTop: "4px" }}>By RAISE UP TOGETHER Team</div>
          </div>
          <div style={{ display: "flex", gap: "8px", padding: "4px", background: "#1a1a1d", borderRadius: "999px", border: "1px solid #27272a", marginBottom: "20px" }}>
            <button onClick={() => setAuthMode("login")} style={{ flex: 1, height: "36px", borderRadius: "999px", border: "none", cursor: "pointer", background: authMode === "login" ? "white" : "transparent", color: authMode === "login" ? "black" : "#71717a", fontSize: "13px" }}>Login</button>
            <button onClick={() => setAuthMode("register")} style={{ flex: 1, height: "36px", borderRadius: "999px", border: "none", cursor: "pointer", background: authMode === "register" ? "white" : "transparent", color: authMode === "register" ? "black" : "#71717a", fontSize: "13px" }}>Register</button>
          </div>
          {authMode === "register" && <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" style={{ width: "100%", height: "44px", marginBottom: "12px", padding: "0 16px", borderRadius: "14px", background: "#1c1c1f", border: "1px solid #27272a", color: "white" }} />}
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={{ width: "100%", height: "44px", marginBottom: "12px", padding: "0 16px", borderRadius: "14px", background: "#1c1c1f", border: "1px solid #27272a", color: "white" }} />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" style={{ width: "100%", height: "44px", marginBottom: "16px", padding: "0 16px", borderRadius: "14px", background: "#1c1c1f", border: "1px solid #27272a", color: "white" }} />
          {authMode === "register" && (
            <div style={{ display: "flex", gap: "16px", marginBottom: "20px", fontSize: "13px" }}>
              <label><input type="radio" checked={role === "user"} onChange={() => setRole("user")} /> Normal User</label>
              <label><input type="radio" checked={role === "volunteer"} onChange={() => setRole("volunteer")} /> Volunteer</label>
            </div>
          )}
          {error && <div style={{ marginBottom: "16px", padding: "10px", borderRadius: "12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", fontSize: "12px", color: "#fca5a5" }}>{error}</div>}
          <button onClick={handleAuth} disabled={loading} style={{ width: "100%", height: "46px", borderRadius: "999px", background: "white", color: "black", fontWeight: "600", border: "none", cursor: "pointer" }}>{loading ? "Wait..." : authMode === "register" ? "Create Account" : "Login"}</button>
          <div style={{ textAlign: "center", marginTop: "16px", fontSize: "12px", color: "#71717a" }}>
            {authMode === "register" ? <span>Already have account? <button onClick={() => setAuthMode("login")} style={{ background: "none", border: "none", color: "white", textDecoration: "underline", cursor: "pointer" }}>Login</button></span> : <span>Don't have account? <button onClick={() => setAuthMode("register")} style={{ background: "none", border: "none", color: "white", textDecoration: "underline", cursor: "pointer" }}>Register</button></span>}
          </div>
          <div style={{ textAlign: "center", marginTop: "28px", fontSize: "10px", color: "#52525b" }}>Copyright 2026 CAREPULES | By RAISE UP TOGETHER Team | Privacy-Safe</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e4e4e7", fontFamily: "system-ui" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 10, borderBottom: "1px solid #27272a", background: "rgba(10,10,10,0.9)" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "0 20px", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div><div style={{ fontWeight: "800", fontSize: "18px" }}>CAREPULES</div><div style={{ fontSize: "9px", color: "#71717a" }}>By RAISE UP TOGETHER Team</div></div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><span style={{ fontSize: "11px", color: "#71717a" }}>{fbUser.email} | {userRole}</span><button onClick={() => signOut(auth)} style={{ fontSize: "11px", padding: "6px 14px", borderRadius: "999px", border: "1px solid #3f3f46", background: "#18181b", color: "#a1a1aa", cursor: "pointer" }}>Logout</button></div>
        </div>
      </header>
      <main style={{ maxWidth: "1000px", margin: "0 auto", padding: "20px" }}>
        <div style={{ background: "#121214", border: "1px solid #27272a", borderRadius: "20px", padding: "20px" }}>
          <div style={{ fontSize: "11px", color: "#71717a", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "1px" }}>Community Impact - Live for All Users After Registration</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
            <div style={{ background: "black", border: "1px solid #27272a", borderRadius: "16px", padding: "16px", textAlign: "center" }}><div style={{ fontSize: "22px", fontWeight: "700" }}>{stats.total}</div><div style={{ fontSize: "11px", color: "#71717a" }}>Total Reported</div></div>
            <div style={{ background: "black", border: "1px solid #27272a", borderRadius: "16px", padding: "16px", textAlign: "center" }}><div style={{ fontSize: "22px", fontWeight: "700", color: "#22d3ee" }}>{stats.completed}</div><div style={{ fontSize: "11px", color: "#71717a" }}>Completed</div></div>
            <div style={{ background: "black", border: "1px solid #27272a", borderRadius: "16px", padding: "16px", textAlign: "center" }}><div style={{ fontSize: "22px", fontWeight: "700" }}>{stats.volunteers}</div><div style={{ fontSize: "11px", color: "#71717a" }}>Active Volunteers</div></div>
            <div style={{ background: "black", border: "1px solid #27272a", borderRadius: "16px", padding: "16px", textAlign: "center" }}><div style={{ fontSize: "22px", fontWeight: "700", color: "#a78bfa" }}>{stats.resolved}%</div><div style={{ fontSize: "11px", color: "#71717a" }}>Resolved</div></div>
          </div>
        </div>

        {userRole === "user" && (
          <>
            <div style={{ marginTop: "20px", background: "#121214", border: "1px solid #27272a", borderRadius: "20px", padding: "24px" }}>
              <h3 style={{ fontSize: "15px", margin: "0 0 8px 0" }}>1. Report Personal Vulnerability [PRIVATE]</h3>
              <p style={{ fontSize: "11px", color: "#71717a", marginBottom: "16px" }}>100% anonymous, AI flags risk, shows government schemes with direct apply link</p>
              <textarea value={personalText} onChange={(e) => setPersonalText(e.target.value)} placeholder="Describe personal difficulty - e.g., I don't have permanent job and I have 10 lakh loan..." style={{ width: "100%", minHeight: "90px", background: "black", border: "1px solid #27272a", borderRadius: "14px", padding: "12px", color: "white" }}></textarea>
              <button onClick={submitPersonal} style={{ marginTop: "12px", padding: "10px 22px", borderRadius: "999px", background: "#22d3ee", color: "black", border: "none", fontWeight: "600", fontSize: "13px", cursor: "pointer" }}>Submit Personal - Get Scheme Link</button>
              {personalSchemes && personalSchemes.length > 0 && (
                <div style={{ marginTop: "16px", display: "grid", gap: "10px" }}>
                  {personalSchemes.map((s, i) => (
                    <div key={i} style={{ background: "black", border: "1px solid #27272a", borderRadius: "14px", padding: "14px" }}>
                      <div style={{ fontWeight: "600", fontSize: "13px" }}>{s.name}</div>
                      <div style={{ fontSize: "11px", color: "#a1a1aa", marginTop: "4px" }}>{s.desc}</div>
                      <div style={{ fontSize: "11px", color: "#71717a", marginTop: "4px" }}>Eligibility: {s.eligibility}</div>
                      <a href={s.url} target="_blank" style={{ display: "inline-block", marginTop: "10px", fontSize: "11px", padding: "6px 14px", borderRadius: "999px", background: "white", color: "black", textDecoration: "none", fontWeight: "600" }}>Apply Now - Direct Link</a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: "20px", background: "#121214", border: "1px solid #27272a", borderRadius: "20px", padding: "24px" }}>
              <h3 style={{ fontSize: "15px", margin: "0 0 8px 0" }}>2. Report Street / Public Issue [PUBLIC]</h3>
              <p style={{ fontSize: "11px", color: "#71717a", marginBottom: "16px" }}>Photo + Auto GPS {gps ? `Lat ${gps.lat.toFixed(4)} Lng ${gps.lng.toFixed(4)}` : "Fetching GPS..."}</p>
              <textarea value={publicText} onChange={(e) => setPublicText(e.target.value)} placeholder="Describe street issue..." style={{ width: "100%", minHeight: "80px", background: "black", border: "1px solid #27272a", borderRadius: "14px", padding: "12px", color: "white" }}></textarea>
              <div style={{ marginTop: "12px", display: "flex", gap: "10px", alignItems: "center" }}>
                <label style={{ padding: "8px 16px", borderRadius: "999px", background: "#27272a", border: "1px solid #3f3f46", fontSize: "12px", cursor: "pointer" }}><input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files[0]; if (f) { const r = new FileReader(); r.onload = (ev) => setPhotoPreview(ev.target.result); r.readAsDataURL(f); } }} />Choose Photo</label>
                <span style={{ fontSize: "11px", color: "#71717a" }}>{photoPreview ? "Photo selected" : "No photo"}</span>
              </div>
              {photoPreview && <img src={photoPreview} style={{ marginTop: "12px", width: "100%", height: "180px", objectFit: "cover", borderRadius: "14px", border: "1px solid #27272a" }} />}
              <button onClick={submitPublic} style={{ marginTop: "12px", padding: "10px 22px", borderRadius: "999px", background: "#22d3ee", color: "black", border: "none", fontWeight: "600", fontSize: "13px", cursor: "pointer" }}>Submit Public with Proof</button>
            </div>
          </>
        )}

        {userRole === "volunteer" && (
          <div style={{ marginTop: "20px", background: "#121214", border: "1px solid #27272a", borderRadius: "20px", padding: "24px" }}>
            <h3 style={{ fontSize: "15px", marginBottom: "16px" }}>Volunteer Dashboard - Claim & Solve</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
              {publicIssues.filter((i) => i.status !== "solved").map((ticket) => (
                <div key={ticket.id} style={{ background: "black", border: "1px solid #27272a", borderRadius: "14px", padding: "14px" }}>
                  <p style={{ fontSize: "13px" }}>{ticket.text}</p>
                  {ticket.photoDataUrl ? <img src={ticket.photoDataUrl} style={{ marginTop: "10px", width: "100%", height: "140px", objectFit: "cover", borderRadius: "12px" }} /> : <div style={{ marginTop: "10px", height: "60px", borderRadius: "12px", background: "#18181b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: "#52525b" }}>No photo provided</div>}
                  <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                    {ticket.status === "open" && <button onClick={() => claimTicket(ticket.id)} style={{ padding: "6px 14px", borderRadius: "999px", background: "white", color: "black", border: "none", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>Claim Ticket</button>}
                    {ticket.status === "claimed" && (
                      <>
                        <label style={{ padding: "6px 12px", borderRadius: "999px", background: "#27272a", border: "1px solid #3f3f46", fontSize: "11px", cursor: "pointer" }}><input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files[0]; if (f) { const r = new FileReader(); r.onload = (ev) => setEvidencePreviews((p) => ({ ...p, [ticket.id]: ev.target.result })); r.readAsDataURL(f); } }} />Evidence Photo*</label>
                        <button disabled={!evidencePreviews[ticket.id]} onClick={() => solveTicket(ticket.id)} style={{ padding: "6px 14px", borderRadius: "999px", background: evidencePreviews[ticket.id] ? "#10b981" : "#27272a", color: evidencePreviews[ticket.id] ? "black" : "#52525b", border: "none", fontSize: "12px", fontWeight: "600", cursor: evidencePreviews[ticket.id] ? "pointer" : "not-allowed" }}>Mark Solved</button>
                      </>
                    )}
                  </div>
                  {ticket.status === "claimed" && !evidencePreviews[ticket.id] && <div style={{ marginTop: "8px", fontSize: "11px", color: "#fcd34d", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "8px", padding: "6px 10px" }}>Evidence photo required to close ticket</div>}
                  {evidencePreviews[ticket.id
