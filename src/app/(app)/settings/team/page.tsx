"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActiveStore } from "@/hooks/useActiveStore";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { apiFetch } from "@/lib/api-client";
import {
  permissionsForRole,
  ROLE_LABELS,
  TEAM_PERMISSION_MATRIX,
  TEAM_TEST_STEPS,
  type StoreMemberRole,
} from "@/lib/team-permissions";

interface MemberRow {
  id: string;
  role: string;
  profiles: { phone: string | null; full_name: string | null } | null;
}

function PermCell({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <Check className="mx-auto h-4 w-4 text-green-600" />
  ) : (
    <X className="mx-auto h-4 w-4 text-gray-300" />
  );
}

export default function TeamSettingsPage() {
  const { user } = useAuth();
  const { activeStore } = useActiveStore();
  const membership = (activeStore?.membership_role || "owner") as StoreMemberRole;
  const { canManageTeam } = useRole(user?.id, activeStore?.membership_role);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("employee");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!activeStore?.id) return;
    const res = await apiFetch(`/api/team/members?store_id=${activeStore.id}`);
    const data = (await res.json()) as { success: boolean; members?: MemberRow[] };
    if (data.success && data.members) setMembers(data.members);
  }, [activeStore?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore?.id) return;
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await apiFetch("/api/team/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_id: activeStore.id, phone, role }),
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !data.success) {
        setError(data.error || "Invitation impossible");
        return;
      }
      setPhone("");
      setSuccess("Membre ajouté. Demandez-lui de se reconnecter pour voir la boutique.");
      await load();
    } finally {
      setLoading(false);
    }
  };

  const remove = async (memberId: string) => {
    if (!activeStore?.id || !confirm("Retirer ce membre ?")) return;
    await apiFetch(
      `/api/team/members?store_id=${activeStore.id}&member_id=${memberId}`,
      { method: "DELETE" }
    );
    await load();
  };

  if (!canManageTeam) {
    const myPerms = permissionsForRole(membership);
    return (
      <>
        <AppHeader title="Équipe" />
        <main className="mx-auto max-w-lg space-y-4 p-4">
          <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
            <p className="text-sm font-medium">Votre rôle sur cette boutique</p>
            <p className="mt-1 text-lg font-bold text-[#075E54]">
              {ROLE_LABELS[membership] || membership}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Vous êtes invité par le propriétaire. Voici ce que vous pouvez faire en production :
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              {myPerms.map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  {p}
                </li>
              ))}
            </ul>
          </section>
          <p className="text-xs text-gray-500">
            Pour changer de boutique, utilisez le sélecteur en haut de l&apos;écran après connexion.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader title="Équipe & rôles" />
      <main className="mx-auto max-w-lg space-y-4 p-4">
        <p className="text-xs text-gray-500">
          Invitez des collaborateurs par numéro de téléphone (compte Wazo requis). Testez les
          droits en prod en vous connectant avec leur compte.
        </p>

        <section className="rounded-xl border border-[#075E54]/15 bg-[#075E54]/5 p-4">
          <h2 className="text-sm font-semibold text-[#075E54]">Tester en production</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-gray-700">
            {TEAM_TEST_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section className="rounded-xl bg-white p-4 shadow-sm overflow-x-auto dark:bg-gray-800">
          <h2 className="mb-3 text-sm font-semibold">Matrice des droits</h2>
          <table className="w-full min-w-[320px] text-xs">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-2">Action</th>
                <th className="pb-2 text-center">Mgr</th>
                <th className="pb-2 text-center">Emp.</th>
                <th className="pb-2 text-center">Cpt.</th>
              </tr>
            </thead>
            <tbody>
              {TEAM_PERMISSION_MATRIX.map((row) => (
                <tr key={row.label} className="border-b border-gray-100">
                  <td className="py-2 pr-2">{row.label}</td>
                  <td className="py-2">
                    <PermCell allowed={row.manager} />
                  </td>
                  <td className="py-2">
                    <PermCell allowed={row.employee} />
                  </td>
                  <td className="py-2">
                    <PermCell allowed={row.accountant} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[10px] text-gray-400">Le propriétaire a tous les droits.</p>
        </section>

        <form onSubmit={invite} className="space-y-2 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
          <h2 className="text-sm font-semibold">Inviter un membre</h2>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Téléphone (+225...)"
            required
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-11 w-full rounded-lg border px-3 text-sm"
          >
            <option value="employee">Employé — caisse, clients, ventes</option>
            <option value="manager">Manager — + paramètres métier</option>
            <option value="accountant">Comptable — analytics en lecture</option>
          </select>
          <Button type="submit" className="w-full bg-[#075E54]" disabled={loading}>
            {loading ? "Invitation..." : "Inviter"}
          </Button>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          {success ? <p className="text-xs text-green-600">{success}</p> : null}
        </form>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Membres ({members.length})</h2>
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm dark:bg-gray-800"
            >
              <div>
                <p className="text-sm font-medium">
                  {m.profiles?.full_name || m.profiles?.phone || "Membre"}
                </p>
                <p className="text-xs text-gray-500">
                  {ROLE_LABELS[m.role as StoreMemberRole] || m.role}
                  {m.profiles?.phone ? ` · ${m.profiles.phone}` : ""}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void remove(m.id)}>
                Retirer
              </Button>
            </div>
          ))}
          {members.length === 0 ? (
            <p className="text-xs text-gray-500">Aucun membre invité pour l&apos;instant.</p>
          ) : null}
        </section>

        <Link href="/settings" className="block text-center text-xs text-gray-500">
          ← Paramètres
        </Link>
      </main>
    </>
  );
}
