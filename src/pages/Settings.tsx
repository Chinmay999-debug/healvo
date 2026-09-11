import { useParams } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { Card } from "../components/ui/Card";
import {
  SettingsNav,
  SETTINGS_SECTION_KEYS,
  type SettingsSectionKey,
} from "../components/settings/SettingsNav";
import { ClinicSettingsPanel } from "../components/settings/ClinicSettingsPanel";
import { AppointmentsSettingsPanel } from "../components/settings/AppointmentsSettingsPanel";
import { BookingSettingsPanel } from "../components/settings/BookingSettingsPanel";
import { AccountSettingsPanel } from "../components/settings/AccountSettingsPanel";
import { SubscriptionSettingsPanel } from "../components/settings/SubscriptionSettingsPanel";
import { useClinicData } from "../state/clinicData";

function isSettingsSection(value: string | undefined): value is SettingsSectionKey {
  return SETTINGS_SECTION_KEYS.includes(value as SettingsSectionKey);
}

export default function Settings() {
  const { section } = useParams<{ section: string }>();
  const active: SettingsSectionKey = isSettingsSection(section) ? section : "clinic";
  const { dataLoading } = useClinicData();

  // The clinic/appointments/booking panels each copy `clinicSettings` into
  // local editable draft state once, at mount — so they must not mount
  // before ClinicDataProvider's real Supabase fetch resolves, or the draft
  // would freeze on the blank placeholder instead of the real row (account
  // settings has no such race — the doctor profile is already resolved
  // before this page can even render, see clinicData.tsx).
  const needsClinicData = active === "clinic" || active === "appointments" || active === "booking";

  return (
    <AppShell crumb="Settings">
      <PageHeader title="Settings" subtitle="Manage your clinic and account settings." />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <Card className="h-fit p-0">
          <SettingsNav />
        </Card>

        <div>
          {needsClinicData && dataLoading ? (
            <Card className="p-5">
              <p className="text-center text-[13.5px] text-[var(--color-muted)]">
                Loading clinic settings…
              </p>
            </Card>
          ) : (
            <>
              {active === "clinic" && <ClinicSettingsPanel />}
              {active === "subscription" && <SubscriptionSettingsPanel />}
              {active === "appointments" && <AppointmentsSettingsPanel />}
              {active === "booking" && <BookingSettingsPanel />}
            </>
          )}
          {active === "account" && <AccountSettingsPanel />}
        </div>
      </div>
    </AppShell>
  );
}
