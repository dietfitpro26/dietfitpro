-- DietFit Pro community hardening.
-- Prepared locally only. Apply after 013_privileged_roles_and_account_deletion.sql
-- and only after review in the controlled Supabase deployment process.
-- Preserves general-feed visibility, invite flows and existing member limits.

BEGIN;

-- Beta moderation has two levels only: the group owner and super admins.
-- Professionals joining through a valid code receive no management role.
ALTER TABLE public.feed_group_members DROP CONSTRAINT IF EXISTS feed_group_members_role_check;
ALTER TABLE public.feed_group_members ADD CONSTRAINT feed_group_members_role_check
  CHECK (role = ANY (ARRAY['owner'::text, 'member'::text, 'participant'::text]));

-- Private helpers prevent direct calls from revealing another user's group
-- membership. The exposed wrappers only answer for the caller (or super admin).
CREATE OR REPLACE FUNCTION private.community_member_access(p_user uuid, p_group uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.feed_group_members AS m
      LEFT JOIN public.profiles AS p ON p.id = m.user_id
     WHERE m.group_id = p_group
       AND m.user_id = p_user
       AND m.status = 'active'
       AND (
         p.role IS DISTINCT FROM 'pro'::public.app_role
         OR m.role IN ('owner', 'participant')
       )
  ) OR EXISTS (
    SELECT 1 FROM public.feed_groups AS g
     WHERE g.id = p_group AND g.owner_id = p_user
  );
