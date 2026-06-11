export interface FleetDriver {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  fuelPricePerKm: number;
  active: boolean;
}

export interface DriverAssignment {
  deliveryId: string;
  driverId: string;
  estimatedKm: number;
}

const KEY_DRIVERS = "wazo_fleet_drivers";
const KEY_ASSIGN = "wazo_fleet_assign";

function driversKey(storeId?: string) {
  return storeId ? `${KEY_DRIVERS}_${storeId}` : KEY_DRIVERS;
}

function assignKey(storeId?: string) {
  return storeId ? `${KEY_ASSIGN}_${storeId}` : KEY_ASSIGN;
}

export function readDrivers(storeId?: string): FleetDriver[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(driversKey(storeId));
    if (!raw) return [];
    return JSON.parse(raw) as FleetDriver[];
  } catch {
    return [];
  }
}

export function addDriver(
  driver: Omit<FleetDriver, "id">,
  storeId?: string
): FleetDriver[] {
  const rows = readDrivers(storeId);
  const next: FleetDriver = { ...driver, id: `drv-${Date.now()}` };
  const updated = [next, ...rows];
  localStorage.setItem(driversKey(storeId), JSON.stringify(updated));
  return updated;
}

export function readAssignments(storeId?: string): DriverAssignment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(assignKey(storeId));
    if (!raw) return [];
    return JSON.parse(raw) as DriverAssignment[];
  } catch {
    return [];
  }
}

export function assignDelivery(
  deliveryId: string,
  driverId: string,
  estimatedKm: number,
  storeId?: string
): DriverAssignment[] {
  const rows = readAssignments(storeId).filter((a) => a.deliveryId !== deliveryId);
  const updated = [...rows, { deliveryId, driverId, estimatedKm }];
  localStorage.setItem(assignKey(storeId), JSON.stringify(updated));
  return updated;
}

export function estimateFuelCost(km: number, pricePerKm = 85): number {
  return Math.round(km * pricePerKm);
}
