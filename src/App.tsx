import { Navigate, Route, Routes } from "react-router-dom";
import { UserCircle } from "lucide-react";
import Overview from "./pages/Overview";
import Today from "./pages/Today";
import Patients from "./pages/Patients";
import PatientRecord from "./pages/PatientRecord";
import Billing from "./pages/Billing";
import BillDetail from "./pages/BillDetail";
import Reports from "./pages/Reports";
import Staff from "./pages/Staff";
import Settings from "./pages/Settings";
import BookAppointment from "./pages/BookAppointment";
import { Placeholder } from "./pages/Placeholder";
import { PatientOverview } from "./components/patient-record/PatientOverview";
import { ConsultationWorkspace } from "./components/patient-record/ConsultationWorkspace";
import { DentalChart } from "./components/patient-record/DentalChart";
import { PatientHistory } from "./components/patient-record/PatientHistory";
import { PatientDocuments } from "./components/patient-record/PatientDocuments";
import { PatientBilling } from "./components/patient-record/PatientBilling";
import { ClinicDataProvider } from "./state/clinicData";
import { AuthProvider } from "./state/authContext";
import { SubscriptionProvider } from "./state/subscriptionContext";
import { RequireAuthAndClinic } from "./components/auth/RequireAuthAndClinic";

export default function App() {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <Routes>
        {/* Public booking has no account of its own and must work for a
            genuinely anonymous visitor — it lives entirely outside
            RequireAuthAndClinic/ClinicDataProvider and is keyed by the
            clinic's public slug, not the signed-in user's own clinic (see
            services/publicBooking.ts). A signed-in staff member opening
            this same URL gets identical behavior, not a shortcut through
            their own session. */}
        <Route path="/book/:slug" element={<BookAppointment />} />
        <Route
          path="/*"
          element={
            <RequireAuthAndClinic>
              <ClinicDataProvider>
                <Routes>
                  <Route path="/" element={<Navigate to="/overview" replace />} />
                  <Route path="/overview" element={<Overview />} />
                  <Route path="/today" element={<Today />} />
                  <Route path="/patients" element={<Patients />} />
                  <Route path="/patients/:patientId" element={<PatientRecord />}>
                    <Route index element={<PatientOverview />} />
                    <Route path="consultation" element={<ConsultationWorkspace />} />
                    <Route path="dental-chart" element={<DentalChart />} />
                    <Route path="history" element={<PatientHistory />} />
                    <Route path="documents" element={<PatientDocuments />} />
                    <Route path="billing" element={<PatientBilling />} />
                  </Route>
                  <Route path="/billing" element={<Billing />} />
                  <Route path="/billing/:billId" element={<BillDetail />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/staff" element={<Staff />} />
                  <Route
                    path="/staff/:staffId"
                    element={
                      <Placeholder
                        crumb="Staff profile"
                        title="Staff profile"
                        description="Detailed role permissions and access management will live here."
                        icon={UserCircle}
                      />
                    }
                  />
                  <Route path="/settings" element={<Navigate to="/settings/clinic" replace />} />
                  <Route path="/settings/:section" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/overview" replace />} />
                </Routes>
              </ClinicDataProvider>
            </RequireAuthAndClinic>
          }
        />
      </Routes>
      </SubscriptionProvider>
    </AuthProvider>
  );
}
