/**
 * client/src/components/RoleGuard.tsx
 * Route-level access control based on user role.
 *
 * Usage:
 *   <RoleGuard allowedRoles={["admin"]}>
 *     <Academics />
 *   </RoleGuard>
 *
 *   <RoleGuard allowedRoles={["coparent", "admin"]}>
 *     <CoParentPortal />
 *   </RoleGuard>
 */

import { ReactNode } from "react";
import { useAuth, UserRole } from "@/lib/auth";
import { Redirect } from "wouter";

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: ReactNode;
  /** Where to redirect if role check fails. Defaults to "/" */
  redirectTo?: string;
}

export function RoleGuard({ allowedRoles, children, redirectTo = "/" }: RoleGuardProps) {
  const { user } = useAuth();

  // Legacy admin (shared password) is always "admin"
  const role = user?.role || "admin";

  if (!allowedRoles.includes(role)) {
    return <Redirect to={redirectTo} />;
  }

  return <>{children}</>;
}