$$;
REVOKE ALL ON FUNCTION private.community_member_access(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.community_user_banned_from_groups(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.community_bans AS b WHERE b.user_id = p_user);
$$;
CREATE OR REPLACE FUNCTION private.community_user_banned_from_group(p_user uuid, p_group uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.feed_group_bans AS b
    WHERE b.user_id = p_user AND b.group_id = p_group);
$$;
CREATE OR REPLACE FUNCTION private.community_user_accepted_charter(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.has_role(p_user, 'pro'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.community_charter_acceptances AS a
      WHERE a.user_id = p_user AND a.version >= 1);
$$;
CREATE OR REPLACE FUNCTION private.community_user_can_participate(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.is_adult(p_user)
    AND EXISTS (SELECT 1 FROM public.profiles AS p WHERE p.id = p_user AND (
      p.role IN ('pro'::public.app_role, 'patient'::public.app_role)
      OR (p.role = 'subscriber'::public.app_role AND p.plan IN ('basic', 'premium'))))
    AND coalesce(public.subscriber_access_state(p_user), 'unrestricted') <> 'suspended'
    AND NOT EXISTS (SELECT 1 FROM public.community_bans AS b
      WHERE b.user_id = p_user AND b.scope = 'all');
$$;
REVOKE ALL ON FUNCTION private.community_user_banned_from_groups(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.community_user_banned_from_group(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.community_user_accepted_charter(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.community_user_can_participate(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Existing public helpers remain callable for the caller's own state, but no
-- longer expose another user's bans, eligibility, or charter acceptance.
CREATE OR REPLACE FUNCTION public.is_banned_from_groups(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND (p_user = auth.uid() OR public.is_current_super_admin())
    AND private.community_user_banned_from_groups(p_user);
$$;
REVOKE ALL ON FUNCTION public.is_banned_from_groups(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_banned_from_groups(uuid) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.is_banned_from_group(p_user uuid, p_group uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND (p_user = auth.uid() OR public.is_current_super_admin())
    AND private.community_user_banned_from_group(p_user, p_group);
$$;
REVOKE ALL ON FUNCTION public.is_banned_from_group(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_banned_from_group(uuid, uuid) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.has_accepted_charter(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND (p_user = auth.uid() OR public.is_current_super_admin())
    AND private.community_user_accepted_charter(p_user);
$$;
REVOKE ALL ON FUNCTION public.has_accepted_charter(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_accepted_charter(uuid) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.can_participate_in_community(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND (p_user = auth.uid() OR public.is_current_super_admin())
    AND private.community_user_can_participate(p_user);
$$;
REVOKE ALL ON FUNCTION public.can_participate_in_community(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_participate_in_community(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_group_member(p_user uuid, p_group uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL
     AND (p_user = auth.uid() OR public.is_current_super_admin())
     AND private.community_member_access(p_user, p_group);
$$;
REVOKE ALL ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_group_owner(p_user uuid, p_group uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL
     AND (p_user = auth.uid() OR public.is_current_super_admin())
     AND EXISTS (SELECT 1 FROM public.feed_groups AS g
                  WHERE g.id = p_group AND g.owner_id = p_user);
$$;
REVOKE ALL ON FUNCTION public.is_group_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_group_owner(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_moderate_community_group(p_group uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_current_super_admin()
    OR (
      private.community_user_can_participate(auth.uid())
      AND private.community_user_accepted_charter(auth.uid())
      AND NOT private.community_user_banned_from_groups(auth.uid())
      AND NOT private.community_user_banned_from_group(auth.uid(), p_group)
      AND EXISTS (SELECT 1 FROM public.feed_groups AS g
                   WHERE g.id = p_group AND g.owner_id = auth.uid())
    )
  );
$$;
REVOKE ALL ON FUNCTION public.can_moderate_community_group(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_moderate_community_group(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_create_community_group(p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND auth.uid() = p_user
    AND public.can_participate_in_community(auth.uid())
    AND public.has_accepted_charter(auth.uid())
    AND NOT public.is_banned_from_groups(auth.uid())
    AND EXISTS (SELECT 1 FROM public.community_profiles AS cp
                 WHERE cp.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles AS p
                 WHERE p.id = auth.uid()
                   AND (p.role = 'pro'::public.app_role
                     OR (p.role = 'subscriber'::public.app_role AND p.plan::text = 'premium')));
$$;
REVOKE ALL ON FUNCTION public.can_create_community_group(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_create_community_group(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_read_feed_group(p_group uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_current_super_admin()
    OR (
      private.community_member_access(auth.uid(), p_group)
      AND private.community_user_can_participate(auth.uid())
      AND private.community_user_accepted_charter(auth.uid())
      AND NOT private.community_user_banned_from_groups(auth.uid())
      AND NOT private.community_user_banned_from_group(auth.uid(), p_group)
    )
  );
$$;
REVOKE ALL ON FUNCTION public.can_read_feed_group(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_feed_group(uuid) TO authenticated, service_role;

-- Professionals can still join a group when they possess a valid invite code;
-- unlike the former auto-enrolment, that explicit membership is marked with a
-- non-moderator role and conveys no management permissions.
CREATE OR REPLACE FUNCTION public.join_group_by_code(p_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_group_id uuid; active_count integer; is_pro boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF private.community_user_banned_from_groups(auth.uid()) THEN RAISE EXCEPTION 'banned_from_group'; END IF;
  IF NOT private.community_user_can_participate(auth.uid()) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.community_profiles AS cp WHERE cp.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'pseudo_required';
  END IF;
  IF NOT private.community_user_accepted_charter(auth.uid()) THEN RAISE EXCEPTION 'charter_required'; END IF;
  SELECT g.id INTO v_group_id FROM public.feed_groups AS g
    WHERE g.invite_code = p_code AND g.invite_enabled = true;
  IF v_group_id IS NULL THEN RAISE EXCEPTION 'invalid_code'; END IF;
  IF private.community_user_banned_from_group(auth.uid(), v_group_id) THEN RAISE EXCEPTION 'banned_from_group'; END IF;
  IF private.community_member_access(auth.uid(), v_group_id) THEN RETURN v_group_id; END IF;
  SELECT p.role = 'pro'::public.app_role INTO is_pro FROM public.profiles AS p WHERE p.id = auth.uid();
  SELECT count(*) INTO active_count FROM public.feed_group_members AS m
    LEFT JOIN public.profiles AS p ON p.id = m.user_id
   WHERE m.group_id = v_group_id AND m.status = 'active' AND m.user_id <> auth.uid()
     AND (p.role IS DISTINCT FROM 'pro'::public.app_role OR m.role IN ('owner', 'participant'));
  IF active_count >= 200 THEN RAISE EXCEPTION 'group_full'; END IF;
  INSERT INTO public.feed_group_members (group_id, user_id, role, status)
    VALUES (v_group_id, auth.uid(), CASE WHEN coalesce(is_pro, false) THEN 'participant' ELSE 'member' END, 'active')
    ON CONFLICT (group_id, user_id) DO UPDATE
      SET role = CASE WHEN coalesce(is_pro, false) THEN 'participant' ELSE 'member' END,
          status = 'active';
  RETURN v_group_id;
END;
$$;
REVOKE ALL ON FUNCTION public.join_group_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_group_by_code(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_read_feed_content(p_content uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.feed_content AS c
     WHERE c.id = p_content
       AND (
         public.is_current_super_admin()
         OR (c.group_id IS NOT NULL AND c.is_published
              AND public.can_read_feed_group(c.group_id))
         OR (c.group_id IS NOT NULL AND NOT c.is_published
              AND public.can_moderate_community_group(c.group_id))
         OR (c.group_id IS NULL AND c.is_published
              AND (c.source = 'coach'::text OR public.is_adult(auth.uid())))
       )
  );
$$;
REVOKE ALL ON FUNCTION public.can_read_feed_content(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_feed_content(uuid) TO authenticated, service_role;

-- Enforce the existing five-owned-groups limit on the database write path and
-- serialize count checks so simultaneous requests cannot exceed the limit.
CREATE OR REPLACE FUNCTION private.enforce_group_creation_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE is_unlimited boolean;
BEGIN
  SELECT p.role = 'pro'::public.app_role INTO is_unlimited
    FROM public.profiles AS p WHERE p.id = NEW.owner_id;
  IF NOT coalesce(is_unlimited, false) THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.owner_id::text, 0));
    IF (SELECT count(*) FROM public.feed_groups AS g WHERE g.owner_id = NEW.owner_id) >= 5 THEN
      RAISE EXCEPTION 'group_limit_reached';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.enforce_group_creation_limit() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS enforce_community_group_creation_limit ON public.feed_groups;
CREATE TRIGGER enforce_community_group_creation_limit
  BEFORE INSERT ON public.feed_groups
  FOR EACH ROW EXECUTE FUNCTION private.enforce_group_creation_limit();

-- Enforce the existing 200 active-member limit for code joins, direct-invite
-- acceptances and any other database write path, including concurrent joins.
CREATE OR REPLACE FUNCTION private.enforce_group_member_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE active_count integer;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' AND OLD.group_id = NEW.group_id
     AND OLD.user_id = NEW.user_id THEN RETURN NEW; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.group_id::text, 0));
  IF TG_OP = 'UPDATE' AND OLD.group_id = NEW.group_id THEN
    SELECT count(*) INTO active_count FROM public.feed_group_members AS m
      LEFT JOIN public.profiles AS p ON p.id = m.user_id
     WHERE m.group_id = NEW.group_id AND m.status = 'active' AND m.user_id <> OLD.user_id
       AND (p.role IS DISTINCT FROM 'pro'::public.app_role OR m.role IN ('owner', 'participant'));
  ELSE
    SELECT count(*) INTO active_count FROM public.feed_group_members AS m
      LEFT JOIN public.profiles AS p ON p.id = m.user_id
     WHERE m.group_id = NEW.group_id AND m.status = 'active'
       AND (p.role IS DISTINCT FROM 'pro'::public.app_role OR m.role IN ('owner', 'participant'));
  END IF;
  IF active_count >= 200 THEN RAISE EXCEPTION 'group_full'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.enforce_group_member_limit() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS enforce_community_group_member_limit ON public.feed_group_members;
CREATE TRIGGER enforce_community_group_member_limit
  BEFORE INSERT OR UPDATE OF group_id, user_id, status ON public.feed_group_members
  FOR EACH ROW EXECUTE FUNCTION private.enforce_group_member_limit();

-- Stop the existing group-created trigger from enrolling every professional
-- into every private group. Existing professional rows are not deleted; access
-- checks above ignore their legacy 'member' role unless they own the group.
CREATE OR REPLACE FUNCTION public.handle_new_feed_group()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.feed_group_members (group_id, user_id, role, status)
  VALUES (NEW.id, NEW.owner_id, 'owner', 'active')
  ON CONFLICT (group_id, user_id) DO UPDATE SET role = 'owner', status = 'active';
  INSERT INTO public.scheduled_notifications
    (user_id, channel, type, title, body, link, payload, scheduled_for, sent_at)
  SELECT ur.user_id, 'in_app', 'feed_group', 'Nouveau groupe créé',
    'Un nouveau groupe privé a été créé dans la communauté.', '/groups/' || NEW.id::text,
    jsonb_build_object('group_id', NEW.id), pg_catalog.now(), pg_catalog.now()
    FROM private.user_roles AS ur WHERE ur.role = 'super_admin' AND ur.user_id <> NEW.owner_id;
  RETURN NEW;
END;
$$;

-- Group metadata is private. Invite previews remain available only through the
-- invitation RPC, which returns the minimum preview fields for a valid code.
DROP POLICY IF EXISTS feed_groups_select ON public.feed_groups;
CREATE POLICY feed_groups_select ON public.feed_groups FOR SELECT TO authenticated
  USING (public.can_read_feed_group(id));
DROP POLICY IF EXISTS feed_groups_insert ON public.feed_groups;
CREATE POLICY feed_groups_insert ON public.feed_groups FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND public.can_create_community_group(auth.uid())
    AND (public.has_role(auth.uid(), 'pro'::public.app_role)
      OR (SELECT count(*) FROM public.feed_groups AS g WHERE g.owner_id = auth.uid()) < 5));
DROP POLICY IF EXISTS feed_groups_update ON public.feed_groups;
CREATE POLICY feed_groups_update ON public.feed_groups FOR UPDATE TO authenticated
  USING (public.can_moderate_community_group(id))
  WITH CHECK (public.can_moderate_community_group(id));
DROP POLICY IF EXISTS feed_groups_delete ON public.feed_groups;
CREATE POLICY feed_groups_delete ON public.feed_groups FOR DELETE TO authenticated
  USING (public.is_current_super_admin() OR (owner_id = auth.uid() AND public.can_moderate_community_group(id)));
REVOKE INSERT, UPDATE ON public.feed_groups FROM authenticated;
GRANT INSERT (name, description, owner_id) ON public.feed_groups TO authenticated;
GRANT UPDATE (name, description, invite_enabled) ON public.feed_groups TO authenticated;

-- Feed rows without group_id retain their existing general-feed visibility.
-- Group-linked rows require membership, group ownership, or super-admin access.
DROP POLICY IF EXISTS feed_read_boundary ON public.feed_content;
CREATE POLICY feed_read_boundary ON public.feed_content AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.can_read_feed_content(id));
DROP POLICY IF EXISTS feed_select_super_admin ON public.feed_content;
CREATE POLICY feed_select_super_admin ON public.feed_content FOR SELECT TO authenticated
  USING (public.is_current_super_admin());
DROP POLICY IF EXISTS feed_select_group_moderator ON public.feed_content;
DROP POLICY IF EXISTS feed_select_group_owner ON public.feed_content;
CREATE POLICY feed_select_group_owner ON public.feed_content FOR SELECT TO authenticated
  USING (group_id IS NOT NULL AND public.can_moderate_community_group(group_id));
DROP POLICY IF EXISTS feed_manage_super_admin ON public.feed_content;
CREATE POLICY feed_manage_super_admin ON public.feed_content FOR ALL TO authenticated
  USING (public.is_current_super_admin()) WITH CHECK (public.is_current_super_admin());
DROP POLICY IF EXISTS feed_member_insert ON public.feed_content;
CREATE POLICY feed_member_insert ON public.feed_content FOR INSERT TO authenticated
  WITH CHECK (source = 'member' AND author_id = auth.uid() AND is_published = true
    AND video_url IS NULL AND tags IS NULL AND char_length(coalesce(body, '')) <= 1000
    AND (char_length(btrim(coalesce(body, ''))) >= 1 OR image_url IS NOT NULL)
    AND (image_url IS NULL OR position(('/feed/' || auth.uid()::text || '/') IN image_url) > 0)
    AND (group_id IS NULL OR public.can_read_feed_group(group_id))
    AND public.can_participate_in_community(auth.uid())
    AND EXISTS (SELECT 1 FROM public.community_profiles AS cp WHERE cp.user_id = auth.uid()));
DROP POLICY IF EXISTS feed_member_delete_pro ON public.feed_content;
CREATE POLICY feed_member_delete_pro ON public.feed_content FOR DELETE TO authenticated
  USING (source = 'member' AND group_id IS NULL AND public.is_current_super_admin());
DROP POLICY IF EXISTS feed_member_update_pro ON public.feed_content;
CREATE POLICY feed_member_update_pro ON public.feed_content FOR UPDATE TO authenticated
  USING (source = 'member' AND group_id IS NULL AND public.is_current_super_admin())
  WITH CHECK (source = 'member' AND group_id IS NULL AND public.is_current_super_admin());
DROP POLICY IF EXISTS feed_group_content_update ON public.feed_content;
CREATE POLICY feed_group_content_update ON public.feed_content FOR UPDATE TO authenticated
  USING (group_id IS NOT NULL AND public.can_moderate_community_group(group_id))
  WITH CHECK (group_id IS NOT NULL AND public.can_moderate_community_group(group_id));
REVOKE UPDATE ON public.feed_content FROM authenticated;
GRANT UPDATE (title, body, type, tags, image_url, video_url, is_published, published_at)
  ON public.feed_content TO authenticated;
DROP POLICY IF EXISTS feed_write_own_pro ON public.feed_content;
CREATE POLICY feed_write_own_pro ON public.feed_content FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'pro'::public.app_role)
    AND author_id = auth.uid() AND source = 'coach' AND group_id IS NULL
    AND is_published = true)
  WITH CHECK (public.has_role(auth.uid(), 'pro'::public.app_role)
    AND author_id = auth.uid() AND source = 'coach' AND group_id IS NULL
    AND is_published = true
    AND (image_url IS NULL OR position(('/feed/' || auth.uid()::text || '/') IN image_url) > 0)
    AND (video_url IS NULL OR position(('/feed/' || auth.uid()::text || '/') IN video_url) > 0));

CREATE OR REPLACE FUNCTION public.guard_group_feed_content_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.group_id IS NOT NULL AND NOT public.is_current_super_admin()
     AND (NEW.title IS DISTINCT FROM OLD.title
       OR NEW.body IS DISTINCT FROM OLD.body
       OR NEW.type IS DISTINCT FROM OLD.type
       OR NEW.tags IS DISTINCT FROM OLD.tags
       OR NEW.image_url IS DISTINCT FROM OLD.image_url
       OR NEW.video_url IS DISTINCT FROM OLD.video_url
       OR NEW.published_at IS DISTINCT FROM OLD.published_at) THEN
    RAISE EXCEPTION 'GROUP_POST_CONTENT_EDIT_REQUIRES_SUPER_ADMIN';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_group_feed_content_update() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_group_feed_content_update_trg ON public.feed_content;
CREATE TRIGGER guard_group_feed_content_update_trg
  BEFORE UPDATE ON public.feed_content
  FOR EACH ROW EXECUTE FUNCTION public.guard_group_feed_content_update();

DROP POLICY IF EXISTS feed_group_owner_delete ON public.feed_content;
CREATE POLICY feed_group_owner_delete ON public.feed_content FOR DELETE TO authenticated
  USING (group_id IS NOT NULL AND public.can_moderate_community_group(group_id));

-- Comments and reactions inherit the visibility of their parent post. This
-- keeps social interactions on accessible general posts while closing IDORs
-- against posts in private groups.
DROP POLICY IF EXISTS feed_comments_read_boundary ON public.feed_comments;
CREATE POLICY feed_comments_read_boundary ON public.feed_comments AS RESTRICTIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.feed_content AS c
    WHERE c.id = content_id AND public.can_read_feed_content(c.id)
      AND (NOT is_hidden OR user_id = auth.uid() OR public.is_current_super_admin()
        OR (c.group_id IS NULL AND public.is_current_super_admin())
        OR (c.group_id IS NOT NULL AND public.can_moderate_community_group(c.group_id)))));
DROP POLICY IF EXISTS feed_comments_select ON public.feed_comments;
CREATE POLICY feed_comments_select ON public.feed_comments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_current_super_admin()
    OR EXISTS (SELECT 1 FROM public.feed_content AS c WHERE c.id = content_id
      AND public.can_read_feed_content(c.id)
      AND (NOT is_hidden OR (c.group_id IS NOT NULL AND public.can_moderate_community_group(c.group_id)))));
DROP POLICY IF EXISTS feed_comments_select_super_admin ON public.feed_comments;
CREATE POLICY feed_comments_select_super_admin ON public.feed_comments FOR SELECT TO authenticated
  USING (public.is_current_super_admin());
DROP POLICY IF EXISTS feed_comments_insert ON public.feed_comments;
CREATE POLICY feed_comments_insert ON public.feed_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_hidden = false
    AND public.can_participate_in_community(auth.uid())
    AND EXISTS (SELECT 1 FROM public.community_profiles AS cp WHERE cp.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.feed_content AS c WHERE c.id = content_id
      AND c.is_published AND public.can_read_feed_content(c.id)));
DROP POLICY IF EXISTS feed_comments_delete ON public.feed_comments;
CREATE POLICY feed_comments_delete ON public.feed_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.feed_content AS c
    WHERE c.id = content_id AND ((c.group_id IS NULL AND public.is_current_super_admin())
      OR (c.group_id IS NOT NULL AND public.can_moderate_community_group(c.group_id)))));
DROP POLICY IF EXISTS feed_comments_update_pro ON public.feed_comments;
CREATE POLICY feed_comments_update_pro ON public.feed_comments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.feed_content AS c WHERE c.id = content_id
    AND ((c.group_id IS NULL AND public.is_current_super_admin())
      OR (c.group_id IS NOT NULL AND public.can_moderate_community_group(c.group_id)))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.feed_content AS c WHERE c.id = content_id
    AND ((c.group_id IS NULL AND public.is_current_super_admin())
      OR (c.group_id IS NOT NULL AND public.can_moderate_community_group(c.group_id)))));
REVOKE UPDATE ON public.feed_comments FROM authenticated;
GRANT UPDATE (is_hidden) ON public.feed_comments TO authenticated;

DROP POLICY IF EXISTS feed_interactions_self ON public.feed_interactions;
CREATE POLICY feed_interactions_self ON public.feed_interactions FOR ALL TO authenticated
  USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.feed_content AS c
    WHERE c.id = content_id AND public.can_read_feed_content(c.id)))
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.feed_content AS c
    WHERE c.id = content_id AND public.can_read_feed_content(c.id)));

-- Member lists, bans, appeals and reports are private group metadata as well.
DROP POLICY IF EXISTS feed_group_members_select ON public.feed_group_members;
CREATE POLICY feed_group_members_select ON public.feed_group_members FOR SELECT TO authenticated
  USING ((user_id = auth.uid() AND status = 'invited')
    OR (status = 'invited' AND public.can_moderate_community_group(group_id))
    OR (public.can_read_feed_group(group_id) AND private.community_member_access(user_id, group_id)));
DROP POLICY IF EXISTS feed_group_members_delete ON public.feed_group_members;
CREATE POLICY feed_group_members_delete ON public.feed_group_members FOR DELETE TO authenticated
  USING (((user_id = auth.uid()) AND role <> 'owner')
    OR (public.can_moderate_community_group(group_id) AND role <> 'owner'
      AND NOT public.has_role(user_id, 'pro'::public.app_role)
      AND NOT public.is_current_super_admin()));
DROP POLICY IF EXISTS feed_group_bans_select ON public.feed_group_bans;
CREATE POLICY feed_group_bans_select ON public.feed_group_bans FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_moderate_community_group(group_id));
DROP POLICY IF EXISTS community_appeals_select ON public.community_appeals;
CREATE POLICY community_appeals_select ON public.community_appeals FOR SELECT TO authenticated
  USING (user_id = auth.uid()
    OR (group_id IS NOT NULL AND public.can_moderate_community_group(group_id))
    OR (group_id IS NULL AND public.is_current_super_admin()));
DROP POLICY IF EXISTS charter_select ON public.community_charter_acceptances;
CREATE POLICY charter_select ON public.community_charter_acceptances FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_current_super_admin());
DROP POLICY IF EXISTS community_bans_select ON public.community_bans;
CREATE POLICY community_bans_select ON public.community_bans FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_current_super_admin());
DROP POLICY IF EXISTS feed_reports_select ON public.feed_reports;
CREATE POLICY feed_reports_select ON public.feed_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.is_current_super_admin()
    OR EXISTS (SELECT 1 FROM public.feed_content AS c
      WHERE feed_reports.target_type = 'post' AND c.id = feed_reports.target_id
        AND c.group_id IS NOT NULL AND public.can_moderate_community_group(c.group_id))
    OR EXISTS (SELECT 1 FROM public.feed_comments AS cm
      JOIN public.feed_content AS c ON c.id = cm.content_id
      WHERE feed_reports.target_type = 'comment' AND cm.id = feed_reports.target_id
        AND c.group_id IS NOT NULL AND public.can_moderate_community_group(c.group_id)));
DROP POLICY IF EXISTS feed_reports_delete_pro ON public.feed_reports;
CREATE POLICY feed_reports_delete_pro ON public.feed_reports FOR DELETE TO authenticated
  USING (public.is_current_super_admin()
    OR EXISTS (SELECT 1 FROM public.feed_content AS c
      WHERE feed_reports.target_type = 'post' AND c.id = feed_reports.target_id
        AND c.group_id IS NOT NULL AND public.can_moderate_community_group(c.group_id))
    OR EXISTS (SELECT 1 FROM public.feed_comments AS cm
      JOIN public.feed_content AS c ON c.id = cm.content_id
      WHERE feed_reports.target_type = 'comment' AND cm.id = feed_reports.target_id
        AND c.group_id IS NOT NULL AND public.can_moderate_community_group(c.group_id)));
DROP POLICY IF EXISTS feed_reports_insert ON public.feed_reports;
CREATE POLICY feed_reports_insert ON public.feed_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND is_adult(auth.uid()) AND (
    (target_type = 'post' AND EXISTS (SELECT 1 FROM public.feed_content AS c
      WHERE c.id = target_id AND c.source = 'member' AND public.can_read_feed_content(c.id)))
    OR (target_type = 'comment' AND EXISTS (SELECT 1 FROM public.feed_comments AS cm
      JOIN public.feed_content AS c ON c.id = cm.content_id
      WHERE cm.id = target_id AND c.source = 'member' AND public.can_read_feed_content(c.id)))
  ));

-- Storage object reads (including signed URL creation) follow the visibility
-- of the feed post that references the object. No direct path-based bypass.
DROP POLICY IF EXISTS feed_files_read_authenticated ON storage.objects;
DROP POLICY IF EXISTS feed_files_read_boundary ON storage.objects;
CREATE POLICY feed_files_read_authenticated ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'feed' AND EXISTS (SELECT 1 FROM public.feed_content AS c
    WHERE public.can_read_feed_content(c.id)
      AND (c.image_url = objects.name OR c.video_url = objects.name
        OR split_part(split_part(c.image_url, '/storage/v1/object/public/feed/', 2), '?', 1) = objects.name
        OR split_part(split_part(c.video_url, '/storage/v1/object/public/feed/', 2), '?', 1) = objects.name)));
CREATE POLICY feed_files_read_boundary ON storage.objects AS RESTRICTIVE FOR SELECT TO public
  USING (bucket_id <> 'feed' OR (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.feed_content AS c WHERE public.can_read_feed_content(c.id)
      AND (c.image_url = objects.name OR c.video_url = objects.name
        OR split_part(split_part(c.image_url, '/storage/v1/object/public/feed/', 2), '?', 1) = objects.name
        OR split_part(split_part(c.video_url, '/storage/v1/object/public/feed/', 2), '?', 1) = objects.name))));
DROP POLICY IF EXISTS pro_upload_feed_authenticated ON storage.objects;
CREATE POLICY pro_upload_feed_authenticated ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feed' AND public.has_role(auth.uid(), 'pro'::public.app_role)
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) = ANY (ARRAY[
      'jpg', 'jpeg', 'jpe', 'jfif', 'pjpeg', 'pjp', 'png', 'apng', 'webp', 'gif',
      'bmp', 'dib', 'avif', 'avifs', 'heic', 'heif', 'heics', 'heifs', 'tif', 'tiff',
      'jxl', 'ico', 'cur', 'svg', 'svgz', 'mp4', 'm4v', 'mov', 'qt', 'webm', 'avi',
      'divx', 'xvid', 'mpg', 'mpeg', 'mpe', 'm1v', 'm2v', 'mpv', 'mkv', 'mk3d', 'mks',
      '3gp', '3g2', 'flv', 'f4v', 'wmv', 'asf', 'm2ts', 'mts', 'ts', 'vob', 'ogv', 'ogg',
      'dv', 'rm', 'rmvb', 'yuv', 'pdf'
    ]::text[])
    AND metadata->>'size' IS NOT NULL
    AND (metadata->>'size')::bigint <= 10485760);
