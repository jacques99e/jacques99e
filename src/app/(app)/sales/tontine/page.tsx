"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localStore } from "@/lib/db";
import {
  advanceTontineRound,
  buildTontineGroupReminder,
  createTontine,
  getNextRoundDueDate,
  readTontines,
  recordTontinePayment,
  tontinePotTotal,
  type TontineMember,
} from "@/lib/tontine";
import { buildWhatsAppShareUrl } from "@/lib/module-local-tools";
import { formatCurrency } from "@/lib/utils";

export default function TontinePage() {
  const storeId = localStore.get()?.id;
  const [groups, setGroups] = useState(() => readTontines(storeId));
  const [name, setName] = useState("");
  const [contribution, setContribution] = useState("5000");
  const [memberName, setMemberName] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [draftMembers, setDraftMembers] = useState<TontineMember[]>([]);

  const addMember = () => {
    if (!memberName.trim()) return;
    setDraftMembers([
      ...draftMembers,
      {
        id: `m-${Date.now()}`,
        name: memberName.trim(),
        phone: memberPhone.trim(),
        paidRounds: 0,
      },
    ]);
    setMemberName("");
    setMemberPhone("");
  };

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || draftMembers.length < 2) return;
    setGroups(
      createTontine(
        {
          name: name.trim(),
          contributionFcfa: Number(contribution) || 5000,
          cycleWeeks: 1,
          members: draftMembers,
        },
        storeId
      )
    );
    setName("");
    setDraftMembers([]);
  };

  const remind = (groupName: string, phone: string, amount: number) => {
    const msg = `Rappel tontine "${groupName}" : cotisation de ${formatCurrency(amount)} cette semaine. Merci !`;
    if (phone) window.open(buildWhatsAppShareUrl(msg, phone), "_blank");
    else void navigator.clipboard.writeText(msg);
  };

  const remindGroup = (group: ReturnType<typeof readTontines>[number]) => {
    const msg = buildTontineGroupReminder(group);
    window.open(buildWhatsAppShareUrl(msg), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-24">
      <header className="bg-[#075E54] px-4 py-4 text-white">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="text-lg font-semibold">Tontine Digitale</h1>
          <Link href="/sales"><ArrowLeft className="h-4 w-4" /></Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        <p className="rounded-2xl bg-amber-50 p-4 text-xs text-amber-900">
          L&apos;épargne rotative des commerçants africains — digitalisée avec rappels WhatsApp et suivi des tours.
        </p>

        <form onSubmit={create} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Nouvelle tontine</h2>
          <div>
            <Label>Nom du groupe</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tontine marché central" />
          </div>
          <div>
            <Label>Cotisation hebdo (FCFA)</Label>
            <Input type="number" value={contribution} onChange={(e) => setContribution(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Input value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="Membre" />
            <Input value={memberPhone} onChange={(e) => setMemberPhone(e.target.value)} placeholder="+228..." />
            <Button type="button" variant="outline" onClick={addMember}><Plus className="h-4 w-4" /></Button>
          </div>
          {draftMembers.length > 0 ? (
            <p className="text-xs text-gray-500">{draftMembers.length} membre(s) ajouté(s)</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={draftMembers.length < 2}>
            <Users className="mr-1 h-4 w-4" /> Créer la tontine
          </Button>
        </form>

        {groups.map((g) => {
          const beneficiary = g.members.find((m) => m.id === g.nextBeneficiaryId);
          const pot = tontinePotTotal(g);
          return (
            <section key={g.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex justify-between">
                <h3 className="font-semibold">{g.name}</h3>
                <span className="text-xs text-gray-500">Tour {g.currentRound}</span>
              </div>
              <p className="mt-1 text-sm text-[#075E54]">Cagnotte : {formatCurrency(pot)}</p>
              <p className="text-xs text-gray-600">
                Bénéficiaire ce tour : <strong>{beneficiary?.name ?? "—"}</strong>
              </p>
              <p className="text-[10px] text-gray-500">
                Échéance tour : {getNextRoundDueDate(g)}
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {g.members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between rounded bg-gray-50 p-2">
                    <span>{m.name} ({m.paidRounds} cotisations)</span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setGroups(recordTontinePayment(g.id, m.id, storeId))}
                      >
                        Payé
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => remind(g.name, m.phone, g.contributionFcfa)}
                      >
                        <MessageCircle className="h-3 w-3" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  className="flex-1"
                  variant="outline"
                  onClick={() => remindGroup(g)}
                >
                  <MessageCircle className="mr-1 h-3 w-3" /> Rappel groupe
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  variant="outline"
                  onClick={() => setGroups(advanceTontineRound(g.id, storeId))}
                >
                  Tour suivant
                </Button>
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
