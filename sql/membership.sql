-- =====================================================
-- EliteMC Cooperative - Membership Register
-- Run AFTER schema.sql (and fix_admin_function.sql).
--
-- Flow: apply -> admin approves -> share capital paid -> ACTIVE member
-- Only ACTIVE members can place orders for property lots.
--
-- All writes go through SECURITY DEFINER functions below; there are no
-- INSERT/UPDATE policies on memberships, so users cannot set their own status.
-- =====================================================

CREATE TYPE membership_status_enum AS ENUM ('PENDING', 'APPROVED', 'ACTIVE', 'REJECTED', 'SUSPENDED');

-- Single-row cooperative settings
CREATE TABLE coop_settings (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
    -- TODO: set to the share capital amount defined in the cooperative's registered rules
    share_capital_mur NUMERIC(18,2) NOT NULL CHECK (share_capital_mur > 0),
    min_member_age INTEGER NOT NULL DEFAULT 18 CHECK (min_member_age > 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO coop_settings (share_capital_mur) VALUES (1000.00);

CREATE SEQUENCE member_number_seq START 1;

-- Membership register (one row per applicant/member)
CREATE TABLE memberships (
    user_id UUID PRIMARY KEY REFERENCES profiles(user_id) ON DELETE RESTRICT,
    member_number TEXT UNIQUE, -- Assigned on activation, e.g. EMC-00001
    status membership_status_enum NOT NULL DEFAULT 'PENDING',

    -- Application
    national_id TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    address TEXT NOT NULL,
    rules_accepted_at TIMESTAMPTZ NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Review
    reviewed_by UUID REFERENCES profiles(user_id),
    reviewed_at TIMESTAMPTZ,
    status_reason TEXT, -- Rejection or suspension reason

    -- Share capital
    share_capital_required_mur NUMERIC(18,2),
    share_capital_paid_mur NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (share_capital_paid_mur >= 0),
    share_capital_ref TEXT, -- Latest bank reference (full history in audit_log)
    share_capital_paid_on DATE,
    activated_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (status NOT IN ('ACTIVE', 'SUSPENDED') OR member_number IS NOT NULL),
    CHECK (share_capital_required_mur IS NULL OR share_capital_paid_mur <= share_capital_required_mur)
);

CREATE INDEX idx_memberships_status ON memberships(status);

CREATE TRIGGER update_memberships_updated_at
    BEFORE UPDATE ON memberships
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RLS
-- =====================================================

ALTER TABLE coop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view coop settings"
    ON coop_settings FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can update coop settings"
    ON coop_settings FOR UPDATE
    USING (is_admin());

CREATE POLICY "Users can view their own membership"
    ON memberships FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all memberships"
    ON memberships FOR SELECT
    USING (is_admin());

-- =====================================================
-- FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION is_active_member(p_user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM memberships
        WHERE user_id = p_user_id AND status = 'ACTIVE'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Applicant submits (or resubmits after rejection) a membership application.
-- Also creates the profile and wallet rows if they don't exist yet.
CREATE OR REPLACE FUNCTION submit_membership_application(
    p_full_name TEXT,
    p_phone TEXT,
    p_national_id TEXT,
    p_date_of_birth DATE,
    p_address TEXT,
    p_accept_rules BOOLEAN
)
RETURNS memberships AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_email TEXT;
    v_min_age INTEGER;
    v_existing memberships;
    v_result memberships;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_accept_rules IS NOT TRUE THEN
        RAISE EXCEPTION 'You must accept the cooperative rules to apply';
    END IF;

    IF COALESCE(btrim(p_full_name), '') = ''
       OR COALESCE(btrim(p_national_id), '') = ''
       OR COALESCE(btrim(p_address), '') = ''
       OR p_date_of_birth IS NULL THEN
        RAISE EXCEPTION 'Full name, national ID, date of birth and address are required';
    END IF;

    SELECT min_member_age INTO v_min_age FROM coop_settings;
    IF p_date_of_birth > (CURRENT_DATE - make_interval(years => v_min_age)) THEN
        RAISE EXCEPTION 'Applicants must be at least % years old', v_min_age;
    END IF;

    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

    INSERT INTO profiles (user_id, full_name, email, phone)
    VALUES (v_uid, btrim(p_full_name), v_email, NULLIF(btrim(p_phone), ''))
    ON CONFLICT (user_id) DO UPDATE
        SET full_name = EXCLUDED.full_name,
            phone = COALESCE(EXCLUDED.phone, profiles.phone);

    INSERT INTO fiat_balances (user_id) VALUES (v_uid)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_existing FROM memberships WHERE user_id = v_uid FOR UPDATE;

    IF FOUND THEN
        IF v_existing.status <> 'REJECTED' THEN
            RAISE EXCEPTION 'An application already exists with status %', v_existing.status;
        END IF;

        UPDATE memberships SET
            status = 'PENDING',
            national_id = btrim(p_national_id),
            date_of_birth = p_date_of_birth,
            address = btrim(p_address),
            rules_accepted_at = NOW(),
            applied_at = NOW(),
            reviewed_by = NULL,
            reviewed_at = NULL,
            status_reason = NULL
        WHERE user_id = v_uid
        RETURNING * INTO v_result;
    ELSE
        INSERT INTO memberships (user_id, national_id, date_of_birth, address, rules_accepted_at)
        VALUES (v_uid, btrim(p_national_id), p_date_of_birth, btrim(p_address), NOW())
        RETURNING * INTO v_result;
    END IF;

    INSERT INTO audit_log (actor_user_id, action, target_table, target_id, details)
    VALUES (v_uid, 'membership_apply', 'memberships', v_uid, '{}'::jsonb);

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Admin approves or rejects a PENDING application.
CREATE OR REPLACE FUNCTION review_membership_application(
    p_user_id UUID,
    p_approve BOOLEAN,
    p_reason TEXT DEFAULT NULL
)
RETURNS memberships AS $$
DECLARE
    v_existing memberships;
    v_share_capital NUMERIC(18,2);
    v_result memberships;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    SELECT * INTO v_existing FROM memberships WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Membership application not found';
    END IF;
    IF v_existing.status <> 'PENDING' THEN
        RAISE EXCEPTION 'Only PENDING applications can be reviewed (current: %)', v_existing.status;
    END IF;

    IF p_approve THEN
        SELECT share_capital_mur INTO v_share_capital FROM coop_settings;

        UPDATE memberships SET
            status = 'APPROVED',
            share_capital_required_mur = v_share_capital,
            reviewed_by = auth.uid(),
            reviewed_at = NOW(),
            status_reason = NULL
        WHERE user_id = p_user_id
        RETURNING * INTO v_result;
    ELSE
        IF COALESCE(btrim(p_reason), '') = '' THEN
            RAISE EXCEPTION 'A reason is required to reject an application';
        END IF;

        UPDATE memberships SET
            status = 'REJECTED',
            reviewed_by = auth.uid(),
            reviewed_at = NOW(),
            status_reason = btrim(p_reason)
        WHERE user_id = p_user_id
        RETURNING * INTO v_result;
    END IF;

    INSERT INTO audit_log (actor_user_id, action, target_table, target_id, details)
    VALUES (auth.uid(),
            CASE WHEN p_approve THEN 'membership_approve' ELSE 'membership_reject' END,
            'memberships', p_user_id,
            jsonb_build_object('reason', p_reason, 'share_capital_required_mur', v_share_capital));

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Admin records a share capital payment received by bank transfer.
-- When the full amount is paid, the member becomes ACTIVE and gets a member number.
-- Share capital is kept separate from the fiat wallet: it is not spendable balance.
CREATE OR REPLACE FUNCTION record_share_capital_payment(
    p_user_id UUID,
    p_amount NUMERIC,
    p_bank_ref TEXT,
    p_paid_on DATE
)
RETURNS memberships AS $$
DECLARE
    v_existing memberships;
    v_new_paid NUMERIC(18,2);
    v_result memberships;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be greater than zero';
    END IF;
    IF COALESCE(btrim(p_bank_ref), '') = '' OR p_paid_on IS NULL THEN
        RAISE EXCEPTION 'Bank reference and payment date are required';
    END IF;

    SELECT * INTO v_existing FROM memberships WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Membership not found';
    END IF;
    IF v_existing.status <> 'APPROVED' THEN
        RAISE EXCEPTION 'Share capital can only be recorded for APPROVED applications (current: %)', v_existing.status;
    END IF;

    v_new_paid := v_existing.share_capital_paid_mur + p_amount;
    IF v_new_paid > v_existing.share_capital_required_mur THEN
        RAISE EXCEPTION 'Payment exceeds outstanding share capital (outstanding: MUR %)',
            v_existing.share_capital_required_mur - v_existing.share_capital_paid_mur;
    END IF;

    IF v_new_paid = v_existing.share_capital_required_mur THEN
        UPDATE memberships SET
            share_capital_paid_mur = v_new_paid,
            share_capital_ref = btrim(p_bank_ref),
            share_capital_paid_on = p_paid_on,
            status = 'ACTIVE',
            member_number = 'EMC-' || lpad(nextval('member_number_seq')::text, 5, '0'),
            activated_at = NOW()
        WHERE user_id = p_user_id
        RETURNING * INTO v_result;

        -- Identity was verified during membership review
        UPDATE profiles SET kyc_status = 'APPROVED' WHERE user_id = p_user_id;
    ELSE
        UPDATE memberships SET
            share_capital_paid_mur = v_new_paid,
            share_capital_ref = btrim(p_bank_ref),
            share_capital_paid_on = p_paid_on
        WHERE user_id = p_user_id
        RETURNING * INTO v_result;
    END IF;

    INSERT INTO audit_log (actor_user_id, action, target_table, target_id, details)
    VALUES (auth.uid(), 'membership_share_capital', 'memberships', p_user_id,
            jsonb_build_object('amount_mur', p_amount, 'bank_ref', btrim(p_bank_ref),
                               'paid_on', p_paid_on, 'total_paid_mur', v_new_paid,
                               'member_number', v_result.member_number));

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Admin suspends an ACTIVE member or reinstates a SUSPENDED one.
CREATE OR REPLACE FUNCTION set_membership_suspension(
    p_user_id UUID,
    p_suspend BOOLEAN,
    p_reason TEXT DEFAULT NULL
)
RETURNS memberships AS $$
DECLARE
    v_existing memberships;
    v_result memberships;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    SELECT * INTO v_existing FROM memberships WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Membership not found';
    END IF;

    IF p_suspend THEN
        IF v_existing.status <> 'ACTIVE' THEN
            RAISE EXCEPTION 'Only ACTIVE members can be suspended (current: %)', v_existing.status;
        END IF;
        IF COALESCE(btrim(p_reason), '') = '' THEN
            RAISE EXCEPTION 'A reason is required to suspend a member';
        END IF;

        UPDATE memberships SET status = 'SUSPENDED', status_reason = btrim(p_reason)
        WHERE user_id = p_user_id
        RETURNING * INTO v_result;
    ELSE
        IF v_existing.status <> 'SUSPENDED' THEN
            RAISE EXCEPTION 'Only SUSPENDED members can be reinstated (current: %)', v_existing.status;
        END IF;

        UPDATE memberships SET status = 'ACTIVE', status_reason = NULL
        WHERE user_id = p_user_id
        RETURNING * INTO v_result;
    END IF;

    INSERT INTO audit_log (actor_user_id, action, target_table, target_id, details)
    VALUES (auth.uid(),
            CASE WHEN p_suspend THEN 'membership_suspend' ELSE 'membership_reinstate' END,
            'memberships', p_user_id,
            jsonb_build_object('reason', p_reason));

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION is_active_member(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION submit_membership_application(TEXT, TEXT, TEXT, DATE, TEXT, BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION review_membership_application(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION record_share_capital_payment(UUID, NUMERIC, TEXT, DATE) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION set_membership_suspension(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION is_active_member(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION submit_membership_application(TEXT, TEXT, TEXT, DATE, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION review_membership_application(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION record_share_capital_payment(UUID, NUMERIC, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION set_membership_suspension(UUID, BOOLEAN, TEXT) TO authenticated;

-- =====================================================
-- ORDER ENFORCEMENT
-- Orders created by clients (browser / REST API) are gated at the database,
-- not just the UI:
--  * only ACTIVE members can create orders
--  * price is taken from the property, never from the client
--  * property must be OPEN and the minimum lot purchase respected
-- Trusted backend roles (service_role, SQL editor) are not affected;
-- capture_order re-checks membership before taking payment.
-- =====================================================

CREATE OR REPLACE FUNCTION enforce_order_rules()
RETURNS TRIGGER AS $$
DECLARE
    v_property properties;
BEGIN
    IF current_user NOT IN ('authenticated', 'anon') THEN
        RETURN NEW;
    END IF;

    IF NOT is_active_member(NEW.user_id) THEN
        RAISE EXCEPTION 'Only active cooperative members can purchase lots';
    END IF;

    SELECT * INTO v_property FROM properties WHERE id = NEW.property_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Property not found';
    END IF;
    IF v_property.status <> 'OPEN' THEN
        RAISE EXCEPTION 'Property is not open for purchase';
    END IF;
    IF NEW.lots < v_property.min_lot_purchase THEN
        RAISE EXCEPTION 'Minimum purchase is % lot(s)', v_property.min_lot_purchase;
    END IF;

    NEW.unit_price_mur := v_property.price_per_lot;
    NEW.status := 'PENDING_PAYMENT';
    NEW.paid_at := NULL;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER enforce_order_rules_before_insert
    BEFORE INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION enforce_order_rules();

-- =====================================================
-- PROFILE PROTECTION
-- "Users can update their own profile" previously let users set their own
-- kyc_status. Only admins / backend code may change it now.
-- =====================================================

CREATE OR REPLACE FUNCTION protect_profile_kyc_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.kyc_status IS DISTINCT FROM OLD.kyc_status
       AND current_user IN ('authenticated', 'anon')
       AND NOT is_admin() THEN
        RAISE EXCEPTION 'kyc_status can only be changed by an admin';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_profile_kyc_status_before_update
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION protect_profile_kyc_status();
