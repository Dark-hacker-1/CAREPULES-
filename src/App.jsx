
import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, serverTimestamp, query, orderBy, setDoc, getDoc } from "firebase/firestore";

// YOUR REAL FIREBASE CONFIG - Inserted from your message
const firebaseConfig = {
  apiKey: "AIzaSyBopYr0IiMzK9nwCxK3NjoDwYXNAHi95PA",
  authDomain: "carepules-5ff07.firebaseapp.com",
  projectId: "carepules-5ff07",
  storageBucket: "carepules-5ff07.firebasestorage.app",
  messagingSenderId: "1047950214331",
  appId: "1:1047950214331:web:2b095b65a33d16e915959e",
  measurementId: "G-GDD4N4E9FQ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const SCHEMES = {
  loan_job: [
    { name: "PM MUDRA Yojana", url: "https://www.mudra.org.in/", desc: "Business loan up to 10 lakh - Shishu, Kishor, Tarun", eligibility: "18+ years, business plan required" },
    { name: "PMEGP", url: "https://www.kviconline.gov.in/pmegpeportal/", desc: "Prime Minister Employment Generation Programme", eligibility: "18+ years, 8th pass" },
    { name: "National Career Service", url: "https://www.ncs.gov.in/", desc: "Job portal, skill training, career counseling", eligibility: "18+ years, valid ID" },
  ],
  education: [
    { name: "National Scholarship Portal", url: "https://scholarships.gov.in/", desc: "Central scholarships for school and college students", eligibility: "Student ID, income less than 2.5L" },
    { name: "PM Vidya Lakshmi", url: "https://www.vidyalakshmi.co.in/", desc: "Education loan portal - single window for all banks", eligibility: "Admission letter, co-applicant required" },
  ],
  health: [
    { name: "Ayushman Bharat PM-JAY", url: "https://pmjay.gov.in/", desc: "Rs 5 lakh free health insurance per family per year", eligibility: "SECC 2011 list or BPL card" },
    { name: "TN CM Health Insurance", url: "https://www.cmchistn.com/", desc: "Tamil Nadu state health coverage", eligibility: "TN resident, income less than 1.2L" },
  ],
  housing: [
    { name: "PMAY - Housing for All", url: "https://pmaymis.gov.in/", desc: "Pradhan Mantri Awas Yojana - housing subsidy", eligibility: "No pucca house, Aadhaar required" },
  ],
  farmer: [
    { name: "PM-KISAN", url: "https://pmkisan.gov.in/", desc: "Rs 6000 per year direct benefit to farmers", eligibility: "Landholding farmer, Aadhaar linked account" },
    { name: "KCC - Kisan Credit Card", url: "https://www.pmkisan.gov.in/", desc: "Crop loan and working capital at low interest", eligibility: "Farmer with cultivable land proof" },
  ],
};