DROP POLICY IF EXISTS member_upload_feed_files ON storage.objects;
CREATE POLICY member_upload_feed_files ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feed' AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) = ANY (ARRAY['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf'])
    AND coalesce((metadata ->> 'size')::bigint, 0) <= 5242880
    AND public.can_participate_in_community(auth.uid()));
DROP POLICY IF EXISTS pro_delete_feed_authenticated ON storage.objects;
DROP POLICY IF EXISTS feed_files_delete_group_moderator ON storage.objects;
CREATE POLICY feed_files_delete_group_owner ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'feed' AND EXISTS (SELECT 1 FROM public.feed_content AS c
    WHERE c.group_id IS NOT NULL AND public.can_moderate_community_group(c.group_id)
      AND (c.image_url = objects.name OR c.video_url = objects.name
        OR split_part(split_part(c.image_url, '/storage/v1/object/public/feed/', 2), '?', 1) = objects.name
        OR split_part(split_part(c.video_url, '/storage/v1/object/public/feed/', 2), '?', 1) = objects.name)));
CREATE POLICY feed_files_delete_super_admin ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'feed' AND public.is_current_super_admin());
DROP POLICY IF EXISTS feed_files_delete_own_pro ON storage.objects;
CREATE POLICY feed_files_delete_own_pro ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'feed'
    AND public.has_role(auth.uid(), 'pro'::public.app_role)
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND NOT EXISTS (SELECT 1 FROM public.feed_content AS c
      WHERE c.image_url = objects.name OR c.video_url = objects.name
        OR split_part(split_part(c.image_url, '/storage/v1/object/public/feed/', 2), '?', 1) = objects.name
        OR split_part(split_part(c.video_url, '/storage/v1/object/public/feed/', 2), '?', 1) = objects.name));

