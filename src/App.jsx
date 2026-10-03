import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  setDoc,
} from "./firebase";
import {
  ShieldCheck,
  MapPin,
  Upload,
  LogOut,
  Users,
  CheckCircle2,
  BarChart3,
  FileText,
  Eye,
  AlertCircle,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";



type PublicIssueDoc = {
  id;
  text;
  status: "open" | "claimed" | "solved";
  createdAt: any;
  createdBy;
  gps?: { lat: number; lng: number } | null;
  photoProvided: boolean;
  photoName?;
  photoDataUrl? | null;
  claimedBy? | null;
  evidencePhotoName? | null;
  evidenceDataUrl? | null;
};

const SCHEMES_DB: Record = {
  loan_job: [
    {
      id: "mudra",
      name: "PM MUDRA Yojana",
      url: "https://www.mudra.org.in/",
      desc: "For business / loan - Shishu, Kishor, Tarun loans up to 10 lakh",
      eligibility: "Must be 18+ years, business plan required",
    },
    {
      id: "pmegp",
      name: "PMEGP",
      url: "https://www.kviconline.gov.in/pmegpeportal/",
      desc: "Prime Minister's Employment Generation Programme for self employment",
      eligibility: "Must be 18+ years, 8th pass for >10 lakh project",
    },
    {
      id: "ncs",
      name: "National Career Service",
      url: "https://www.ncs.gov.in/",
      desc: "Job portal, skill training & career counseling for unemployed youth",
      eligibility: "Must be 18+, valid ID proof required",
    },
  ],
  education: [
    {
      id: "nsp",
      name: "National Scholarship Portal",
      url: "https://scholarships.gov.in/",
      desc: "Central scholarships for school & college students",
      eligibility: "Student ID, income  words.some((w) => t.includes(w));

  if (
    has([
      "loan",
      "job",
      "unemployed",
      "permanent job",
      "10 lakh",
      "10lakh",
      "debt",
      "emi",
      "business",
      "self employment",
      "self-employment",
      "selfemployed",
      "startup",
      "udhyam",
      "mudra",
    ])
  ) {
    return SCHEMES_DB.loan_job;
  }
  if (
    has([
      "fee",
      "college",
      "school",
      "education",
      "student",
      "scholarship",
      "exam",
      "university",
      "admission",
      "tuition",
    ])
  ) {
    return SCHEMES_DB.education;
  }
  if (
    has([
      "health",
      "medical",
      "hospital",
      "treatment",
      "disease",
      "insurance",
      "doctor",
      "surgery",
      "illness",
      "medicine",
    ])
  ) {
    return SCHEMES_DB.health;
  }
  if (
    has([
      "house",
      "housing",
      "home",
      "rent",
      "shelter",
      "awas",
      "roof",
      "landless",
    ])
  ) {
    return SCHEMES_DB.housing;
  }
  if (
    has(["farm", "farmer", "crop", "agriculture", "kisan", "khet", "farming"])
  ) {
    return SCHEMES_DB.farmer;
  }
  return [];
}

export default function App() {
  // Auth
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [fbUser, setFbUser] = useState(null);
  const [userRole, setUserRole] = useState("user");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  // Inputs - separate state (fix auto-copy bug)
  const [personalText, setPersonalText] = useState("");
  const [publicText, setPublicText] = useState("");
  const [income, setIncome] = useState("");
  const [category, setCategory] = useState("");

  const [personalSchemes, setPersonalSchemes] = useState(null);
  const [publicSchemes, setPublicSchemes] = useState(null);
  const [personalNoMatch, setPersonalNoMatch] = useState(false);
  const [publicNoMatch, setPublicNoMatch] = useState(false);

  // Public issue
  const [publicPhotoFile, setPublicPhotoFile] = useState(null);
  const [publicPhotoPreview, setPublicPhotoPreview] = useState(null);
  const [gps, setGps] = useState(null);
  const [gpsStatus, setGpsStatus] = useState("idle");
  const [submittingPublic, setSubmittingPublic] = useState(false);

  // Counters
  const [totalReported, setTotalReported] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [activeVolunteers, setActiveVolunteers] = useState(0);
  const [publicIssues, setPublicIssues] = useState([]);

  // Volunteer solve
  const [evidenceFiles, setEvidenceFiles] = useState>({});
  const [evidencePreviews, setEvidencePreviews] = useState>({});

  const publicPhotoRef = useRef(null);

  // Auth observer
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setFbUser(u);
    });
    return () => unsub();
  }, []);

  // Real Firestore counters
  useEffect(() => {
    const qPublic = query(collection(db, "publicIssues"), orderBy("createdAt", "desc"));
    const unsubPublic = onSnapshot(
      qPublic,
      (snap) => {
        const docs: PublicIssueDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setPublicIssues(docs);
        const completedCount = docs.filter((x) => x.status === "solved").length;
        (window as any).__publicCount = docs.length;
        (window as any).__publicCompleted = completedCount;
        calcTotals();
      },
      () => {
        // offline fallback - keep 0
      }
    );

    const qPersonal = query(collection(db, "personalIssues"));
    const unsubPersonal = onSnapshot(
      qPersonal,
      (snap) => {
        (window as any).__personalCount = snap.size;
        (window as any).__personalCompleted = snap.docs.filter(
          (d) => (d.data() as any).status === "solved"
        ).length;
        calcTotals();
      },
      () => {}
    );

    const qUsers = query(collection(db, "users"));
    const unsubUsers = onSnapshot(
      qUsers,
      (snap) => {
        const vols = snap.docs.filter((d) => (d.data() as any).role === "volunteer").length;
        setActiveVolunteers(vols);
        // determine current user role
        if (fbUser) {
          const me = snap.docs.find((d) => d.id === fbUser.uid);
          if (me) setUserRole((me.data() as any).role || "user");
        }
      },
      () => {}
    );

    function calcTotals() {
      const pc = (window as any).__publicCount || 0;
      const perC = (window as any).__personalCount || 0;
      const pcComp = (window as any).__publicCompleted || 0;
      const perComp = (window as any).__personalCompleted || 0;
      setTotalReported(pc + perC);
      setCompleted(pcComp + perComp);
    }

    return () => {
      unsubPublic();
      unsubPersonal();
      unsubUsers();
    };
  }, [fbUser]);

  const resolvedPct = useMemo(() => {
    if (totalReported === 0) return 0;
    return Math.round((completed / totalReported) * 100);
  }, [totalReported, completed]);

  // GPS auto-capture
  const captureGps = () => {
    setGpsStatus("loading");
    if (!navigator.geolocation) {
      setGpsStatus("error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsStatus("done");
      },
      () => setGpsStatus("error"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    // auto try on mount for public section
    captureGps();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      if (authMode === "register") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        // save role to users collection with uid as doc id for easy lookup
        await setDoc(doc(db, "users", cred.user.uid), {
          email,
          role,
          createdAt: serverTimestamp(),
        });
        setUserRole(role);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        // role will be resolved via users snapshot
      }
    } catch (err: any) {
      setAuthError(err.message?.replace("Firebase:", "").trim() || "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const checkPersonalSchemes = () => {
    if (personalText.trim().length  {});
    }
  };

  const checkPublicSchemes = () => {
    if (publicText.trim().length  {
    if (!fbUser || publicText.trim().length ((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(publicPhotoFile);
        });
      }
      await addDoc(collection(db, "publicIssues"), {
        text: publicText,
        status: "open",
        createdAt: serverTimestamp(),
        createdBy: fbUser.uid,
        gps: gps || null,
        photoProvided: !!publicPhotoFile,
        photoName: publicPhotoFile?.name || null,
        photoDataUrl,
      });
      // also show schemes for this text
      checkPublicSchemes();
      setPublicText("");
      setPublicPhotoFile(null);
      setPublicPhotoPreview(null);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingPublic(false);
    }
  };

  const handlePublicPhoto = (f: File | null) => {
    setPublicPhotoFile(f);
    if (f) {
      const url = URL.createObjectURL(f);
      setPublicPhotoPreview(url);
    } else {
      setPublicPhotoPreview(null);
    }
  };

  const handleEvidenceChange = (ticketId, f: File | null) => {
    setEvidenceFiles((prev) => ({ ...prev, [ticketId]: f }));
    if (f) {
      const url = URL.createObjectURL(f);
      setEvidencePreviews((prev) => ({ ...prev, [ticketId]: url }));
    } else {
      setEvidencePreviews((prev) => ({ ...prev, [ticketId]: null }));
    }
  };

  const claimTicket = async (id) => {
    if (!fbUser) return;
    await updateDoc(doc(db, "publicIssues", id), {
      status: "claimed",
      claimedBy: fbUser.uid,
    });
  };

  const solveTicket = async (id) => {
    const file = evidenceFiles[id];
    if (!file) return;
    const dataUrl = await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.readAsDataURL(file);
    });
    await updateDoc(doc(db, "publicIssues", id), {
      status: "solved",
      evidencePhotoName: file.name,
      evidenceDataUrl: dataUrl,
      solvedAt: serverTimestamp(),
    });
  };

  // UI helpers
  const showQuestionnaire = personalText.length > 10;

  return (
    
      {`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');
        *{font-family: Inter, system-ui, -apple-system, sans-serif}
        .mono{font-family: 'JetBrains Mono', monospace}
      `}

      {/* Header - clean professional */}
      
        
          
            
              CAREPULES
            
            
              Community Problem Solving Platform - By RAISE UP TOGETHER Team
            
          
          
            {fbUser ? (
              <>
                
                  
                    {fbUser.email}
                  
                  
                    {userRole}
                  
                
                 signOut(auth)}
                  className="h-9 px-3.5 rounded-full bg-white text-black text-[13px] font-semibold flex items-center gap-1.5 hover:bg-zinc-200 transition"
                >
                   Logout
                
              
            ) : (
              
            )}
          
        
      

      
        {!fbUser ? (
          // AUTH - professional
          
            
              
                
                  {authMode === "login" ? "Welcome back" : "Create account"}
                
                
                  {authMode === "login"
                    ? "Login to continue to Carepules"
                    : "Register to report and resolve issues"}
                
              

              
                
                  
                    Email
                  
                   setEmail(e.target.value)}
                    placeholder="you@college.edu"
                    className="w-full h-[42px] rounded-xl bg-[#0a0a0b] border border-zinc-800 px-3.5 text-[14px] outline-none focus:border-zinc-600 focus:ring-0 placeholder:text-zinc-600"
                  />
                
                
                  
                    Password
                  
                   setPassword(e.target.value)}
                    placeholder="鈥⑩€⑩€⑩€⑩€⑩€⑩€⑩€�"
                    className="w-full h-[42px] rounded-xl bg-[#0a0a0b] border border-zinc-800 px-3.5 text-[14px] outline-none focus:border-zinc-600 placeholder:text-zinc-600"
                  />
                

                {authMode === "register" && (
                  
                    
                      Select Role
                    
                    
                      
                         setRole("user")}
                          className="accent-black"
                        />
                        Normal User
                      
                      
                         setRole("volunteer")}
                          className="accent-black"
                        />
                        Volunteer
                      
                    
                  
                )}

                {authError && (
                  
                    
                    {authError}
                  
                )}

                
                  {authLoading && }
                  {authMode === "login" ? "Login" : "Create Account"}
                
              

              
                {authMode === "login" ? (
                  
                    Don't have account?{" "}
                     setAuthMode("register")}
                      className="text-white font-medium underline underline-offset-4 hover:text-zinc-200"
                    >
                      Register
                    
                  
                ) : (
                  
                    Already have account?{" "}
                     setAuthMode("login")}
                      className="text-white font-medium underline underline-offset-4 hover:text-zinc-200"
                    >
                      Login
                    
                  
                )}
              

              {/* bottom area clean - no demo banners */}
            
          
        ) : (
          <>
            {/* Stats - real counters */}
            
              
                
                  Total Reported
                  
                
                {totalReported}
                public + private issues
              
              
                
                  Completed
                  
                
                {completed}
                status = solved
              
              
                
                  Active Volunteers
                  
                
                {activeVolunteers}
                role = volunteer
              
              
                
                  Resolved %
                  
                
                {resolvedPct}%
                completed / total * 100
              
            

            
              {/* Personal PRIVATE */}
              
                
                  
                    
                      
                    
                    
                      Personal Problem [PRIVATE]
                      Your identity is hidden - Only eligibility check
                    
                  
                  Anonymous
                

                
                  
                     setPersonalText(e.target.value)}
                      placeholder='Example: I didn&apos;t have permanent job and I have 10 lakh loan I can&apos;t close loan'
                      className="w-full min-h-[118px] rounded-xl bg-[#0a0a0b] border border-zinc-800 p-3.5 text-[13.5px] leading-6 outline-none focus:border-zinc-700 placeholder:text-zinc-600 resize-none"
                    />
                    
                      {personalText.length} chars
                      Separate state - no auto-copy
                    
                  

                  {showQuestionnaire && (
                    
                      
                        Monthly Income?
                         setIncome(e.target.value)}
                          className="w-full h-10 rounded-xl bg-[#0a0a0b] border border-zinc-800 px-3 text-[13px] outline-none focus:border-zinc-700"
                        >
                          Select
                          &lt;10000
                          10000-25000
                          25000">&gt;25000
                        
                      
                      
                        Category?
                         setCategory(e.target.value)}
                          className="w-full h-10 rounded-xl bg-[#0a0a0b] border border-zinc-800 px-3 text-[13px] outline-none focus:border-zinc-700"
                        >
                          Select
                          BPL
                          APL
                          SC/ST
                        
                      
                    
                  )}

                  
                    Check Eligible Schemes
                  

                  {/* Schemes result */}
                  {personalSchemes && personalSchemes.length > 0 && (
                    
                      
                        Matched Schemes ({personalSchemes.length}) - for: "{personalText.slice(0, 40)}..."
                      
                      {personalSchemes.map((s) => (
                        
                          
                            
                              {s.name}
                              {s.desc}
                              
                                Eligibility: {s.eligibility}
                              
                            
                            
                              Apply Now 
                            
                          
                        
                      ))}
                    
                  )}

                  {personalNoMatch && (
                    
                      No specific scheme detected
                      
                        Please contact local panchayat office. General helpline: 1800-180-1551. Try keywords like loan, job, education, health, housing, farmer.
                      
                    
                  )}
                
              

              {/* Public PUBLIC */}
              
                
                  
                    
                      
                    
                    
                      Public Issue [PUBLIC]
                      Visible to community and volunteers
                    
                  
                  
                    
                    {gpsStatus === "loading" ? "Locating..." : gpsStatus === "done" ? `${gps?.lat.toFixed(4)}, ${gps?.lng.toFixed(4)}` : "Capture GPS"}
                  
                

                
                  
                     setPublicText(e.target.value)}
                      placeholder="Example: Road damaged near market, drainage blocked..."
                      className="w-full min-h-[118px] rounded-xl bg-[#0a0a0b] border border-zinc-800 p-3.5 text-[13.5px] leading-6 outline-none focus:border-zinc-700 placeholder:text-zinc-600 resize-none"
                    />
                    
                      {publicText.length} chars
                      {gps && (
                        
        