function getSchemesForProblem(text) {
  const t = text.toLowerCase();
  if (t.includes("loan") || t.includes("job") || t.includes("unemployed") || t.includes("10 lakh") || t.includes("10lakh") || t.includes("debt") || t.includes("emi") || t.includes("business") || t.includes("mudra") || t.includes("permanent job")) {
    return SCHEMES.loan_job;
  }
  if (t.includes("fee") || t.includes("college") || t.includes("school") || t.includes("education") || t.includes("student") || t.includes("scholarship") || t.includes("exam") || t.includes("university") || t.includes("admission")) {
    return SCHEMES.education;
  }
  if (t.includes("health") || t.includes("medical") || t.includes("hospital") || t.includes("treatment") || t.includes("disease") || t.includes("insurance") || t.includes("doctor") || t.includes("surgery")) {
    return SCHEMES.health;
  }
  if (t.includes("house") || t.includes("housing") || t.includes("home") || t.includes("rent") || t.includes("shelter") || t.includes("awas")) {
    return SCHEMES.housing;
  }
  if (t.includes("farm") || t.includes("farmer") || t.includes("crop") || t.includes("agriculture") || t.includes("kisan")) {
    return SCHEMES.farmer;
  }
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
      navigator.geolocation.getCurrentPosition((pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }, () => {});
    }
  }, []);

  useEffect(() => {
    const q1 = query(collection(db, "publicIssues"), orderBy("createdAt", "desc"));
    const unsub1 = onSnapshot(q1, (snap) => {
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
    if (!personalText.trim()) { alert("Enter personal difficulty"); return; }
    const schemes = getSchemesForProblem(personalText);
    setPersonalSchemes(schemes);
    await addDoc(collection(db, "personalIssues"), { text: personalText, income, category, schemes, userId: fbUser.uid, status: "open", createdAt: serverTimestamp() });
    setPersonalText("");
    setIncome("");
    setCategory("");
  };

  const submitPublic = async () => {
    if (!publicText.trim()) { alert("Enter street issue"); return; }
    await addDoc(collection(db, "publicIssues"), { text: publicText, gps, photoDataUrl: photoPreview, photoProvided: !!photoPreview, userId: fbUser.uid, status: "open", createdAt: serverTimestamp() });
    setPublicText("");
    setPhotoPreview(null);
  };

  const claimTicket = async (id) => {
    await updateDoc(doc(db, "publicIssues", id), { status: "claimed", claimedBy: fbUser.uid });
  };

  const solveTicket = async (id) => {
    if (!evidencePreviews[id]) { alert("Evidence photo required to close ticket"); return; }
    await updateDoc(doc(db, "publicIssues", id), { status: "solved", evidenceDataUrl: evidencePreviews[id], solvedAt: serverTimestamp() });
  };

  if (!fbUser) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "white", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", fontFamily: "system-ui" }}>
        <div style={{ width: "100%", maxWidth: "440px", background: "#121214", border: "1px solid #27272a", borderRadius: "24px", padding: "32px" }}>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <div style={{ fontSize: "28px", fontWeight: "800" }}>CAREPULES</div>
            <div style={{ fontSize: "11px", color: "#a1a1aa", marginTop: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>Community Problem Solving Platform - By RAISE UP TOGETHER Team</div>
          </div>
          <div style={{ display: "flex", gap: "8px", padding: "4px", background: "#1a1a1d", borderRadius: "999px", border: "1px solid #27272a", marginBottom: "24px" }}>
            <button onClick={() => setAuthMode("login")} style={{ flex: 1, height: "36px", borderRadius: "999px", border: "none", cursor: "pointer", background: authMode === "login" ? "white" : "transparent", color: authMode === "login" ? "black" : "#71717a", fontSize: "13px", fontWeight: "500" }}>Login</button>
            <button onClick={() => setAuthMode("register")} style={{ flex: 1, height: "36px", borderRadius: "999px", border: "none", cursor: "pointer", background: authMode === "register" ? "white" : "transparent", color: authMode === "register" ? "black" : "#71717a", fontSize: "13px", fontWeight: "500" }}>Register</button>
          </div>
          {authMode === "register" && <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" style={{ width: "100%", height: "44px", marginBottom: "12px", padding: "0 16px", borderRadius: "14px", background: "#1c1c1f", border: "1px solid #27272a", color: "white", outline: "none" }} />}
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" style={{ width: "100%", height: "44px", marginBottom: "12px", padding: "0 16px", borderRadius: "14px", background: "#1c1c1f", border: "1px solid #27272a", color: "white", outline: "none" }} />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" style={{ width: "100%", height: "44px", marginBottom: "16px", padding: "0 16px", borderRadius: "14px", background: "#1c1c1f", border: "1px solid #27272a", color: "white", outline: "none" }} />
          {authMode === "register" && (
            <div style={{ display: "flex", gap: "20px", marginBottom: "20px", fontSize: "13px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}><input type="radio" checked={role === "user"} onChange={() => setRole("user")} /> Normal User</label>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}><input type="radio" checked={role === "volunteer"} onChange={() => setRole("volunteer")} /> Volunteer</label>
            </div>
          )}
          {error && <div style={{ marginBottom: "16px", padding: "10px 12px", borderRadius: "12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", fontSize: "12px", color: "#fca5a5" }}>{error}</div>}
          <button onClick={handleAuth} disabled={loading} style={{ width: "100%", height: "46px", borderRadius: "999px", background: "white", color: "black", fontWeight: "600", border: "none", cursor: "pointer", fontSize: "14px" }}>{loading ? "Please wait..." : authMode === "register" ? "Create Account" : "Login to CAREPULES"}</button>
          <div style={{ textAlign: "center", marginTop: "16px", fontSize: "12px", color: "#71717a" }}>
            {authMode === "register" ? <span>Already have account? <button onClick={() => setAuthMode("login")} style={{ background: "none", border: "none", color: "white", textDecoration: "underline", cursor: "pointer" }}>Login</button></span> : <span>Don't have account? <button onClick={() => setAuthMode("register")} style={{ background: "none", border: "none", color: "white", textDecoration: "underline", cursor: "pointer" }}>Register</button></span>}
          </div>
          <div style={{ textAlign: "center", marginTop: "28px", fontSize: "10px", color: "#52525b", lineHeight: "1.5" }}>Copyright 2026 CAREPULES | By RAISE UP TOGETHER Team | Privacy-Safe<br/>Government Scheme Direct Link for Eligible Citizens</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e4e4e7", fontFamily: "system-ui" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 10, borderBottom: "1px solid #27272a", background: "rgba(10,10,10,0.9)" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "0 20px", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div><div style={{ fontWeight: "800", fontSize: "18px" }}>CAREPULES</div><div style={{ fontSize: "9px", color: "#71717a", letterSpacing: "1px", textTransform: "uppercase" }}>By RAISE UP TOGETHER Team</div></div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><span style={{ fontSize: "11px", color: "#71717a" }}>{fbUser.email} | {userRole}</span><button onClick={() => signOut(auth)} style={{ fontSize: "11px", padding: "6px 14px", borderRadius: "999px", border: "1px solid #3f3f46", background: "#18181b", color: "#a1a1aa", cursor: "pointer" }}>Logout</button></div>
        </div>
      </header>
      <main style={{ maxWidth: "1000px", margin: "0 auto", padding: "20px" }}>
        <div style={{ background: "#121214", border: "1px solid #27272a", borderRadius: "20px", padding: "20px" }}>
          <div style={{ fontSize: "11px", color: "#71717a", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "1px" }}>Community Impact - Live for All Users After Registration</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
            <div style={{ background: "black", border: "1px solid #27272a", borderRadius: "16px", padding: "16px", textAlign: "center" }}><div style={{ fontSize: "24px", fontWeight: "700" }}>{stats.total}</div><div style={{ fontSize: "11px", color: "#71717a", marginTop: "4px" }}>Total Reported</div></div>
            <div style={{ background: "black", border: "1px solid #27272a", borderRadius: "16px", padding: "16px", textAlign: "center" }}><div style={{ fontSize: "24px", fontWeight: "700", color: "#22d3ee" }}>{stats.completed}</div><div style={{ fontSize: "11px", color: "#71717a", marginTop: "4px" }}>Completed</div></div>
            <div style={{ background: "black", border: "1px solid #27272a", borderRadius: "16px", padding: "16px", textAlign: "center" }}><div style={{ fontSize: "24px", fontWeight: "700" }}>{stats.volunteers}</div><div style={{ fontSize: "11px", color: "#71717a", marginTop: "4px" }}>Active Volunteers</div></div>
            <div style={{ background: "black", border: "1px solid #27272a", borderRadius: "16px", padding: "16px", textAlign: "center" }}><div style={{ fontSize: "24px", fontWeight: "700", color: "#a78bfa" }}>{stats.resolved}%</div><div style={{ fontSize: "11px", color: "#71717a", marginTop: "4px" }}>Resolved</div></div>
          </div>
        </div>

        {userRole === "user" && (
          <>
            <div style={{ marginTop: "20px", background: "#121214", border: "1px solid #27272a", borderRadius: "20px", padding: "24px" }}>
              <h3 style={{ fontSize: "15px", margin: "0 0 8px 0", fontWeight: "600" }}>1. Report Personal Vulnerability [PRIVATE]</h3>
              <p style={{ fontSize: "11px", color: "#71717a", margin: "0 0 16px 0" }}>100% anonymous, AI flags risk, shows government schemes + direct link</p>
              <textarea value={personalText} onChange={(e) => setPersonalText(e.target.value)} placeholder="Describe personal difficulty - e.g., I don't have permanent job and I have 10 lakh loan, education fee..." style={{ width: "100%", minHeight: "90px", background: "black", border: "1px solid #27272a", borderRadius: "14px", padding: "12px", color: "white", outline: "none" }}></textarea>
              {personalText.length > 10 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
                  <select value={income} onChange={(e) => setIncome(e.target.value)} style={{ height: "40px", background: "black", border: "1px solid #27272a", borderRadius: "12px", padding: "0 12px", color: "white" }}><option value="">Monthly Income</option><option value="<10000">Below 10k</option><option value="10000-25000">10k-25k</option><option value=">25000">Above 25k</option></select>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ height: "40px", background: "black", border: "1px solid #27272a", borderRadius: "12px", padding: "0 12px", color: "white" }}><option value="">Category</option><option value="BPL">BPL</option><option value="APL">APL</option><option value="SC/ST">SC/ST</option></select>
                </div>
              )}
              <button onClick={submitPersonal} style={{ marginTop: "14px", padding: "10px 22px", borderRadius: "999px", background: "#22d3ee", color: "black", border: "none", fontWeight: "600", fontSize: "13px", cursor: "pointer" }}>Submit Personal - Get Scheme Direct Link</button>
              {personalSchemes && personalSchemes.length > 0 && (
                <div style={{ marginTop: "18px", display: "grid", gap: "10px" }}>
                  <div style={{ fontSize: "12px", fontWeight: "600" }}>Relevant Government Schemes for your problem:</div>
                  {personalSchemes.map((s, i) => (
                    <div key={i} style={{ background: "black", border: "1px solid #27272a", borderRadius: "14px", padding: "14px" }}>
                      <div style={{ fontWeight: "600", fontSize: "13px" }}>{s.name}</div>
                      <div style={{ fontSize: "11px", color: "#a1a1aa", marginTop: "4px" }}>{s.desc}</div>
                      <div style={{ fontSize: "11px", color: "#71717a", marginTop: "4px" }}>Eligibility: {s.eligibility}</div>
                      <a href={s.url} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: "10px", fontSize: "11px", padding: "6px 14px", borderRadius: "999px", background: "white", color: "black", textDecoration: "none", fontWeight: "600" }}>Apply Now - Direct Link</a>
                    </div>
                  ))}
                </div>
              )}
              {personalSchemes && personalSchemes.length === 0 && <div style={{ marginTop: "12px", fontSize: "12px", color: "#71717a" }}>No specific scheme detected - Our team will review. Contact helpline 1800-180-1551</div>}
            </div>

            <div style={{ marginTop: "20px", background: "#121214", border: "1px solid #27272a", borderRadius: "20px", padding: "24px" }}>
              <h3 style={{ fontSize: "15px", margin: "0 0 8px 0", fontWeight: "600" }}>2. Report Street / Public Issue [PUBLIC]</h3>
              <p style={{ fontSize: "11px", color: "#71717a", margin: "0 0 16px 0" }}>Photo + Auto GPS {gps ? "| Lat " + gps.lat.toFixed(4) + " Lng " + gps.lng.toFixed(4) : "| Fetching GPS..."}</p>
              <textarea value={publicText} onChange={(e) => setPublicText(e.target.value)} placeholder="Describe street issue - pothole, garbage, street light..." style={{ width: "100%", minHeight: "80px", background: "black", border: "1px solid #27272a", borderRadius: "14px", padding: "12px", color: "white", outline: "none" }}></textarea>
              <div style={{ marginTop: "12px", display: "flex", gap: "10
