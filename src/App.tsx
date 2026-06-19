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
import ShieldPage from "./pages/Shield";
import DevicesPage from "./pages/Devices";
import TenantsPage from "./pages/Tenants";
import DeviceDetailPage from "./pages/DeviceDetail";
import AgentsPage from "./pages/Agents";
import CommsPage from "./pages/Comms";
import ApprovalsPage from "./pages/Approvals";
import AiStudioPage from "./pages/AiStudio";
import AdminPage from "./pages/Admin";
import LeadsPage from "./pages/Leads";
import ReportsPage from "./pages/Reports";
import BrainPage from "./pages/Brain";
import PoliciesPage from "./pages/Policies";
import AgentStorePage from "./pages/AgentStore";
import DocsPage from "./pages/Docs";
import KnowledgeBasePage from "./pages/KnowledgeBase";

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
        <Route path="/shield" element={<ShieldPage />} />
        <Route path="/devices" element={<DevicesPage />} />
        <Route path="/devices/:deviceId" element={<DeviceDetailPage />} />
        <Route path="/tenants" element={<TenantsPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/comms" element={<CommsPage />} />
        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route path="/ai-studio" element={<AiStudioPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/brain" element={<BrainPage />} />
        <Route path="/policies" element={<PoliciesPage />} />
        <Route path="/agent-store" element={<AgentStorePage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/kb" element={<KnowledgeBasePage />} />
      </Route>
    </Routes>
  );
}
