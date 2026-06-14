export type StoreMemberRole = "owner" | "employee" | "manager" | "accountant";

export const ROLE_LABELS: Record<StoreMemberRole, string> = {
  owner: "Propriétaire",
  employee: "Employé",
  manager: "Manager",
  accountant: "Comptable",
};

export interface PermissionRow {
  label: string;
  owner: boolean;
  manager: boolean;
  employee: boolean;
  accountant: boolean;
}

export const TEAM_PERMISSION_MATRIX: PermissionRow[] = [
  {
    label: "Caisse & ventes",
    owner: true,
    manager: true,
    employee: true,
    accountant: false,
  },
  {
    label: "Clients & relances",
    owner: true,
    manager: true,
    employee: true,
    accountant: false,
  },
  {
    label: "Produits & stock",
    owner: true,
    manager: true,
    employee: true,
    accountant: false,
  },
  {
    label: "Analytics & insights",
    owner: true,
    manager: true,
    employee: true,
    accountant: true,
  },
  {
    label: "Paramètres boutique",
    owner: true,
    manager: true,
    employee: false,
    accountant: false,
  },
  {
    label: "Inviter l'équipe",
    owner: true,
    manager: false,
    employee: false,
    accountant: false,
  },
  {
    label: "Notifications & rapports e-mail",
    owner: true,
    manager: true,
    employee: false,
    accountant: false,
  },
];

export const TEAM_TEST_STEPS = [
  "Invitez un collaborateur avec son numéro Wazo (il doit avoir créé un compte avant).",
  "Demandez-lui de se connecter sur wazo-digital.com/login (email ou Google).",
  "Vérifiez qu'il voit la boutique dans le sélecteur en haut de l'écran.",
  "Testez un rôle employé : caisse et clients OK, paramètres et équipe bloqués.",
  "Testez un comptable : analytics uniquement, pas de modification ventes.",
] as const;

export function permissionsForRole(role: StoreMemberRole): string[] {
  const key = role === "owner" ? "owner" : role;
  return TEAM_PERMISSION_MATRIX.filter((row) => row[key as keyof PermissionRow]).map(
    (row) => row.label
  );
}
