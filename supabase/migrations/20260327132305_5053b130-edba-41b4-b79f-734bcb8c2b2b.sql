
-- Function to refresh SPR > 30 days notifications
-- Called on demand; creates/removes notifications as needed
CREATE OR REPLACE FUNCTION public.refresh_spr_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  vol RECORD;
  admin_rec RECORD;
  vol_user_id uuid;
  notif_title text;
  notif_message text;
  oldest_date date;
  total_amount numeric;
  charge_count integer;
  first_name text;
BEGIN
  -- For each volunteer with open/partial charges older than 30 days
  FOR vol IN
    SELECT
      v.id AS volunteer_id,
      v.full_name,
      COUNT(*) AS open_count,
      SUM(c.amount) AS total_open,
      MIN(c.business_date) AS oldest_charge_date
    FROM spr_fiado_charges c
    JOIN spr_volunteers v ON v.id = c.volunteer_id
    WHERE c.status IN ('open', 'partial')
      AND c.business_date < CURRENT_DATE - INTERVAL '30 days'
    GROUP BY v.id, v.full_name
  LOOP
    first_name := split_part(vol.full_name, ' ', 1);
    total_amount := vol.total_open;
    charge_count := vol.open_count;
    oldest_date := vol.oldest_charge_date;

    -- Notification for the volunteer user (if linked)
    SELECT id INTO vol_user_id
    FROM profiles
    WHERE volunteer_id = vol.volunteer_id AND role = 'volunteer'::app_role
    LIMIT 1;

    IF vol_user_id IS NOT NULL THEN
      -- Check if there's already an unread notification for this volunteer
      IF NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE user_id = vol_user_id
          AND volunteer_id = vol.volunteer_id
          AND type = 'spr_over_30_days'
          AND is_read = false
      ) THEN
        notif_message := 'Olá, ' || first_name || '. Há um valor em aberto no seu SPR há mais de 30 dias. Estamos deixando este aviso apenas para sua ciência, com tranquilidade.';
        INSERT INTO notifications (user_id, volunteer_id, type, title, message, reference_type)
        VALUES (vol_user_id, vol.volunteer_id, 'spr_over_30_days',
                'Lembrete amigável do SPR', notif_message, 'spr_fiado');
      END IF;
    END IF;

    -- Notification for all admins
    FOR admin_rec IN
      SELECT id FROM profiles WHERE role = 'admin'::app_role AND is_active = true
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE user_id = admin_rec.id
          AND volunteer_id = vol.volunteer_id
          AND type = 'spr_over_30_days'
          AND is_read = false
      ) THEN
        notif_message := vol.full_name || ' possui ' || charge_count || ' lançamento(s) em aberto há mais de 30 dias, totalizando R$ ' || TRIM(to_char(total_amount, '999G999D99')) || '.';
        INSERT INTO notifications (user_id, volunteer_id, type, title, message, reference_type)
        VALUES (admin_rec.id, vol.volunteer_id, 'spr_over_30_days',
                'SPR em aberto há mais de 30 dias', notif_message, 'spr_fiado');
      END IF;
    END LOOP;
  END LOOP;

  -- Clean up: remove unread notifications for volunteers who no longer qualify
  DELETE FROM notifications n
  WHERE n.type = 'spr_over_30_days'
    AND n.is_read = false
    AND NOT EXISTS (
      SELECT 1 FROM spr_fiado_charges c
      WHERE c.volunteer_id = n.volunteer_id
        AND c.status IN ('open', 'partial')
        AND c.business_date < CURRENT_DATE - INTERVAL '30 days'
    );
END;
$$;
