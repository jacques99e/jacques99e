import { redirect } from "next/navigation";
import { getLandingLoginUrl } from "@/lib/public-urls";

export default function LoginPage() {
  redirect(getLandingLoginUrl());
}
