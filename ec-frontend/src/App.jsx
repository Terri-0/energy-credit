import { useState, useEffect } from "react";
import client from "./api/client";
import Sidebar from "./components/Sidebar";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import Marketplace from "./pages/Marketplace";
import LogEnergy from "./pages/LogEnergy";
import MyPanels from "./pages/MyPanels";
import BillOffset from "./pages/BillOffset";
import BuyEC from "./pages/BuyEC";

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user")); }
    catch { return null; }
  });
  const [token, setToken]         = useState(() => localStorage.getItem("token"));
  const [page, setPage]           = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [panels, setPanels]       = useState([]);
  const [batches, setBatches]     = useState([]);
  const [listings, setListings]   = useState([]);
  const [reserve, setReserve]     = useState({
    ec_available:    0,
    total_ec_issued: 0,
    total_ec_burned: 0,
    month_ec_issued: 0,
    month_ec_burned: 0,
  });

  const updateUser = (patch) => {
    const updated = { ...user, ...patch };
    setUser(updated);
    localStorage.setItem("user", JSON.stringify(updated));
  };

  // Fetch panels on login and poll every 10s so accumulated Wh updates live.
  useEffect(() => {
    if (!token) return;
    const fetchPanels = () =>
      client.get("/panels").then((res) => setPanels(res.data.panels ?? []));
    fetchPanels();
    const id = setInterval(fetchPanels, 10_000);
    return () => clearInterval(id);
  }, [token]);

  const handleAuth = (tok, u) => {
    localStorage.setItem("token", tok);
    localStorage.setItem("user", JSON.stringify(u));
    setToken(tok);
    setUser(u);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    setPanels([]);
    setBatches([]);
    setListings([]);
  };

  if (!token) return <AuthPage onAuth={handleAuth} />;

  const pageProps = { user, updateUser, panels, setPanels, batches, setBatches, listings, setListings, reserve, setReserve };

  const PageMap = {
    dashboard:   <Dashboard   {...pageProps} />,
    marketplace: <Marketplace {...pageProps} />,
    log:         <LogEnergy   {...pageProps} />,
    panels:      <MyPanels    {...pageProps} />,
    offset:      <BillOffset  {...pageProps} />,
    buy:         <BuyEC       {...pageProps} />,
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f8fafc", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Sidebar
        page={page}
        setPage={setPage}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        user={user}
        onLogout={handleLogout}
      />
      <main className="flex-1 overflow-y-auto">{PageMap[page]}</main>
    </div>
  );
}