-- The professional composer accepts images, videos and PDFs. Professionals
-- receive twice the existing 5 MiB community-member limit. Keep the bucket cap
-- at 10 MiB and enforce the role-specific 5/10 MiB limits in Storage RLS.
UPDATE storage.buckets
   SET file_size_limit = 10485760,
       allowed_mime_types = ARRAY['image/*', 'video/*', 'application/pdf']::text[]
 WHERE id = 'feed';

-- TRUNCATE bypasses RLS and is not needed by browser clients.
REVOKE TRUNCATE ON public.feed_content, public.feed_interactions, public.feed_comments,
  public.feed_reports, public.feed_groups, public.feed_group_members,
  public.community_profiles, public.community_charter_acceptances,
  public.community_bans, public.feed_group_bans, public.community_appeals
  FROM PUBLIC, anon, authenticated;

-- Direct invitations are limited to the group owner or the super admin.
CREATE OR REPLACE FUNCTION public.invite_to_group(p_group uuid, p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE group_name text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_moderate_community_group(p_group) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  SELECT g.name INTO group_name FROM public.feed_groups AS g WHERE g.id = p_group;
  IF group_name IS NULL THEN RAISE EXCEPTION 'group_not_found'; END IF;
  IF p_user IS NULL OR p_user = auth.uid()
     OR EXISTS (SELECT 1 FROM public.profiles AS p WHERE p.id = p_user AND p.role = 'pro'::public.app_role)
     OR NOT private.community_user_can_participate(p_user) THEN
    RAISE EXCEPTION 'not_eligible';
  END IF;
  IF private.community_user_banned_from_groups(p_user)
     OR private.community_user_banned_from_group(p_user, p_group) THEN
    RAISE EXCEPTION 'banned';
  END IF;
  IF private.community_member_access(p_user, p_group) THEN RAISE EXCEPTION 'already_member'; END IF;
  INSERT INTO public.feed_group_members (group_id, user_id, role, status, invited_by)
  VALUES (p_group, p_user, 'member', 'invited', auth.uid())
  ON CONFLICT (group_id, user_id) DO UPDATE
    SET status = 'invited', role = 'member', invited_by = auth.uid();
  PERFORM public.notify_user(p_user, 'group_invite', 'Invitation à rejoindre un groupe',
    'Vous êtes invité(e) à rejoindre le groupe « ' || group_name || ' ». Vous pouvez accepter ou refuser.', '/groups');
END;
$$;
REVOKE ALL ON FUNCTION public.invite_to_group(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_to_group(uuid, uuid) TO authenticated, service_role;

-- Premium group owners can invite by an exact public community pseudo without
-- gaining a directory of private profile fields or all account records.
CREATE OR REPLACE FUNCTION public.search_group_invite_candidate(
  p_group uuid,
  p_exact_pseudo text
)
RETURNS TABLE (user_id uuid, pseudo text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE lookup_pseudo text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_moderate_community_group(p_group) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  lookup_pseudo := pg_catalog.lower(pg_catalog.btrim(coalesce(p_exact_pseudo, '')));
  IF pg_catalog.char_length(lookup_pseudo) < 3 OR pg_catalog.char_length(lookup_pseudo) > 20 THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT cp.user_id, cp.pseudo
      FROM public.community_profiles AS cp
      JOIN public.profiles AS p ON p.id = cp.user_id
     WHERE pg_catalog.lower(cp.pseudo) = lookup_pseudo
       AND cp.user_id <> auth.uid()
       AND p.role IN ('patient'::public.app_role, 'subscriber'::public.app_role)
       AND private.community_user_can_participate(cp.user_id)
       AND NOT private.community_user_banned_from_groups(cp.user_id)
       AND NOT private.community_user_banned_from_group(cp.user_id, p_group)
       AND NOT EXISTS (
         SELECT 1 FROM public.feed_group_members AS m
          WHERE m.group_id = p_group AND m.user_id = cp.user_id
            AND m.status IN ('active', 'invited')
       )
     LIMIT 1;
END;
$$;
REVOKE ALL ON FUNCTION public.search_group_invite_candidate(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_group_invite_candidate(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.regenerate_invite_code(p_group uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE new_code text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_moderate_community_group(p_group) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  new_code := pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 16);
  UPDATE public.feed_groups SET invite_code = new_code WHERE id = p_group;
  IF NOT FOUND THEN RAISE EXCEPTION 'group_not_found'; END IF;
  RETURN new_code;
END;
$$;
REVOKE ALL ON FUNCTION public.regenerate_invite_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regenerate_invite_code(uuid) TO authenticated, service_role;

-- Taking over a group is a global administrative action, not a permission
-- inherited by every professional account.
CREATE OR REPLACE FUNCTION public.take_over_group(p_group uuid, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE old_owner uuid; group_name text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_current_super_admin() THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT g.owner_id, g.name INTO old_owner, group_name
    FROM public.feed_groups AS g WHERE g.id = p_group FOR UPDATE;
  IF old_owner IS NULL THEN RAISE EXCEPTION 'group_not_found'; END IF;
  IF old_owner = auth.uid() THEN RAISE EXCEPTION 'already_owner'; END IF;
  UPDATE public.feed_groups SET owner_id = auth.uid() WHERE id = p_group;
  UPDATE public.feed_group_members SET status = 'banned', role = 'member'
    WHERE group_id = p_group AND user_id = old_owner;
  INSERT INTO public.feed_group_members (group_id, user_id, role, status)
    VALUES (p_group, auth.uid(), 'owner', 'active')
    ON CONFLICT (group_id, user_id) DO UPDATE SET role = 'owner', status = 'active';
  INSERT INTO public.feed_group_bans (group_id, user_id, reason, banned_by)
    VALUES (p_group, old_owner, left(p_reason, 300), auth.uid())
    ON CONFLICT (group_id, user_id) DO UPDATE
      SET reason = excluded.reason, banned_by = excluded.banned_by, created_at = pg_catalog.now();
  PERFORM public.notify_user(old_owner, 'moderation', 'Vous avez été retiré(e) de la responsabilité du groupe',
    'Le super administrateur a repris la gestion du groupe « ' || group_name || ' ».', '/groups');
END;
$$;
REVOKE ALL ON FUNCTION public.take_over_group(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.take_over_group(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ban_group_member(p_group uuid, p_user uuid, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE group_name text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_moderate_community_group(p_group) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles AS p WHERE p.id = p_user AND p.role = 'pro'::public.app_role) OR EXISTS (
    SELECT 1 FROM public.feed_groups AS g WHERE g.id = p_group AND g.owner_id = p_user
  ) OR EXISTS (SELECT 1 FROM private.user_roles AS ur
    WHERE ur.user_id = p_user AND ur.role = 'super_admin') THEN
    RAISE EXCEPTION 'cannot_ban';
  END IF;
  INSERT INTO public.feed_group_bans (group_id, user_id, reason, banned_by)
    VALUES (p_group, p_user, left(p_reason, 300), auth.uid())
    ON CONFLICT (group_id, user_id) DO UPDATE
      SET reason = excluded.reason, banned_by = excluded.banned_by, created_at = pg_catalog.now();
  UPDATE public.feed_group_members SET status = 'banned', role = 'member'
    WHERE group_id = p_group AND user_id = p_user;
  SELECT g.name INTO group_name FROM public.feed_groups AS g WHERE g.id = p_group;
  PERFORM public.notify_user(p_user, 'moderation', 'Vous avez été banni(e) d’un groupe',
    'Vous avez été banni(e) du groupe « ' || coalesce(group_name, '') || ' ». '
      || CASE WHEN nullif(btrim(p_reason), '') IS NOT NULL THEN 'Motif : ' || left(btrim(p_reason), 300) || '. ' ELSE '' END
      || 'Vous pouvez envoyer un message pour demander votre réintégration.', '/groups');
END;
$$;
REVOKE ALL ON FUNCTION public.ban_group_member(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ban_group_member(uuid, uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.unban_group_member(p_group uuid, p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE group_name text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_moderate_community_group(p_group) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  DELETE FROM public.feed_group_bans WHERE group_id = p_group AND user_id = p_user;
  UPDATE public.community_appeals SET status = 'accepted', handled_by = auth.uid(), handled_at = pg_catalog.now()
    WHERE user_id = p_user AND group_id = p_group AND status = 'pending';
  IF NOT private.community_user_banned_from_groups(p_user)
     AND private.community_user_can_participate(p_user) THEN
    INSERT INTO public.feed_group_members (group_id, user_id, role, status)
      VALUES (p_group, p_user, 'member', 'active')
      ON CONFLICT (group_id, user_id) DO UPDATE SET status = 'active';
    SELECT g.name INTO group_name FROM public.feed_groups AS g WHERE g.id = p_group;
    PERFORM public.notify_user(p_user, 'moderation', 'Vous avez été réintégré(e)',
      'Votre bannissement du groupe « ' || coalesce(group_name, '') || ' » a été levé.', '/groups/' || p_group::text);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.unban_group_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unban_group_member(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.answer_appeal(p_appeal uuid, p_accept boolean, p_response text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE appeal_row public.community_appeals%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO appeal_row FROM public.community_appeals WHERE id = p_appeal FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF appeal_row.status <> 'pending' THEN RAISE EXCEPTION 'already_handled'; END IF;
  IF appeal_row.group_id IS NULL THEN
    IF NOT public.is_current_super_admin() THEN RAISE EXCEPTION 'not_allowed'; END IF;
  ELSIF NOT public.can_moderate_community_group(appeal_row.group_id) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  IF p_accept THEN
    IF appeal_row.group_id IS NULL THEN
      PERFORM public.unban_community_member(appeal_row.user_id);
    ELSE
      PERFORM public.unban_group_member(appeal_row.group_id, appeal_row.user_id);
    END IF;
  END IF;
  UPDATE public.community_appeals SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'refused' END,
    response = nullif(btrim(left(p_response, 1000)), ''), handled_by = auth.uid(), handled_at = pg_catalog.now()
    WHERE id = p_appeal;
  IF NOT p_accept OR coalesce(btrim(p_response), '') <> '' THEN
    PERFORM public.notify_user(appeal_row.user_id, 'moderation',
      CASE WHEN p_accept THEN 'Votre demande a été acceptée' ELSE 'Votre demande a été refusée' END,
      CASE WHEN p_accept THEN 'Votre demande de réintégration a été acceptée.' ELSE 'Votre demande de réintégration a été refusée.' END
        || CASE WHEN coalesce(btrim(p_response), '') <> '' THEN ' Réponse : ' || left(btrim(p_response), 300) ELSE '' END,
      '/groups');
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.answer_appeal(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.answer_appeal(uuid, boolean, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ban_community_member(p_user uuid, p_reason text DEFAULT NULL, p_scope text DEFAULT 'all')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_current_super_admin() THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF EXISTS (SELECT 1 FROM private.user_roles AS ur WHERE ur.user_id = p_user AND ur.role = 'super_admin') THEN
    RAISE EXCEPTION 'cannot_ban';
  END IF;
  IF p_scope NOT IN ('all', 'groups') THEN RAISE EXCEPTION 'invalid_scope'; END IF;
  INSERT INTO public.community_bans (user_id, reason, banned_by, scope)
    VALUES (p_user, left(p_reason, 300), auth.uid(), p_scope)
    ON CONFLICT (user_id) DO UPDATE SET reason = excluded.reason, banned_by = excluded.banned_by,
      scope = excluded.scope, created_at = pg_catalog.now();
  UPDATE public.feed_groups SET owner_id = auth.uid() WHERE owner_id = p_user;
  UPDATE public.feed_group_members SET status = 'banned', role = 'member' WHERE user_id = p_user;
  INSERT INTO public.feed_group_members (group_id, user_id, role, status)
    SELECT g.id, auth.uid(), 'owner', 'active' FROM public.feed_groups AS g WHERE g.owner_id = auth.uid()
    ON CONFLICT (group_id, user_id) DO UPDATE SET role = 'owner', status = 'active';
  PERFORM public.notify_user(p_user, 'moderation',
    CASE WHEN p_scope = 'groups' THEN 'Vous avez été banni(e) de tous les groupes' ELSE 'Vous avez été banni(e) de la communauté' END,
    CASE WHEN p_scope = 'groups' THEN 'Vous avez été banni(e) de tous les groupes.'
      ELSE 'Vous avez été banni(e) de la communauté. Vous pouvez envoyer une demande de réintégration.' END
      || CASE WHEN nullif(btrim(p_reason), '') IS NOT NULL THEN ' Motif : ' || left(btrim(p_reason), 300) || '.' ELSE '' END,
    '/groups');
END;
$$;
REVOKE ALL ON FUNCTION public.ban_community_member(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ban_community_member(uuid, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.unban_community_member(p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_current_super_admin() THEN RAISE EXCEPTION 'not_allowed'; END IF;
  DELETE FROM public.community_bans WHERE user_id = p_user;
  UPDATE public.community_appeals SET status = 'accepted', handled_by = auth.uid(), handled_at = pg_catalog.now()
    WHERE user_id = p_user AND group_id IS NULL AND status = 'pending';
  IF private.community_user_can_participate(p_user) THEN
    UPDATE public.feed_group_members AS m SET status = 'active'
     WHERE m.user_id = p_user AND m.status = 'banned'
       AND NOT EXISTS (SELECT 1 FROM public.feed_group_bans AS b
                        WHERE b.group_id = m.group_id AND b.user_id = m.user_id);
  END IF;
  PERFORM public.notify_user(p_user, 'moderation', 'Votre accès a été rétabli',
    'Votre bannissement a été levé. Vous retrouvez vos groupes et pouvez de nouveau participer à la communauté.', '/groups');
END;
$$;
REVOKE ALL ON FUNCTION public.unban_community_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unban_community_member(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.feed_like_counts()
RETURNS TABLE(content_id uuid, likes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT i.content_id, count(*)::bigint
    FROM public.feed_interactions AS i
    JOIN public.feed_content AS c ON c.id = i.content_id AND c.is_published = true
   WHERE i.liked = true AND public.can_read_feed_content(c.id)
   GROUP BY i.content_id;
$$;
REVOKE ALL ON FUNCTION public.feed_like_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feed_like_counts() TO authenticated, service_role;

-- Report and post notifications for a private group go only to that group's
-- group owners and super admins. General-feed notifications keep
-- the existing professional notification behavior.
CREATE OR REPLACE FUNCTION public.notify_pro_member_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pseudo text; group_name text; target_ids uuid[];
BEGIN
  IF NEW.source <> 'member' THEN RETURN NEW; END IF;
  SELECT cp.pseudo INTO pseudo FROM public.community_profiles AS cp WHERE cp.user_id = NEW.author_id;
  IF NEW.group_id IS NULL THEN
    SELECT array_agg(pro.id) INTO target_ids FROM (
      SELECT p.id FROM public.profiles AS p
       WHERE p.role = 'pro'::public.app_role AND p.id <> NEW.author_id
       ORDER BY p.created_at LIMIT 1
    ) AS pro;
  ELSE
    SELECT g.name INTO group_name FROM public.feed_groups AS g WHERE g.id = NEW.group_id;
    SELECT array_agg(DISTINCT recipients.user_id) INTO target_ids FROM (
      SELECT g.owner_id AS user_id FROM public.feed_groups AS g WHERE g.id = NEW.group_id
      UNION ALL
      SELECT ur.user_id FROM private.user_roles AS ur WHERE ur.role = 'super_admin'
    ) AS recipients WHERE recipients.user_id IS NOT NULL AND recipients.user_id <> NEW.author_id;
  END IF;
  IF target_ids IS NOT NULL THEN
    INSERT INTO public.scheduled_notifications
      (user_id, channel, type, title, body, link, payload, scheduled_for, sent_at)
    SELECT recipient_id, 'in_app', 'feed_post',
      CASE WHEN NEW.group_id IS NULL THEN 'Nouvelle publication sur le feed'
        ELSE 'Nouvelle publication dans « ' || coalesce(group_name, 'un groupe') || ' »' END,
      coalesce(pseudo, 'Un membre') || ' : ' || left(coalesce(nullif(NEW.body, ''), NEW.title), 120),
      CASE WHEN NEW.group_id IS NULL THEN '/pro/feed' ELSE '/groups/' || NEW.group_id::text END,
      jsonb_build_object('post_id', NEW.id, 'group_id', NEW.group_id), pg_catalog.now(), pg_catalog.now()
      FROM unnest(target_ids) AS recipients(recipient_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_feed_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE report_count integer; target_group uuid; hidden_now boolean := false; recipients uuid[];
BEGIN
  SELECT count(DISTINCT r.reporter_id) INTO report_count FROM public.feed_reports AS r
   WHERE r.target_type = NEW.target_type AND r.target_id = NEW.target_id;
  IF NEW.target_type = 'comment' THEN
    SELECT c.group_id INTO target_group FROM public.feed_comments AS cm
      JOIN public.feed_content AS c ON c.id = cm.content_id WHERE cm.id = NEW.target_id;
    IF report_count >= 3 THEN
      UPDATE public.feed_comments SET is_hidden = true WHERE id = NEW.target_id AND NOT is_hidden;
      hidden_now := FOUND;
    END IF;
  ELSIF NEW.target_type = 'post' THEN
    SELECT c.group_id INTO target_group FROM public.feed_content AS c WHERE c.id = NEW.target_id;
    IF report_count >= 3 THEN
      UPDATE public.feed_content SET is_published = false
       WHERE id = NEW.target_id AND source = 'member' AND is_published;
      hidden_now := FOUND;
    END IF;
  END IF;
  IF target_group IS NULL THEN
    SELECT array_agg(ur.user_id) INTO recipients FROM private.user_roles AS ur WHERE ur.role = 'super_admin';
  ELSE
    SELECT array_agg(DISTINCT admins.user_id) INTO recipients FROM (
      SELECT g.owner_id AS user_id FROM public.feed_groups AS g WHERE g.id = target_group
      UNION ALL
      SELECT ur.user_id FROM private.user_roles AS ur WHERE ur.role = 'super_admin'
    ) AS admins;
  END IF;
  IF recipients IS NOT NULL AND (report_count = 1 OR hidden_now) THEN
    INSERT INTO public.scheduled_notifications
      (user_id, channel, type, title, body, link, payload, scheduled_for, sent_at)
    SELECT recipient_id, 'in_app', 'report',
      CASE WHEN hidden_now THEN 'Contenu masqué automatiquement' ELSE 'Nouveau signalement' END,
      CASE WHEN hidden_now THEN 'Un contenu a été signalé 3 fois et masqué en attendant votre décision.'
        ELSE 'Un contenu du fil a été signalé par un membre.' END,
      CASE WHEN target_group IS NULL THEN '/pro/feed' ELSE '/groups/' || target_group::text END,
      jsonb_build_object('target_type', NEW.target_type, 'target_id', NEW.target_id),
      pg_catalog.now(), pg_catalog.now()
      FROM unnest(recipients) AS report_recipients(recipient_id);
  END IF;
  RETURN NEW;
END;
$$;

-- These functions are trigger entry points, not PostgREST RPC endpoints.
REVOKE ALL ON FUNCTION public.handle_new_feed_group() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.handle_feed_report() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.notify_pro_member_post() FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
