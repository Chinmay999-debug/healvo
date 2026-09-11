import { useNavigate } from "react-router-dom";
import { ArrowRight, UserRoundPlus, UsersRound } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Badge, type BadgeTone } from "../ui/Badge";
import { Button } from "../ui/Button";
import { LoadingState } from "../ui/LoadingState";
import { formatPhoneDisplay } from "../../lib/phone";
import type { StaffMember, StaffRole, StaffStatus } from "../../data/mockData";

const ROLE_TONE: Record<StaffRole, BadgeTone> = {
  Doctor: "blue",
  Reception: "mint",
};

const STATUS_TONE: Record<StaffStatus, BadgeTone> = {
  Active: "mint",
  Inactive: "slate",
};

export function StaffTable({
  members,
  hasAnyStaff,
  loading,
  onAddStaff,
}: {
  members: StaffMember[];
  hasAnyStaff: boolean;
  loading?: boolean;
  onAddStaff: () => void;
}) {
  const navigate = useNavigate();

  function openStaff(member: StaffMember) {
    navigate(`/staff/${member.id}`);
  }

  if (members.length === 0 && loading) {
    return <LoadingState />;
  }

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-mint-bg)] text-[var(--color-teal)]">
          <UsersRound size={22} strokeWidth={2} />
        </div>
        {hasAnyStaff ? (
          <>
            <h2 className="text-[15px] font-bold text-[var(--color-ink)]">
              No staff found
            </h2>
            <p className="max-w-xs text-[13.5px] text-[var(--color-muted)]">
              Try a different name or phone number.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-[15px] font-bold text-[var(--color-ink)]">
              No staff yet
            </h2>
            <p className="max-w-xs text-[13.5px] text-[var(--color-muted)]">
              Add your first team member to get started.
            </p>
            <Button variant="primary" className="mt-1" onClick={onAddStaff}>
              <UserRoundPlus size={15} strokeWidth={2.25} />
              Add staff
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] table-fixed border-collapse text-left">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            <th className="w-[34%] pt-3 pb-3 pl-1 text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
              Staff
            </th>
            <th className="w-[16%] pt-3 pb-3 text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
              Role
            </th>
            <th className="w-[26%] pt-3 pb-3 text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
              Phone
            </th>
            <th className="w-[13%] pt-3 pb-3 text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
              Status
            </th>
            <th className="w-[11%] pt-3 pb-3 text-right text-[11px] font-bold tracking-[0.06em] text-[var(--color-muted)] uppercase">
              View
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr
              key={member.id}
              className="border-b border-[var(--color-border)] last:border-b-0"
            >
              <td className="py-4 pl-1 align-top">
                <button
                  type="button"
                  onClick={() => openStaff(member)}
                  className="flex items-center gap-3 text-left"
                >
                  <Avatar initials={member.initials} size={34} />
                  <span className="truncate text-[13.5px] font-bold text-[var(--color-ink)] hover:text-[var(--color-teal)] hover:underline">
                    {member.name}
                  </span>
                </button>
              </td>
              <td className="py-4 align-top">
                <Badge tone={ROLE_TONE[member.role]}>{member.role}</Badge>
              </td>
              <td className="py-4 align-top">
                <span className="text-[13px] text-[var(--color-ink)]">
                  {formatPhoneDisplay(member.phone)}
                </span>
              </td>
              <td className="py-4 align-top">
                <Badge tone={STATUS_TONE[member.status]}>{member.status}</Badge>
              </td>
              <td className="py-4 align-top text-right">
                <button
                  type="button"
                  onClick={() => openStaff(member)}
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--color-teal)] hover:underline"
                >
                  View
                  <ArrowRight size={13} strokeWidth={2.5} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
