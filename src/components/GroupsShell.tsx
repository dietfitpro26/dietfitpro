import type { ReactNode } from "react";
import { ProLayout } from "@/layouts/ProLayout";
import { PatientLayout } from "@/layouts/PatientLayout";
import { SubscriberLayout } from "@/layouts/SubscriberLayout";
import { useAuth } from "@/hooks/useAuth";

export function GroupsShell({ children }: { children: ReactNode }) {
  const { role } = useAuth();

  if (role === "pro") return <ProLayout>{children}</ProLayout>;
  if (role === "patient") return <PatientLayout>{children}</PatientLayout>;

  return <SubscriberLayout>{children}</SubscriberLayout>;
}