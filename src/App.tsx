import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import MissionControl from "./pages/MissionControl";
import Orchestrator from "./pages/Orchestrator";
import TerminalPage from "./pages/TerminalPage";
import Noc from "./pages/Noc";
import Business from "./pages/Business";
import Vault from "./pages/Vault";
import Revenue from "./pages/Revenue";
import Audit from "./pages/Audit";
import Pipeline from "./pages/Pipeline";
import Fundraise from "./pages/Fundraise";
import Compliance from "./pages/Compliance";

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
        <Route path="/revenue" element={<Revenue />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/fundraise" element={<Fundraise />} />
        <Route path="/compliance" element={<Compliance />} />
      </Route>
    </Routes>
  );
}
