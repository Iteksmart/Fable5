import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import MissionControl from "./pages/MissionControl";
import Orchestrator from "./pages/Orchestrator";
import TerminalPage from "./pages/TerminalPage";
import Noc from "./pages/Noc";
import Business from "./pages/Business";
import Vault from "./pages/Vault";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<MissionControl />} />
        <Route path="/orchestrator" element={<Orchestrator />} />
        <Route path="/terminal" element={<TerminalPage />} />
        <Route path="/noc" element={<Noc />} />
        <Route path="/business" element={<Business />} />
        <Route path="/vault" element={<Vault />} />
      </Route>
    </Routes>
  );
}
