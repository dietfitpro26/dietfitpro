-- =====================================================================
-- DietFitPro — Migration 010 : Correctif RLS-1 (phase-4-stabilisation)
-- Date : 03/09/2026
-- Contexte : Audit RLS cross-patient — Point 1 (PRIORITÉ ABSOLUE)
-- Statut : deja applique et verifie actif dans Supabase (04/09/2026)
-- =====================================================================

-- PROBLÈME CORRIGÉ :
-- La policy "availability_select_all" sur pro_availability utilisait `using (true)`,
-- permettant à TOUS les utilisateurs authentifiés de lister les créneaux de
-- disponibilité de TOUS les pros. Cela exposait des données sensibles (plannings)
-- sans restriction.

-- POURQUOI C'EST SÛR :
-- 1. patient.agenda.tsx ne lit PAS la table pro_availability (créneaux générés en frontend).
-- 2. La nouvelle policy restreint l'accès aux seuls créneaux :
--    - du pro lui-même (pro_id = auth.uid())
--    - du pro auquel le patient est lié (via patients.pro_id + patients.user_id)
--    - de tous les pros si l'utilisateur a le rôle 'pro' (via has_role)
-- 3. La fonction has_role existe (001_initial_schema.sql:402) et 'pro' est bien une valeur
--    valide de l'enum app_role ('pro', 'patient', 'subscriber').

-- =====================================================================

-- Suppression de l'ancienne policy permissive
drop policy if exists "availability_select_all" on public.pro_availability;

-- Nouvelle policy restrictive
create policy "availability_select_linked_pro" on public.pro_availability
  for select to authenticated
  using (
    pro_id = auth.uid()
    OR
    exists (
      select 1 from public.patients p
      where p.pro_id = pro_availability.pro_id
        and p.user_id = auth.uid()
    )
    OR
    public.has_role(auth.uid(), 'pro')
  );