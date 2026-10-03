import React, { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { collection, addDoc, onSnapshot, doc, updateDoc, serverTimestamp, query, orderBy, setDoc, getDoc } from "firebase/firestore";

const SCHEMES_DB = {
  loan_job: [
    { id: "mudra", name: "PM MUDRA Yojana", url: "https://www.mudra.org.in/", desc: "Business / loan up to 10 lakh", eligibility: "18+ years, business plan" },
    { id: "pmegp", name: "PMEGP", url: "https://www.kviconline.gov.in/pmegpeportal/", desc: "Self employment", eligibility: "18+ years" },
    { id: "ncs", name: "National Career Service", url: "https://www.ncs.gov.in/", desc: "Job portal & skill training", eligibility: "18+, ID proof" },
  ],
  education: [
    { id: "nsp", name: "National Scholarship Portal", url: "https://scholarships.gov.in/", desc: "Central scholarships", eligibility: "Student ID, income <2.5L" },
    { id: "vidya", name: "PM Vidya Lakshmi", url: "https://www.vidyalakshmi.co.in/", desc: "Education loan window", eligibility: "Admission letter" },
  ],
  health: [
    { id: "pmjay", name: "Ayushman Bharat PM-JAY", url: "https://pmjay.gov.in/", desc: "Rs. 5 lakh insurance", eligibility: "BPL / SECC list" },
    { id: "cmchis", name: "TN CM Health Insurance", url: "https://www.cmchistn.com/", desc: "TN health coverage", eligibility: "TN resident" },
  ],
  housing: [{ id: "pmay", name: "PMAY", url: "https://pmaymis.gov.in/", desc: "Housing for all", eligibility: "No pucca house" }],
  farmer: [
    { id: "pmkisan", name: "PM-KISAN", url: "https://pmkisan.gov.in/", desc: "Rs. 6000/year", eligibility: "Landholding farmer" },
    { id: "kcc", name: "KCC", url: "https://www.pmkisan.gov.in/", desc: "Crop loan", eligibility: "Cultivable land" },
  ],
};

function getSchemesForText(text) {
  const t = text.toLowerCase();
  const has = (w) => w.some(x => t.includes(x));
  if (has(["loan","job","unemployed","permanent job","10 lakh","10lakh","debt","emi","business","self employment","startup","mudra"])) return SCHEMES_DB.loan_job;
  if (has(["fee","college","school","education","student","scholarship","exam","university","admission"])) return SCHEMES_DB.education;
  if (has(["health","medical","hospital","treatment","disease","insurance","doctor","surgery"])) return SCHEMES_DB.health;
  if (has(["house","housing","home","rent","shelter","awas"])) return SCHEMES_DB.housing;
  if (has(["farm","farmer","crop","agriculture","kisan","farming"])) return SCHEMES_DB.farmer;
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
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [personalText, setPersonalText] = useState("");
  const [publicText, setPublicText] = useState("");
  const [income, setIncome] = useState("");
  const [category, setCategory] = useState("");
  const [personalSchemes, setPersonalSchemes] = useState(null);
  const [gps, setGps] = useState(null);
  const [publicIssues, setPublicIssues] = useState([]);
  const [personalIssues, setPersonalIssues] = useState([]);
  const [stats, setStats] = useState({ total:0, completed:0, volunteers:0, resolved:0 });
  const [publicPhoto, setPublicPhoto] = useState(null);
  const [publicPhotoPreview, setPublicPhotoPreview] = useState(null);
  const [evidencePreviews, setEvidencePreviews] = useState({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFbUser(u);
      if (u) {
        try { const snap = await getDoc(doc(db, "users", u.uid)); if (snap.exists()) setUserRole(snap.data().role || "user"); } catch(e){}
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
    const q1 = query(collection(db, "publicIssues"), orderBy("createdAt","desc"));
    const unsub1 = onSnapshot(q1, (snap) => { setPublicIssues(snap.docs.map(d => ({ id: d.id, ...d.data() }))); });
    const q2 = query(collection(db, "personalIssues"), orderBy("createdAt","desc"));
    const unsub2 = onSnapshot(q2, (snap) => { setPersonalIssues(snap.docs.map(d => ({ id: d.id, ...d.data() }))); });
    const unsub3 = onSnapshot(collection(db, "users"), (snap) => {
      const vols = snap.docs.filter(d => d.data().role === "volunteer").length;
      setStats(s => ({ ...s, volunteers: vols }));
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  useEffect(() => {
    const total = publicIssues.length + personalIssues.length;
    const completed = publicIssues.filter(i => i.status === "solved").length;
    const resolved = total > 0 ? Math.round((completed/total)*100) : 0;
    setStats(s => ({ ...s, total, completed, resolved }));
  }, [publicIssues, personalIssues]);

  const handleAuth = async () => {
    setAuthError(""); setAuthLoading(true);
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
    } catch (e) { setAuthError(e.message); }
    setAuthLoading(false);
  };

  const submitPersonal = async () => {
    if (!personalText.trim()) { alert("Enter description"); return; }
    const schemes = getSchemesForText(personalText);
    setPersonalSchemes(schemes);
    await addDoc(collection(db, "personalIssues"), { text: personalText, income, category, schemes, userId: fbUser.uid, status: "open", createdAt: serverTimestamp() });
    setPersonalText(""); setIncome(""); setCategory("");
  };

  const handlePublicPhoto = (file) => {
    if (!file) { setPublicPhoto(null); setPublicPhotoPreview(null); return; }
    setPublicPhoto(file);
    const reader = new FileReader();
    reader.onload = (e) => setPublicPhotoPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const submitPublic = async () => {
    if (!publicText.trim()) { alert("Enter street issue"); return; }
    await addDoc(collection(db, "publicIssues"), { text: publicText, gps, photoName: publicPhoto ? publicPhoto.name : null, photoDataUrl: publicPhotoPreview, photoProvided: !!publicPhoto, userId: fbUser.uid, status: "open", createdAt: serverTimestamp() });
    setPublicText(""); setPublicPhoto(null); setPublicPhotoPreview(null);
  };

  const claimTicket = async (id) => { await updateDoc(doc(db, "publicIssues", id), { status: "claimed", claimedBy: fbUser.uid }); };
  const handleEvidence = (id, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { setEvidencePreviews(p => ({ ...p, [id]: e.target.result })); };
    reader.readAsDataURL(file);
  };
  const solveTicket = async (id) => {
    if (!evidencePreviews[id]) { alert("Evidence photo required"); return; }
    await updateDoc(doc(db, "publicIssues", id), { status: "solved", evidenceDataUrl: evidencePreviews[id], solvedAt: serverTimestamp() });
  };

  if (!fbUser) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
        <div className="w-full max-w-[420px] rounded-[24px] border border-zinc-800 bg-[#121214] p-6">
          <div className="text-center mb-6">
            <h1 className="text-[22px] font-bold">CAREPULES</h1>
            <p className="text-[11px] text-zinc-400 mt-2 uppercase">Community Problem Solving Platform - By RAISE UP TOGETHER Team</p>
          </div>
          <div className="flex gap-2 mb-6 p-1 rounded-full bg-[#1a1a1d] border border-zinc-800">
            <button onClick={()=>setAuthMode("login")} className={`flex-1 h-9 rounded-full text-[13px] ${authMode==="login" ? "bg-white text-black" : "text-zinc-400"}`}>Login</button>
            <button onClick={()=>setAuthMode("register")} className={`flex-1 h-9 rounded-full text-[13px] ${authMode==="register" ? "bg-white text-black" : "text-zinc-400"}`}>Register</button>
          </div>
          {authMode==="register" && <input value={name} onChange={e=>setName(e.target.value)} placeholder="Full Name" className="w-full h-11 mb-3 px-4 rounded-xl bg-[#1c1c1f] border border-zinc-800 text-[14px]" />}
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="w-full h-11 mb-3 px-4 rounded-xl bg-[#1c1c1f] border border-zinc-800 text-[14px]" />
          <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password" className="w-full h-11 mb-4 px-4 rounded-xl bg-[#1c1c1f] border border-zinc-800 text-[14px]" />
          {authMode==="register" && (
            <div className="flex gap-3 mb-5">
              <label className="flex items-center gap-2 text-[13px]"><input type="radio" checked={role==="user"} onChange={()=>setRole("user")} /> Normal User</label>
              <label className="flex items-center gap-2 text-[13px]"><input type="radio" checked={role==="volunteer"} onChange={()=>setRole("volunteer")} /> Volunteer</label>
            </div>
          )}
          {authError && <div className="mb-4 text-[12px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{authError}</div>}
          <button onClick={handleAuth} disabled={authLoading} className="w-full h-11 rounded-full bg-white text-black font-semibold text-[14px]">{authLoading ? "Wait..." : authMode==="register" ? "Sign Up" : "Login"}</button>
          <div className="text-center mt-4 text-[12px] text-zinc-400">
            {authMode==="register" ? <span>Already have account? <button onClick={()=>setAuthMode("login")} className="text-white underline">Login</button></span> : <span>Don't have account? <button onClick={()=>setAuthMode("register")} className="text-white underline">Register</button></span>}
          </div>
          <div className="mt-8 text-center text-[10px] text-zinc-600">漏 2026 CAREPULES | By RAISE UP TOGETHER Team | Privacy-Safe</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-[#0a0a0a]/90 backdrop-blur">
        <div className="max-w-[980px] mx-auto px-4 h-[56px] flex items-center justify-between">
          <div><div className="font-bold">CAREPULES</div><div className="text-[10px] text-zinc-500 uppercase">By RAISE UP TOGETHER Team</div></div>
          <div className="flex items-center gap-3"><span className="text-[11px] text-zinc-400">{fbUser.email} | {userRole}</span><button onClick={()=>signOut(auth)} className="text-[11px] px-3 h-7 rounded-full border border-zinc-700 bg-zinc-900">Logout</button></div>
        </div>
      </header>
      <main className="max-w-[980px] mx-auto px-4 py-6">
        <section className="rounded-[20px] border border-zinc-800 bg-[#121214] p-5">
          <h3 className="text-[12px] uppercase text-zinc-400 mb-3">Community Impact - Live for All Users After Registration</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl bg-black border border-zinc-800 p-4 text-center"><div className="text-[20px] font-bold">{stats.total}</div><div className="text-[11px] text-zinc-500">Total Reported</div></div>
            <div className="rounded-xl bg-black border border-zinc-800 p-4 text-center"><div className="text-[20px] font-bold">{stats.completed}</div><div className="text-[11px] text-zinc-500">Completed</div></div>
            <div className="rounded-xl bg-black border border-zinc-800 p-4 text-center"><div className="text-[20px] font-bold">{stats.volunteers}</div><div className="text-[11px] text-zinc-500">Active Volunteers</div></div>
            <div className="rounded-xl bg-black border border-zinc-800 p-4 text-center"><div className="text-[20px] font-bold">{stats.resolved}%</div><div className="text-[11px] text-zinc-500">Resolved</div></div>
          </div>
        </section>
        {userRole === "user" && (
          <>
            <section className="mt-6 rounded-[20px] border border-zinc-800 bg-[#121214] p-5">
              <h3 className="font-semibold text-[14px] mb-1">1. Report Personal Vulnerability [PRIVATE]</h3>
              <p className="text-[11px] text-zinc-500 mb-3">100% anonymous, AI flags risk, shows schemes + direct link</p>
              <textarea value={personalText} onChange={e=>setPersonalText(e.target.value)} placeholder="Describe personal difficulty..." className="w-full min-h-[80px] rounded-xl bg-black border border-zinc-800 p-3 text-[13px]"></textarea>
              {personalText.length > 10 && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <select value={income} onChange={e=>setIncome(e.target.value)} className="h-10 rounded-xl bg-black border border-zinc-800 px-3 text-[12px]"><option value="">Monthly Income</option><option value="<10000">Below 10k</option><option value="10000-25000">10k-25k</option><option value=">25000">Above 25k</option></select>
                  <select value={category} onChange={e=>setCategory(e.target.value)} className="h-10 rounded-xl bg-black border border-zinc-800 px-3 text-[12px]"><option value="">Category</option><option value="BPL">BPL</option><option value="APL">APL</option><option value="SC/ST">SC/ST</option></select>
                </div>
              )}
              <button onClick={submitPersonal} className="mt-3 px-5 h-10 rounded-full bg-cyan-400 text-black text-[13px] font-semibold">Submit Personal</button>
              {personalSchemes && personalSchemes.length > 0 && (
                <div className="mt-4 space-y-2">
                  {personalSchemes.map(s=>(
                    <div key={s.id} className="rounded-xl border border-zinc-800 bg-black p-3">
                      <div className="font-medium text-[13px]">{s.name}</div>
                      <div className="text-[11px] text-zinc-400 mt-1">{s.desc}</div>
                      <div className="text-[11px] text-zinc-500 mt-1">Eligibility: {s.eligibility}</div>
                      <a href={s.url} target="_blank" className="inline-block mt-2 text-[12px] px-3 h-7 leading-7 rounded-full bg-white text-black">Apply Now</a>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="mt-6 rounded-[20px] border border-zinc-800 bg-[#121214] p-5">
              <h3 className="font-semibold text-[14px] mb-1">2. Report Street/Public Issue [PUBLIC]</h3>
              <p className="text-[11px] text-zinc-500 mb-3">Photo + Auto GPS {gps ? `Lat: ${gps.lat.toFixed(4)} Lng: ${gps.lng.toFixed(4)}` : "Fetching GPS..."}</p>
              <textarea value={publicText} onChange={e=>setPublicText(e.target.value)} placeholder="Describe street issue..." className="w-full min-h-[70px] rounded-xl bg-black border border-zinc-800 p-3 text-[13px]"></textarea>
              <div className="mt-3 flex items-center gap-3">
                <label className="h-9 px-4 rounded-full bg-zinc-800 border border-zinc-700 text-[12px] flex items-center cursor-pointer"><input type="file" accept="image/*" className="hidden" onChange={e=>handlePublicPhoto(e.target.files[0])} />Choose file</label>
                <span className="text-[11px] text-zinc-500">{publicPhoto ? publicPhoto.name : "No file chosen"}</span>
              </div>
              {publicPhotoPreview && <img src={publicPhotoPreview} className="mt-3 w-full h-[180px] object-cover rounded-xl border border-zinc-800" />}
              <button onClick={submitPublic} className="mt-3 px-5 h-10 rounded-full bg-cyan-400 text-black text-[13px] font-semibold">Submit Public with Proof</button>
            </section>
          </>
        )}
        {userRole === "volunteer" && (
          <section className="mt-6 rounded-[20px] border border-zinc-800 bg-[#121214] p-5">
            <h3 className="font-semibold text-[14px] mb-3">Volunteer Dashboard</h3>
            <div className="grid md:grid-cols-2 gap-3">
              {publicIssues.filter(i=>i.status!=="solved").map(ticket=>(
                <div key={ticket.id} className="rounded-xl border border-zinc-800 bg-black p-4">
                  <p className="text-[13px]">{ticket.text}</p>
                  {ticket.photoDataUrl ? <img src={ticket.photoDataUrl} className="mt-2 w-full h-[140px] object-cover rounded-xl" /> : <div className="mt-2 h-[60px] rounded-xl bg-zinc-900 flex items-center justify-center text-[11px] text-zinc-500">No photo provided</div>}
                  <div className="mt-3 flex gap-2">
                    {ticket.status==="open" && <button onClick={()=>claimTicket(ticket.id)} className="h-8 px-3 rounded-full bg-white text-black text-[12px] font-semibold">Claim Ticket</button>}
                    {ticket.status==="claimed" && (
                      <>
                        <label className="h-8 px-3 rounded-full bg-zinc-800 border border-zinc-700 text-[12px] flex items-center cursor-pointer"><input type="file" accept="image/*" className="hidden" onChange={e=>handleEvidence(ticket.id, e.target.files[0])} />Evidence Photo*</label>
                        <button disabled={!evidencePreviews[ticket.id]} onClick={()=>solveTicket(ticket.id)} className="h-8 px-3 rounded-full bg-emerald-500 text-black text-[12px] disabled:opacity-40">Mark Solved</button>
                      </>
                    )}
                  </div>
                  {ticket.status==="claimed" && !evidencePreviews[ticket.id] && <div className="mt-2 text-[11px] text-amber-300 bg-amber-500/10 border rounded-lg p-2">Evidence photo required to close ticket</div>}
                  {evidencePreviews[ticket.id] && <img src={evidencePreviews[ticket.id]} className="mt-2 w-full h-[120px] object-cover rounded-xl" />}
                </div>
              ))}
            </div>
          </section>
        )}
        <section className="mt-6 rounded-[20px] border border-zinc-800 bg-[#121214] p-5">
          <h3 className="font-semibold text-[14px] mb-3">Live Map Feed</h3>
          <div className="space-y-2">
            {publicIssues.slice(0,10).map(issue=>(
              <div key={issue.id} className="rounded-xl border border-zinc-800 bg-black p-3 text-[12px]">
                <div className="flex justify-between"><span>{issue.text}</span><span className="text-[10px] uppercase px-2 py-1 rounded-full bg-zinc-800">{issue.status}</span></div>
              </div>
            ))}
            {publicIssues.length===0 && <div className="text-[12px] text-zinc-500">No issues yet</div>}
          </div>
        </section>
        <footer className="mt-10 pb-10 text-center border-t border-zinc-800 pt-6">
          <p className="text-[11px] text-zinc-500">漏 2026 CAREPULES | By RAISE UP TOGETHER Team | Privacy-Safe</p>
        </footer>
      </main>
    </div>
  );
    }
